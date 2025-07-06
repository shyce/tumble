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

type AdminHandler struct {
	db        *sql.DB
	realtime  RealtimeInterface
	getUserID func(*http.Request, *sql.DB) (int, error)
}

func NewAdminHandler(db *sql.DB, realtime RealtimeInterface) *AdminHandler {
	return &AdminHandler{
		db:        db,
		realtime:  realtime,
		getUserID: getUserIDFromRequest,
	}
}

// Middleware to check if user is admin
func (h *AdminHandler) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := h.getUserID(r, h.db)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var role string
		err = h.db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&role)
		if err != nil || role != "admin" {
			http.Error(w, "Forbidden - Admin access required", http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// User Management
type AdminUserResponse struct {
	ID                 int       `json:"id"`
	Email              string    `json:"email"`
	FirstName          string    `json:"first_name"`
	LastName           string    `json:"last_name"`
	Phone              *string   `json:"phone,omitempty"`
	Role               string    `json:"role"`
	EmailVerified      bool      `json:"email_verified"`
	CreatedAt          time.Time `json:"created_at"`
	TotalOrders        int       `json:"total_orders"`
	ActiveSubscription bool      `json:"active_subscription"`
}

// handleGetUsers returns all users with optional filters
func (h *AdminHandler) handleGetUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	role := r.URL.Query().Get("role")
	search := r.URL.Query().Get("search")
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

	query := `
		SELECT 
			u.id, u.email, u.first_name, u.last_name, u.phone, u.role, 
			u.email_verified_at IS NOT NULL as email_verified, u.created_at,
			COUNT(DISTINCT o.id) as total_orders,
			EXISTS(SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active') as has_subscription
		FROM users u
		LEFT JOIN orders o ON u.id = o.user_id
		WHERE 1=1`

	args := []interface{}{}
	argCount := 0

	if role != "" {
		argCount++
		query += fmt.Sprintf(" AND u.role = $%d", argCount)
		args = append(args, role)
	}

	if search != "" {
		argCount++
		query += fmt.Sprintf(" AND (u.email ILIKE $%d OR u.first_name ILIKE $%d OR u.last_name ILIKE $%d)", argCount, argCount, argCount)
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern)
	}

	query += " GROUP BY u.id ORDER BY u.created_at DESC"

	argCount++
	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []AdminUserResponse{}
	for rows.Next() {
		var u AdminUserResponse
		err := rows.Scan(
			&u.ID, &u.Email, &u.FirstName, &u.LastName, &u.Phone, &u.Role,
			&u.EmailVerified, &u.CreatedAt, &u.TotalOrders, &u.ActiveSubscription,
		)
		if err != nil {
			continue
		}
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// handleUpdateUserRole updates a user's role
func (h *AdminHandler) handleUpdateUserRole(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from URL path
	vars := mux.Vars(r)
	userIDStr := vars["id"]
	if userIDStr == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Role string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate role
	if req.Role != "customer" && req.Role != "driver" && req.Role != "admin" {
		http.Error(w, "Invalid role", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec("UPDATE users SET role = $1 WHERE id = $2", req.Role, userID)
	if err != nil {
		http.Error(w, "Failed to update user role", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Role updated successfully"})
}

// Order Management
type AdminOrderSummary struct {
	TotalOrders     int     `json:"total_orders"`
	PendingOrders   int     `json:"pending_orders"`
	InProcessOrders int     `json:"in_process_orders"`
	CompletedOrders int     `json:"completed_orders"`
	TotalRevenue    float64 `json:"total_revenue"`
	TodayOrders     int     `json:"today_orders"`
	TodayRevenue    float64 `json:"today_revenue"`
}

// handleGetOrdersSummary returns order statistics
func (h *AdminHandler) handleGetOrdersSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var summary AdminOrderSummary

	// Get overall statistics
	err := h.db.QueryRow(`
		SELECT 
			COUNT(*) as total_orders,
			COUNT(CASE WHEN status = 'pending' OR status = 'scheduled' THEN 1 END) as pending,
			COUNT(CASE WHEN status IN ('picked_up', 'in_process', 'ready', 'out_for_delivery') THEN 1 END) as in_process,
			COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed,
			COALESCE(SUM(total), 0) as total_revenue
		FROM orders
		WHERE status != 'cancelled'
	`).Scan(&summary.TotalOrders, &summary.PendingOrders, &summary.InProcessOrders,
		&summary.CompletedOrders, &summary.TotalRevenue)

	if err != nil {
		http.Error(w, "Failed to fetch order summary", http.StatusInternalServerError)
		return
	}

	// Get today's statistics
	err = h.db.QueryRow(`
		SELECT 
			COUNT(*) as today_orders,
			COALESCE(SUM(total), 0) as today_revenue
		FROM orders
		WHERE DATE(created_at) = CURRENT_DATE
		AND status != 'cancelled'
	`).Scan(&summary.TodayOrders, &summary.TodayRevenue)

	if err != nil {
		// Non-critical error, just log and continue
		summary.TodayOrders = 0
		summary.TodayRevenue = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

// handleGetAllOrders returns all orders with admin view
func (h *AdminHandler) handleGetAllOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := r.URL.Query().Get("status")
	date := r.URL.Query().Get("date")
	userID := r.URL.Query().Get("user_id")
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

	query := `
		SELECT 
			o.id, o.user_id, o.subscription_id, o.pickup_address_id, o.delivery_address_id,
			o.status, o.total_weight, o.subtotal, o.tax, o.total, o.special_instructions,
			o.pickup_date, o.delivery_date, o.pickup_time_slot, o.delivery_time_slot,
			o.created_at, o.updated_at,
			u.email, u.first_name, u.last_name,
			dr.id as route_id, dr.route_type, 
			CASE WHEN du.first_name IS NOT NULL THEN du.first_name || ' ' || du.last_name ELSE NULL END as driver_name,
			du.id as driver_id,
			CASE WHEN ro.id IS NOT NULL THEN true ELSE false END as is_assigned
		FROM orders o
		JOIN users u ON o.user_id = u.id
		LEFT JOIN route_orders ro ON o.id = ro.order_id
		LEFT JOIN driver_routes dr ON ro.route_id = dr.id
		LEFT JOIN users du ON dr.driver_id = du.id
		WHERE 1=1`

	args := []interface{}{}
	argCount := 0

	if status != "" {
		argCount++
		query += fmt.Sprintf(" AND o.status = $%d", argCount)
		args = append(args, status)
	}

	if date != "" {
		argCount++
		query += fmt.Sprintf(" AND DATE(o.pickup_date) = $%d", argCount)
		args = append(args, date)
	}

	if userID != "" {
		argCount++
		query += fmt.Sprintf(" AND o.user_id = $%d", argCount)
		args = append(args, userID)
	}

	query += " ORDER BY o.created_at DESC"

	argCount++
	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type AdminOrder struct {
		Order
		UserEmail   string  `json:"user_email"`
		UserName    string  `json:"user_name"`
		RouteID     *int    `json:"route_id,omitempty"`
		RouteType   *string `json:"route_type,omitempty"`
		DriverName  *string `json:"driver_name,omitempty"`
		DriverID    *int    `json:"driver_id,omitempty"`
		IsAssigned  bool    `json:"is_assigned"`
	}

	orders := []AdminOrder{}
	for rows.Next() {
		var o AdminOrder
		var firstName, lastName string
		err := rows.Scan(
			&o.ID, &o.UserID, &o.SubscriptionID, &o.PickupAddressID, &o.DeliveryAddressID,
			&o.Status, &o.TotalWeight, &o.Subtotal, &o.Tax, &o.Total, &o.SpecialInstructions,
			&o.PickupDate, &o.DeliveryDate, &o.PickupTimeSlot, &o.DeliveryTimeSlot,
			&o.CreatedAt, &o.UpdatedAt,
			&o.UserEmail, &firstName, &lastName,
			&o.RouteID, &o.RouteType, &o.DriverName, &o.DriverID, &o.IsAssigned,
		)
		if err != nil {
			continue
		}
		o.UserName = firstName + " " + lastName
		orders = append(orders, o)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orders)
}

// Analytics
type RevenueAnalytics struct {
	Date              string  `json:"date"`
	Revenue           float64 `json:"revenue"`
	OrderCount        int     `json:"order_count"`
	AverageOrderValue float64 `json:"average_order_value"`
}

// handleGetRevenueAnalytics returns revenue analytics
func (h *AdminHandler) handleGetRevenueAnalytics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	period := r.URL.Query().Get("period") // "day", "week", "month"
	if period == "" {
		period = "day"
	}

	var dateFormat string
	var interval string

	switch period {
	case "week":
		dateFormat = "YYYY-IW" // ISO week
		interval = "30 days"
	case "month":
		dateFormat = "YYYY-MM"
		interval = "12 months"
	default: // day
		dateFormat = "YYYY-MM-DD"
		interval = "30 days"
	}

	query := fmt.Sprintf(`
		SELECT 
			TO_CHAR(DATE(created_at), '%s') as period,
			SUM(total) as revenue,
			COUNT(*) as order_count,
			AVG(total) as avg_order_value
		FROM orders
		WHERE status != 'cancelled'
		AND created_at >= CURRENT_DATE - INTERVAL '%s'
		GROUP BY period
		ORDER BY period DESC
	`, dateFormat, interval)

	rows, err := h.db.Query(query)
	if err != nil {
		http.Error(w, "Failed to fetch analytics", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	analytics := []RevenueAnalytics{}
	for rows.Next() {
		var a RevenueAnalytics
		err := rows.Scan(&a.Date, &a.Revenue, &a.OrderCount, &a.AverageOrderValue)
		if err != nil {
			continue
		}
		analytics = append(analytics, a)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

// Driver Management
type DriverStats struct {
	DriverID        int     `json:"driver_id"`
	DriverName      string  `json:"driver_name"`
	TotalDeliveries int     `json:"total_deliveries"`
	TodayDeliveries int     `json:"today_deliveries"`
	AvgDeliveryTime float64 `json:"avg_delivery_time_minutes"`
	Rating          float64 `json:"rating"`
}

// handleGetDriverStats returns driver performance statistics
func (h *AdminHandler) handleGetDriverStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := `
		SELECT 
			u.id, u.first_name || ' ' || u.last_name as name,
			COUNT(DISTINCT ro.order_id) as total_deliveries,
			COUNT(DISTINCT CASE WHEN DATE(dr.route_date) = CURRENT_DATE THEN ro.order_id END) as today_deliveries,
			0 as avg_delivery_time,
			0 as rating
		FROM users u
		LEFT JOIN driver_routes dr ON u.id = dr.driver_id
		LEFT JOIN route_orders ro ON dr.id = ro.route_id AND ro.status = 'completed'
		WHERE u.role = 'driver'
		GROUP BY u.id, u.first_name, u.last_name
		ORDER BY total_deliveries DESC
	`

	rows, err := h.db.Query(query)
	if err != nil {
		http.Error(w, "Failed to fetch driver stats", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	drivers := []DriverStats{}
	for rows.Next() {
		var d DriverStats
		err := rows.Scan(
			&d.DriverID, &d.DriverName, &d.TotalDeliveries,
			&d.TodayDeliveries, &d.AvgDeliveryTime, &d.Rating,
		)
		if err != nil {
			continue
		}
		drivers = append(drivers, d)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drivers)
}

// handleAssignDriverToRoute assigns a driver to orders
func (h *AdminHandler) handleAssignDriverToRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DriverID  int    `json:"driver_id"`
		OrderIDs  []int  `json:"order_ids"`
		RouteDate string `json:"route_date"`
		RouteType string `json:"route_type"` // "pickup" or "delivery"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate route type
	if req.RouteType != "pickup" && req.RouteType != "delivery" {
		http.Error(w, "Invalid route type", http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Create driver route
	var routeID int
	err = tx.QueryRow(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, $3, 'planned')
		RETURNING id
	`, req.DriverID, req.RouteDate, req.RouteType).Scan(&routeID)

	if err != nil {
		http.Error(w, "Failed to create route", http.StatusInternalServerError)
		return
	}

	// Assign orders to route
	for i, orderID := range req.OrderIDs {
		_, err = tx.Exec(`
			INSERT INTO route_orders (route_id, order_id, sequence_number, status)
			VALUES ($1, $2, $3, 'pending')
		`, routeID, orderID, i+1)

		if err != nil {
			http.Error(w, "Failed to assign orders", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete assignment", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":  "Route created successfully",
		"route_id": routeID,
	})
}
