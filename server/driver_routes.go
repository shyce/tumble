package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
)

type DriverRouteHandler struct {
	db        *sql.DB
	realtime  RealtimeInterface
	getUserID func(*http.Request, *sql.DB) (int, error)
}

func NewDriverRouteHandler(db *sql.DB, realtime RealtimeInterface) *DriverRouteHandler {
	return &DriverRouteHandler{
		db:        db,
		realtime:  realtime,
		getUserID: getUserIDFromRequest,
	}
}

type DriverRoute struct {
	ID           int                    `json:"id"`
	DriverID     int                    `json:"driver_id"`
	RouteDate    string                 `json:"route_date"`
	RouteType    string                 `json:"route_type"`
	Status       string                 `json:"status"`
	Orders       []RouteOrder           `json:"orders"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

type RouteOrder struct {
	ID             int     `json:"id"`
	OrderID        int     `json:"order_id"`
	SequenceNumber int     `json:"sequence_number"`
	Status         string  `json:"status"`
	CustomerName   string  `json:"customer_name"`
	CustomerPhone  string  `json:"customer_phone"`
	Address        string  `json:"address"`
	SpecialInstructions *string `json:"special_instructions,omitempty"`
	PickupTimeSlot *string `json:"pickup_time_slot,omitempty"`
	DeliveryTimeSlot *string `json:"delivery_time_slot,omitempty"`
}

// requireDriver middleware
func (h *DriverRouteHandler) requireDriver(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := h.getUserID(r, h.db)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var role string
		err = h.db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&role)
		if err != nil || role != "driver" {
			http.Error(w, "Forbidden - Driver access required", http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// handleGetDriverRoutes returns routes assigned to the driver
func (h *DriverRouteHandler) handleGetDriverRoutes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	driverID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}


	date := r.URL.Query().Get("date")
	var query string
	var rows *sql.Rows
	
	if date == "" {
		// If no date specified, show all upcoming routes (today and future)
		query = `
			SELECT id, driver_id, route_date, route_type, status, created_at, created_at as updated_at
			FROM driver_routes
			WHERE driver_id = $1 AND DATE(route_date) >= CURRENT_DATE
			ORDER BY route_date ASC, created_at ASC
		`
		rows, err = h.db.Query(query, driverID)
	} else {
		// If date specified, show routes for that specific date
		query = `
			SELECT id, driver_id, route_date, route_type, status, created_at, created_at as updated_at
			FROM driver_routes
			WHERE driver_id = $1 AND DATE(route_date) = $2
			ORDER BY created_at ASC
		`
		rows, err = h.db.Query(query, driverID, date)
	}
	if err != nil {
		http.Error(w, "Failed to fetch routes", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	routes := []DriverRoute{}
	for rows.Next() {
		var route DriverRoute
		err := rows.Scan(
			&route.ID, &route.DriverID, &route.RouteDate, &route.RouteType,
			&route.Status, &route.CreatedAt, &route.UpdatedAt,
		)
		if err != nil {
			continue
		}

		// Get orders for this route
		route.Orders, _ = h.getRouteOrders(route.ID)
		routes = append(routes, route)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(routes)
}

// getRouteOrders fetches orders for a specific route
func (h *DriverRouteHandler) getRouteOrders(routeID int) ([]RouteOrder, error) {
	query := `
		SELECT 
			ro.id, ro.order_id, ro.sequence_number, ro.status,
			u.first_name || ' ' || u.last_name as customer_name,
			COALESCE(u.phone, '') as customer_phone,
			CASE 
				WHEN o.pickup_address_id IS NOT NULL THEN 
					(SELECT street_address || ', ' || city || ', ' || state || ' ' || zip_code 
					 FROM addresses WHERE id = o.pickup_address_id)
				ELSE 
					(SELECT street_address || ', ' || city || ', ' || state || ' ' || zip_code 
					 FROM addresses WHERE id = o.delivery_address_id)
			END as address,
			o.special_instructions,
			o.pickup_time_slot,
			o.delivery_time_slot
		FROM route_orders ro
		JOIN orders o ON ro.order_id = o.id
		JOIN users u ON o.user_id = u.id
		WHERE ro.route_id = $1
		ORDER BY ro.sequence_number ASC
	`

	rows, err := h.db.Query(query, routeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []RouteOrder{}
	for rows.Next() {
		var order RouteOrder
		err := rows.Scan(
			&order.ID, &order.OrderID, &order.SequenceNumber, &order.Status,
			&order.CustomerName, &order.CustomerPhone, &order.Address,
			&order.SpecialInstructions, &order.PickupTimeSlot, &order.DeliveryTimeSlot,
		)
		if err != nil {
			// Log error for debugging - likely NULL values in optional fields
			continue
		}
		orders = append(orders, order)
	}

	return orders, nil
}

// handleUpdateRouteOrderStatus updates the status of an order in a route
func (h *DriverRouteHandler) handleUpdateRouteOrderStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	driverID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	routeOrderIDStr := r.URL.Query().Get("id")
	if routeOrderIDStr == "" {
		http.Error(w, "Route order ID required", http.StatusBadRequest)
		return
	}

	routeOrderID, err := strconv.Atoi(routeOrderIDStr)
	if err != nil {
		http.Error(w, "Invalid route order ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate status (must match database constraint)
	validStatuses := []string{"pending", "completed", "failed"}
	isValid := false
	for _, status := range validStatuses {
		if req.Status == status {
			isValid = true
			break
		}
	}
	if !isValid {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	// Verify this route order belongs to the driver
	var routeDriverID int
	err = h.db.QueryRow(`
		SELECT dr.driver_id 
		FROM route_orders ro 
		JOIN driver_routes dr ON ro.route_id = dr.id 
		WHERE ro.id = $1
	`, routeOrderID).Scan(&routeDriverID)

	if err != nil {
		http.Error(w, "Route order not found", http.StatusNotFound)
		return
	}

	if routeDriverID != driverID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update route order status
	_, err = tx.Exec("UPDATE route_orders SET status = $1 WHERE id = $2", req.Status, routeOrderID)
	if err != nil {
		http.Error(w, "Failed to update status", http.StatusInternalServerError)
		return
	}

	// If completed, also update the main order status
	if req.Status == "completed" {
		var orderID int
		var routeType string
		err = tx.QueryRow(`
			SELECT ro.order_id, dr.route_type 
			FROM route_orders ro 
			JOIN driver_routes dr ON ro.route_id = dr.id 
			WHERE ro.id = $1
		`, routeOrderID).Scan(&orderID, &routeType)

		if err == nil {
			var newOrderStatus string
			if routeType == "pickup" {
				newOrderStatus = "picked_up"
			} else {
				newOrderStatus = "delivered"
			}

			_, err = tx.Exec("UPDATE orders SET status = $1 WHERE id = $2", newOrderStatus, orderID)
			if err != nil {
				http.Error(w, "Failed to update order status", http.StatusInternalServerError)
				return
			}

			// Send real-time update
			if h.realtime != nil {
				// Get user ID for the order
				var orderUserID int
				err = tx.QueryRow("SELECT user_id FROM orders WHERE id = $1", orderID).Scan(&orderUserID)
				if err == nil {
					h.realtime.PublishOrderUpdate(orderUserID, orderID, newOrderStatus, 
						fmt.Sprintf("Order status updated to %s", newOrderStatus), nil)
				}
			}
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete update", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Status updated successfully",
	})
}

// handleStartRoute marks a route as started
func (h *DriverRouteHandler) handleStartRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	driverID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	routeIDStr := r.URL.Query().Get("id")
	if routeIDStr == "" {
		http.Error(w, "Route ID required", http.StatusBadRequest)
		return
	}

	routeID, err := strconv.Atoi(routeIDStr)
	if err != nil {
		http.Error(w, "Invalid route ID", http.StatusBadRequest)
		return
	}

	// Verify this route belongs to the driver
	var routeDriverID int
	err = h.db.QueryRow("SELECT driver_id FROM driver_routes WHERE id = $1", routeID).Scan(&routeDriverID)
	if err != nil {
		http.Error(w, "Route not found", http.StatusNotFound)
		return
	}

	if routeDriverID != driverID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Update route status to in_progress
	_, err = h.db.Exec("UPDATE driver_routes SET status = 'in_progress' WHERE id = $1", routeID)
	if err != nil {
		http.Error(w, "Failed to start route", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Route started successfully",
	})
}