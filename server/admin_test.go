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