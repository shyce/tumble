package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

type RealtimeInterface interface {
	PublishOrderUpdate(userID, orderID int, status, message string, data interface{}) error
	PublishOrderComplete(userID, orderID int) error
}

type OrderHandler struct {
	db       *sql.DB
	realtime RealtimeInterface
	getUserID func(*http.Request, *sql.DB) (int, error)
}

type Order struct {
	ID                   int       `json:"id"`
	UserID               int       `json:"user_id"`
	SubscriptionID       *int      `json:"subscription_id,omitempty"`
	PickupAddressID      int       `json:"pickup_address_id"`
	DeliveryAddressID    int       `json:"delivery_address_id"`
	Status               string    `json:"status"`
	TotalWeight          *float64  `json:"total_weight,omitempty"`
	Subtotal             *float64  `json:"subtotal,omitempty"`
	Tax                  *float64  `json:"tax,omitempty"`
	Total                *float64  `json:"total,omitempty"`
	SpecialInstructions  *string   `json:"special_instructions,omitempty"`
	PickupDate           string    `json:"pickup_date"`
	DeliveryDate         string    `json:"delivery_date"`
	PickupTimeSlot       string    `json:"pickup_time_slot"`
	DeliveryTimeSlot     string    `json:"delivery_time_slot"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
	Items                []OrderItem `json:"items,omitempty"`
	StatusHistory        []OrderStatus `json:"status_history,omitempty"`
}

type OrderItem struct {
	ID        int      `json:"id"`
	OrderID   int      `json:"order_id"`
	ServiceID int      `json:"service_id"`
	ServiceName string  `json:"service_name,omitempty"`
	Quantity  int      `json:"quantity"`
	Weight    *float64 `json:"weight,omitempty"`
	Price     float64  `json:"price"`
	Notes     *string  `json:"notes,omitempty"`
}

type OrderStatus struct {
	ID        int       `json:"id"`
	OrderID   int       `json:"order_id"`
	Status    string    `json:"status"`
	Notes     *string   `json:"notes,omitempty"`
	UpdatedBy *int      `json:"updated_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateOrderRequest struct {
	PickupAddressID     int         `json:"pickup_address_id"`
	DeliveryAddressID   int         `json:"delivery_address_id"`
	PickupDate          string      `json:"pickup_date"`
	DeliveryDate        string      `json:"delivery_date"`
	PickupTimeSlot      string      `json:"pickup_time_slot"`
	DeliveryTimeSlot    string      `json:"delivery_time_slot"`
	SpecialInstructions *string     `json:"special_instructions,omitempty"`
	Items               []OrderItem `json:"items"`
}

func NewOrderHandler(db *sql.DB, realtime RealtimeInterface) *OrderHandler {
	return &OrderHandler{
		db:       db,
		realtime: realtime,
		getUserID: getUserIDFromRequest,
	}
}

