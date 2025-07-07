package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// OrderLocation represents an order with its pickup and delivery location details
type OrderLocation struct {
	ID              int    `json:"id"`
	PickupDate      string `json:"pickup_date"`
	PickupTimeSlot  string `json:"pickup_time_slot"`
	DeliveryDate    string `json:"delivery_date"`
	DeliveryTimeSlot string `json:"delivery_time_slot"`
	PickupAddress   string `json:"pickup_address"`
	PickupCity      string `json:"pickup_city"`
	PickupZip       string `json:"pickup_zip"`
	DeliveryAddress string `json:"delivery_address"`
	DeliveryCity    string `json:"delivery_city"`
	DeliveryZip     string `json:"delivery_zip"`
	CustomerName    string `json:"customer_name"`
}

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

// hashPassword hashes a password using bcrypt
func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
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
	Status             string    `json:"status"`
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
			u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status,
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
			&u.ID, &u.Email, &u.FirstName, &u.LastName, &u.Phone, &u.Role, &u.Status,
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

// handleCreateUser creates a new user
func (h *AdminHandler) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID for logging
	currentUserID, err := h.getUserID(r, h.db)
	if err != nil {
		currentUserID = 0 // Will be handled by requireAdmin middleware
	}
	logger := LogRequest("create_user", r.Method, r.URL.Path, currentUserID)

	var req struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		Role      string `json:"role"`
		Status    string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("Failed to decode request body", "error", err)
		http.Error(w, "Invalid request body format", http.StatusBadRequest)
		return
	}

	logger.Info("Creating new user", "email", req.Email, "role", req.Role)

	// Validate required fields
	if req.FirstName == "" || req.LastName == "" || req.Email == "" {
		logger.Warn("Missing required fields", "first_name", req.FirstName, "last_name", req.LastName, "email", req.Email)
		http.Error(w, "First name, last name, and email are required", http.StatusBadRequest)
		return
	}

	// Validate role
	if req.Role != "customer" && req.Role != "driver" && req.Role != "admin" {
		logger.Warn("Invalid role provided", "role", req.Role)
		http.Error(w, "Role must be customer, driver, or admin", http.StatusBadRequest)
		return
	}

	// Validate status
	if req.Status != "active" && req.Status != "inactive" && req.Status != "suspended" {
		logger.Warn("Invalid status provided", "status", req.Status)
		http.Error(w, "Status must be active, inactive, or suspended", http.StatusBadRequest)
		return
	}

	// Check if email already exists
	var existingUserID int
	err = h.db.QueryRow("SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingUserID)
	if err == nil {
		logger.Warn("Attempt to create user with existing email", "email", req.Email, "existing_user_id", existingUserID)
		http.Error(w, "A user with this email address already exists", http.StatusConflict)
		return
	} else if err != sql.ErrNoRows {
		logger.Error("Database error checking existing email", "error", err, "email", req.Email)
		http.Error(w, "Database error while checking email", http.StatusInternalServerError)
		return
	}

	// Create user with a temporary password (user will need to reset)
	tempPassword := "temp123!" // In production, generate a secure temporary password
	hashedPassword, err := hashPassword(tempPassword)
	if err != nil {
		logger.Error("Failed to hash password", "error", err)
		http.Error(w, "Failed to process password", http.StatusInternalServerError)
		return
	}

	var userID int
	err = h.db.QueryRow(`
		INSERT INTO users (email, password_hash, first_name, last_name, phone, role, status, email_verified_at, created_at)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id
	`, req.Email, hashedPassword, req.FirstName, req.LastName, req.Phone, req.Role, req.Status).Scan(&userID)

	if err != nil {
		logger.Error("Failed to insert user into database", "error", err, "email", req.Email, "role", req.Role)
		http.Error(w, "Failed to create user account", http.StatusInternalServerError)
		return
	}

	logger.Info("Successfully created user", "user_id", userID, "email", req.Email, "role", req.Role)

	// Return the created user
	var phone *string
	if req.Phone != "" {
		phone = &req.Phone
	}

	user := AdminUserResponse{
		ID:            userID,
		Email:         req.Email,
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Phone:         phone,
		Role:          req.Role,
		Status:        req.Status,
		EmailVerified: true,
		CreatedAt:     time.Now(),
		TotalOrders:   0,
		ActiveSubscription: false,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(user); err != nil {
		logger.Error("Failed to encode response", "error", err, "user_id", userID)
	}
}

// handleUpdateUser updates a user's details
func (h *AdminHandler) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
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
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		Role      string `json:"role"`
		Status    string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.FirstName == "" || req.LastName == "" || req.Email == "" {
		http.Error(w, "First name, last name, and email are required", http.StatusBadRequest)
		return
	}

	// Validate role
	if req.Role != "customer" && req.Role != "driver" && req.Role != "admin" {
		http.Error(w, "Invalid role", http.StatusBadRequest)
		return
	}

	// Validate status
	if req.Status != "active" && req.Status != "inactive" && req.Status != "suspended" {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	// Check if email already exists for another user
	var existingUserID int
	err = h.db.QueryRow("SELECT id FROM users WHERE email = $1 AND id != $2", req.Email, userID).Scan(&existingUserID)
	if err == nil {
		http.Error(w, "A user with this email address already exists", http.StatusConflict)
		return
	} else if err != sql.ErrNoRows {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Update user
	_, err = h.db.Exec(`
		UPDATE users 
		SET email = $1, first_name = $2, last_name = $3, phone = $4, role = $5, status = $6, updated_at = CURRENT_TIMESTAMP
		WHERE id = $7
	`, req.Email, req.FirstName, req.LastName, req.Phone, req.Role, req.Status, userID)

	if err != nil {
		http.Error(w, "Failed to update user", http.StatusInternalServerError)
		return
	}

	// Return the updated user
	var user AdminUserResponse
	err = h.db.QueryRow(`
		SELECT 
			u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status,
			u.email_verified_at IS NOT NULL as email_verified, u.created_at,
			COUNT(DISTINCT o.id) as total_orders,
			EXISTS(SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active') as has_subscription
		FROM users u
		LEFT JOIN orders o ON u.id = o.user_id
		WHERE u.id = $1
		GROUP BY u.id
	`, userID).Scan(
		&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.Phone, &user.Role, &user.Status,
		&user.EmailVerified, &user.CreatedAt, &user.TotalOrders, &user.ActiveSubscription,
	)

	if err != nil {
		http.Error(w, "Failed to fetch updated user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// handleUpdateUserStatus updates a user's status
func (h *AdminHandler) handleUpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get current user ID for logging
	currentUserID, err := h.getUserID(r, h.db)
	if err != nil {
		currentUserID = 0
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

	logger := LogRequest("update_user_status", r.Method, r.URL.Path, currentUserID)

	var req struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("Failed to decode request body", "error", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate status
	if req.Status != "active" && req.Status != "inactive" && req.Status != "suspended" {
		logger.Warn("Invalid status provided", "status", req.Status, "target_user_id", userID)
		http.Error(w, "Status must be active, inactive, or suspended", http.StatusBadRequest)
		return
	}

	// Prevent changing your own status
	if currentUserID == userID {
		logger.Warn("Attempt to change own status", "user_id", currentUserID, "status", req.Status)
		http.Error(w, "You cannot change your own account status", http.StatusForbidden)
		return
	}

	logger.Info("Updating user status", "target_user_id", userID, "new_status", req.Status)

	// Update user status
	_, err = h.db.Exec("UPDATE users SET status = $1 WHERE id = $2", req.Status, userID)
	if err != nil {
		logger.Error("Failed to update user status", "error", err, "target_user_id", userID, "status", req.Status)
		http.Error(w, "Failed to update user status", http.StatusInternalServerError)
		return
	}

	logger.Info("Successfully updated user status", "target_user_id", userID, "new_status", req.Status)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "User status updated successfully",
		"status":  req.Status,
	})
}

// handleDeleteUser deletes a user
func (h *AdminHandler) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
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

	// Get current user ID to prevent self-deletion
	currentUserID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Prevent deleting the currently logged-in user
	if userID == currentUserID {
		http.Error(w, "You cannot delete your own account while logged in", http.StatusForbidden)
		return
	}

	// Check if user exists and get their role
	var userRole string
	err = h.db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&userRole)
	if err == sql.ErrNoRows {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Prevent deleting admin users for safety
	if userRole == "admin" {
		http.Error(w, "Admin users cannot be deleted for security reasons", http.StatusForbidden)
		return
	}

	// Check if user has active orders
	var activeOrdersCount int
	err = h.db.QueryRow(`
		SELECT COUNT(*) FROM orders 
		WHERE user_id = $1 AND status NOT IN ('delivered', 'cancelled')
	`, userID).Scan(&activeOrdersCount)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if activeOrdersCount > 0 {
		http.Error(w, "This user has active orders and cannot be deleted. Please complete or cancel their orders first", http.StatusConflict)
		return
	}

	// Begin transaction for safe deletion
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Delete related records first (to maintain referential integrity)
	// Delete subscription preferences
	_, err = tx.Exec("DELETE FROM subscription_preferences WHERE user_id = $1", userID)
	if err != nil {
		http.Error(w, "Failed to delete user data", http.StatusInternalServerError)
		return
	}

	// Delete subscriptions
	_, err = tx.Exec("DELETE FROM subscriptions WHERE user_id = $1", userID)
	if err != nil {
		http.Error(w, "Failed to delete user data", http.StatusInternalServerError)
		return
	}

	// Delete addresses
	_, err = tx.Exec("DELETE FROM addresses WHERE user_id = $1", userID)
	if err != nil {
		http.Error(w, "Failed to delete user data", http.StatusInternalServerError)
		return
	}

	// Delete completed orders (keep historical data integrity)
	_, err = tx.Exec("DELETE FROM orders WHERE user_id = $1 AND status IN ('delivered', 'cancelled')", userID)
	if err != nil {
		http.Error(w, "Failed to delete user data", http.StatusInternalServerError)
		return
	}

	// Finally delete the user
	result, err := tx.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		http.Error(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete deletion", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User deleted successfully"})
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
		SELECT DISTINCT ON (o.id)
			o.id, o.user_id, o.subscription_id, o.pickup_address_id, o.delivery_address_id,
			o.status, o.total_weight, 
			COALESCE(oi_totals.subtotal, 0) as subtotal,
			ROUND(COALESCE(oi_totals.subtotal, 0) * 0.08, 2) as tax,
			ROUND(COALESCE(oi_totals.subtotal, 0) * 1.08, 2) as total,
			o.special_instructions,
			o.pickup_date, o.delivery_date, o.pickup_time_slot, o.delivery_time_slot,
			o.created_at, o.updated_at,
			u.email, u.first_name, u.last_name,
			COALESCE(latest_route.route_id, 0) as route_id, 
			latest_route.route_type, 
			latest_route.driver_name,
			COALESCE(latest_route.driver_id, 0) as driver_id,
			CASE WHEN latest_route.route_id IS NOT NULL THEN true ELSE false END as is_assigned
		FROM orders o
		JOIN users u ON o.user_id = u.id
		LEFT JOIN (
			SELECT order_id, SUM(price * quantity) as subtotal
			FROM order_items
			GROUP BY order_id
		) oi_totals ON o.id = oi_totals.order_id
		LEFT JOIN (
			SELECT DISTINCT ON (ro.order_id)
				ro.order_id,
				dr.id as route_id,
				dr.route_type,
				CASE WHEN du.first_name IS NOT NULL THEN du.first_name || ' ' || du.last_name ELSE NULL END as driver_name,
				du.id as driver_id
			FROM route_orders ro
			JOIN driver_routes dr ON ro.route_id = dr.id
			LEFT JOIN users du ON dr.driver_id = du.id
			ORDER BY ro.order_id, ro.id DESC
		) latest_route ON o.id = latest_route.order_id
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

	query += " ORDER BY o.id, o.created_at DESC"

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

		// Fetch order items for each order (same as in orders.go)
		itemRows, err := h.db.Query(`
			SELECT oi.id, oi.order_id, oi.service_id, s.name, oi.quantity, oi.weight, oi.price, oi.notes
			FROM order_items oi
			JOIN services s ON oi.service_id = s.id
			WHERE oi.order_id = $1`,
			o.ID,
		)
		if err == nil {
			o.Items = []OrderItem{}
			for itemRows.Next() {
				var item OrderItem
				err := itemRows.Scan(
					&item.ID, &item.OrderID, &item.ServiceID, &item.ServiceName,
					&item.Quantity, &item.Weight, &item.Price, &item.Notes,
				)
				if err == nil {
					o.Items = append(o.Items, item)
				}
			}
			itemRows.Close()
		}

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

// handleBulkOrderStatusUpdate updates the status of multiple orders at once
func (h *AdminHandler) handleBulkOrderStatusUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		OrderIDs []int  `json:"order_ids"`
		Status   string `json:"status"`
		Notes    string `json:"notes,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate status
	validStatuses := []string{"pending", "scheduled", "picked_up", "in_process", "ready", "out_for_delivery", "delivered", "cancelled"}
	isValidStatus := false
	for _, status := range validStatuses {
		if req.Status == status {
			isValidStatus = true
			break
		}
	}
	if !isValidStatus {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	if len(req.OrderIDs) == 0 {
		http.Error(w, "No orders specified", http.StatusBadRequest)
		return
	}

	// Get user ID for audit trail
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	updatedCount := 0
	// Update each order
	for _, orderID := range req.OrderIDs {
		// Update order status
		result, err := tx.Exec(`
			UPDATE orders 
			SET status = $1, updated_at = CURRENT_TIMESTAMP 
			WHERE id = $2
		`, req.Status, orderID)

		if err != nil {
			continue // Skip failed updates but don't fail the whole operation
		}

		if affected, _ := result.RowsAffected(); affected > 0 {
			updatedCount++

			// Add status history entry
			notes := req.Notes
			if notes == "" {
				notes = fmt.Sprintf("Bulk status update to %s", req.Status)
			}

			_, err = tx.Exec(`
				INSERT INTO order_status_history (order_id, status, notes, updated_by)
				VALUES ($1, $2, $3, $4)
			`, orderID, req.Status, notes, userID)

			// Don't fail if history insert fails
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete bulk update", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":        "Bulk status update completed",
		"updated_count":  updatedCount,
		"total_orders":   len(req.OrderIDs),
	})
}

// handleGetRouteOptimizationSuggestions provides optimization suggestions for route creation
func (h *AdminHandler) handleGetRouteOptimizationSuggestions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		OrderIDs []int `json:"order_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.OrderIDs) == 0 {
		http.Error(w, "No orders specified", http.StatusBadRequest)
		return
	}

	// Get orders with addresses
	rows, err := h.db.Query(`
		SELECT o.id, o.pickup_date, o.pickup_time_slot, o.delivery_date, o.delivery_time_slot,
			   pa.street_address as pickup_address, pa.city as pickup_city, pa.zip_code as pickup_zip,
			   da.street_address as delivery_address, da.city as delivery_city, da.zip_code as delivery_zip,
			   u.first_name, u.last_name
		FROM orders o
		JOIN addresses pa ON o.pickup_address_id = pa.id
		JOIN addresses da ON o.delivery_address_id = da.id
		JOIN users u ON o.user_id = u.id
		WHERE o.id = ANY($1)
	`, pq.Array(req.OrderIDs))

	if err != nil {
		http.Error(w, "Failed to fetch orders", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []OrderLocation
	for rows.Next() {
		var order OrderLocation
		var firstName, lastName string
		err := rows.Scan(
			&order.ID, &order.PickupDate, &order.PickupTimeSlot,
			&order.DeliveryDate, &order.DeliveryTimeSlot,
			&order.PickupAddress, &order.PickupCity, &order.PickupZip,
			&order.DeliveryAddress, &order.DeliveryCity, &order.DeliveryZip,
			&firstName, &lastName,
		)
		if err != nil {
			continue
		}
		order.CustomerName = fmt.Sprintf("%s %s", firstName, lastName)
		orders = append(orders, order)
	}

	// Enhanced optimization suggestions
	suggestions := map[string]interface{}{
		"orders": orders,
		"suggestions": []map[string]interface{}{
			{
				"type": "pickup_delivery_cycle",
				"message": "Routes optimized for efficient pickup→delivery cycles on the same day. Perfect for 'one-swoop' service where drivers pick up and deliver in sequence.",
				"groups": groupOrdersByPickupDeliveryCycle(orders),
			},
			{
				"type": "geographic_clusters",
				"message": "Groups orders by geographic proximity for both pickup and delivery locations. Minimizes driving distance between stops.",
				"groups": groupOrdersByGeographicClusters(orders),
			},
			{
				"type": "time_slot_grouping",
				"message": "Orders grouped by customer-selected pickup time windows. Useful for coordinating driver schedules.",
				"groups": groupOrdersByTimeSlot(orders),
			},
		},
		"total_orders": len(orders),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suggestions)
}

// Helper function to group orders by time slot
func groupOrdersByTimeSlot(orders []OrderLocation) map[string][]int {
	groups := make(map[string][]int)
	for _, order := range orders {
		slot := order.PickupTimeSlot
		groups[slot] = append(groups[slot], order.ID)
	}
	return groups
}

// Helper function to group orders by zip code  
func groupOrdersByZipCode(orders []OrderLocation) map[string][]int {
	groups := make(map[string][]int)
	for _, order := range orders {
		zip := order.PickupZip
		groups[zip] = append(groups[zip], order.ID)
	}
	return groups
}

// Enhanced function to group orders by pickup-delivery cycles
func groupOrdersByPickupDeliveryCycle(orders []OrderLocation) map[string][]int {
	groups := make(map[string][]int)
	
	for _, order := range orders {
		// Create a cycle key based on pickup date/time and delivery date/time
		cycleKey := fmt.Sprintf("%s %s → %s %s", 
			order.PickupDate, order.PickupTimeSlot,
			order.DeliveryDate, order.DeliveryTimeSlot)
		
		groups[cycleKey] = append(groups[cycleKey], order.ID)
	}
	
	// Only return groups with more than 1 order (efficiency gains)
	efficientGroups := make(map[string][]int)
	for key, orderIds := range groups {
		if len(orderIds) > 1 {
			efficientGroups[key] = orderIds
		}
	}
	
	return efficientGroups
}

// OrderResolution types
type OrderResolution struct {
	ID             int       `json:"id"`
	OrderID        int       `json:"order_id"`
	ResolvedBy     int       `json:"resolved_by"`
	ResolutionType string    `json:"resolution_type"`
	RescheduleDate *string   `json:"reschedule_date,omitempty"`
	RefundAmount   *float64  `json:"refund_amount,omitempty"`
	CreditAmount   *float64  `json:"credit_amount,omitempty"`
	Notes          string    `json:"notes"`
	CreatedAt      time.Time `json:"created_at"`
}

type CreateOrderResolutionRequest struct {
	OrderID        int      `json:"order_id"`
	ResolutionType string   `json:"resolution_type"`
	RescheduleDate *string  `json:"reschedule_date,omitempty"`
	RefundAmount   *float64 `json:"refund_amount,omitempty"`
	CreditAmount   *float64 `json:"credit_amount,omitempty"`
	Notes          string   `json:"notes"`
}

// handleCreateOrderResolution creates a resolution for a failed order
func (h *AdminHandler) handleCreateOrderResolution(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateOrderResolutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate resolution type
	validTypes := map[string]bool{
		"reschedule":     true,
		"partial_refund": true,
		"full_refund":    true,
		"credit":         true,
		"waive_fee":      true,
	}
	if !validTypes[req.ResolutionType] {
		http.Error(w, "Invalid resolution type", http.StatusBadRequest)
		return
	}

	// Validate required fields based on resolution type
	if req.ResolutionType == "reschedule" && req.RescheduleDate == nil {
		http.Error(w, "Reschedule date is required for reschedule resolution", http.StatusBadRequest)
		return
	}
	if (req.ResolutionType == "partial_refund" || req.ResolutionType == "full_refund") && req.RefundAmount == nil {
		http.Error(w, "Refund amount is required for refund resolution", http.StatusBadRequest)
		return
	}
	if req.ResolutionType == "credit" && req.CreditAmount == nil {
		http.Error(w, "Credit amount is required for credit resolution", http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Verify order exists and is failed
	var orderStatus string
	var userEmail string
	err = tx.QueryRow(`
		SELECT o.status, u.email
		FROM orders o
		JOIN users u ON o.user_id = u.id
		WHERE o.id = $1
	`, req.OrderID).Scan(&orderStatus, &userEmail)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Order not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if orderStatus != "failed" {
		http.Error(w, "Order is not in failed status", http.StatusBadRequest)
		return
	}

	// Insert order resolution
	var resolution OrderResolution
	err = tx.QueryRow(`
		INSERT INTO order_resolutions (
			order_id, resolved_by, resolution_type, 
			reschedule_date, refund_amount, credit_amount, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, order_id, resolved_by, resolution_type, 
			reschedule_date, refund_amount, credit_amount, notes, created_at
	`, req.OrderID, userID, req.ResolutionType,
		req.RescheduleDate, req.RefundAmount, req.CreditAmount, req.Notes).Scan(
		&resolution.ID, &resolution.OrderID, &resolution.ResolvedBy,
		&resolution.ResolutionType, &resolution.RescheduleDate,
		&resolution.RefundAmount, &resolution.CreditAmount,
		&resolution.Notes, &resolution.CreatedAt,
	)
	if err != nil {
		http.Error(w, "Failed to create resolution", http.StatusInternalServerError)
		return
	}

	// Update order status based on resolution type
	newStatus := "cancelled" // Default for refunds
	if req.ResolutionType == "reschedule" {
		newStatus = "scheduled"
		// Update pickup date if rescheduling
		_, err = tx.Exec(`
			UPDATE orders 
			SET status = $1, pickup_date = $2, updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
		`, newStatus, req.RescheduleDate, req.OrderID)
	} else {
		_, err = tx.Exec(`
			UPDATE orders 
			SET status = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, newStatus, req.OrderID)
	}

	if err != nil {
		http.Error(w, "Failed to update order status", http.StatusInternalServerError)
		return
	}

	// TODO: Process refunds/credits through payment system
	// TODO: Send notification to customer

	// Send real-time update
	if h.realtime != nil {
		// Get user ID for the order
		var orderUserID int
		err = tx.QueryRow("SELECT user_id FROM orders WHERE id = $1", req.OrderID).Scan(&orderUserID)
		if err == nil {
			statusMessage := fmt.Sprintf("Order resolution: %s", req.ResolutionType)
			h.realtime.PublishOrderUpdate(orderUserID, req.OrderID, newStatus, statusMessage, nil)
		}
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resolution)
}

// handleGetOrderResolutions gets all resolutions for an order
func (h *AdminHandler) handleGetOrderResolutions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	vars := mux.Vars(r)
	orderID, err := strconv.Atoi(vars["orderId"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	query := `
		SELECT 
			r.id, r.order_id, r.resolved_by, r.resolution_type,
			r.reschedule_date, r.refund_amount, r.credit_amount,
			r.notes, r.created_at
		FROM order_resolutions r
		WHERE r.order_id = $1
		ORDER BY r.created_at DESC
	`

	rows, err := h.db.Query(query, orderID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	resolutions := []OrderResolution{}
	for rows.Next() {
		var r OrderResolution
		err := rows.Scan(
			&r.ID, &r.OrderID, &r.ResolvedBy, &r.ResolutionType,
			&r.RescheduleDate, &r.RefundAmount, &r.CreditAmount,
			&r.Notes, &r.CreatedAt,
		)
		if err != nil {
			continue
		}
		resolutions = append(resolutions, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resolutions)
}

// Enhanced function to create geographic clusters considering both pickup and delivery
func groupOrdersByGeographicClusters(orders []OrderLocation) map[string][]int {
	groups := make(map[string][]int)
	
	for _, order := range orders {
		// Create geographic cluster key
		clusterKey := fmt.Sprintf("%s→%s", order.PickupZip, order.DeliveryZip)
		groups[clusterKey] = append(groups[clusterKey], order.ID)
	}
	
	// Group similar routes together
	efficientGroups := make(map[string][]int)
	
	// First, group same pickup to same delivery zip
	for key, orderIds := range groups {
		if len(orderIds) > 1 {
			efficientGroups[key+" - Identical Route"] = orderIds
		}
	}
	
	// Then, group by pickup zip (multiple deliveries from same pickup area)
	pickupGroups := make(map[string][]int)
	for _, order := range orders {
		pickupGroups[order.PickupZip] = append(pickupGroups[order.PickupZip], order.ID)
	}
	
	for zip, orderIds := range pickupGroups {
		if len(orderIds) > 2 { // More than 2 orders from same pickup area
			efficientGroups["Zone "+zip+" - Multiple Pickups"] = orderIds
		}
	}
	
	return efficientGroups
}
