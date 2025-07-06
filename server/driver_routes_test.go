package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestDriverRouteHandler_RequireDriver(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create regular user
	userID := db.CreateTestUser(t, "user@example.com", "Regular", "User")
	
	// Create driver user
	driverUserID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	_, err := db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverUserID)
	if err != nil {
		t.Fatalf("Failed to create driver user: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := NewDriverRouteHandler(db.DB, mockRealtime)

	t.Run("Non-driver user denied", func(t *testing.T) {
		authMock := CreateAuthMock(userID)
		handler.getUserID = authMock.getUserIDFromRequest

		req := httptest.NewRequest(http.MethodGet, "/driver/routes", nil)
		w := httptest.NewRecorder()

		middlewareHandler := handler.requireDriver(handler.handleGetDriverRoutes)
		middlewareHandler(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected status %d, got %d", http.StatusForbidden, w.Code)
		}
	})

	t.Run("Driver user allowed", func(t *testing.T) {
		authMock := CreateAuthMock(driverUserID)
		handler.getUserID = authMock.getUserIDFromRequest

		req := httptest.NewRequest(http.MethodGet, "/driver/routes", nil)
		w := httptest.NewRecorder()

		middlewareHandler := handler.requireDriver(handler.handleGetDriverRoutes)
		middlewareHandler(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}
	})
}

func TestDriverRouteHandler_GetDriverRoutes(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create driver user
	driverUserID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	_, err := db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverUserID)
	if err != nil {
		t.Fatalf("Failed to create driver user: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := NewDriverRouteHandler(db.DB, mockRealtime)
	authMock := CreateAuthMock(driverUserID)
	handler.getUserID = authMock.getUserIDFromRequest

	// Create a test route
	today := time.Now().Format("2006-01-02")
	var routeID int
	err = db.QueryRow(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, 'pickup', 'planned')
		RETURNING id
	`, driverUserID, today).Scan(&routeID)
	if err != nil {
		t.Fatalf("Failed to create test route: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/driver/routes", nil)
	w := httptest.NewRecorder()
	
	handler.handleGetDriverRoutes(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var routes []DriverRoute
	err = json.NewDecoder(w.Body).Decode(&routes)
	if err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	if len(routes) != 1 {
		t.Errorf("Expected 1 route, got %d", len(routes))
	}

	if routes[0].DriverID != driverUserID {
		t.Errorf("Expected DriverID %d, got %d", driverUserID, routes[0].DriverID)
	}
}

func TestDriverRouteHandler_GetDriverRoutesWithDate(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create driver user
	driverUserID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	_, err := db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverUserID)
	if err != nil {
		t.Fatalf("Failed to create driver user: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := NewDriverRouteHandler(db.DB, mockRealtime)
	authMock := CreateAuthMock(driverUserID)
	handler.getUserID = authMock.getUserIDFromRequest

	// Create routes for different dates
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	today := time.Now().Format("2006-01-02")

	// Route for yesterday
	_, err = db.Exec(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, 'pickup', 'planned')
	`, driverUserID, yesterday)
	if err != nil {
		t.Fatalf("Failed to create yesterday route: %v", err)
	}

	// Route for today
	_, err = db.Exec(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, 'delivery', 'planned')
	`, driverUserID, today)
	if err != nil {
		t.Fatalf("Failed to create today route: %v", err)
	}

	t.Run("Get routes for specific date", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/driver/routes?date="+yesterday, nil)
		w := httptest.NewRecorder()
		
		handler.handleGetDriverRoutes(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var routes []DriverRoute
		err = json.NewDecoder(w.Body).Decode(&routes)
		if err != nil {
			t.Errorf("Failed to decode response: %v", err)
		}

		if len(routes) != 1 {
			t.Errorf("Expected 1 route for yesterday, got %d", len(routes))
		}

		if routes[0].RouteType != "pickup" {
			t.Errorf("Expected route type 'pickup', got '%s'", routes[0].RouteType)
		}
	})
}

func TestDriverRouteHandler_UpdateRouteOrderStatus(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create driver user
	driverUserID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	_, err := db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverUserID)
	if err != nil {
		t.Fatalf("Failed to create driver user: %v", err)
	}

	// Create regular user for order
	userID := db.CreateTestUser(t, "user@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := NewDriverRouteHandler(db.DB, mockRealtime)
	authMock := CreateAuthMock(driverUserID)
	handler.getUserID = authMock.getUserIDFromRequest

	// Create a test route and route order
	today := time.Now().Format("2006-01-02")
	var routeID int
	err = db.QueryRow(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, 'pickup', 'planned')
		RETURNING id
	`, driverUserID, today).Scan(&routeID)
	if err != nil {
		t.Fatalf("Failed to create test route: %v", err)
	}

	var routeOrderID int
	err = db.QueryRow(`
		INSERT INTO route_orders (route_id, order_id, sequence_number, status)
		VALUES ($1, $2, 1, 'pending')
		RETURNING id
	`, routeID, orderID).Scan(&routeOrderID)
	if err != nil {
		t.Fatalf("Failed to create route order: %v", err)
	}

	tests := []struct {
		name           string
		status         string
		expectedStatus int
		expectRealtime bool
	}{
		{
			name:           "Update to failed",
			status:         "failed",
			expectedStatus: http.StatusOK,
			expectRealtime: false,
		},
		{
			name:           "Update to completed",
			status:         "completed",
			expectedStatus: http.StatusOK,
			expectRealtime: true,
		},
		{
			name:           "Invalid status",
			status:         "invalid_status",
			expectedStatus: http.StatusBadRequest,
			expectRealtime: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear previous realtime updates
			mockRealtime.ClearUpdates()

			statusReq := struct {
				Status string `json:"status"`
			}{
				Status: tt.status,
			}

			body, _ := json.Marshal(statusReq)
			req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/driver/routes/orders/status?id=%d", routeOrderID), bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			
			w := httptest.NewRecorder()
			handler.handleUpdateRouteOrderStatus(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Response: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectRealtime {
				if len(mockRealtime.PublishedUpdates) == 0 {
					t.Error("Expected realtime update to be published")
				}
			}
		})
	}
}

