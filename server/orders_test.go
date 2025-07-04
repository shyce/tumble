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

func TestOrderHandler_CreateOrder(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	serviceID := db.GetServiceID(t, "standard_bag")

	// Create mock realtime handler
	mockRealtime := NewMockRealtimeHandler()

	tests := []struct {
		name           string
		requestBody    CreateOrderRequest
		expectedStatus int
		userID         int
	}{
		{
			name: "Valid order creation",
			requestBody: CreateOrderRequest{
				PickupAddressID:   addressID,
				DeliveryAddressID: addressID,
				PickupDate:        "2024-02-01",
				DeliveryDate:      "2024-02-03",
				PickupTimeSlot:    "9am-12pm",
				DeliveryTimeSlot:  "9am-12pm",
				Items: []OrderItem{
					{
						ServiceID: serviceID,
						Quantity:  2,
						Price:     45.00,
					},
				},
			},
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name: "Invalid address ID",
			requestBody: CreateOrderRequest{
				PickupAddressID:   99999,
				DeliveryAddressID: addressID,
				PickupDate:        "2024-02-01",
				DeliveryDate:      "2024-02-03",
				PickupTimeSlot:    "9am-12pm",
				DeliveryTimeSlot:  "9am-12pm",
				Items: []OrderItem{
					{
						ServiceID: serviceID,
						Quantity:  1,
						Price:     45.00,
					},
				},
			},
			expectedStatus: http.StatusInternalServerError,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create handler with mocked getUserID for this specific test
			testHandler := &OrderHandler{
				db:       db.DB,
				realtime: mockRealtime,
				getUserID: func(r *http.Request, db *sql.DB) (int, error) {
					return tt.userID, nil
				},
			}

			// Create request
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/orders/create", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			// Create response recorder
			w := httptest.NewRecorder()

			// Call handler
			testHandler.handleCreateOrder(w, req)

			// Check status code
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// For successful creation, verify response and realtime notification
			if tt.expectedStatus == http.StatusOK {
				var order Order
				if err := json.Unmarshal(w.Body.Bytes(), &order); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if order.ID == 0 {
					t.Error("Expected order ID to be set")
				}

				if order.Status != "scheduled" {
					t.Errorf("Expected status 'scheduled', got '%s'", order.Status)
				}

				// Verify realtime notification was sent
				if len(mockRealtime.PublishedUpdates) == 0 {
					t.Error("Expected realtime notification to be sent")
				} else {
					update := mockRealtime.PublishedUpdates[0]
					if update.UserID != userID || update.Status != "scheduled" {
						t.Errorf("Unexpected realtime update: userID=%d, status=%s", update.UserID, update.Status)
					}
				}
			}

			// Clear realtime updates for next test
			mockRealtime.ClearUpdates()
		})
	}
}

func TestOrderHandler_GetOrders(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := NewOrderHandler(db.DB, mockRealtime)

	tests := []struct {
		name           string
		queryParams    string
		expectedStatus int
		userID         int
		expectedCount  int
	}{
		{
			name:           "Get all orders",
			queryParams:    "",
			expectedStatus: http.StatusOK,
			userID:         userID,
			expectedCount:  1,
		},
		{
			name:           "Get orders with status filter",
			queryParams:    "?status=scheduled",
			expectedStatus: http.StatusOK,
			userID:         userID,
			expectedCount:  1,
		},
		{
			name:           "Get orders with non-matching status",
			queryParams:    "?status=delivered",
			expectedStatus: http.StatusOK,
			userID:         userID,
			expectedCount:  0,
		},
		{
			name:           "Get orders with limit",
			queryParams:    "?limit=10",
			expectedStatus: http.StatusOK,
			userID:         userID,
			expectedCount:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/orders"+tt.queryParams, nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}

			handler.handleGetOrders(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var orders []Order
				if err := json.Unmarshal(w.Body.Bytes(), &orders); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if len(orders) != tt.expectedCount {
					t.Errorf("Expected %d orders, got %d", tt.expectedCount, len(orders))
				}

				if tt.expectedCount > 0 {
					if orders[0].ID != orderID {
						t.Errorf("Expected order ID %d, got %d", orderID, orders[0].ID)
					}
				}
			}
		})
	}
}

