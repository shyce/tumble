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

func TestSubscriptionHandler_GetPlans(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create handler for this test
	handler := NewSubscriptionHandler(db.DB)

	req := httptest.NewRequest("GET", "/api/subscriptions/plans", nil)
	w := httptest.NewRecorder()

	handler.handleGetPlans(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var plans []SubscriptionPlan
	if err := json.Unmarshal(w.Body.Bytes(), &plans); err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	// Should have at least the seeded plans
	if len(plans) < 2 {
		t.Errorf("Expected at least 2 plans, got %d", len(plans))
	}

	// Check for expected plan structure
	if len(plans) > 0 {
		plan := plans[0]
		
		// Verify required fields exist
		if plan.ID == 0 {
			t.Error("Expected plan to have ID")
		}
		if plan.Name == "" {
			t.Error("Expected plan to have name")
		}
		if plan.PricePerMonth == 0 {
			t.Error("Expected plan to have price_per_month")
		}
		if plan.PickupsPerMonth == 0 {
			t.Error("Expected plan to have pickups_per_month")
		}

		// Verify pricing matches README specs
		foundCorrectPricing := false
		for _, p := range plans {
			if p.Name == "Weekly Standard" && p.PricePerMonth == 170.0 {
				foundCorrectPricing = true
				break
			}
		}
		if !foundCorrectPricing {
			t.Error("Expected to find Weekly Standard plan with price $170")
		}
	}
}

func TestSubscriptionHandler_CreateSubscription(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	planID := db.GetPlanID(t, "Weekly Standard")

	// Handler will be created per test with mocked getUserID

	tests := []struct {
		name           string
		requestBody    CreateSubscriptionRequest
		expectedStatus int
		userID         int
	}{
		{
			name: "Valid subscription creation",
			requestBody: CreateSubscriptionRequest{
				PlanID: planID,
			},
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name: "Invalid plan ID",
			requestBody: CreateSubscriptionRequest{
				PlanID: 99999,
			},
			expectedStatus: http.StatusBadRequest,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean up any existing subscriptions
			db.TruncateTables(t)
			userID := db.CreateTestUser(t, "test2@example.com", "Test", "User")

			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/subscriptions/create", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

			w := httptest.NewRecorder()

			// Create handler with mocked getUserID for this specific test
			handler := &SubscriptionHandler{
				db: db.DB,
				getUserID: func(r *http.Request, db *sql.DB) (int, error) {
					return userID, nil
				},
			}

			handler.handleCreateSubscription(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var subscription Subscription
				if err := json.Unmarshal(w.Body.Bytes(), &subscription); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if subscription.ID == 0 {
					t.Error("Expected subscription ID to be set")
				}

				if subscription.Status != "active" {
					t.Errorf("Expected status 'active', got '%s'", subscription.Status)
				}

				if subscription.PlanID != tt.requestBody.PlanID {
					t.Errorf("Expected plan ID %d, got %d", tt.requestBody.PlanID, subscription.PlanID)
				}
			}
		})
	}
}

func TestSubscriptionHandler_GetSubscription(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	planID := db.GetPlanID(t, "Bi-Weekly Standard")
	subscriptionID := db.CreateTestSubscription(t, userID, planID)

	// Handler will be created per test with mocked getUserID

	tests := []struct {
		name           string
		expectedStatus int
		userID         int
		hasSubscription bool
	}{
		{
			name:           "Get existing subscription",
			expectedStatus: http.StatusOK,
			userID:         userID,
			hasSubscription: true,
		},
		{
			name:           "Get non-existing subscription",
			expectedStatus: http.StatusNotFound,
			userID:         99999,
			hasSubscription: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/subscriptions/current", nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Create handler with mocked getUserID for this specific test
			handler := &SubscriptionHandler{
				db: db.DB,
				getUserID: func(r *http.Request, db *sql.DB) (int, error) {
					return tt.userID, nil
				},
			}

			handler.handleGetSubscription(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.hasSubscription && tt.expectedStatus == http.StatusOK {
				var subscription Subscription
				if err := json.Unmarshal(w.Body.Bytes(), &subscription); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if subscription.ID != subscriptionID {
					t.Errorf("Expected subscription ID %d, got %d", subscriptionID, subscription.ID)
				}

				if subscription.Plan == nil {
					t.Error("Expected subscription to include plan details")
				}
			}
		})
	}
}

