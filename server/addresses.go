package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type AddressHandler struct {
	db *sql.DB
	getUserID func(*http.Request, *sql.DB) (int, error)
}

type Address struct {
	ID                   int     `json:"id"`
	UserID               int     `json:"user_id"`
	Type                 string  `json:"type"`
	StreetAddress        string  `json:"street_address"`
	City                 string  `json:"city"`
	State                string  `json:"state"`
	ZipCode              string  `json:"zip_code"`
	DeliveryInstructions *string `json:"delivery_instructions,omitempty"`
	IsDefault            bool    `json:"is_default"`
}

type CreateAddressRequest struct {
	Type                 string  `json:"type"`
	StreetAddress        string  `json:"street_address"`
	City                 string  `json:"city"`
	State                string  `json:"state"`
	ZipCode              string  `json:"zip_code"`
	DeliveryInstructions *string `json:"delivery_instructions,omitempty"`
	IsDefault            bool    `json:"is_default"`
}

func NewAddressHandler(db *sql.DB) *AddressHandler {
	return &AddressHandler{
		db: db,
		getUserID: getUserIDFromRequest,
	}
}

// handleGetAddresses returns all addresses for the authenticated user
func (h *AddressHandler) handleGetAddresses(w http.ResponseWriter, r *http.Request) {
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

	rows, err := h.db.Query(`
		SELECT id, user_id, type, street_address, city, state, zip_code, 
			   delivery_instructions, is_default
		FROM addresses
		WHERE user_id = $1
		ORDER BY is_default DESC, created_at DESC`,
		userID,
	)
	if err != nil {
		http.Error(w, "Failed to fetch addresses", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	addresses := []Address{}
	for rows.Next() {
		var addr Address
		err := rows.Scan(
			&addr.ID, &addr.UserID, &addr.Type, &addr.StreetAddress,
			&addr.City, &addr.State, &addr.ZipCode,
			&addr.DeliveryInstructions, &addr.IsDefault,
		)
		if err != nil {
			http.Error(w, "Failed to parse addresses", http.StatusInternalServerError)
			return
		}
		addresses = append(addresses, addr)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addresses)
}

// handleCreateAddress creates a new address for the user
func (h *AddressHandler) handleCreateAddress(w http.ResponseWriter, r *http.Request) {
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

	var req CreateAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.StreetAddress == "" || req.City == "" || req.State == "" || req.ZipCode == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Validate type
	if req.Type != "home" && req.Type != "work" && req.Type != "other" {
		req.Type = "home"
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// If this is set as default, unset other defaults
	if req.IsDefault {
		_, err = tx.Exec(`
			UPDATE addresses SET is_default = false 
			WHERE user_id = $1 AND is_default = true`,
			userID,
		)
		if err != nil {
			http.Error(w, "Failed to update defaults", http.StatusInternalServerError)
			return
		}
	}

	// Create address
	var addressID int
	err = tx.QueryRow(`
		INSERT INTO addresses (
			user_id, type, street_address, city, state, zip_code,
			delivery_instructions, is_default
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id`,
		userID, req.Type, req.StreetAddress, req.City, req.State,
		req.ZipCode, req.DeliveryInstructions, req.IsDefault,
	).Scan(&addressID)
	if err != nil {
		http.Error(w, "Failed to create address", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete address creation", http.StatusInternalServerError)
		return
	}

	// Fetch and return the created address
	var addr Address
	err = h.db.QueryRow(`
		SELECT id, user_id, type, street_address, city, state, zip_code, 
			   delivery_instructions, is_default
		FROM addresses WHERE id = $1`,
		addressID,
	).Scan(
		&addr.ID, &addr.UserID, &addr.Type, &addr.StreetAddress,
		&addr.City, &addr.State, &addr.ZipCode,
		&addr.DeliveryInstructions, &addr.IsDefault,
	)
	if err != nil {
		http.Error(w, "Failed to fetch created address", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addr)
}

// handleUpdateAddress updates an existing address
func (h *AddressHandler) handleUpdateAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get address ID from URL
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid address ID", http.StatusBadRequest)
		return
	}

	addressID, err := strconv.Atoi(pathParts[3])
	if err != nil {
		http.Error(w, "Invalid address ID", http.StatusBadRequest)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// If this is set as default, unset other defaults
	if req.IsDefault {
		_, err = tx.Exec(`
			UPDATE addresses SET is_default = false 
			WHERE user_id = $1 AND is_default = true AND id != $2`,
			userID, addressID,
		)
		if err != nil {
			http.Error(w, "Failed to update defaults", http.StatusInternalServerError)
			return
		}
	}

	// Update address
	result, err := tx.Exec(`
		UPDATE addresses 
		SET type = $1, street_address = $2, city = $3, state = $4,
			zip_code = $5, delivery_instructions = $6, is_default = $7
		WHERE id = $8 AND user_id = $9`,
		req.Type, req.StreetAddress, req.City, req.State,
		req.ZipCode, req.DeliveryInstructions, req.IsDefault,
		addressID, userID,
	)
	if err != nil {
		http.Error(w, "Failed to update address", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Address not found", http.StatusNotFound)
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete address update", http.StatusInternalServerError)
		return
	}

	// Fetch and return the updated address
	var addr Address
	err = h.db.QueryRow(`
		SELECT id, user_id, type, street_address, city, state, zip_code, 
			   delivery_instructions, is_default
		FROM addresses WHERE id = $1`,
		addressID,
	).Scan(
		&addr.ID, &addr.UserID, &addr.Type, &addr.StreetAddress,
		&addr.City, &addr.State, &addr.ZipCode,
		&addr.DeliveryInstructions, &addr.IsDefault,
	)
	if err != nil {
		http.Error(w, "Failed to fetch updated address", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addr)
}

// handleDeleteAddress deletes an address
func (h *AddressHandler) handleDeleteAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get address ID from URL
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid address ID", http.StatusBadRequest)
		return
	}

	addressID, err := strconv.Atoi(pathParts[3])
	if err != nil {
		http.Error(w, "Invalid address ID", http.StatusBadRequest)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Delete address
	result, err := h.db.Exec(`
		DELETE FROM addresses 
		WHERE id = $1 AND user_id = $2`,
		addressID, userID,
	)
	if err != nil {
		http.Error(w, "Failed to delete address", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Address not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Address deleted successfully",
	})
}