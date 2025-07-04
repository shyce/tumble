package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
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

	var plans []map[string]interface{}
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
		requiredFields := []string{"id", "name", "price", "frequency", "bags", "features"}
		for _, field := range requiredFields {
			if _, exists := plan[field]; !exists {
				t.Errorf("Expected plan to have field '%s'", field)
			}
		}

		// Verify pricing matches README specs
		foundCorrectPricing := false
		for _, p := range plans {
			if name, ok := p["name"].(string); ok && name == "Weekly Standard" {
				if price, ok := p["price"].(float64); ok && price == 170.0 {
					foundCorrectPricing = true
					break
				}
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
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("PUT", fmt.Sprintf("/api/subscriptions/%d", tt.subscriptionID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
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

			handler.handleUpdateSubscription(w, req)

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
			req := httptest.NewRequest("POST", fmt.Sprintf("/api/subscriptions/%d/cancel", tt.subscriptionID), nil)
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

			handler.handleCancelSubscription(w, req)

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
	
	// Link order to subscription
	_, err := db.Exec("UPDATE orders SET subscription_id = $1 WHERE id = $2", subscriptionID, orderID)
	if err != nil {
		t.Fatalf("Failed to link order to subscription: %v", err)
	}

	// Add order items
	serviceID := db.GetServiceID(t, "standard_bag")
	_, err = db.Exec(`
		INSERT INTO order_items (order_id, service_id, quantity, price)
		VALUES ($1, $2, 2, 45.00)`,
		orderID, serviceID)
	if err != nil {
		t.Fatalf("Failed to add order items: %v", err)
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