func TestSubscriptionHandler_UpdateSubscription(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	planID := db.GetPlanID(t, "Weekly Standard")
	subscriptionID := db.CreateTestSubscription(t, userID, planID)

	// Handler will be created per test with mocked getUserID

	tests := []struct {
		name           string
		subscriptionID int
		requestBody    UpdateSubscriptionRequest
		expectedStatus int
		userID         int
	}{
		{
			name:           "Pause subscription",
			subscriptionID: subscriptionID,
			requestBody: UpdateSubscriptionRequest{
				Status: "paused",
			},
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name:           "Invalid status",
			subscriptionID: subscriptionID,
			requestBody: UpdateSubscriptionRequest{
				Status: "invalid_status",
			},
			expectedStatus: http.StatusBadRequest,
			userID:         userID,
		},
		{
			name:           "Non-existing subscription",
			subscriptionID: 99999,
			requestBody: UpdateSubscriptionRequest{
				Status: "paused",
			},
			expectedStatus: http.StatusNotFound,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set up router
			router := mux.NewRouter()
			
			// Create handler with mocked getUserID for this specific test
			handler := &SubscriptionHandler{
				db: db.DB,
				getUserID: func(r *http.Request, db *sql.DB) (int, error) {
					return tt.userID, nil
				},
			}
			
			// Register the route
			router.HandleFunc("/subscriptions/{id}", handler.handleUpdateSubscription).Methods("PUT")

			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("PUT", fmt.Sprintf("/subscriptions/%d", tt.subscriptionID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var subscription Subscription
				if err := json.Unmarshal(w.Body.Bytes(), &subscription); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if subscription.Status != tt.requestBody.Status {
					t.Errorf("Expected status '%s', got '%s'", tt.requestBody.Status, subscription.Status)
				}
			}
		})
	}
}

func TestSubscriptionHandler_CancelSubscription(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	planID := db.GetPlanID(t, "Weekly Standard")
	subscriptionID := db.CreateTestSubscription(t, userID, planID)

	// Handler will be created per test with mocked getUserID

	tests := []struct {
		name           string
		subscriptionID int
		expectedStatus int
		userID         int
	}{
		{
			name:           "Cancel existing subscription",
			subscriptionID: subscriptionID,
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name:           "Cancel non-existing subscription",
			subscriptionID: 99999,
			expectedStatus: http.StatusNotFound,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set up router
			router := mux.NewRouter()
			
			// Create handler with mocked getUserID for this specific test
			handler := &SubscriptionHandler{
				db: db.DB,
				getUserID: func(r *http.Request, db *sql.DB) (int, error) {
					return tt.userID, nil
				},
			}
			
			// Register the route
			router.HandleFunc("/subscriptions/{id}/cancel", handler.handleCancelSubscription).Methods("POST")

			req := httptest.NewRequest("POST", fmt.Sprintf("/subscriptions/%d/cancel", tt.subscriptionID), nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]string
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if response["status"] != "cancelled" {
					t.Errorf("Expected status 'cancelled', got '%s'", response["status"])
				}

				// Verify subscription is actually cancelled in database
				var status string
				err := db.QueryRow("SELECT status FROM subscriptions WHERE id = $1", tt.subscriptionID).Scan(&status)
				if err != nil {
					t.Errorf("Failed to check subscription status: %v", err)
				} else if status != "cancelled" {
					t.Errorf("Expected subscription status 'cancelled' in DB, got '%s'", status)
				}
			}
		})
	}
}

