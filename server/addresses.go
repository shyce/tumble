package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
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
	logger := LogRequest("address_update", r.Method, r.URL.Path, 0)
	logger.Info("Starting address update")
	
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		logger.Warn("Method not allowed", "method", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get address ID from URL using Gorilla Mux
	vars := mux.Vars(r)
	addressID, err := strconv.Atoi(vars["id"])
	if err != nil {
		logger.Error("Invalid address ID", "error", err, "vars", vars)
		http.Error(w, "Invalid address ID", http.StatusBadRequest)
		return
	}
	logger = logger.With("address_id", addressID)
	logger.Debug("Address ID extracted")

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		logger.Warn("Authentication failed", "error", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	logger = logger.With("user_id", userID)
	logger.Debug("User authenticated")

	var req CreateAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("Invalid request body", "error", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	logger.Info("Request decoded", 
		"type", req.Type,
		"street_address", req.StreetAddress,
		"city", req.City,
		"state", req.State,
		"zip_code", req.ZipCode,
		"is_default", req.IsDefault,
	)

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// If this is set as default, unset other defaults
	if req.IsDefault {
		dbLogger := LogDatabase("unset_defaults", userID).With("address_id", addressID)
		dbLogger.Info("Unsetting other defaults")
		_, err = tx.Exec(`
			UPDATE addresses SET is_default = false 
			WHERE user_id = $1 AND is_default = true AND id != $2`,
			userID, addressID,
		)
		if err != nil {
			dbLogger.Error("Failed to update defaults", "error", err)
			http.Error(w, "Failed to update defaults", http.StatusInternalServerError)
			return
		}
		dbLogger.Debug("Other defaults unset successfully")
	}

	// Build dynamic update query based on provided fields
	updateFields := []string{}
	updateValues := []interface{}{}
	paramIndex := 1

	if req.Type != "" {
		updateFields = append(updateFields, "type = $"+strconv.Itoa(paramIndex))
		updateValues = append(updateValues, req.Type)
		paramIndex++
	}
	if req.StreetAddress != "" {
		updateFields = append(updateFields, "street_address = $"+strconv.Itoa(paramIndex))
		updateValues = append(updateValues, req.StreetAddress)
		paramIndex++
	}
	if req.City != "" {
		updateFields = append(updateFields, "city = $"+strconv.Itoa(paramIndex))
		updateValues = append(updateValues, req.City)
		paramIndex++
	}
	if req.State != "" {
		updateFields = append(updateFields, "state = $"+strconv.Itoa(paramIndex))
		updateValues = append(updateValues, req.State)
		paramIndex++
	}
	if req.ZipCode != "" {
		updateFields = append(updateFields, "zip_code = $"+strconv.Itoa(paramIndex))
		updateValues = append(updateValues, req.ZipCode)
		paramIndex++
	}
	if req.DeliveryInstructions != nil {
		updateFields = append(updateFields, "delivery_instructions = $"+strconv.Itoa(paramIndex))
		updateValues = append(updateValues, req.DeliveryInstructions)
		paramIndex++
	}
	
	// Always update is_default if provided (even if false)
	updateFields = append(updateFields, "is_default = $"+strconv.Itoa(paramIndex))
	updateValues = append(updateValues, req.IsDefault)
	paramIndex++

	// Add WHERE clause parameters
	updateValues = append(updateValues, addressID, userID)

	if len(updateFields) == 0 {
		log.Printf("[ADDRESS_UPDATE] No fields to update")
		http.Error(w, "No fields to update", http.StatusBadRequest)
		return
	}

	query := fmt.Sprintf(`
		UPDATE addresses 
		SET %s
		WHERE id = $%d AND user_id = $%d`,
		strings.Join(updateFields, ", "),
		paramIndex, paramIndex+1,
	)

	dbLogger := LogDatabase("update_address", userID).With("address_id", addressID)
	dbLogger.Info("Executing update query", 
		"query", query,
		"param_count", len(updateValues),
		"fields_updated", len(updateFields)-1, // -1 for is_default which is always included
	)

	result, err := tx.Exec(query, updateValues...)
	if err != nil {
		dbLogger.Error("Failed to update address", "error", err)
		http.Error(w, "Failed to update address", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		dbLogger.Warn("Address not found", "rows_affected", rowsAffected)
		http.Error(w, "Address not found", http.StatusNotFound)
		return
	}
	dbLogger.Info("Address updated successfully", "rows_affected", rowsAffected)

	// Commit transaction
	if err := tx.Commit(); err != nil {
		dbLogger.Error("Failed to commit transaction", "error", err)
		http.Error(w, "Failed to complete address update", http.StatusInternalServerError)
		return
	}
	dbLogger.Info("Transaction committed successfully")

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
		logger.Error("Failed to fetch updated address", "error", err)
		http.Error(w, "Failed to fetch updated address", http.StatusInternalServerError)
		return
	}

	logger.Info("Address update completed successfully",
		"final_is_default", addr.IsDefault,
		"address_type", addr.Type,
		"city", addr.City,
	)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(addr)
}

// handleDeleteAddress deletes an address
func (h *AddressHandler) handleDeleteAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get address ID from URL using Gorilla Mux
	vars := mux.Vars(r)
	addressID, err := strconv.Atoi(vars["id"])
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