package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestPaymentHandler_CreateSetupIntent(t *testing.T) {
	// Skip if no Stripe key (for CI/CD)
	if os.Getenv("STRIPE_SECRET_KEY") == "" {
		t.Skip("Skipping Stripe test - no API key")
	}

	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "payment@example.com", "Payment", "User")

	mockRealtime := NewMockRealtimeHandler()
	handler := &PaymentHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	req := httptest.NewRequest("POST", "/api/payments/setup-intent", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w := httptest.NewRecorder()
	handler.handleCreateSetupIntent(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["client_secret"] == "" {
		t.Error("Expected client_secret in response")
	}
}

func TestPaymentHandler_GetPaymentMethods(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "payment@example.com", "Payment", "User")

	mockRealtime := NewMockRealtimeHandler()
	handler := &PaymentHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	req := httptest.NewRequest("GET", "/api/payments/methods", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w := httptest.NewRecorder()
	handler.handleGetPaymentMethods(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var methods []PaymentMethodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &methods); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Should return empty array for user with no payment methods
	if len(methods) != 0 {
		t.Errorf("Expected 0 payment methods, got %d", len(methods))
	}
}

func TestPaymentHandler_SetDefaultPaymentMethod(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test user
	userID := db.CreateTestUser(t, "payment@example.com", "Payment", "User")

	mockRealtime := NewMockRealtimeHandler()
	handler := &PaymentHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	requestBody := map[string]string{
		"payment_method_id": "pm_test_123456",
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/payments/methods/default", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w := httptest.NewRecorder()
	handler.handleSetDefaultPaymentMethod(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify the payment method was saved in database
	var defaultMethodID string
	err := db.QueryRow("SELECT default_payment_method_id FROM users WHERE id = $1", userID).Scan(&defaultMethodID)
	if err != nil {
		t.Fatalf("Failed to get default payment method: %v", err)
	}

	if defaultMethodID != "pm_test_123456" {
		t.Errorf("Expected default payment method pm_test_123456, got %s", defaultMethodID)
	}
}

func TestPaymentHandler_CreateOrderPayment(t *testing.T) {
	// Skip if no Stripe key (for CI/CD)
	if os.Getenv("STRIPE_SECRET_KEY") == "" {
		t.Skip("Skipping Stripe test - no API key")
	}

	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "payment@example.com", "Payment", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	// Update order with realistic total
	_, err := db.Exec("UPDATE orders SET total = 100.00 WHERE id = $1", orderID)
	if err != nil {
		t.Fatalf("Failed to update order total: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &PaymentHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	requestBody := map[string]interface{}{
		"order_id": orderID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/api/payments/order", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w := httptest.NewRecorder()
	handler.handleCreateOrderPayment(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response["payment_intent_id"] == nil {
		t.Error("Expected payment_intent_id in response")
	}

	if response["client_secret"] == nil {
		t.Error("Expected client_secret in response")
	}

	// Verify payment record was created
	var paymentID int
	err = db.QueryRow(`
		SELECT id FROM payments 
		WHERE order_id = $1 AND user_id = $2 AND payment_type = 'extra_order'
	`, orderID, userID).Scan(&paymentID)
	
	if err != nil {
		t.Fatalf("Expected payment record to be created: %v", err)
	}
}

func TestPaymentHandler_GetPaymentHistory(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "payment@example.com", "Payment", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	// Create test payment records
	_, err := db.Exec(`
		INSERT INTO payments (user_id, order_id, amount, payment_type, status)
		VALUES ($1, $2, 100.00, 'extra_order', 'completed')
	`, userID, orderID)
	if err != nil {
		t.Fatalf("Failed to create test payment: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO payments (user_id, amount, payment_type, status)
		VALUES ($1, 170.00, 'subscription', 'completed')
	`, userID)
	if err != nil {
		t.Fatalf("Failed to create test payment: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &PaymentHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	tests := []struct {
		name          string
		queryParams   string
		expectedCount int
	}{
		{
			name:          "Get all payments",
			queryParams:   "",
			expectedCount: 2,
		},
		{
			name:          "Limit to 1",
			queryParams:   "?limit=1",
			expectedCount: 1,
		},
		{
			name:          "With offset",
			queryParams:   "?limit=1&offset=1",
			expectedCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/payments/history"+tt.queryParams, nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

			w := httptest.NewRecorder()
			handler.handleGetPaymentHistory(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var payments []interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &payments); err != nil {
				t.Fatalf("Failed to unmarshal response: %v", err)
			}

			if len(payments) != tt.expectedCount {
				t.Errorf("Expected %d payments, got %d", tt.expectedCount, len(payments))
			}
		})
	}
}

func TestPaymentHandler_Authentication(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	mockRealtime := NewMockRealtimeHandler()
	handler := &PaymentHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return 0, fmt.Errorf("unauthorized")
		},
	}

	endpoints := []struct {
		method string
		path   string
		body   interface{}
	}{
		{"POST", "/api/payments/setup-intent", nil},
		{"GET", "/api/payments/methods", nil},
		{"PUT", "/api/payments/methods/default", map[string]string{"payment_method_id": "pm_123"}},
		{"POST", "/api/payments/order", map[string]int{"order_id": 1}},
		{"GET", "/api/payments/history", nil},
	}

	for _, ep := range endpoints {
		t.Run(fmt.Sprintf("%s %s requires auth", ep.method, ep.path), func(t *testing.T) {
			var req *http.Request
			if ep.body != nil {
				body, _ := json.Marshal(ep.body)
				req = httptest.NewRequest(ep.method, ep.path, bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(ep.method, ep.path, nil)
			}

			w := httptest.NewRecorder()

			// Call the appropriate handler
			switch ep.path {
			case "/api/payments/setup-intent":
				handler.handleCreateSetupIntent(w, req)
			case "/api/payments/methods":
				handler.handleGetPaymentMethods(w, req)
			case "/api/payments/methods/default":
				handler.handleSetDefaultPaymentMethod(w, req)
			case "/api/payments/order":
				handler.handleCreateOrderPayment(w, req)
			case "/api/payments/history":
				handler.handleGetPaymentHistory(w, req)
			}

			if w.Code != http.StatusUnauthorized {
				t.Errorf("Expected status 401, got %d", w.Code)
			}
		})
	}
}

func TestPaymentHandler_MethodValidation(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	userID := db.CreateTestUser(t, "payment@example.com", "Payment", "User")

	mockRealtime := NewMockRealtimeHandler()
	handler := &PaymentHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{"POST to setup-intent with GET", "GET", "/api/payments/setup-intent", http.StatusMethodNotAllowed},
		{"GET to methods with POST", "POST", "/api/payments/methods", http.StatusMethodNotAllowed},
		{"PUT to default with GET", "GET", "/api/payments/methods/default", http.StatusMethodNotAllowed},
		{"POST to order with GET", "GET", "/api/payments/order", http.StatusMethodNotAllowed},
		{"GET to history with POST", "POST", "/api/payments/history", http.StatusMethodNotAllowed},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

			w := httptest.NewRecorder()

			// Call the appropriate handler
			switch tt.path {
			case "/api/payments/setup-intent":
				handler.handleCreateSetupIntent(w, req)
			case "/api/payments/methods":
				handler.handleGetPaymentMethods(w, req)
			case "/api/payments/methods/default":
				handler.handleSetDefaultPaymentMethod(w, req)
			case "/api/payments/order":
				handler.handleCreateOrderPayment(w, req)
			case "/api/payments/history":
				handler.handleGetPaymentHistory(w, req)
			}

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}