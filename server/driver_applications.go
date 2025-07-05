package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type DriverApplicationHandler struct {
	db        *sql.DB
	getUserID func(*http.Request, *sql.DB) (int, error)
}

func NewDriverApplicationHandler(db *sql.DB) *DriverApplicationHandler {
	return &DriverApplicationHandler{
		db:        db,
		getUserID: getUserIDFromRequest,
	}
}

type DriverApplication struct {
	ID              int                    `json:"id"`
	UserID          int                    `json:"user_id"`
	Status          string                 `json:"status"`
	ApplicationData map[string]interface{} `json:"application_data"`
	AdminNotes      *string                `json:"admin_notes,omitempty"`
	ReviewedBy      *int                   `json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time             `json:"reviewed_at,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	UserEmail       string                 `json:"user_email,omitempty"`
	UserName        string                 `json:"user_name,omitempty"`
}

type DriverApplicationRequest struct {
	FirstName         string `json:"first_name"`
	LastName          string `json:"last_name"`
	Phone             string `json:"phone"`
	LicenseNumber     string `json:"license_number"`
	LicenseState      string `json:"license_state"`
	VehicleYear       string `json:"vehicle_year"`
	VehicleMake       string `json:"vehicle_make"`
	VehicleModel      string `json:"vehicle_model"`
	VehicleColor      string `json:"vehicle_color"`
	InsuranceProvider string `json:"insurance_provider"`
	InsurancePolicyID string `json:"insurance_policy_id"`
	Experience        string `json:"experience"`
	Availability      string `json:"availability"`
	WhyInterested     string `json:"why_interested"`
}

// handleSubmitDriverApplication handles driver application submissions
func (h *DriverApplicationHandler) handleSubmitDriverApplication(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if user already has a pending or approved application
	var existingCount int
	err = h.db.QueryRow(`
		SELECT COUNT(*) FROM driver_applications 
		WHERE user_id = $1 AND status IN ('pending', 'approved')
	`, userID).Scan(&existingCount)
	
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	
	if existingCount > 0 {
		http.Error(w, "You already have a pending or approved application", http.StatusBadRequest)
		return
	}

	var req DriverApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.FirstName == "" || req.LastName == "" || req.Phone == "" || req.LicenseNumber == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Convert to JSON for storage
	applicationDataBytes, err := json.Marshal(req)
	if err != nil {
		http.Error(w, "Failed to process application", http.StatusInternalServerError)
		return
	}

	var applicationID int
	err = h.db.QueryRow(`
		INSERT INTO driver_applications (user_id, application_data)
		VALUES ($1, $2)
		RETURNING id
	`, userID, applicationDataBytes).Scan(&applicationID)

	if err != nil {
		http.Error(w, "Failed to submit application", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":        "Application submitted successfully",
		"application_id": applicationID,
	})
}

// handleGetUserApplication gets the current user's driver application
func (h *DriverApplicationHandler) handleGetUserApplication(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var app DriverApplication
	var applicationDataBytes []byte
	
	err = h.db.QueryRow(`
		SELECT id, user_id, status, application_data, admin_notes, reviewed_by, reviewed_at, created_at, updated_at
		FROM driver_applications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(
		&app.ID, &app.UserID, &app.Status, &applicationDataBytes,
		&app.AdminNotes, &app.ReviewedBy, &app.ReviewedAt,
		&app.CreatedAt, &app.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		http.Error(w, "No application found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if err := json.Unmarshal(applicationDataBytes, &app.ApplicationData); err != nil {
		http.Error(w, "Failed to parse application data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(app)
}

// Admin-only handlers

// requireAdmin middleware
func (h *DriverApplicationHandler) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
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

// handleGetAllApplications returns all driver applications (admin only)
func (h *DriverApplicationHandler) handleGetAllApplications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

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

	query := `
		SELECT 
			da.id, da.user_id, da.status, da.application_data, da.admin_notes, 
			da.reviewed_by, da.reviewed_at, da.created_at, da.updated_at,
			u.email, u.first_name, u.last_name
		FROM driver_applications da
		JOIN users u ON da.user_id = u.id
		WHERE 1=1`

	args := []interface{}{}
	argCount := 0

	if status != "" {
		argCount++
		query += " AND da.status = $" + strconv.Itoa(argCount)
		args = append(args, status)
	}

	query += " ORDER BY da.created_at DESC"

	argCount++
	query += " LIMIT $" + strconv.Itoa(argCount)
	args = append(args, limit)

	argCount++
	query += " OFFSET $" + strconv.Itoa(argCount)
	args = append(args, offset)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		http.Error(w, "Failed to fetch applications", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	applications := []DriverApplication{}
	for rows.Next() {
		var app DriverApplication
		var applicationDataBytes []byte
		var firstName, lastName string

		err := rows.Scan(
			&app.ID, &app.UserID, &app.Status, &applicationDataBytes,
			&app.AdminNotes, &app.ReviewedBy, &app.ReviewedAt,
			&app.CreatedAt, &app.UpdatedAt,
			&app.UserEmail, &firstName, &lastName,
		)
		if err != nil {
			continue
		}

		app.UserName = firstName + " " + lastName

		if err := json.Unmarshal(applicationDataBytes, &app.ApplicationData); err != nil {
			continue
		}

		applications = append(applications, app)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(applications)
}

// handleReviewApplication approves or rejects a driver application (admin only)
func (h *DriverApplicationHandler) handleReviewApplication(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	adminUserID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	applicationIDStr := r.URL.Query().Get("id")
	if applicationIDStr == "" {
		http.Error(w, "Application ID required", http.StatusBadRequest)
		return
	}

	applicationID, err := strconv.Atoi(applicationIDStr)
	if err != nil {
		http.Error(w, "Invalid application ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Status     string `json:"status"`
		AdminNotes string `json:"admin_notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
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

	// Update application
	_, err = tx.Exec(`
		UPDATE driver_applications 
		SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`, req.Status, req.AdminNotes, adminUserID, applicationID)

	if err != nil {
		http.Error(w, "Failed to update application", http.StatusInternalServerError)
		return
	}

	// If approved, update user role to driver
	if req.Status == "approved" {
		var userID int
		err = tx.QueryRow("SELECT user_id FROM driver_applications WHERE id = $1", applicationID).Scan(&userID)
		if err != nil {
			http.Error(w, "Failed to get user ID", http.StatusInternalServerError)
			return
		}

		_, err = tx.Exec("UPDATE users SET role = 'driver' WHERE id = $1", userID)
		if err != nil {
			http.Error(w, "Failed to update user role", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete review", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Application reviewed successfully",
	})
}