func TestOrderHandler_GetOrder(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := NewOrderHandler(db.DB, mockRealtime)

	tests := []struct {
		name           string
		orderID        int
		expectedStatus int
		userID         int
	}{
		{
			name:           "Get existing order",
			orderID:        orderID,
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name:           "Get non-existing order",
			orderID:        99999,
			expectedStatus: http.StatusNotFound,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", fmt.Sprintf("/api/orders/%d", tt.orderID), nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}

			handler.handleGetOrder(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var order Order
				if err := json.Unmarshal(w.Body.Bytes(), &order); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if order.ID != tt.orderID {
					t.Errorf("Expected order ID %d, got %d", tt.orderID, order.ID)
				}
			}
		})
	}
}

func TestOrderHandler_UpdateOrderStatus(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := NewOrderHandler(db.DB, mockRealtime)

	tests := []struct {
		name           string
		orderID        int
		newStatus      string
		expectedStatus int
		userID         int
	}{
		{
			name:           "Update to picked_up",
			orderID:        orderID,
			newStatus:      "picked_up",
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name:           "Update to invalid status",
			orderID:        orderID,
			newStatus:      "invalid_status",
			expectedStatus: http.StatusBadRequest,
			userID:         userID,
		},
		{
			name:           "Update non-existing order",
			orderID:        99999,
			newStatus:      "delivered",
			expectedStatus: http.StatusNotFound,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reqBody := map[string]string{
				"status": tt.newStatus,
				"notes":  "Test update",
			}
			body, _ := json.Marshal(reqBody)

			req := httptest.NewRequest("PUT", fmt.Sprintf("/api/orders/%d/status", tt.orderID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}

			handler.handleUpdateOrderStatus(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var order Order
				if err := json.Unmarshal(w.Body.Bytes(), &order); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if order.Status != tt.newStatus {
					t.Errorf("Expected status '%s', got '%s'", tt.newStatus, order.Status)
				}

				// Verify realtime notification was sent
				if len(mockRealtime.PublishedUpdates) == 0 {
					t.Error("Expected realtime notification to be sent")
				} else {
					update := mockRealtime.PublishedUpdates[len(mockRealtime.PublishedUpdates)-1]
					if update.Status != tt.newStatus {
						t.Errorf("Expected realtime status '%s', got '%s'", tt.newStatus, update.Status)
					}
				}
			}

			// Clear realtime updates for next test
			mockRealtime.ClearUpdates()
		})
	}
}

func TestOrderHandler_GetOrderTracking(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	// Add some status history
	_, err := db.Exec(`
		INSERT INTO order_status_history (order_id, status, notes, updated_by)
		VALUES ($1, 'picked_up', 'Picked up by driver', $2)`,
		orderID, userID)
	if err != nil {
		t.Fatalf("Failed to add status history: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := NewOrderHandler(db.DB, mockRealtime)

	tests := []struct {
		name           string
		orderID        int
		expectedStatus int
		userID         int
	}{
		{
			name:           "Get tracking for existing order",
			orderID:        orderID,
			expectedStatus: http.StatusOK,
			userID:         userID,
		},
		{
			name:           "Get tracking for non-existing order",
			orderID:        99999,
			expectedStatus: http.StatusNotFound,
			userID:         userID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", fmt.Sprintf("/api/orders/%d/tracking", tt.orderID), nil)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(tt.userID)))

			w := httptest.NewRecorder()

			// Mock auth for test
			handler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
				return tt.userID, nil
			}

			handler.handleGetOrderTracking(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				if response["id"] == nil {
					t.Error("Expected tracking response to have id field")
				}

				events, ok := response["trackingEvents"].([]interface{})
				if !ok {
					t.Error("Expected trackingEvents to be an array")
				}

				// Should have at least 2 events (initial scheduled + picked_up)
				if len(events) < 2 {
					t.Errorf("Expected at least 2 tracking events, got %d", len(events))
				}
			}
		})
	}
}

// Benchmark tests
func BenchmarkOrderHandler_GetOrders(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(&testing.T{}, "bench@example.com", "Bench", "User")
	addressID := db.CreateTestAddress(&testing.T{}, userID)

	// Create multiple orders
	for i := 0; i < 100; i++ {
		db.CreateTestOrder(&testing.T{}, userID, addressID)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &OrderHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/orders", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

		w := httptest.NewRecorder()

		handler.handleGetOrders(w, req)
	}
}