package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

func TestAddressHandler_CreateAddress(t *testing.T) {
	InitLogger()
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")

	handler := NewAddressHandler(db.DB)

	tests := []struct {
		name           string
		requestBody    CreateAddressRequest
		expectedStatus int
		userID         int
	}{
		{
			name: "Valid address creation",
			requestBody: CreateAddressRequest{
				Type:          "home",
				StreetAddress: "123 Test Street",
				City:          "Test City",
				State:         "CA",
				ZipCode:       "12345",
				DeliveryInstructions: stringPtr("Leave at front door"),
				IsDefault:     true,
			},
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name: "Missing street address",
			requestBody: CreateAddressRequest{
				Type:    "home",
				City:    "Test City",
				State:   "CA",
				ZipCode: "12345",
			},
			expectedStatus: http.StatusBadRequest,
			userID:         userID,
		},
		{
			name: "Missing city",
			requestBody: CreateAddressRequest{
				Type:          "home",
				StreetAddress: "123 Test Street",
				State:         "CA",
				ZipCode:       "12345",
			},
			expectedStatus: http.StatusBadRequest,
			userID:         userID,
		},
		{
			name: "Missing state",
			requestBody: CreateAddressRequest{
				Type:          "home",
				StreetAddress: "123 Test Street",
				City:          "Test City",
				ZipCode:       "12345",
			},
			expectedStatus: http.StatusBadRequest,
			userID:         userID,
		},
		{
			name: "Missing zip code",
			requestBody: CreateAddressRequest{
				Type:          "home",
				StreetAddress: "123 Test Street",
				City:          "Test City",
				State:         "CA",
			},
			expectedStatus: http.StatusBadRequest,
			userID:         userID,
		},
		{
			name: "Valid work address",
			requestBody: CreateAddressRequest{
				Type:          "work",
				StreetAddress: "456 Work Ave",
				City:          "Work City",
				State:         "NY",
				ZipCode:       "54321",
				IsDefault:     false,
			},
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/addresses/create", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}

			handler.handleCreateAddress(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Response: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var address Address
				if err := json.Unmarshal(w.Body.Bytes(), &address); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if address.ID == 0 {
					t.Error("Expected address ID to be set")
				}

				if address.StreetAddress != tt.requestBody.StreetAddress {
					t.Errorf("Expected street address '%s', got '%s'", tt.requestBody.StreetAddress, address.StreetAddress)
				}

				if address.City != tt.requestBody.City {
					t.Errorf("Expected city '%s', got '%s'", tt.requestBody.City, address.City)
				}

				if address.State != tt.requestBody.State {
					t.Errorf("Expected state '%s', got '%s'", tt.requestBody.State, address.State)
				}

				if address.ZipCode != tt.requestBody.ZipCode {
					t.Errorf("Expected zip code '%s', got '%s'", tt.requestBody.ZipCode, address.ZipCode)
				}

				if address.Type != tt.requestBody.Type {
					t.Errorf("Expected type '%s', got '%s'", tt.requestBody.Type, address.Type)
				}

				if address.IsDefault != tt.requestBody.IsDefault {
					t.Errorf("Expected is_default %v, got %v", tt.requestBody.IsDefault, address.IsDefault)
				}
			}
		})
	}
}