func TestDriverRouteHandler_StartRoute(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create driver user
	driverUserID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	_, err := db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverUserID)
	if err != nil {
		t.Fatalf("Failed to create driver user: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := NewDriverRouteHandler(db.DB, mockRealtime)
	authMock := CreateAuthMock(driverUserID)
	handler.getUserID = authMock.getUserIDFromRequest

	// Create a test route
	today := time.Now().Format("2006-01-02")
	var routeID int
	err = db.QueryRow(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, 'pickup', 'planned')
		RETURNING id
	`, driverUserID, today).Scan(&routeID)
	if err != nil {
		t.Fatalf("Failed to create test route: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/driver/routes/start?id=%d", routeID), nil)
	w := httptest.NewRecorder()
	
	handler.handleStartRoute(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Check if route status was updated
	var routeStatus string
	err = db.QueryRow("SELECT status FROM driver_routes WHERE id = $1", routeID).Scan(&routeStatus)
	if err != nil {
		t.Errorf("Failed to get route status: %v", err)
	}
	if routeStatus != "in_progress" {
		t.Errorf("Expected route status 'in_progress', got '%s'", routeStatus)
	}
}

func TestDriverRouteHandler_ForbiddenAccess(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create two driver users
	driver1ID := db.CreateTestUser(t, "driver1@example.com", "Driver1", "User")
	driver2ID := db.CreateTestUser(t, "driver2@example.com", "Driver2", "User")
	_, err := db.Exec("UPDATE users SET role = 'driver' WHERE id IN ($1, $2)", driver1ID, driver2ID)
	if err != nil {
		t.Fatalf("Failed to create driver users: %v", err)
	}

	mockRealtime := NewMockRealtimeHandler()
	handler := NewDriverRouteHandler(db.DB, mockRealtime)

	// Create a route for driver1
	today := time.Now().Format("2006-01-02")
	var routeID int
	err = db.QueryRow(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, 'pickup', 'planned')
		RETURNING id
	`, driver1ID, today).Scan(&routeID)
	if err != nil {
		t.Fatalf("Failed to create test route: %v", err)
	}

	// Try to start route as driver2 (should be forbidden)
	authMock := CreateAuthMock(driver2ID)
	handler.getUserID = authMock.getUserIDFromRequest

	req := httptest.NewRequest(http.MethodPut, "/driver/routes/start?id=1", nil)
	w := httptest.NewRecorder()
	
	handler.handleStartRoute(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestDriverRouteHandler_GetRouteOrders(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create driver user
	driverUserID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	_, err := db.Exec("UPDATE users SET role = 'driver' WHERE id = $1", driverUserID)
	if err != nil {
		t.Fatalf("Failed to create driver user: %v", err)
	}

	// Create customer and order
	userID := db.CreateTestUser(t, "user@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	mockRealtime := NewMockRealtimeHandler()
	handler := NewDriverRouteHandler(db.DB, mockRealtime)

	// Create a test route
	today := time.Now().Format("2006-01-02")
	var routeID int
	err = db.QueryRow(`
		INSERT INTO driver_routes (driver_id, route_date, route_type, status)
		VALUES ($1, $2, 'pickup', 'planned')
		RETURNING id
	`, driverUserID, today).Scan(&routeID)
	if err != nil {
		t.Fatalf("Failed to create test route: %v", err)
	}

	// Create route order
	_, err = db.Exec(`
		INSERT INTO route_orders (route_id, order_id, sequence_number, status)
		VALUES ($1, $2, 1, 'pending')
	`, routeID, orderID)
	if err != nil {
		t.Fatalf("Failed to create route order: %v", err)
	}

	// Test getRouteOrders method
	orders, err := handler.getRouteOrders(routeID)
	if err != nil {
		t.Errorf("Failed to get route orders: %v", err)
	}

	if len(orders) != 1 {
		t.Errorf("Expected 1 order, got %d", len(orders))
		return
	}

	if orders[0].OrderID != orderID {
		t.Errorf("Expected OrderID %d, got %d", orderID, orders[0].OrderID)
	}

	if orders[0].CustomerName == "" {
		t.Error("Expected customer name to be populated")
	}
}