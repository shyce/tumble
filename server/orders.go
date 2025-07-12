package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/checkout/session"
	"github.com/stripe/stripe-go/v82/customer"
	"github.com/stripe/stripe-go/v82/price"
	"github.com/stripe/stripe-go/v82/product"
)

// Helper functions to convert between cents and dollars
func centsToDollars(cents int) float64 {
	return float64(cents) / 100.0
}

func dollarsToCents(dollars float64) int {
	return int(math.Round(dollars * 100))
}

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
	Subtotal             *float64  `json:"subtotal,omitempty"` // Convert from cents for JSON
	Tax                  *float64  `json:"tax,omitempty"`      // Convert from cents for JSON
	Tip                  *float64  `json:"tip,omitempty"`      // Convert from cents for JSON
	Total                *float64  `json:"total,omitempty"`    // Convert from cents for JSON
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
	Price     float64  `json:"price"` // Convert from cents for JSON
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
	Tip                 float64     `json:"tip,omitempty"`
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
			AND oi.price_cents = 0`,
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
			status, subtotal_cents, tax_cents, tip_cents, total_cents,
			special_instructions, pickup_date, delivery_date,
			pickup_time_slot, delivery_time_slot
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id`,
		userID, subscriptionID, req.PickupAddressID, req.DeliveryAddressID,
		"scheduled", 0, 0, dollarsToCents(req.Tip), 0, // Placeholder totals in cents
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
	
	// Add pickup service as a line item
	// For pay-as-you-go: pickup is included in bag price (no separate fee)
	// For subscribers: pickup is free within quota, $10 if over quota
	pickupPrice := 0.0
	pickupNote := "Pickup Service"
	
	if subscriptionID != nil {
		// Subscriber - check if they're over quota
		if pickupsUsed >= pickupsAllowed {
			// Over quota - charge pickup fee
			pickupPrice = 10.0
			pickupNote = "Pickup Service (Over Quota)"
		} else {
			// Within quota - free
			pickupNote = "Pickup Service (Included)"
		}
	} else {
		// Pay-as-you-go - pickup included in bag price
		pickupNote = "Pickup Service (Included)"
	}
	
	_, err = tx.Exec(`
		INSERT INTO order_items (order_id, service_id, quantity, weight, price_cents, notes)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		orderID, pickupServiceID, 1, nil, dollarsToCents(pickupPrice), pickupNote,
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
					INSERT INTO order_items (order_id, service_id, quantity, weight, price_cents, notes)
					VALUES ($1, $2, $3, $4, $5, $6)`,
					orderID, item.ServiceID, bagsCovered, item.Weight, 0, item.Notes,
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
					INSERT INTO order_items (order_id, service_id, quantity, weight, price_cents, notes)
					VALUES ($1, $2, $3, $4, $5, $6)`,
					orderID, item.ServiceID, remainingBags, item.Weight, dollarsToCents(item.Price), item.Notes,
				)
				if err != nil {
					http.Error(w, "Failed to create charged order items", http.StatusInternalServerError)
					return
				}
			}
		} else {
			// Non-standard bags or no coverage available - insert at full price
			_, err = tx.Exec(`
				INSERT INTO order_items (order_id, service_id, quantity, weight, price_cents, notes)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				orderID, item.ServiceID, item.Quantity, item.Weight, dollarsToCents(item.Price), item.Notes,
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
	var subtotalCents int
	rows, err := tx.Query(`
		SELECT price_cents, quantity FROM order_items WHERE order_id = $1`,
		orderID,
	)
	if err != nil {
		http.Error(w, "Failed to calculate order totals", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	for rows.Next() {
		var priceCents int
		var quantity int
		if err := rows.Scan(&priceCents, &quantity); err != nil {
			http.Error(w, "Failed to calculate order totals", http.StatusInternalServerError)
			return
		}
		subtotalCents += priceCents * quantity
	}
	
	tipCents := dollarsToCents(req.Tip)
	// Note: tax will be calculated by Stripe automatically, so we store subtotal + tip for now
	totalCents := subtotalCents + tipCents

	// Update the order with subtotal and tip (tax will be handled by Stripe)
	_, err = tx.Exec(`
		UPDATE orders 
		SET subtotal_cents = $1, tip_cents = $2, total_cents = $3
		WHERE id = $4`,
		subtotalCents, tipCents, totalCents, orderID,
	)
	if err != nil {
		http.Error(w, "Failed to update order totals", http.StatusInternalServerError)
		return
	}

	// Commit transaction first to ensure order exists
	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete order creation", http.StatusInternalServerError)
		return
	}

	// Process payment if there's a charge (after order is committed)
	var paymentIntentID *string
	subtotalDollars := centsToDollars(subtotalCents)
	tipDollars := centsToDollars(tipCents)
	if subtotalCents > 0 || tipCents > 0 {
		// Create payment intent for the order (Stripe will calculate tax automatically)
		paymentID, _, _, err := h.createOrderPaymentIntent(userID, orderID, subtotalDollars, tipDollars)
		if err != nil {
			http.Error(w, fmt.Sprintf("Payment processing failed: %v", err), http.StatusPaymentRequired)
			return
		}
		paymentIntentID = &paymentID
		
		// Note: Tax will be calculated automatically by Stripe
		// We don't need to update the order record here since tax is handled at payment time
		
		// Note: Order remains 'scheduled' until payment is completed via webhook
		// The payment intent creation is sufficient to track payment requirement
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
	response := map[string]interface{}{
		"order": order,
		"requires_payment": totalCents > 0,
	}
	
	if paymentIntentID != nil {
		// For orders requiring payment, return checkout URL
		response["checkout_url"] = *paymentIntentID
	}
	
	json.NewEncoder(w).Encode(response)
}

// createOrderPaymentIntent creates a Stripe payment intent for the order with automatic tax calculation
func (h *OrderHandler) createOrderPaymentIntent(userID, orderID int, subtotal, tip float64) (string, float64, float64, error) {
	// Initialize Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	
	// Get or create Stripe customer ID
	stripeCustomerID, err := h.getOrCreateStripeCustomer(userID)
	if err != nil {
		return "", 0, 0, fmt.Errorf("failed to get/create customer: %v", err)
	}
	
	// Get order items from database to create proper line items
	orderItems, err := h.getOrderItemsForStripe(orderID)
	if err != nil {
		return "", 0, 0, fmt.Errorf("failed to get order items: %v", err)
	}
	
	// Create line items from actual order items
	var lineItems []*stripe.CheckoutSessionLineItemParams
	
	for _, item := range orderItems {
		// Get or create Stripe price for this service
		priceID, err := h.getOrCreateStripePriceForService(item.ServiceName, item.Price)
		if err != nil {
			return "", 0, 0, fmt.Errorf("failed to create Stripe price for %s: %v", item.ServiceName, err)
		}
		
		lineItems = append(lineItems, &stripe.CheckoutSessionLineItemParams{
			Price:    stripe.String(priceID),
			Quantity: stripe.Int64(int64(item.Quantity)),
		})
	}
	
	// Add tip as a separate line item if there's a tip
	// Use a single tip product with dynamic pricing to avoid duplicate products
	if tip > 0 {
		tipPriceID, err := h.getOrCreateTipPrice(tip)
		if err != nil {
			return "", 0, 0, fmt.Errorf("failed to create Stripe tip price: %v", err)
		}
		
		lineItems = append(lineItems, &stripe.CheckoutSessionLineItemParams{
			Price:    stripe.String(tipPriceID),
			Quantity: stripe.Int64(1),
		})
	}
	
	// Create checkout session with automatic tax
	checkoutParams := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		LineItems:          lineItems,
		Mode:               stripe.String(string(stripe.CheckoutSessionModePayment)),
		SuccessURL:         stripe.String("https://tumble.royer.app/dashboard/orders/" + strconv.Itoa(orderID) + "?success=true"),
		CancelURL:          stripe.String("https://tumble.royer.app/dashboard/schedule?canceled=true"),
		BillingAddressCollection: stripe.String("required"),
		AutomaticTax: &stripe.CheckoutSessionAutomaticTaxParams{
			Enabled: stripe.Bool(true),
		},
		Metadata: map[string]string{
			"order_id": strconv.Itoa(orderID),
			"user_id":  strconv.Itoa(userID),
		},
	}
	
	// Add customer if available
	if stripeCustomerID != "" {
		checkoutParams.Customer = stripe.String(stripeCustomerID)
		// Customer address will be automatically populated from Stripe customer record
	}
	
	checkoutSession, err := session.New(checkoutParams)
	if err != nil {
		return "", 0, 0, fmt.Errorf("failed to create checkout session: %v", err)
	}
	
	// Log successful checkout session creation
	fmt.Printf("Created checkout session %s with automatic tax enabled and customer %s\n", checkoutSession.ID, stripeCustomerID)
	
	// Store payment record in database (Stripe will calculate final amount with tax)
	_, err = h.db.Exec(`
		INSERT INTO payments (user_id, order_id, amount_cents, payment_type, status, stripe_payment_intent_id)
		VALUES ($1, $2, $3, 'extra_order', 'pending', $4)
	`, userID, orderID, dollarsToCents(subtotal + tip), checkoutSession.ID)
	
	if err != nil {
		return "", 0, 0, fmt.Errorf("failed to record payment: %v", err)
	}
	
	// Return checkout session URL - Stripe will calculate final tax and total automatically
	return checkoutSession.URL, 0, subtotal + tip, nil
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

	// Build query using stored totals from orders table
	query := `
		SELECT 
			o.id, o.user_id, o.subscription_id, o.pickup_address_id, o.delivery_address_id,
			o.status, o.total_weight, 
			o.subtotal_cents, o.tax_cents, o.tip_cents, o.total_cents,
			o.special_instructions,
			o.pickup_date, o.delivery_date, o.pickup_time_slot, o.delivery_time_slot,
			o.created_at, o.updated_at
		FROM orders o
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
		var subtotalCents, taxCents, tipCents, totalCents sql.NullInt64
		err := rows.Scan(
			&order.ID, &order.UserID, &order.SubscriptionID,
			&order.PickupAddressID, &order.DeliveryAddressID,
			&order.Status, &order.TotalWeight, &subtotalCents,
			&taxCents, &tipCents, &totalCents, &order.SpecialInstructions,
			&order.PickupDate, &order.DeliveryDate,
			&order.PickupTimeSlot, &order.DeliveryTimeSlot,
			&order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			http.Error(w, "Failed to parse orders", http.StatusInternalServerError)
			return
		}

		// Convert cents to dollars for JSON response
		if subtotalCents.Valid {
			subtotal := centsToDollars(int(subtotalCents.Int64))
			order.Subtotal = &subtotal
		}
		if taxCents.Valid {
			tax := centsToDollars(int(taxCents.Int64))
			order.Tax = &tax
		}
		if tipCents.Valid {
			tip := centsToDollars(int(tipCents.Int64))
			order.Tip = &tip
		}
		if totalCents.Valid {
			total := centsToDollars(int(totalCents.Int64))
			order.Total = &total
		}

		// Fetch order items for each order
		itemRows, err := h.db.Query(`
			SELECT oi.id, oi.order_id, oi.service_id, s.name, oi.quantity, oi.weight, oi.price_cents, oi.notes
			FROM order_items oi
			JOIN services s ON oi.service_id = s.id
			WHERE oi.order_id = $1`,
			order.ID,
		)
		if err == nil {
			order.Items = []OrderItem{}
			for itemRows.Next() {
				var item OrderItem
				var priceCents int
				err := itemRows.Scan(
					&item.ID, &item.OrderID, &item.ServiceID, &item.ServiceName,
					&item.Quantity, &item.Weight, &priceCents, &item.Notes,
				)
				if err == nil {
					// Convert cents to dollars for JSON response
					item.Price = centsToDollars(priceCents)
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
	var subtotalCents, taxCents, tipCents, totalCents sql.NullInt64
	err := h.db.QueryRow(`
		SELECT id, user_id, subscription_id, pickup_address_id, delivery_address_id,
			   status, total_weight, subtotal_cents, tax_cents, tip_cents, total_cents, special_instructions,
			   pickup_date, delivery_date, pickup_time_slot, delivery_time_slot,
			   created_at, updated_at
		FROM orders
		WHERE id = $1 AND user_id = $2`,
		orderID, userID,
	).Scan(
		&order.ID, &order.UserID, &order.SubscriptionID,
		&order.PickupAddressID, &order.DeliveryAddressID,
		&order.Status, &order.TotalWeight, &subtotalCents,
		&taxCents, &tipCents, &totalCents, &order.SpecialInstructions,
		&order.PickupDate, &order.DeliveryDate,
		&order.PickupTimeSlot, &order.DeliveryTimeSlot,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Convert cents to dollars for JSON response
	if subtotalCents.Valid {
		subtotal := centsToDollars(int(subtotalCents.Int64))
		order.Subtotal = &subtotal
	}
	if taxCents.Valid {
		tax := centsToDollars(int(taxCents.Int64))
		order.Tax = &tax
	}
	if tipCents.Valid {
		tip := centsToDollars(int(tipCents.Int64))
		order.Tip = &tip
	}
	if totalCents.Valid {
		total := centsToDollars(int(totalCents.Int64))
		order.Total = &total
	}

	// Fetch order items
	itemRows, err := h.db.Query(`
		SELECT oi.id, oi.order_id, oi.service_id, s.name, oi.quantity, oi.weight, oi.price_cents, oi.notes
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
		var priceCents int
		err := itemRows.Scan(
			&item.ID, &item.OrderID, &item.ServiceID, &item.ServiceName,
			&item.Quantity, &item.Weight, &priceCents, &item.Notes,
		)
		if err != nil {
			return nil, err
		}
		// Convert cents to dollars for JSON response
		item.Price = centsToDollars(priceCents)
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

// getOrCreateStripeProduct creates or retrieves a Stripe product for laundry services
func (h *OrderHandler) getOrCreateStripeProduct(name, description string) (string, error) {
	// Create product
	productParams := &stripe.ProductParams{
		Name: stripe.String(name),
		Description: stripe.String(description),
		Type: stripe.String("service"),
	}
	
	prod, err := product.New(productParams)
	if err != nil {
		return "", err
	}

	return prod.ID, nil
}

// getOrderItemsForStripe gets order items with their details for Stripe checkout
func (h *OrderHandler) getOrderItemsForStripe(orderID int) ([]struct {
	ServiceName string
	Quantity    int
	Price       float64
}, error) {
	rows, err := h.db.Query(`
		SELECT s.description, oi.quantity, oi.price_cents
		FROM order_items oi
		JOIN services s ON oi.service_id = s.id
		WHERE oi.order_id = $1 AND oi.price_cents > 0`,
		orderID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []struct {
		ServiceName string
		Quantity    int
		Price       float64
	}

	for rows.Next() {
		var item struct {
			ServiceName string
			Quantity    int
			Price       float64
		}
		var priceCents int
		err := rows.Scan(&item.ServiceName, &item.Quantity, &priceCents)
		if err != nil {
			return nil, err
		}
		item.Price = centsToDollars(priceCents)
		items = append(items, item)
	}

	return items, nil
}

// getOrCreateStripePriceForService creates a Stripe price for a specific service and amount
func (h *OrderHandler) getOrCreateStripePriceForService(serviceName string, amount float64) (string, error) {
	// Service name is already the description from the query, so use it directly
	productName := "Tumble " + serviceName
	amountCents := int64(math.Round(amount * 100))
	
	// Use metadata to find existing products reliably
	serviceKey := serviceName // Use service name as unique key
	productSearchParams := &stripe.ProductSearchParams{
		SearchParams: stripe.SearchParams{
			Query: `metadata["service_key"]:"` + serviceKey + `"`,
			Limit: stripe.Int64(1),
		},
	}
	
	searchResult := product.Search(productSearchParams)
	var prod *stripe.Product
	
	// If product exists, use it
	if searchResult.Next() {
		prod = searchResult.Product()
	} else {
		// Create new product with metadata for reliable identification
		productParams := &stripe.ProductParams{
			Name:    stripe.String(productName),
			TaxCode: stripe.String("txcd_20090012"), // Linen Services - Laundry only
			Metadata: map[string]string{
				"service_key": serviceKey,
				"type":        "tumble_service",
			},
		}
		
		var err error
		prod, err = product.New(productParams)
		if err != nil {
			return "", err
		}
	}

	// Look for existing price with the same amount using List API
	priceListParams := &stripe.PriceListParams{
		Product: stripe.String(prod.ID),
	}
	priceListParams.Limit = stripe.Int64(10) // List a few prices to find matching amount
	
	priceList := price.List(priceListParams)
	
	// Check if any existing price has the same amount
	for priceList.Next() {
		existingPrice := priceList.Price()
		if existingPrice.UnitAmount == amountCents {
			return existingPrice.ID, nil
		}
	}

	// Create new price
	priceParams := &stripe.PriceParams{
		Product:     stripe.String(prod.ID),
		UnitAmount:  stripe.Int64(amountCents),
		Currency:    stripe.String("usd"),
		TaxBehavior: stripe.String("exclusive"), // Tax is calculated on top of the price
	}

	p, err := price.New(priceParams)
	if err != nil {
		return "", err
	}

	return p.ID, nil
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

// getOrCreateStripeCustomer creates or retrieves a Stripe customer for the user
func (h *OrderHandler) getOrCreateStripeCustomer(userID int) (string, error) {
	// Check if customer already exists
	var stripeCustomerID sql.NullString
	var email, firstName, lastName string
	
	err := h.db.QueryRow(`
		SELECT stripe_customer_id, email, first_name, last_name 
		FROM users WHERE id = $1
	`, userID).Scan(&stripeCustomerID, &email, &firstName, &lastName)
	
	if err != nil {
		return "", fmt.Errorf("error querying user %d from database: %v", userID, err)
	}

	// If customer exists, check if it has an address and update if needed
	if stripeCustomerID.Valid && stripeCustomerID.String != "" {
		// Get user's default address
		var streetAddress, city, state, zipCode sql.NullString
		err = h.db.QueryRow(`
			SELECT street_address, city, state, zip_code 
			FROM addresses 
			WHERE user_id = $1 AND is_default = true
			LIMIT 1
		`, userID).Scan(&streetAddress, &city, &state, &zipCode)
		
		// If we have a valid address, try to update the existing Stripe customer
		if err == nil && streetAddress.Valid && city.Valid && state.Valid && zipCode.Valid {
			updateParams := &stripe.CustomerParams{
				Address: &stripe.AddressParams{
					Line1:      stripe.String(streetAddress.String),
					City:       stripe.String(city.String),
					State:      stripe.String(state.String),
					PostalCode: stripe.String(zipCode.String),
					Country:    stripe.String("US"),
				},
			}
			_, updateErr := customer.Update(stripeCustomerID.String, updateParams)
			if updateErr != nil {
				// Customer doesn't exist in Stripe, clear the stale ID and create new one
				h.db.Exec("UPDATE users SET stripe_customer_id = NULL WHERE id = $1", userID)
				// Fall through to create new customer
			} else {
				return stripeCustomerID.String, nil
			}
		} else {
			// Try to verify customer exists by fetching it
			_, fetchErr := customer.Get(stripeCustomerID.String, nil)
			if fetchErr != nil {
				// Customer doesn't exist, clear stale ID and create new one
				h.db.Exec("UPDATE users SET stripe_customer_id = NULL WHERE id = $1", userID)
				// Fall through to create new customer
			} else {
				return stripeCustomerID.String, nil
			}
		}
	}

	// Get user's default address for new customer creation
	var streetAddress, city, state, zipCode sql.NullString
	err = h.db.QueryRow(`
		SELECT street_address, city, state, zip_code 
		FROM addresses 
		WHERE user_id = $1 AND is_default = true
		LIMIT 1
	`, userID).Scan(&streetAddress, &city, &state, &zipCode)

	// Check if user has a valid default address
	if err == sql.ErrNoRows || !streetAddress.Valid || !city.Valid || !state.Valid || !zipCode.Valid {
		return "", fmt.Errorf("no_default_address")
	}

	// Create new Stripe customer with address for tax calculation
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Name:  stripe.String(firstName + " " + lastName),
		Address: &stripe.AddressParams{
			Line1:      stripe.String(streetAddress.String),
			City:       stripe.String(city.String),
			State:      stripe.String(state.String),
			PostalCode: stripe.String(zipCode.String),
			Country:    stripe.String("US"),
		},
		Metadata: map[string]string{
			"user_id": strconv.Itoa(userID),
		},
	}

	c, err := customer.New(params)
	if err != nil {
		return "", fmt.Errorf("error creating Stripe customer for user %d: %v", userID, err)
	}

	// Save Stripe customer ID
	_, err = h.db.Exec(`
		UPDATE users SET stripe_customer_id = $1 WHERE id = $2
	`, c.ID, userID)
	
	if err != nil {
		return "", err
	}

	return c.ID, nil
}

// getOrCreateTipPrice creates a one-time price for tips, reusing a single tip product
func (h *OrderHandler) getOrCreateTipPrice(tipAmount float64) (string, error) {
	tipAmountCents := int64(math.Round(tipAmount * 100))
	
	// Get or create a single "Driver Tip" product 
	tipProductID, err := h.getOrCreateTipProduct()
	if err != nil {
		return "", err
	}
	
	// Create a one-time price for this specific tip amount
	// We don't need to search for existing tip prices since tips are usually unique amounts
	priceParams := &stripe.PriceParams{
		Product:     stripe.String(tipProductID),
		UnitAmount:  stripe.Int64(tipAmountCents),
		Currency:    stripe.String("usd"),
		TaxBehavior: stripe.String("inclusive"), // Tips are usually not taxed
		Metadata: map[string]string{
			"type": "driver_tip",
		},
	}

	p, err := price.New(priceParams)
	if err != nil {
		return "", err
	}
	
	return p.ID, nil
}

// getOrCreateTipProduct gets or creates a single reusable "Driver Tip" product
func (h *OrderHandler) getOrCreateTipProduct() (string, error) {
	// Search for existing tip product using metadata
	productSearchParams := &stripe.ProductSearchParams{
		SearchParams: stripe.SearchParams{
			Query: `metadata["type"]:"driver_tip"`,
			Limit: stripe.Int64(1),
		},
	}
	
	searchResult := product.Search(productSearchParams)
	
	// If tip product exists, use it
	if searchResult.Next() {
		prod := searchResult.Product()
		return prod.ID, nil
	}
	
	// Create single tip product that can be reused with different prices
	productParams := &stripe.ProductParams{
		Name:        stripe.String("Driver Tip"),
		Description: stripe.String("Gratuity for Tumble drivers"),
		Metadata: map[string]string{
			"type": "driver_tip",
		},
		// Tips usually don't have tax codes since they're gratuity
	}
	
	prod, err := product.New(productParams)
	if err != nil {
		return "", err
	}
	
	return prod.ID, nil
}