// handleCreateOrder creates a new order
func (h *OrderHandler) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check for active subscription and calculate current usage dynamically
	var subscriptionID *int
	var pickupsUsed, pickupsAllowed int
	var bagsUsed, bagsAllowed int
	var subscription struct {
		ID                 int
		PickupsPerMonth    int
		CurrentPeriodStart string
		CurrentPeriodEnd   string
	}
	
	err = h.db.QueryRow(`
		SELECT s.id, p.pickups_per_month, s.current_period_start, s.current_period_end
		FROM subscriptions s
		JOIN subscription_plans p ON s.plan_id = p.id
		WHERE s.user_id = $1 AND s.status = 'active'
		ORDER BY s.created_at DESC
		LIMIT 1`,
		userID,
	).Scan(&subscription.ID, &subscription.PickupsPerMonth, 
		&subscription.CurrentPeriodStart, &subscription.CurrentPeriodEnd)
	
	if err == nil {
		// User has active subscription - calculate current usage dynamically
		subscriptionID = &subscription.ID
		pickupsAllowed = subscription.PickupsPerMonth
		bagsAllowed = subscription.PickupsPerMonth // Same as pickups in current plans
		
		// Count actual pickups (orders) in current period
		err = h.db.QueryRow(`
			SELECT COUNT(DISTINCT o.id)
			FROM orders o
			WHERE o.user_id = $1 
			AND o.subscription_id = $2
			AND o.pickup_date >= $3::date 
			AND o.pickup_date < $4::date
			AND o.status != 'cancelled'`,
			userID, subscription.ID, subscription.CurrentPeriodStart, subscription.CurrentPeriodEnd,
		).Scan(&pickupsUsed)
		
		if err != nil {
			pickupsUsed = 0 // Default to 0 if query fails
		}
		
		// Count actual standard bags covered by subscription in current period
		// Only count bags that were covered (price = 0)
		err = h.db.QueryRow(`
			SELECT COALESCE(SUM(oi.quantity), 0)
			FROM orders o
			JOIN order_items oi ON o.id = oi.order_id
			JOIN services s ON oi.service_id = s.id
			WHERE o.user_id = $1 
			AND o.subscription_id = $2
			AND o.pickup_date >= $3::date 
			AND o.pickup_date < $4::date
			AND o.status != 'cancelled'
			AND s.name = 'standard_bag'
			AND oi.price = 0`,
			userID, subscription.ID, subscription.CurrentPeriodStart, subscription.CurrentPeriodEnd,
		).Scan(&bagsUsed)
		
		if err != nil {
			bagsUsed = 0 // Default to 0 if query fails
		}
	}
	
	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Create order with placeholder totals (will update later)
	var orderID int
	err = tx.QueryRow(`
		INSERT INTO orders (
			user_id, subscription_id, pickup_address_id, delivery_address_id, 
			status, subtotal, tax, total,
			special_instructions, pickup_date, delivery_date,
			pickup_time_slot, delivery_time_slot
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id`,
		userID, subscriptionID, req.PickupAddressID, req.DeliveryAddressID,
		"scheduled", 0, 0, 0, // Placeholder totals
		req.SpecialInstructions, req.PickupDate, req.DeliveryDate,
		req.PickupTimeSlot, req.DeliveryTimeSlot,
	).Scan(&orderID)
	if err != nil {
		http.Error(w, "Failed to create order", http.StatusInternalServerError)
		return
	}

	// Get pickup service ID
	var pickupServiceID int
	err = tx.QueryRow("SELECT id FROM services WHERE name = 'pickup_service'").Scan(&pickupServiceID)
	if err != nil {
		http.Error(w, "Failed to get pickup service", http.StatusInternalServerError)
		return
	}
	
	// Add pickup service as a line item (covered if subscription allows)
	pickupPrice := 10.0 // Default pickup price
	if subscriptionID != nil && pickupsUsed < pickupsAllowed {
		// Pickup is covered by subscription
		pickupPrice = 0.0
	}
	
	_, err = tx.Exec(`
		INSERT INTO order_items (order_id, service_id, quantity, weight, price, notes)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		orderID, pickupServiceID, 1, nil, pickupPrice, "Pickup Service",
	)
	if err != nil {
		http.Error(w, "Failed to create pickup service item", http.StatusInternalServerError)
		return
	}

	// Insert bag items with separate coverage tracking
	remainingBagCoverage := 0
	if subscriptionID != nil {
		// Calculate how many standard bags can be covered (separate from pickup coverage)
		remainingBagCoverage = bagsAllowed - bagsUsed
	}
	
	for _, item := range req.Items {
		// Check if this is a standard bag that can be covered
		var serviceName string
		tx.QueryRow("SELECT name FROM services WHERE id = $1", item.ServiceID).Scan(&serviceName)
		
		if serviceName == "standard_bag" && remainingBagCoverage > 0 {
			// Calculate how many bags from this item can be covered
			bagsCovered := item.Quantity
			if bagsCovered > remainingBagCoverage {
				bagsCovered = remainingBagCoverage
			}
			
			// Insert covered bags as separate line item with $0 price
			if bagsCovered > 0 {
				_, err = tx.Exec(`
					INSERT INTO order_items (order_id, service_id, quantity, weight, price, notes)
					VALUES ($1, $2, $3, $4, $5, $6)`,
					orderID, item.ServiceID, bagsCovered, item.Weight, 0.0, item.Notes,
				)
				if err != nil {
					http.Error(w, "Failed to create covered order items", http.StatusInternalServerError)
					return
				}
				remainingBagCoverage -= bagsCovered
			}
			
			// Insert remaining bags at full price if any
			remainingBags := item.Quantity - bagsCovered
			if remainingBags > 0 {
				_, err = tx.Exec(`
					INSERT INTO order_items (order_id, service_id, quantity, weight, price, notes)
					VALUES ($1, $2, $3, $4, $5, $6)`,
					orderID, item.ServiceID, remainingBags, item.Weight, item.Price, item.Notes,
				)
				if err != nil {
					http.Error(w, "Failed to create charged order items", http.StatusInternalServerError)
					return
				}
			}
		} else {
			// Non-standard bags or no coverage available - insert at full price
			_, err = tx.Exec(`
				INSERT INTO order_items (order_id, service_id, quantity, weight, price, notes)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				orderID, item.ServiceID, item.Quantity, item.Weight, item.Price, item.Notes,
			)
			if err != nil {
				http.Error(w, "Failed to create order items", http.StatusInternalServerError)
				return
			}
		}
	}

	// Add initial status history
	_, err = tx.Exec(`
		INSERT INTO order_status_history (order_id, status, notes, updated_by)
		VALUES ($1, $2, $3, $4)`,
		orderID, "scheduled", "Order created", userID,
	)
	if err != nil {
		http.Error(w, "Failed to create status history", http.StatusInternalServerError)
		return
	}

	// Calculate final totals based on inserted items
	var subtotal float64
	rows, err := tx.Query(`
		SELECT price, quantity FROM order_items WHERE order_id = $1`,
		orderID,
	)
	if err != nil {
		http.Error(w, "Failed to calculate order totals", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	for rows.Next() {
		var price float64
		var quantity int
		if err := rows.Scan(&price, &quantity); err != nil {
			http.Error(w, "Failed to calculate order totals", http.StatusInternalServerError)
			return
		}
		subtotal += price * float64(quantity)
	}
	
	tax := subtotal * 0.08 // 8% tax
	total := subtotal + tax

	// Update the order with correct totals
	_, err = tx.Exec(`
		UPDATE orders 
		SET subtotal = $1, tax = $2, total = $3
		WHERE id = $4`,
		subtotal, tax, total, orderID,
	)
	if err != nil {
		http.Error(w, "Failed to update order totals", http.StatusInternalServerError)
		return
	}

	// No need to update subscription usage counters - we calculate dynamically from orders

	// Commit transaction
	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete order creation", http.StatusInternalServerError)
		return
	}

	// Send real-time notification
	if h.realtime != nil {
		go h.realtime.PublishOrderUpdate(
			userID, orderID, "scheduled",
			"Order created successfully",
			nil,
		)
	}

	// Fetch the created order
	order, err := h.getOrderByID(orderID, userID)
	if err != nil {
		http.Error(w, "Failed to fetch created order", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

// handleGetOrders returns all orders for the authenticated user
func (h *OrderHandler) handleGetOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	status := r.URL.Query().Get("status")
	limit := 50
	offset := 0
	
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}
	
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsedOffset, err := strconv.Atoi(o); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// Build query with calculated totals from order_items
	query := `
		SELECT 
			o.id, o.user_id, o.subscription_id, o.pickup_address_id, o.delivery_address_id,
			o.status, o.total_weight, 
			COALESCE(oi_totals.subtotal, 0) as subtotal,
			ROUND(COALESCE(oi_totals.subtotal, 0) * 0.08, 2) as tax,
			ROUND(COALESCE(oi_totals.subtotal, 0) * 1.08, 2) as total,
			o.special_instructions,
			o.pickup_date, o.delivery_date, o.pickup_time_slot, o.delivery_time_slot,
			o.created_at, o.updated_at
		FROM orders o
		LEFT JOIN (
			SELECT order_id, SUM(price * quantity) as subtotal
			FROM order_items
			GROUP BY order_id
		) oi_totals ON o.id = oi_totals.order_id
		WHERE o.user_id = $1`
	
	args := []interface{}{userID}
	argCount := 1

	if status != "" {
		argCount++
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, status)
	}

	query += " ORDER BY created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount+1, argCount+2)
	args = append(args, limit, offset)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	orders := []Order{}
	for rows.Next() {
		var order Order
		err := rows.Scan(
			&order.ID, &order.UserID, &order.SubscriptionID,
			&order.PickupAddressID, &order.DeliveryAddressID,
			&order.Status, &order.TotalWeight, &order.Subtotal,
			&order.Tax, &order.Total, &order.SpecialInstructions,
			&order.PickupDate, &order.DeliveryDate,
			&order.PickupTimeSlot, &order.DeliveryTimeSlot,
			&order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			http.Error(w, "Failed to parse orders", http.StatusInternalServerError)
			return
		}

		// Fetch order items for each order
		itemRows, err := h.db.Query(`
			SELECT oi.id, oi.order_id, oi.service_id, s.name, oi.quantity, oi.weight, oi.price, oi.notes
			FROM order_items oi
			JOIN services s ON oi.service_id = s.id
			WHERE oi.order_id = $1`,
			order.ID,
		)
		if err == nil {
			order.Items = []OrderItem{}
			for itemRows.Next() {
				var item OrderItem
				err := itemRows.Scan(
					&item.ID, &item.OrderID, &item.ServiceID, &item.ServiceName,
					&item.Quantity, &item.Weight, &item.Price, &item.Notes,
				)
				if err == nil {
					order.Items = append(order.Items, item)
				}
			}
			itemRows.Close()
		}

		orders = append(orders, order)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

// handleGetOrder returns a specific order
func (h *OrderHandler) handleGetOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get order ID from URL path
	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	order, err := h.getOrderByID(orderID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Order not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch order", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

// handleUpdateOrderStatus updates the status of an order
func (h *OrderHandler) handleUpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get order ID from URL path
	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Status string  `json:"status"`
		Notes  *string `json:"notes,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate status
	validStatuses := []string{"pending", "scheduled", "picked_up", "in_process", "ready", "out_for_delivery", "delivered", "cancelled"}
	isValid := false
	for _, s := range validStatuses {
		if req.Status == s {
			isValid = true
			break
		}
	}
	if !isValid {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update order status
	result, err := tx.Exec(`
		UPDATE orders 
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND user_id = $3`,
		req.Status, orderID, userID,
	)
	if err != nil {
		http.Error(w, "Failed to update order", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Add status history
	_, err = tx.Exec(`
		INSERT INTO order_status_history (order_id, status, notes, updated_by)
		VALUES ($1, $2, $3, $4)`,
		orderID, req.Status, req.Notes, userID,
	)
	if err != nil {
		http.Error(w, "Failed to update status history", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete status update", http.StatusInternalServerError)
		return
	}

	// Send real-time notification for status change
	if h.realtime != nil {
		statusMessages := map[string]string{
			"scheduled":        "Order scheduled for pickup",
			"picked_up":        "Laundry picked up by driver",
			"in_process":       "Laundry being processed",
			"ready":            "Laundry ready for delivery",
			"out_for_delivery": "Out for delivery",
			"delivered":        "Delivered successfully",
			"cancelled":        "Order cancelled",
		}
		
		message := statusMessages[req.Status]
		if message == "" {
			message = "Order status updated"
		}
		
		go h.realtime.PublishOrderUpdate(userID, orderID, req.Status, message, nil)
		
		// Send special notifications for certain statuses
		if req.Status == "delivered" {
			go h.realtime.PublishOrderComplete(userID, orderID)
		}
	}

	// Return updated order
	order, err := h.getOrderByID(orderID, userID)
	if err != nil {
		http.Error(w, "Failed to fetch updated order", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

// getOrderByID fetches a complete order with items and status history
func (h *OrderHandler) getOrderByID(orderID, userID int) (*Order, error) {
	var order Order
	err := h.db.QueryRow(`
		SELECT id, user_id, subscription_id, pickup_address_id, delivery_address_id,
			   status, total_weight, subtotal, tax, total, special_instructions,
			   pickup_date, delivery_date, pickup_time_slot, delivery_time_slot,
			   created_at, updated_at
		FROM orders
		WHERE id = $1 AND user_id = $2`,
		orderID, userID,
	).Scan(
		&order.ID, &order.UserID, &order.SubscriptionID,
		&order.PickupAddressID, &order.DeliveryAddressID,
		&order.Status, &order.TotalWeight, &order.Subtotal,
		&order.Tax, &order.Total, &order.SpecialInstructions,
		&order.PickupDate, &order.DeliveryDate,
		&order.PickupTimeSlot, &order.DeliveryTimeSlot,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Fetch order items
	itemRows, err := h.db.Query(`
		SELECT oi.id, oi.order_id, oi.service_id, s.name, oi.quantity, oi.weight, oi.price, oi.notes
		FROM order_items oi
		JOIN services s ON oi.service_id = s.id
		WHERE oi.order_id = $1`,
		orderID,
	)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	order.Items = []OrderItem{}
	for itemRows.Next() {
		var item OrderItem
		err := itemRows.Scan(
			&item.ID, &item.OrderID, &item.ServiceID, &item.ServiceName,
			&item.Quantity, &item.Weight, &item.Price, &item.Notes,
		)
		if err != nil {
			return nil, err
		}
		order.Items = append(order.Items, item)
	}

	// Fetch status history
	statusRows, err := h.db.Query(`
		SELECT id, order_id, status, notes, updated_by, created_at
		FROM order_status_history
		WHERE order_id = $1
		ORDER BY created_at DESC`,
		orderID,
	)
	if err != nil {
		return nil, err
	}
	defer statusRows.Close()

	order.StatusHistory = []OrderStatus{}
	for statusRows.Next() {
		var status OrderStatus
		err := statusRows.Scan(
			&status.ID, &status.OrderID, &status.Status,
			&status.Notes, &status.UpdatedBy, &status.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		order.StatusHistory = append(order.StatusHistory, status)
	}

	return &order, nil
}

// handleGetOrderTracking returns real-time tracking info for an order
func (h *OrderHandler) handleGetOrderTracking(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get order ID from URL path
	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Verify order belongs to user
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND user_id = $2)", orderID, userID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Fetch tracking information
	type TrackingEvent struct {
		ID          string    `json:"id"`
		Status      string    `json:"status"`
		Timestamp   time.Time `json:"timestamp"`
		Description string    `json:"description"`
	}

	rows, err := h.db.Query(`
		SELECT 
			CONCAT('event_', id) as id,
			status,
			created_at as timestamp,
			COALESCE(notes, 
				CASE status
					WHEN 'scheduled' THEN 'Order scheduled'
					WHEN 'picked_up' THEN 'Laundry picked up by driver'
					WHEN 'in_process' THEN 'Laundry being processed'
					WHEN 'ready' THEN 'Laundry ready for delivery'
					WHEN 'out_for_delivery' THEN 'Out for delivery'
					WHEN 'delivered' THEN 'Delivered successfully'
					WHEN 'cancelled' THEN 'Order cancelled'
					ELSE 'Status updated'
				END
			) as description
		FROM order_status_history
		WHERE order_id = $1
		ORDER BY created_at DESC`,
		orderID,
	)
	if err != nil {
		http.Error(w, "Failed to fetch tracking data", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	events := []TrackingEvent{}
	for rows.Next() {
		var event TrackingEvent
		err := rows.Scan(&event.ID, &event.Status, &event.Timestamp, &event.Description)
		if err != nil {
			continue
		}
		events = append(events, event)
	}

	// Get order details for response
	var orderNumber string
	var currentStatus string
	err = h.db.QueryRow(`
		SELECT CONCAT('TUM-', EXTRACT(YEAR FROM created_at), '-', LPAD(id::text, 3, '0')), status
		FROM orders WHERE id = $1`,
		orderID,
	).Scan(&orderNumber, &currentStatus)
	if err != nil {
		orderNumber = fmt.Sprintf("TUM-%d", orderID)
	}

	response := map[string]interface{}{
		"id":             fmt.Sprintf("%d", orderID),
		"orderNumber":    orderNumber,
		"status":         currentStatus,
		"trackingEvents": events,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}