func TestSubscriptionHandler_GetUsage(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	planID := db.GetPlanID(t, "Weekly Standard")
	subscriptionID := db.CreateTestSubscription(t, userID, planID)
	addressID := db.CreateTestAddress(t, userID)

	// Create an order to test usage calculation
	orderID := db.CreateTestOrder(t, userID, addressID)
	
	// Link order to subscription and set pickup date within subscription period
	_, err := db.Exec("UPDATE orders SET subscription_id = $1, pickup_date = CURRENT_DATE WHERE id = $2", subscriptionID, orderID)
	if err != nil {
		t.Fatalf("Failed to link order to subscription: %v", err)
	}

	// Add order items - use price = 0 to indicate covered bags
	serviceID := db.GetServiceID(t, "standard_bag")
	_, err = db.Exec(`
		INSERT INTO order_items (order_id, service_id, quantity, price)
		VALUES ($1, $2, 2, 0.00)`,
		orderID, serviceID)
	if err != nil {
		t.Fatalf("Failed to add order items: %v", err)
	}
	
	// Also add pickup service as covered
	pickupServiceID := db.GetServiceID(t, "pickup_service")
	_, err = db.Exec(`
		INSERT INTO order_items (order_id, service_id, quantity, price)
		VALUES ($1, $2, 1, 0.00)`,
		orderID, pickupServiceID)
	if err != nil {
		t.Fatalf("Failed to add pickup service: %v", err)
	}

	// Handler will be created per test with mocked getUserID

	tests := []struct {
		name           string
		expectedStatus int
		userID         int
		hasSubscription bool
	}{
		{
			name:           "Get usage for user with subscription",
			expectedStatus: http.StatusOK,
			userID:         userID,
			hasSubscription: true,
		},
		{
			name:           "Get usage for user without subscription",
			expectedStatus: http.StatusNotFound,
			userID:         99999,
			hasSubscription: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/subscriptions/usage", nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Mock getUserIDFromRequest
			// Create handler with mocked getUserID for this specific test
			handler := &SubscriptionHandler{
				db: db.DB,
				getUserID: func(r *http.Request, db *sql.DB) (int, error) {
					return tt.userID, nil
				},
			}

			handler.handleGetSubscriptionUsage(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.hasSubscription && tt.expectedStatus == http.StatusOK {
				var usage map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &usage); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				requiredFields := []string{
					"subscription_id", "current_period_start", "current_period_end",
					"pickups_used", "pickups_allowed", "pickups_remaining",
					"bags_used", "bags_allowed", "bags_remaining",
				}

				for _, field := range requiredFields {
					if _, exists := usage[field]; !exists {
						t.Errorf("Expected usage to have field '%s'", field)
					}
				}

				// Verify usage calculations
				if usage["pickups_used"].(float64) != 1 {
					t.Errorf("Expected 1 pickup used, got %v", usage["pickups_used"])
				}

				if usage["bags_used"].(float64) != 2 {
					t.Errorf("Expected 2 bags used, got %v", usage["bags_used"])
				}
			}
		})
	}
}