func TestAddressHandler_GetAddresses(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user and addresses
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID1 := db.CreateTestAddress(t, userID)
	
	// Create second address
	var addressID2 int
	err := db.QueryRow(`
		INSERT INTO addresses (user_id, street_address, city, state, zip_code, type, is_default)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		userID, "456 Second St", "Test City", "CA", "54321", "work", false,
	).Scan(&addressID2)
	if err != nil {
		t.Fatalf("Failed to create second test address: %v", err)
	}

	handler := NewAddressHandler(db.DB)

	tests := []struct {
		name           string
		expectedStatus int
		userID         int
		expectedCount  int
	}{
		{
			name:           "Get addresses for user with addresses",
			expectedStatus: http.StatusOK,
			userID:         userID,
			expectedCount:  2,
		},
		{
			name:           "Get addresses for user without addresses",
			expectedStatus: http.StatusOK,
			userID:         99999,
			expectedCount:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/addresses", nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}

			handler.handleGetAddresses(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var addresses []Address
				if err := json.Unmarshal(w.Body.Bytes(), &addresses); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if len(addresses) != tt.expectedCount {
					t.Errorf("Expected %d addresses, got %d", tt.expectedCount, len(addresses))
				}

				if tt.expectedCount > 0 {
					// Check that default address comes first
					if len(addresses) > 1 && !addresses[0].IsDefault {
						t.Error("Expected default address to be first in results")
					}

					// Verify one of our created addresses is present
					found := false
					for _, addr := range addresses {
						if addr.ID == addressID1 || addr.ID == addressID2 {
							found = true
							break
						}
					}
					if !found {
						t.Error("Expected to find one of the created addresses")
					}
				}
			}
		})
	}
}

func TestAddressHandler_UpdateAddress(t *testing.T) {
	// Initialize logger to avoid nil pointer
	InitLogger()
	
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user and address
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)

	handler := NewAddressHandler(db.DB)

	tests := []struct {
		name           string
		addressID      int
		requestBody    CreateAddressRequest
		expectedStatus int
		userID         int
	}{
		{
			name:      "Valid address update",
			addressID: addressID,
			requestBody: CreateAddressRequest{
				Type:          "work",
				StreetAddress: "456 Updated Street",
				City:          "Updated City",
				State:         "NY",
				ZipCode:       "54321",
				DeliveryInstructions: stringPtr("Updated instructions"),
				IsDefault:     false,
			},
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name:      "Update non-existing address",
			addressID: 99999,
			requestBody: CreateAddressRequest{
				Type:          "home",
				StreetAddress: "123 Test Street",
				City:          "Test City",
				State:         "CA",
				ZipCode:       "12345",
			},
			expectedStatus: http.StatusNotFound,
			userID:         userID,
		},
		{
			name:      "Update with missing required fields",
			addressID: addressID,
			requestBody: CreateAddressRequest{
				Type:  "home",
				State: "CA",
			},
			expectedStatus: http.StatusOK, // Should still work, just with empty fields
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set up router
			router := mux.NewRouter()
			
			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}
			
			// Register the route
			router.HandleFunc("/addresses/{id}", handler.handleUpdateAddress).Methods("PUT")

			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("PUT", fmt.Sprintf("/addresses/%d", tt.addressID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Response: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var address Address
				if err := json.Unmarshal(w.Body.Bytes(), &address); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if address.ID != tt.addressID {
					t.Errorf("Expected address ID %d, got %d", tt.addressID, address.ID)
				}

				// Check updated fields (only if they were provided)
				if tt.requestBody.StreetAddress != "" && address.StreetAddress != tt.requestBody.StreetAddress {
					t.Errorf("Expected street address '%s', got '%s'", tt.requestBody.StreetAddress, address.StreetAddress)
				}

				if tt.requestBody.Type != "" && address.Type != tt.requestBody.Type {
					t.Errorf("Expected type '%s', got '%s'", tt.requestBody.Type, address.Type)
				}
			}
		})
	}
}

func TestAddressHandler_DeleteAddress(t *testing.T) {
	InitLogger()
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user and address
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)

	handler := NewAddressHandler(db.DB)

	tests := []struct {
		name           string
		addressID      int
		expectedStatus int
		userID         int
	}{
		{
			name:           "Delete existing address",
			addressID:      addressID,
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name:           "Delete non-existing address",
			addressID:      99999,
			expectedStatus: http.StatusNotFound,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set up router
			router := mux.NewRouter()
			
			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}
			
			// Register the route
			router.HandleFunc("/addresses/{id}", handler.handleDeleteAddress).Methods("DELETE")

			req := httptest.NewRequest("DELETE", fmt.Sprintf("/addresses/%d", tt.addressID), nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Response: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]string
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if response["message"] == "" {
					t.Error("Expected success message in response")
				}

				// Verify address is actually deleted
				var count int
				err := db.QueryRow("SELECT COUNT(*) FROM addresses WHERE id = $1", tt.addressID).Scan(&count)
				if err != nil {
					t.Errorf("Failed to check if address was deleted: %v", err)
				} else if count != 0 {
					t.Error("Expected address to be deleted from database")
				}
			}
		})
	}
}

func TestAddressHandler_DefaultAddressHandling(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")

	handler := NewAddressHandler(db.DB)

	// Create first address as default
	requestBody1 := CreateAddressRequest{
		Type:          "home",
		StreetAddress: "123 First Street",
		City:          "Test City",
		State:         "CA",
		ZipCode:       "12345",
		IsDefault:     true,
	}

	body1, _ := json.Marshal(requestBody1)
	req1 := httptest.NewRequest("POST", "/api/addresses/create", bytes.NewBuffer(body1))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w1 := httptest.NewRecorder()

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	handler.handleCreateAddress(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("Failed to create first address: status %d", w1.Code)
	}

	var address1 Address
	json.Unmarshal(w1.Body.Bytes(), &address1)

	// Create second address as default (should unset first one)
	requestBody2 := CreateAddressRequest{
		Type:          "work",
		StreetAddress: "456 Second Street",
		City:          "Test City",
		State:         "CA",
		ZipCode:       "54321",
		IsDefault:     true,
	}

	body2, _ := json.Marshal(requestBody2)
	req2 := httptest.NewRequest("POST", "/api/addresses/create", bytes.NewBuffer(body2))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w2 := httptest.NewRecorder()
	handler.handleCreateAddress(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("Failed to create second address: status %d", w2.Code)
	}

	// Check that only one address is marked as default
	var defaultCount int
	err := db.QueryRow("SELECT COUNT(*) FROM addresses WHERE user_id = $1 AND is_default = true", userID).Scan(&defaultCount)
	if err != nil {
		t.Fatalf("Failed to count default addresses: %v", err)
	}

	if defaultCount != 1 {
		t.Errorf("Expected exactly 1 default address, got %d", defaultCount)
	}

	// Check that the second address is now the default
	var isDefault bool
	err = db.QueryRow("SELECT is_default FROM addresses WHERE id = $1", address1.ID).Scan(&isDefault)
	if err != nil {
		t.Fatalf("Failed to check first address default status: %v", err)
	}

	if isDefault {
		t.Error("Expected first address to no longer be default")
	}
}

// Test cross-user access prevention
func TestAddressHandler_UserIsolation(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create two users
	userID1 := db.CreateTestUser(t, "user1@example.com", "User", "One")
	userID2 := db.CreateTestUser(t, "user2@example.com", "User", "Two")

	// Create address for user1
	addressID := db.CreateTestAddress(t, userID1)

	handler := NewAddressHandler(db.DB)

	// Try to access user1's address as user2
	req := httptest.NewRequest("GET", "/api/addresses", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID2)))

	w := httptest.NewRecorder()

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID2, nil
	}

	handler.handleGetAddresses(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var addresses []Address
	if err := json.Unmarshal(w.Body.Bytes(), &addresses); err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	// User2 should not see user1's addresses
	if len(addresses) != 0 {
		t.Errorf("Expected 0 addresses for user2, got %d", len(addresses))
	}

	// Verify user1's address still exists but is not visible to user2
	for _, addr := range addresses {
		if addr.ID == addressID {
			t.Error("User2 should not be able to see user1's address")
		}
	}
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}

// Benchmark test
func BenchmarkAddressHandler_GetAddresses(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	// Create test user and multiple addresses
	userID := db.CreateTestUser(&testing.T{}, "bench@example.com", "Bench", "User")
	for i := 0; i < 10; i++ {
		db.CreateTestAddress(&testing.T{}, userID)
	}

	handler := NewAddressHandler(db.DB)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/addresses", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

		w := httptest.NewRecorder()

		// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

		handler.handleGetAddresses(w, req)
	}
}