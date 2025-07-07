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

func TestAdminHandler_RequireAdmin(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test users
	customerID := db.CreateTestUser(t, "customer@example.com", "Customer", "User")
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	
	// Update admin user role
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			// Extract user ID from request for testing
			if r.Header.Get("X-Test-User-ID") == fmt.Sprintf("%d", customerID) {
				return customerID, nil
			} else if r.Header.Get("X-Test-User-ID") == fmt.Sprintf("%d", adminID) {
				return adminID, nil
			}
			return 0, fmt.Errorf("unauthorized")
		},
	}

	tests := []struct {
		name           string
		userID         int
		expectedStatus int
	}{
		{
			name:           "Admin user allowed",
			userID:         adminID,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Customer user forbidden",
			userID:         customerID,
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "No auth unauthorized",
			userID:         0,
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a test handler that just returns OK
			testHandler := handler.requireAdmin(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			req := httptest.NewRequest("GET", "/api/admin/test", nil)
			if tt.userID > 0 {
				req.Header.Set("X-Test-User-ID", fmt.Sprintf("%d", tt.userID))
			}

			w := httptest.NewRecorder()
			testHandler(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestAdminHandler_GetUsers(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test users
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	customerID := db.CreateTestUser(t, "customer@example.com", "Customer", "User")
	driverID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	
	// Update roles
	db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverID)
	
	// Create some orders for the customer
	addressID := db.CreateTestAddress(t, customerID)
	db.CreateTestOrder(t, customerID, addressID)
	db.CreateTestOrder(t, customerID, addressID)
	
	// Create subscription for customer
	db.CreateTestSubscription(t, customerID, 1)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name          string
		queryParams   string
		expectedCount int
		checkUser     string
	}{
		{
			name:          "Get all users",
			queryParams:   "",
			expectedCount: 3,
		},
		{
			name:          "Filter by customer role",
			queryParams:   "?role=customer",
			expectedCount: 1,
			checkUser:     "customer@example.com",
		},
		{
			name:          "Filter by driver role",
			queryParams:   "?role=driver",
			expectedCount: 1,
			checkUser:     "driver@example.com",
		},
		{
			name:          "Search by email",
			queryParams:   "?search=customer",
			expectedCount: 1,
			checkUser:     "customer@example.com",
		},
		{
			name:          "Limit results",
			queryParams:   "?limit=2",
			expectedCount: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/admin/users"+tt.queryParams, nil)
			w := httptest.NewRecorder()

			handler.handleGetUsers(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var users []AdminUserResponse
			if err := json.Unmarshal(w.Body.Bytes(), &users); err != nil {
				t.Fatalf("Failed to unmarshal response: %v", err)
			}

			if len(users) != tt.expectedCount {
				t.Errorf("Expected %d users, got %d", tt.expectedCount, len(users))
			}

			if tt.checkUser != "" {
				found := false
				for _, u := range users {
					if u.Email == tt.checkUser {
						found = true
						// Verify additional fields
						if u.Email == "customer@example.com" {
							if u.TotalOrders != 2 {
								t.Errorf("Expected 2 orders for customer, got %d", u.TotalOrders)
							}
							if !u.ActiveSubscription {
								t.Error("Expected customer to have active subscription")
							}
						}
						break
					}
				}
				if !found {
					t.Errorf("Expected to find user %s", tt.checkUser)
				}
			}
		})
	}
}

func TestAdminHandler_UpdateUserRole(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test users
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	customerID := db.CreateTestUser(t, "customer@example.com", "Customer", "User")
	
	db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		userID         int
		newRole        string
		expectedStatus int
	}{
		{
			name:           "Valid role update to driver",
			userID:         customerID,
			newRole:        "driver",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Invalid role",
			userID:         customerID,
			newRole:        "invalid",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing user ID",
			userID:         0,
			newRole:        "driver",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]string{"role": tt.newRole}
			jsonBody, _ := json.Marshal(body)
			
			url := "/api/admin/users/role"
			if tt.userID > 0 {
				url = fmt.Sprintf("/api/admin/users/%d/role", tt.userID)
			}
			
			req := httptest.NewRequest("PUT", url, bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			
			// Need to set up mux vars since we're testing the handler directly
			if tt.userID > 0 {
				req = mux.SetURLVars(req, map[string]string{"id": fmt.Sprintf("%d", tt.userID)})
			}
			
			w := httptest.NewRecorder()
			handler.handleUpdateUserRole(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			// Verify role was updated if successful
			if tt.expectedStatus == http.StatusOK {
				var role string
				err := db.QueryRow("SELECT role FROM users WHERE id = $1", tt.userID).Scan(&role)
				if err != nil {
					t.Fatalf("Failed to get user role: %v", err)
				}
				if role != tt.newRole {
					t.Errorf("Expected role %s, got %s", tt.newRole, role)
				}
			}
		})
	}
}

func TestAdminHandler_GetOrdersSummary(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	
	customerID := db.CreateTestUser(t, "customer@example.com", "Customer", "User")
	addressID := db.CreateTestAddress(t, customerID)

	// Create various orders
	// Pending order
	db.Exec(`INSERT INTO orders (user_id, pickup_address_id, delivery_address_id, status, total, created_at) 
		VALUES ($1, $2, $2, 'pending', 100.00, CURRENT_TIMESTAMP)`, customerID, addressID)
	
	// In process order
	db.Exec(`INSERT INTO orders (user_id, pickup_address_id, delivery_address_id, status, total, created_at) 
		VALUES ($1, $2, $2, 'in_process', 150.00, CURRENT_TIMESTAMP)`, customerID, addressID)
	
	// Delivered order
	db.Exec(`INSERT INTO orders (user_id, pickup_address_id, delivery_address_id, status, total, created_at) 
		VALUES ($1, $2, $2, 'delivered', 200.00, CURRENT_TIMESTAMP)`, customerID, addressID)
	
	// Today's order
	db.Exec(`INSERT INTO orders (user_id, pickup_address_id, delivery_address_id, status, total, created_at) 
		VALUES ($1, $2, $2, 'scheduled', 75.00, CURRENT_TIMESTAMP)`, customerID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	req := httptest.NewRequest("GET", "/api/admin/orders/summary", nil)
	w := httptest.NewRecorder()

	handler.handleGetOrdersSummary(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var summary AdminOrderSummary
	if err := json.Unmarshal(w.Body.Bytes(), &summary); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify summary data
	if summary.TotalOrders != 4 {
		t.Errorf("Expected 4 total orders, got %d", summary.TotalOrders)
	}

	if summary.PendingOrders != 2 { // Both 'pending' and 'scheduled' count as pending
		t.Errorf("Expected 2 pending orders (1 pending + 1 scheduled), got %d", summary.PendingOrders)
	}

	if summary.InProcessOrders != 1 {
		t.Errorf("Expected 1 in-process order, got %d", summary.InProcessOrders)
	}

	if summary.CompletedOrders != 1 {
		t.Errorf("Expected 1 completed order, got %d", summary.CompletedOrders)
	}

	if summary.TotalRevenue != 525.00 {
		t.Errorf("Expected total revenue 525.00, got %.2f", summary.TotalRevenue)
	}

	if summary.TodayOrders != 4 { // All orders created today in test
		t.Errorf("Expected 4 today's orders, got %d", summary.TodayOrders)
	}
}

func TestAdminHandler_GetRevenueAnalytics(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name   string
		period string
	}{
		{name: "Daily analytics", period: "day"},
		{name: "Weekly analytics", period: "week"},
		{name: "Monthly analytics", period: "month"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/admin/analytics/revenue"
			if tt.period != "" {
				url += "?period=" + tt.period
			}

			req := httptest.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()

			handler.handleGetRevenueAnalytics(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("Expected status 200, got %d: %s", w.Code, w.Body.String())
			}

			var analytics []RevenueAnalytics
			if err := json.Unmarshal(w.Body.Bytes(), &analytics); err != nil {
				t.Fatalf("Failed to unmarshal response: %v", err)
			}

			// Should return an array (possibly empty)
			if analytics == nil {
				t.Error("Expected analytics array, got nil")
			}
		})
	}
}

func TestAdminHandler_AssignDriverToRoute(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	
	driverID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverID)
	
	customerID := db.CreateTestUser(t, "customer@example.com", "Customer", "User")
	addressID := db.CreateTestAddress(t, customerID)
	orderID1 := db.CreateTestOrder(t, customerID, addressID)
	orderID2 := db.CreateTestOrder(t, customerID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		request        map[string]interface{}
		expectedStatus int
	}{
		{
			name: "Valid route assignment",
			request: map[string]interface{}{
				"driver_id":  driverID,
				"order_ids":  []int{orderID1, orderID2},
				"route_date": "2024-12-01",
				"route_type": "pickup",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "Invalid route type",
			request: map[string]interface{}{
				"driver_id":  driverID,
				"order_ids":  []int{orderID1},
				"route_date": "2024-12-01",
				"route_type": "invalid",
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonBody, _ := json.Marshal(tt.request)
			req := httptest.NewRequest("POST", "/api/admin/drivers/assign", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			
			w := httptest.NewRecorder()
			handler.handleAssignDriverToRoute(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusCreated {
				var response map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}
				
				if response["route_id"] == nil {
					t.Error("Expected route_id in response")
				}
			}
		})
	}
}

// ===== BULK OPERATIONS TESTS =====

func TestAdminHandler_BulkOrderStatusUpdate(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	// Create test user and orders
	userID := db.CreateTestUser(t, "customer@example.com", "Test", "Customer")
	addressID := db.CreateTestAddress(t, userID)
	
	order1ID := db.CreateTestOrder(t, userID, addressID)
	order2ID := db.CreateTestOrder(t, userID, addressID)
	order3ID := db.CreateTestOrder(t, userID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		requestBody    map[string]interface{}
		expectedStatus int
		expectedCount  int
	}{
		{
			name: "Valid bulk status update",
			requestBody: map[string]interface{}{
				"order_ids": []int{order1ID, order2ID},
				"status":    "picked_up",
				"notes":     "Bulk update test",
			},
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name: "Update with empty notes",
			requestBody: map[string]interface{}{
				"order_ids": []int{order3ID},
				"status":    "in_process",
			},
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name: "Invalid status",
			requestBody: map[string]interface{}{
				"order_ids": []int{order1ID},
				"status":    "invalid_status",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Empty order IDs",
			requestBody: map[string]interface{}{
				"order_ids": []int{},
				"status":    "picked_up",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Invalid request body",
			requestBody: map[string]interface{}{
				"invalid": "data",
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("PUT", "/api/v1/admin/orders/bulk-status", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handleBulkOrderStatusUpdate(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if int(response["updated_count"].(float64)) != tt.expectedCount {
					t.Errorf("Expected updated_count %d, got %v", tt.expectedCount, response["updated_count"])
				}

				// Verify orders were actually updated
				if status, ok := tt.requestBody["status"].(string); ok {
					for _, orderID := range tt.requestBody["order_ids"].([]int) {
						var actualStatus string
						err := db.QueryRow("SELECT status FROM orders WHERE id = $1", orderID).Scan(&actualStatus)
						if err != nil {
							t.Errorf("Failed to query order status: %v", err)
							continue
						}
						if actualStatus != status {
							t.Errorf("Expected order %d status %s, got %s", orderID, status, actualStatus)
						}
					}
				}
			}
		})
	}
}

func TestAdminHandler_BulkOrderStatusUpdate_Unauthorized(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return 0, fmt.Errorf("unauthorized")
		},
	}

	requestBody := map[string]interface{}{
		"order_ids": []int{1, 2},
		"status":    "picked_up",
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/v1/admin/orders/bulk-status", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.handleBulkOrderStatusUpdate(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestAdminHandler_GetRouteOptimizationSuggestions(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	// Create test users and orders
	userID1 := db.CreateTestUser(t, "customer1@example.com", "Customer", "One")
	userID2 := db.CreateTestUser(t, "customer2@example.com", "Customer", "Two")
	
	addressID1 := db.CreateTestAddress(t, userID1)
	addressID2 := db.CreateTestAddress(t, userID2)
	
	order1ID := db.CreateTestOrder(t, userID1, addressID1)
	order2ID := db.CreateTestOrder(t, userID2, addressID2)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		requestBody    map[string]interface{}
		expectedStatus int
	}{
		{
			name: "Valid optimization request",
			requestBody: map[string]interface{}{
				"order_ids": []int{order1ID, order2ID},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Empty order IDs",
			requestBody: map[string]interface{}{
				"order_ids": []int{},
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Invalid request body",
			requestBody: map[string]interface{}{
				"invalid": "data",
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/v1/admin/routes/optimization-suggestions", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handleGetRouteOptimizationSuggestions(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				// Verify response structure
				if response["orders"] == nil {
					t.Error("Expected orders in response")
				}
				if response["suggestions"] == nil {
					t.Error("Expected suggestions in response")
				}
				if response["total_orders"] == nil {
					t.Error("Expected total_orders in response")
				}

				// Verify orders array
				orders, ok := response["orders"].([]interface{})
				if !ok {
					t.Error("Expected orders to be an array")
				}

				// For valid requests with actual orders, should have at least one order
				if len(tt.requestBody["order_ids"].([]int)) > 0 && len(orders) == 0 {
					t.Error("Expected at least one order in response")
				}
			}
		})
	}
}

func TestAdminHandler_OptimizationSuggestions_Methods(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	
	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	// Test invalid HTTP methods
	invalidMethods := []string{"GET", "PUT", "DELETE", "PATCH"}
	
	for _, method := range invalidMethods {
		t.Run(fmt.Sprintf("Invalid method %s", method), func(t *testing.T) {
			req := httptest.NewRequest(method, "/api/v1/admin/routes/optimization-suggestions", nil)
			w := httptest.NewRecorder()

			handler.handleGetRouteOptimizationSuggestions(w, req)

			if w.Code != http.StatusMethodNotAllowed {
				t.Errorf("Expected status %d for method %s, got %d", http.StatusMethodNotAllowed, method, w.Code)
			}
		})
	}
}

func TestAdminHandler_BulkStatusUpdate_Methods(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	
	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	// Test invalid HTTP methods
	invalidMethods := []string{"GET", "POST", "DELETE", "PATCH"}
	
	for _, method := range invalidMethods {
		t.Run(fmt.Sprintf("Invalid method %s", method), func(t *testing.T) {
			req := httptest.NewRequest(method, "/api/v1/admin/orders/bulk-status", nil)
			w := httptest.NewRecorder()

			handler.handleBulkOrderStatusUpdate(w, req)

			if w.Code != http.StatusMethodNotAllowed {
				t.Errorf("Expected status %d for method %s, got %d", http.StatusMethodNotAllowed, method, w.Code)
			}
		})
	}
}

// Benchmark tests for bulk operations
func BenchmarkAdminHandler_BulkOrderStatusUpdate(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	// Setup data
	adminID := db.CreateTestUser(&testing.T{}, "admin@example.com", "Admin", "User")
	userID := db.CreateTestUser(&testing.T{}, "customer@example.com", "Test", "Customer")
	addressID := db.CreateTestAddress(&testing.T{}, userID)
	
	// Create multiple orders for benchmarking
	orderIDs := make([]int, 10)
	for i := 0; i < 10; i++ {
		orderIDs[i] = db.CreateTestOrder(&testing.T{}, userID, addressID)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	requestBody := map[string]interface{}{
		"order_ids": orderIDs,
		"status":    "picked_up",
		"notes":     "Benchmark test",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("PUT", "/api/v1/admin/orders/bulk-status", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		handler.handleBulkOrderStatusUpdate(w, req)
		
		// Reset order statuses for next iteration
		for _, orderID := range orderIDs {
			db.DB.Exec("UPDATE orders SET status = 'scheduled' WHERE id = $1", orderID)
		}
	}
}

// ===== ENHANCED ROUTE OPTIMIZATION TESTS =====

func TestRouteOptimization_PickupDeliveryCycle(t *testing.T) {
	tests := []struct {
		name     string
		orders   []OrderLocation
		expected map[string][]int
	}{
		{
			name: "Same day pickup and delivery",
			orders: []OrderLocation{
				{ID: 1, PickupDate: "2024-12-01", PickupTimeSlot: "8:00 AM - 12:00 PM", DeliveryDate: "2024-12-01", DeliveryTimeSlot: "1:00 PM - 5:00 PM"},
				{ID: 2, PickupDate: "2024-12-01", PickupTimeSlot: "8:00 AM - 12:00 PM", DeliveryDate: "2024-12-01", DeliveryTimeSlot: "1:00 PM - 5:00 PM"},
				{ID: 3, PickupDate: "2024-12-01", PickupTimeSlot: "1:00 PM - 5:00 PM", DeliveryDate: "2024-12-02", DeliveryTimeSlot: "8:00 AM - 12:00 PM"},
			},
			expected: map[string][]int{
				"2024-12-01 8:00 AM - 12:00 PM → 2024-12-01 1:00 PM - 5:00 PM": {1, 2},
			},
		},
		{
			name: "Different cycles - no grouping",
			orders: []OrderLocation{
				{ID: 1, PickupDate: "2024-12-01", PickupTimeSlot: "8:00 AM - 12:00 PM", DeliveryDate: "2024-12-01", DeliveryTimeSlot: "1:00 PM - 5:00 PM"},
				{ID: 2, PickupDate: "2024-12-02", PickupTimeSlot: "8:00 AM - 12:00 PM", DeliveryDate: "2024-12-02", DeliveryTimeSlot: "1:00 PM - 5:00 PM"},
			},
			expected: map[string][]int{},
		},
		{
			name: "Multiple efficient cycles",
			orders: []OrderLocation{
				{ID: 1, PickupDate: "2024-12-01", PickupTimeSlot: "8:00 AM - 12:00 PM", DeliveryDate: "2024-12-01", DeliveryTimeSlot: "1:00 PM - 5:00 PM"},
				{ID: 2, PickupDate: "2024-12-01", PickupTimeSlot: "8:00 AM - 12:00 PM", DeliveryDate: "2024-12-01", DeliveryTimeSlot: "1:00 PM - 5:00 PM"},
				{ID: 3, PickupDate: "2024-12-02", PickupTimeSlot: "9:00 AM - 1:00 PM", DeliveryDate: "2024-12-02", DeliveryTimeSlot: "2:00 PM - 6:00 PM"},
				{ID: 4, PickupDate: "2024-12-02", PickupTimeSlot: "9:00 AM - 1:00 PM", DeliveryDate: "2024-12-02", DeliveryTimeSlot: "2:00 PM - 6:00 PM"},
			},
			expected: map[string][]int{
				"2024-12-01 8:00 AM - 12:00 PM → 2024-12-01 1:00 PM - 5:00 PM": {1, 2},
				"2024-12-02 9:00 AM - 1:00 PM → 2024-12-02 2:00 PM - 6:00 PM":   {3, 4},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := groupOrdersByPickupDeliveryCycle(tt.orders)
			
			if len(result) != len(tt.expected) {
				t.Errorf("Expected %d groups, got %d", len(tt.expected), len(result))
			}
			
			for expectedKey, expectedOrders := range tt.expected {
				if actualOrders, exists := result[expectedKey]; !exists {
					t.Errorf("Expected group %s not found", expectedKey)
				} else {
					if len(actualOrders) != len(expectedOrders) {
						t.Errorf("Group %s: expected %d orders, got %d", expectedKey, len(expectedOrders), len(actualOrders))
					}
					
					// Check if orders match (order doesn't matter)
					for _, expectedOrder := range expectedOrders {
						found := false
						for _, actualOrder := range actualOrders {
							if expectedOrder == actualOrder {
								found = true
								break
							}
						}
						if !found {
							t.Errorf("Group %s: expected order %d not found", expectedKey, expectedOrder)
						}
					}
				}
			}
		})
	}
}

func TestRouteOptimization_GeographicClusters(t *testing.T) {
	tests := []struct {
		name     string
		orders   []OrderLocation
		expected map[string][]int
	}{
		{
			name: "Same route clustering",
			orders: []OrderLocation{
				{ID: 1, PickupZip: "90210", DeliveryZip: "90211"},
				{ID: 2, PickupZip: "90210", DeliveryZip: "90211"},
				{ID: 3, PickupZip: "90212", DeliveryZip: "90213"},
			},
			expected: map[string][]int{
				"90210→90211 - Identical Route": {1, 2},
			},
		},
		{
			name: "Multi-pickup zone",
			orders: []OrderLocation{
				{ID: 1, PickupZip: "90210", DeliveryZip: "90211"},
				{ID: 2, PickupZip: "90210", DeliveryZip: "90212"},
				{ID: 3, PickupZip: "90210", DeliveryZip: "90213"},
				{ID: 4, PickupZip: "90210", DeliveryZip: "90214"},
			},
			expected: map[string][]int{
				"Zone 90210 - Multiple Pickups": {1, 2, 3, 4},
			},
		},
		{
			name: "Combined same route and multi-pickup",
			orders: []OrderLocation{
				{ID: 1, PickupZip: "90210", DeliveryZip: "90211"},
				{ID: 2, PickupZip: "90210", DeliveryZip: "90211"},
				{ID: 3, PickupZip: "90210", DeliveryZip: "90212"},
				{ID: 4, PickupZip: "90210", DeliveryZip: "90213"},
			},
			expected: map[string][]int{
				"90210→90211 - Identical Route":   {1, 2},
				"Zone 90210 - Multiple Pickups": {1, 2, 3, 4},
			},
		},
		{
			name: "No efficient groupings",
			orders: []OrderLocation{
				{ID: 1, PickupZip: "90210", DeliveryZip: "90211"},
				{ID: 2, PickupZip: "90212", DeliveryZip: "90213"},
			},
			expected: map[string][]int{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := groupOrdersByGeographicClusters(tt.orders)
			
			if len(result) != len(tt.expected) {
				t.Errorf("Expected %d groups, got %d. Got: %v", len(tt.expected), len(result), result)
			}
			
			for expectedKey, expectedOrders := range tt.expected {
				if actualOrders, exists := result[expectedKey]; !exists {
					t.Errorf("Expected group %s not found in result: %v", expectedKey, result)
				} else {
					if len(actualOrders) != len(expectedOrders) {
						t.Errorf("Group %s: expected %d orders, got %d", expectedKey, len(expectedOrders), len(actualOrders))
					}
					
					// Check if orders match (order doesn't matter)
					for _, expectedOrder := range expectedOrders {
						found := false
						for _, actualOrder := range actualOrders {
							if expectedOrder == actualOrder {
								found = true
								break
							}
						}
						if !found {
							t.Errorf("Group %s: expected order %d not found", expectedKey, expectedOrder)
						}
					}
				}
			}
		})
	}
}

func TestAdminHandler_EnhancedOptimizationSuggestions(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	// Create test users and orders using existing helper functions
	userID1 := db.CreateTestUser(t, "customer1@example.com", "Customer", "One")
	userID2 := db.CreateTestUser(t, "customer2@example.com", "Customer", "Two")
	
	addressID1 := db.CreateTestAddress(t, userID1)
	addressID2 := db.CreateTestAddress(t, userID2)
	
	order1ID := db.CreateTestOrder(t, userID1, addressID1)
	order2ID := db.CreateTestOrder(t, userID2, addressID2)
	order3ID := db.CreateTestOrder(t, userID1, addressID1)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	requestBody := map[string]interface{}{
		"order_ids": []int{order1ID, order2ID, order3ID},
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/api/v1/admin/routes/optimization-suggestions", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.handleGetRouteOptimizationSuggestions(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify response structure
	if response["orders"] == nil {
		t.Error("Expected orders in response")
	}
	if response["suggestions"] == nil {
		t.Error("Expected suggestions in response")
	}
	if response["total_orders"] == nil {
		t.Error("Expected total_orders in response")
	}

	// Verify we have the enhanced suggestion types
	suggestions, ok := response["suggestions"].([]interface{})
	if !ok {
		t.Fatal("Expected suggestions to be an array")
	}

	expectedTypes := []string{"pickup_delivery_cycle", "geographic_clusters", "time_slot_grouping"}
	foundTypes := make(map[string]bool)

	for _, suggestion := range suggestions {
		suggestionMap, ok := suggestion.(map[string]interface{})
		if !ok {
			continue
		}
		suggestionType, ok := suggestionMap["type"].(string)
		if !ok {
			continue
		}
		foundTypes[suggestionType] = true
	}

	for _, expectedType := range expectedTypes {
		if !foundTypes[expectedType] {
			t.Errorf("Expected suggestion type %s not found in response", expectedType)
		}
	}
}

func BenchmarkRouteOptimization_PickupDeliveryCycle(b *testing.B) {
	// Create test data with 100 orders
	orders := make([]OrderLocation, 100)
	for i := 0; i < 100; i++ {
		orders[i] = OrderLocation{
			ID:               i + 1,
			PickupDate:       "2024-12-01",
			PickupTimeSlot:   fmt.Sprintf("%d:00 AM - %d:00 PM", (i%12)+8, (i%12)+12),
			DeliveryDate:     "2024-12-01",
			DeliveryTimeSlot: fmt.Sprintf("%d:00 PM - %d:00 PM", (i%8)+1, (i%8)+5),
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		groupOrdersByPickupDeliveryCycle(orders)
	}
}

func BenchmarkRouteOptimization_GeographicClusters(b *testing.B) {
	// Create test data with 100 orders
	orders := make([]OrderLocation, 100)
	for i := 0; i < 100; i++ {
		orders[i] = OrderLocation{
			ID:          i + 1,
			PickupZip:   fmt.Sprintf("902%02d", i%20),
			DeliveryZip: fmt.Sprintf("903%02d", i%15),
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		groupOrdersByGeographicClusters(orders)
	}
}

// ===== USER MANAGEMENT TESTS =====

func TestAdminHandler_CreateUser(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		requestBody    map[string]interface{}
		expectedStatus int
	}{
		{
			name: "Valid user creation",
			requestBody: map[string]interface{}{
				"first_name": "New",
				"last_name":  "User",
				"email":      "newuser@example.com",
				"phone":      "+1-555-1234",
				"role":       "customer",
				"status":     "active",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "Missing required fields",
			requestBody: map[string]interface{}{
				"first_name": "New",
				"email":      "incomplete@example.com",
				// Missing last_name
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Invalid role",
			requestBody: map[string]interface{}{
				"first_name": "New",
				"last_name":  "User",
				"email":      "invalidrole@example.com",
				"role":       "invalid_role",
				"status":     "active",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Invalid status",
			requestBody: map[string]interface{}{
				"first_name": "New",
				"last_name":  "User",
				"email":      "invalidstatus@example.com",
				"role":       "customer",
				"status":     "invalid_status",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Duplicate email",
			requestBody: map[string]interface{}{
				"first_name": "New",
				"last_name":  "User",
				"email":      "admin@example.com", // Already exists
				"role":       "customer",
				"status":     "active",
			},
			expectedStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handleCreateUser(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusCreated {
				var response AdminUserResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if response.Email != tt.requestBody["email"] {
					t.Errorf("Expected email %s, got %s", tt.requestBody["email"], response.Email)
				}

				if response.Role != tt.requestBody["role"] {
					t.Errorf("Expected role %s, got %s", tt.requestBody["role"], response.Role)
				}

				// Verify user was actually created in database
				var dbUser AdminUserResponse
				err := db.QueryRow(`
					SELECT id, email, first_name, last_name, role 
					FROM users WHERE email = $1
				`, tt.requestBody["email"]).Scan(
					&dbUser.ID, &dbUser.Email, &dbUser.FirstName, &dbUser.LastName, &dbUser.Role,
				)
				if err != nil {
					t.Errorf("Failed to find created user in database: %v", err)
				}
			}
		})
	}
}

func TestAdminHandler_UpdateUser(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	// Create test user to update
	testUserID := db.CreateTestUser(t, "testuser@example.com", "Test", "User")

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		userID         int
		requestBody    map[string]interface{}
		expectedStatus int
	}{
		{
			name:   "Valid user update",
			userID: testUserID,
			requestBody: map[string]interface{}{
				"first_name": "Updated",
				"last_name":  "Name",
				"email":      "updated@example.com",
				"phone":      "+1-555-9999",
				"role":       "driver",
				"status":     "active",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:   "Missing required fields",
			userID: testUserID,
			requestBody: map[string]interface{}{
				"first_name": "Updated",
				// Missing last_name and email
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "Invalid user ID",
			userID: 99999,
			requestBody: map[string]interface{}{
				"first_name": "Updated",
				"last_name":  "Name",
				"email":      "nonexistentuser@example.com",
				"role":       "customer",
				"status":     "active",
			},
			expectedStatus: http.StatusInternalServerError, // User not found during fetch
		},
		{
			name:   "Duplicate email with different user",
			userID: testUserID,
			requestBody: map[string]interface{}{
				"first_name": "Updated",
				"last_name":  "Name",
				"email":      "admin@example.com", // Admin email already exists
				"role":       "customer",
				"status":     "active",
			},
			expectedStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			url := fmt.Sprintf("/api/v1/admin/users/%d", tt.userID)
			req := httptest.NewRequest("PUT", url, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			
			// Set up mux vars since we're testing the handler directly
			req = mux.SetURLVars(req, map[string]string{"id": fmt.Sprintf("%d", tt.userID)})
			
			w := httptest.NewRecorder()
			handler.handleUpdateUser(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var response AdminUserResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if response.Email != tt.requestBody["email"] {
					t.Errorf("Expected email %s, got %s", tt.requestBody["email"], response.Email)
				}

				if response.Role != tt.requestBody["role"] {
					t.Errorf("Expected role %s, got %s", tt.requestBody["role"], response.Role)
				}
			}
		})
	}
}

func TestAdminHandler_DeleteUser(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	// Create test users
	customerID := db.CreateTestUser(t, "customer@example.com", "Customer", "User")
	driverID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	_, err = db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverID)
	if err != nil {
		t.Fatalf("Failed to set driver role: %v", err)
	}

	// Create another admin user to test admin deletion protection
	adminID2 := db.CreateTestUser(t, "admin2@example.com", "Admin2", "User")
	_, err = db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID2)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	// Create user with active orders
	customerWithOrdersID := db.CreateTestUser(t, "customerorders@example.com", "Customer", "WithOrders")
	addressID := db.CreateTestAddress(t, customerWithOrdersID)
	orderID := db.CreateTestOrder(t, customerWithOrdersID, addressID)
	// Make order active (not delivered or cancelled)
	_, err = db.Exec("UPDATE orders SET status = 'pending' WHERE id = $1", orderID)
	if err != nil {
		t.Fatalf("Failed to update order status: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		userID         int
		expectedStatus int
	}{
		{
			name:           "Valid customer deletion",
			userID:         customerID,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Valid driver deletion",
			userID:         driverID,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Cannot delete admin user",
			userID:         adminID2,
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "Cannot delete own account",
			userID:         adminID, // Trying to delete self
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "Cannot delete user with active orders",
			userID:         customerWithOrdersID,
			expectedStatus: http.StatusConflict,
		},
		{
			name:           "User not found",
			userID:         99999,
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := fmt.Sprintf("/api/v1/admin/users/%d", tt.userID)
			req := httptest.NewRequest("DELETE", url, nil)
			
			// Set up mux vars since we're testing the handler directly
			req = mux.SetURLVars(req, map[string]string{"id": fmt.Sprintf("%d", tt.userID)})
			
			w := httptest.NewRecorder()
			handler.handleDeleteUser(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				// Verify user was actually deleted
				var count int
				err := db.QueryRow("SELECT COUNT(*) FROM users WHERE id = $1", tt.userID).Scan(&count)
				if err != nil {
					t.Errorf("Failed to check if user was deleted: %v", err)
				}
				if count != 0 {
					t.Errorf("Expected user to be deleted, but still exists")
				}
			}
		})
	}
}

func TestAdminHandler_UserManagement_MethodValidation(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		handlerFunc    func(http.ResponseWriter, *http.Request)
		validMethod    string
		invalidMethods []string
	}{
		{
			handlerFunc:    handler.handleCreateUser,
			validMethod:    "POST",
			invalidMethods: []string{"GET", "PUT", "DELETE", "PATCH"},
		},
		{
			handlerFunc:    handler.handleUpdateUser,
			validMethod:    "PUT",
			invalidMethods: []string{"GET", "POST", "DELETE", "PATCH"},
		},
		{
			handlerFunc:    handler.handleDeleteUser,
			validMethod:    "DELETE",
			invalidMethods: []string{"GET", "POST", "PUT", "PATCH"},
		},
	}

	for _, tt := range tests {
		for _, method := range tt.invalidMethods {
			t.Run(fmt.Sprintf("Invalid method %s", method), func(t *testing.T) {
				req := httptest.NewRequest(method, "/api/v1/admin/users", nil)
				w := httptest.NewRecorder()

				tt.handlerFunc(w, req)

				if w.Code != http.StatusMethodNotAllowed {
					t.Errorf("Expected status %d for method %s, got %d", 
						http.StatusMethodNotAllowed, method, w.Code)
				}
			})
		}
	}
}

func TestAdminHandler_CreateUserWithStatus(t *testing.T) {
	InitLogger()
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		requestBody    map[string]interface{}
		expectedStatus int
		expectedStatus_field string
	}{
		{
			name: "Create user with active status",
			requestBody: map[string]interface{}{
				"first_name": "Test",
				"last_name":  "User",
				"email":      "test@example.com",
				"phone":      "555-0123",
				"role":       "customer",
				"status":     "active",
			},
			expectedStatus: http.StatusCreated,
			expectedStatus_field: "active",
		},
		{
			name: "Create user with invalid status",
			requestBody: map[string]interface{}{
				"first_name": "Test",
				"last_name":  "User",
				"email":      "test4@example.com",
				"phone":      "555-0126",
				"role":       "customer",
				"status":     "invalid",
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.handleCreateUser(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusCreated {
				var response AdminUserResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				// Verify user has correct status
				if response.Status != tt.expectedStatus_field {
					t.Errorf("Expected status %s, got %s", tt.expectedStatus_field, response.Status)
				}

				// Verify status was saved in database
				var dbStatus string
				err := db.QueryRow("SELECT status FROM users WHERE id = $1", response.ID).Scan(&dbStatus)
				if err != nil {
					t.Fatalf("Failed to get user status from database: %v", err)
				}
				if dbStatus != tt.expectedStatus_field {
					t.Errorf("Expected database status %s, got %s", tt.expectedStatus_field, dbStatus)
				}
			}
		})
	}
}

func TestAdminHandler_UpdateUserStatus(t *testing.T) {
	InitLogger()
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminID)

	// Create target user
	targetUserID := db.CreateTestUser(t, "target@example.com", "Target", "User")

	mockRealtime := NewMockRealtimeHandler()
	handler := &AdminHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return adminID, nil
		},
	}

	tests := []struct {
		name           string
		userID         int
		requestBody    map[string]interface{}
		expectedStatus int
		expectedStatusValue string
	}{
		{
			name:   "Update user to inactive",
			userID: targetUserID,
			requestBody: map[string]interface{}{
				"status": "inactive",
			},
			expectedStatus: http.StatusOK,
			expectedStatusValue: "inactive",
		},
		{
			name:   "Try to update own status (should fail)",
			userID: adminID,
			requestBody: map[string]interface{}{
				"status": "inactive",
			},
			expectedStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			url := fmt.Sprintf("/api/v1/admin/users/%d/status", tt.userID)
			req := httptest.NewRequest("POST", url, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			
			// Set up mux vars
			req = mux.SetURLVars(req, map[string]string{"id": fmt.Sprintf("%d", tt.userID)})
			
			w := httptest.NewRecorder()
			handler.handleUpdateUserStatus(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			// Verify status was updated if successful
			if tt.expectedStatus == http.StatusOK && tt.expectedStatusValue != "" {
				var dbStatus string
				err := db.QueryRow("SELECT status FROM users WHERE id = $1", tt.userID).Scan(&dbStatus)
				if err != nil {
					t.Fatalf("Failed to get user status from database: %v", err)
				}
				if dbStatus != tt.expectedStatusValue {
					t.Errorf("Expected database status %s, got %s", tt.expectedStatusValue, dbStatus)
				}
			}
		})
	}
}