// Test duplicate subscription prevention
func TestSubscriptionHandler_PreventDuplicateSubscription(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	planID := db.GetPlanID(t, "Weekly Standard")
	
	// Create first subscription
	db.CreateTestSubscription(t, userID, planID)

	// Handler will be created per test with mocked getUserID

	// Try to create second subscription
	requestBody := CreateSubscriptionRequest{
		PlanID: planID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/api/subscriptions/create", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w := httptest.NewRecorder()

	// Mock getUserIDFromRequest
	// Create handler with mocked getUserID for this test
	handler := &SubscriptionHandler{
		db: db.DB,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	handler.handleCreateSubscription(w, req)

	// Should fail with bad request
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

// Benchmark test
func BenchmarkSubscriptionHandler_GetPlans(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	// Create handler for this benchmark
	handler := NewSubscriptionHandler(db.DB)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/subscriptions/plans", nil)
		w := httptest.NewRecorder()
		handler.handleGetPlans(w, req)
	}
}

// ===== SUBSCRIPTION PREFERENCES TESTS =====

func TestSubscriptionHandler_GetSubscriptionPreferences_NoPreferences(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")

	// Create handler
	handler := NewSubscriptionHandler(db.DB)

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	// Create request with user context
	req := httptest.NewRequest("GET", "/api/subscriptions/preferences", nil)
	w := httptest.NewRecorder()

	handler.handleGetSubscriptionPreferences(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var prefs SubscriptionPreferences
	if err := json.Unmarshal(w.Body.Bytes(), &prefs); err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	// Check default values are returned
	if prefs.UserID != userID {
		t.Errorf("Expected user_id %d, got %d", userID, prefs.UserID)
	}
	if prefs.PreferredPickupTimeSlot != "8:00 AM - 12:00 PM" {
		t.Errorf("Expected default pickup time slot, got %s", prefs.PreferredPickupTimeSlot)
	}
	if prefs.PreferredPickupDay != "monday" {
		t.Errorf("Expected default pickup day monday, got %s", prefs.PreferredPickupDay)
	}
	if !prefs.AutoScheduleEnabled {
		t.Error("Expected auto schedule to be enabled by default")
	}
	// Get the expected standard_bag service ID
	var expectedServiceID int
	err := db.QueryRow("SELECT id FROM services WHERE name = 'standard_bag' AND is_active = true LIMIT 1").Scan(&expectedServiceID)
	if err != nil {
		t.Fatalf("Failed to get standard_bag service ID: %v", err)
	}
	
	if len(prefs.DefaultServices) != 1 || prefs.DefaultServices[0].ServiceID != expectedServiceID {
		t.Errorf("Expected default service to be standard_bag service ID %d, got length=%d, serviceID=%d", 
			expectedServiceID, len(prefs.DefaultServices), 
			func() int { if len(prefs.DefaultServices) > 0 { return prefs.DefaultServices[0].ServiceID } else { return -1 } }())
	}
}

func TestSubscriptionHandler_CreateSubscriptionPreferences(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")

	// Create test addresses
	pickupAddrID := db.CreateTestAddress(t, userID)
	deliveryAddrID := db.CreateTestAddress(t, userID)

	// Create handler
	handler := NewSubscriptionHandler(db.DB)

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	// Create request body
	reqBody := CreateSubscriptionPreferencesRequest{
		DefaultPickupAddressID:   &pickupAddrID,
		DefaultDeliveryAddressID: &deliveryAddrID,
		PreferredPickupTimeSlot:  "12:00 PM - 4:00 PM",
		PreferredDeliveryTimeSlot: "4:00 PM - 8:00 PM",
		PreferredPickupDay:       "tuesday",
		DefaultServices:          []ServiceRequest{{ServiceID: 1, Quantity: 2}},
		AutoScheduleEnabled:      true,
		LeadTimeDays:             2,
		SpecialInstructions:      "Test instructions",
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/subscriptions/preferences", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.handleCreateOrUpdateSubscriptionPreferences(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	if response["message"] != "Preferences saved successfully" {
		t.Errorf("Expected success message, got %s", response["message"])
	}

	// Verify preferences were saved by retrieving them
	req2 := httptest.NewRequest("GET", "/api/subscriptions/preferences", nil)
	w2 := httptest.NewRecorder()

	handler.handleGetSubscriptionPreferences(w2, req2)

	var savedPrefs SubscriptionPreferences
	if err := json.Unmarshal(w2.Body.Bytes(), &savedPrefs); err != nil {
		t.Errorf("Failed to unmarshal saved preferences: %v", err)
	}

	// Verify all fields were saved correctly
	if savedPrefs.DefaultPickupAddressID == nil || *savedPrefs.DefaultPickupAddressID != pickupAddrID {
		t.Errorf("Expected pickup address ID %d, got %v", pickupAddrID, savedPrefs.DefaultPickupAddressID)
	}
	if savedPrefs.DefaultDeliveryAddressID == nil || *savedPrefs.DefaultDeliveryAddressID != deliveryAddrID {
		t.Errorf("Expected delivery address ID %d, got %v", deliveryAddrID, savedPrefs.DefaultDeliveryAddressID)
	}
	if savedPrefs.PreferredPickupTimeSlot != "12:00 PM - 4:00 PM" {
		t.Errorf("Expected pickup time slot '12:00 PM - 4:00 PM', got %s", savedPrefs.PreferredPickupTimeSlot)
	}
	if savedPrefs.PreferredPickupDay != "tuesday" {
		t.Errorf("Expected pickup day 'tuesday', got %s", savedPrefs.PreferredPickupDay)
	}
	if savedPrefs.LeadTimeDays != 2 {
		t.Errorf("Expected lead time days 2, got %d", savedPrefs.LeadTimeDays)
	}
	if savedPrefs.SpecialInstructions != "Test instructions" {
		t.Errorf("Expected special instructions 'Test instructions', got %s", savedPrefs.SpecialInstructions)
	}
}

func TestSubscriptionHandler_UpdateSubscriptionPreferences(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")

	// Create handler
	handler := NewSubscriptionHandler(db.DB)

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	// First create preferences
	reqBody1 := CreateSubscriptionPreferencesRequest{
		PreferredPickupTimeSlot:  "8:00 AM - 12:00 PM",
		PreferredDeliveryTimeSlot: "8:00 AM - 12:00 PM",
		PreferredPickupDay:       "monday",
		DefaultServices:          []ServiceRequest{{ServiceID: 1, Quantity: 1}},
		AutoScheduleEnabled:      true,
		LeadTimeDays:             1,
		SpecialInstructions:      "Original instructions",
	}

	body1, _ := json.Marshal(reqBody1)
	req1 := httptest.NewRequest("POST", "/api/subscriptions/preferences", bytes.NewBuffer(body1))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()

	handler.handleCreateOrUpdateSubscriptionPreferences(w1, req1)

	if w1.Code != http.StatusOK {
		t.Errorf("Expected status %d for create, got %d", http.StatusOK, w1.Code)
	}

	// Now update preferences
	reqBody2 := CreateSubscriptionPreferencesRequest{
		PreferredPickupTimeSlot:  "4:00 PM - 8:00 PM",
		PreferredDeliveryTimeSlot: "4:00 PM - 8:00 PM",
		PreferredPickupDay:       "friday",
		DefaultServices:          []ServiceRequest{{ServiceID: 1, Quantity: 3}},
		AutoScheduleEnabled:      false,
		LeadTimeDays:             3,
		SpecialInstructions:      "Updated instructions",
	}

	body2, _ := json.Marshal(reqBody2)
	req2 := httptest.NewRequest("PUT", "/api/subscriptions/preferences", bytes.NewBuffer(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()

	handler.handleCreateOrUpdateSubscriptionPreferences(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("Expected status %d for update, got %d", http.StatusOK, w2.Code)
	}

	// Verify preferences were updated
	req3 := httptest.NewRequest("GET", "/api/subscriptions/preferences", nil)
	w3 := httptest.NewRecorder()

	handler.handleGetSubscriptionPreferences(w3, req3)

	var updatedPrefs SubscriptionPreferences
	if err := json.Unmarshal(w3.Body.Bytes(), &updatedPrefs); err != nil {
		t.Errorf("Failed to unmarshal updated preferences: %v", err)
	}

	// Verify updated fields
	if updatedPrefs.PreferredPickupTimeSlot != "4:00 PM - 8:00 PM" {
		t.Errorf("Expected updated pickup time slot '4:00 PM - 8:00 PM', got %s", updatedPrefs.PreferredPickupTimeSlot)
	}
	if updatedPrefs.PreferredPickupDay != "friday" {
		t.Errorf("Expected updated pickup day 'friday', got %s", updatedPrefs.PreferredPickupDay)
	}
	if updatedPrefs.AutoScheduleEnabled {
		t.Error("Expected auto schedule to be disabled after update")
	}
	if updatedPrefs.LeadTimeDays != 3 {
		t.Errorf("Expected updated lead time days 3, got %d", updatedPrefs.LeadTimeDays)
	}
	if updatedPrefs.SpecialInstructions != "Updated instructions" {
		t.Errorf("Expected updated special instructions, got %s", updatedPrefs.SpecialInstructions)
	}
}

func TestSubscriptionHandler_CreateSubscriptionPreferences_InvalidAddress(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")

	// Create another user and their address
	otherUserID := db.CreateTestUser(t, "other@example.com", "Other", "User")
	otherUserAddrID := db.CreateTestAddress(t, otherUserID)

	// Create handler
	handler := NewSubscriptionHandler(db.DB)

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	// Try to create preferences with another user's address
	reqBody := CreateSubscriptionPreferencesRequest{
		DefaultPickupAddressID:   &otherUserAddrID, // This should fail
		PreferredPickupTimeSlot:  "8:00 AM - 12:00 PM",
		PreferredDeliveryTimeSlot: "8:00 AM - 12:00 PM",
		PreferredPickupDay:       "monday",
		DefaultServices:          []ServiceRequest{{ServiceID: 1, Quantity: 1}},
		AutoScheduleEnabled:      true,
		LeadTimeDays:             1,
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/subscriptions/preferences", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.handleCreateOrUpdateSubscriptionPreferences(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d for invalid address, got %d", http.StatusBadRequest, w.Code)
	}

	if !bytes.Contains(w.Body.Bytes(), []byte("Invalid pickup address")) {
		t.Errorf("Expected 'Invalid pickup address' error message, got %s", w.Body.String())
	}
}

func TestSubscriptionHandler_GetSubscriptionPreferences_Unauthorized(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create handler
	handler := NewSubscriptionHandler(db.DB)

	// Create request without authorization
	req := httptest.NewRequest("GET", "/api/subscriptions/preferences", nil)
	w := httptest.NewRecorder()

	handler.handleGetSubscriptionPreferences(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d for unauthorized request, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestSubscriptionHandler_CreateSubscriptionPreferences_InvalidJSON(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")

	// Create handler
	handler := NewSubscriptionHandler(db.DB)

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	// Create request with invalid JSON
	req := httptest.NewRequest("POST", "/api/subscriptions/preferences", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.handleCreateOrUpdateSubscriptionPreferences(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d for invalid JSON, got %d", http.StatusBadRequest, w.Code)
	}
}

// Benchmark tests for subscription preferences
func BenchmarkSubscriptionHandler_GetSubscriptionPreferences(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	// Create test user and preferences
	userID := db.CreateTestUser(&testing.T{}, "test@example.com", "Test", "User")
	handler := NewSubscriptionHandler(db.DB)

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	// Create some preferences first
	reqBody := CreateSubscriptionPreferencesRequest{
		PreferredPickupTimeSlot:  "8:00 AM - 12:00 PM",
		PreferredDeliveryTimeSlot: "8:00 AM - 12:00 PM",
		PreferredPickupDay:       "monday",
		DefaultServices:          []ServiceRequest{{ServiceID: 1, Quantity: 1}},
		AutoScheduleEnabled:      true,
		LeadTimeDays:             1,
	}
	body, _ := json.Marshal(reqBody)
	setupReq := httptest.NewRequest("POST", "/api/subscriptions/preferences", bytes.NewBuffer(body))
	setupReq.Header.Set("Content-Type", "application/json")
	setupW := httptest.NewRecorder()
	handler.handleCreateOrUpdateSubscriptionPreferences(setupW, setupReq)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/subscriptions/preferences", nil)
		w := httptest.NewRecorder()
		handler.handleGetSubscriptionPreferences(w, req)
	}
}

func BenchmarkSubscriptionHandler_CreateSubscriptionPreferences(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(&testing.T{}, "test@example.com", "Test", "User")
	handler := NewSubscriptionHandler(db.DB)

	// Mock auth for test
	handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		return userID, nil
	}

	reqBody := CreateSubscriptionPreferencesRequest{
		PreferredPickupTimeSlot:  "8:00 AM - 12:00 PM",
		PreferredDeliveryTimeSlot: "8:00 AM - 12:00 PM",
		PreferredPickupDay:       "monday",
		DefaultServices:          []ServiceRequest{{ServiceID: 1, Quantity: 1}},
		AutoScheduleEnabled:      true,
		LeadTimeDays:             1,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/subscriptions/preferences", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.handleCreateOrUpdateSubscriptionPreferences(w, req)
		
		// Clean up for next iteration
		db.DB.Exec("DELETE FROM subscription_preferences WHERE user_id = $1", userID)
	}
}