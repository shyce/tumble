package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

func TestOrderResolution(t *testing.T) {
	testDB := SetupTestDB(t)
	defer testDB.CleanupTestDB()
	db := testDB.DB

	// Create test data
	adminUserID := testDB.CreateTestUser(t, "admin@test.com", "Admin", "User")
	customerUserID := testDB.CreateTestUser(t, "customer@test.com", "Customer", "User") 
	
	// Update user roles
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminUserID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}
	
	adminToken := CreateTestJWTToken(adminUserID)
	customerToken := CreateTestJWTToken(customerUserID)

	// Create test handlers
	realtime := NewMockRealtimeHandler()
	adminHandler := NewAdminHandler(db, realtime)
	
	// Mock the auth function to return the admin user
	adminHandler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		auth := r.Header.Get("Authorization")
		if auth == "Bearer "+adminToken {
			return adminUserID, nil
		}
		if auth == "Bearer "+customerToken {
			return customerUserID, nil
		}
		return 0, fmt.Errorf("unauthorized")
	}

	// Create addresses for the customer
	pickupAddrID := testDB.CreateTestAddress(t, customerUserID)

	// Create a failed order using the test helper
	orderID := testDB.CreateTestOrder(t, customerUserID, pickupAddrID)

	// Update order status to failed
	_, err = db.Exec("UPDATE orders SET status = 'failed' WHERE id = $1", orderID)
	if err != nil {
		t.Fatalf("Failed to update order status: %v", err)
	}

	t.Run("CreateOrderResolution_Reschedule", func(t *testing.T) {
		rescheduleDate := time.Now().Add(72 * time.Hour).Format("2006-01-02")
		resolution := CreateOrderResolutionRequest{
			OrderID:        orderID,
			ResolutionType: "reschedule",
			RescheduleDate: &rescheduleDate,
			Notes:          "Customer requested reschedule due to availability",
		}

		resolutionBody, _ := json.Marshal(resolution)
		req := httptest.NewRequest("POST", "/api/v1/admin/orders/resolution", bytes.NewReader(resolutionBody))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		adminHandler.handleCreateOrderResolution(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
		}

		var createdResolution OrderResolution
		json.NewDecoder(w.Body).Decode(&createdResolution)

		// Verify resolution was created
		if createdResolution.ResolutionType != "reschedule" {
			t.Errorf("Expected resolution type 'reschedule', got %s", createdResolution.ResolutionType)
		}
		if createdResolution.RescheduleDate == nil {
			t.Errorf("Expected reschedule date %s, got nil", rescheduleDate)
		} else {
			// Parse the returned date to compare just the date part (ignoring time)
			returnedDate := *createdResolution.RescheduleDate
			if len(returnedDate) >= 10 {
				returnedDate = returnedDate[:10] // Take just YYYY-MM-DD part
			}
			if returnedDate != rescheduleDate {
				t.Errorf("Expected reschedule date %s, got %s", rescheduleDate, returnedDate)
			}
		}

		// Verify order status was updated
		var orderStatus string
		err := db.QueryRow("SELECT status FROM orders WHERE id = $1", orderID).Scan(&orderStatus)
		if err != nil {
			t.Fatalf("Failed to get order status: %v", err)
		}
		if orderStatus != "scheduled" {
			t.Errorf("Expected order status 'scheduled', got %s", orderStatus)
		}

		// Reset order status for next test
		db.Exec("UPDATE orders SET status = 'failed' WHERE id = $1", orderID)
	})

	t.Run("CreateOrderResolution_PartialRefund", func(t *testing.T) {
		refundAmount := 25.50
		resolution := CreateOrderResolutionRequest{
			OrderID:        orderID,
			ResolutionType: "partial_refund",
			RefundAmount:   &refundAmount,
			Notes:          "Partial refund for service issue",
		}

		resolutionBody, _ := json.Marshal(resolution)
		req := httptest.NewRequest("POST", "/api/v1/admin/orders/resolution", bytes.NewReader(resolutionBody))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		adminHandler.handleCreateOrderResolution(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
		}

		var createdResolution OrderResolution
		json.NewDecoder(w.Body).Decode(&createdResolution)

		// Verify resolution was created
		if createdResolution.RefundAmount == nil || *createdResolution.RefundAmount != refundAmount {
			t.Errorf("Expected refund amount %.2f, got %v", refundAmount, createdResolution.RefundAmount)
		}

		// Verify order status was updated to cancelled
		var orderStatus string
		err := db.QueryRow("SELECT status FROM orders WHERE id = $1", orderID).Scan(&orderStatus)
		if err != nil {
			t.Fatalf("Failed to get order status: %v", err)
		}
		if orderStatus != "cancelled" {
			t.Errorf("Expected order status 'cancelled', got %s", orderStatus)
		}

		// Reset order status for next test
		db.Exec("UPDATE orders SET status = 'failed' WHERE id = $1", orderID)
	})

	t.Run("CreateOrderResolution_InvalidStatus", func(t *testing.T) {
		// First update order to delivered status
		db.Exec("UPDATE orders SET status = 'delivered' WHERE id = $1", orderID)

		resolution := CreateOrderResolutionRequest{
			OrderID:        orderID,
			ResolutionType: "partial_refund",
			RefundAmount:   floatPtr(10.0),
			Notes:          "Should fail - order not failed",
		}

		resolutionBody, _ := json.Marshal(resolution)
		req := httptest.NewRequest("POST", "/api/v1/admin/orders/resolution", bytes.NewReader(resolutionBody))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		adminHandler.handleCreateOrderResolution(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("CreateOrderResolution_Unauthorized", func(t *testing.T) {
		resolution := CreateOrderResolutionRequest{
			OrderID:        orderID,
			ResolutionType: "partial_refund",
			RefundAmount:   floatPtr(10.0),
			Notes:          "Should fail - not admin",
		}

		resolutionBody, _ := json.Marshal(resolution)
		req := httptest.NewRequest("POST", "/api/v1/admin/orders/resolution", bytes.NewReader(resolutionBody))
		req.Header.Set("Authorization", "Bearer "+customerToken)
		req.Header.Set("Content-Type", "application/json")

		// Use requireAdmin middleware
		handler := adminHandler.requireAdmin(adminHandler.handleCreateOrderResolution)
		w := httptest.NewRecorder()
		handler(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected status 403, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("GetOrderResolutions", func(t *testing.T) {
		// Clean up any existing resolutions for this order
		db.Exec("DELETE FROM order_resolutions WHERE order_id = $1", orderID)
		
		// Create a couple resolutions first
		db.Exec("UPDATE orders SET status = 'failed' WHERE id = $1", orderID)

		// Create first resolution
		resolution1 := CreateOrderResolutionRequest{
			OrderID:        orderID,
			ResolutionType: "partial_refund",
			RefundAmount:   floatPtr(15.0),
			Notes:          "First resolution",
		}
		createResolution(t, adminHandler, adminToken, resolution1)

		// Reset status and create second resolution
		db.Exec("UPDATE orders SET status = 'failed' WHERE id = $1", orderID)
		resolution2 := CreateOrderResolutionRequest{
			OrderID:        orderID,
			ResolutionType: "credit",
			CreditAmount:   floatPtr(20.0),
			Notes:          "Second resolution",
		}
		createResolution(t, adminHandler, adminToken, resolution2)

		// Now get all resolutions
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/admin/orders/%d/resolutions", orderID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		
		// Add mux vars
		req = mux.SetURLVars(req, map[string]string{"orderId": fmt.Sprintf("%d", orderID)})

		w := httptest.NewRecorder()
		adminHandler.handleGetOrderResolutions(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
		}

		var resolutions []OrderResolution
		json.NewDecoder(w.Body).Decode(&resolutions)

		if len(resolutions) != 2 {
			t.Errorf("Expected 2 resolutions, got %d", len(resolutions))
		}

		// Should be ordered by created_at DESC
		if resolutions[0].ResolutionType != "credit" {
			t.Errorf("Expected most recent resolution first")
		}
	})
}

func createResolution(t *testing.T, handler *AdminHandler, token string, resolution CreateOrderResolutionRequest) {
	resolutionBody, _ := json.Marshal(resolution)
	req := httptest.NewRequest("POST", "/api/v1/admin/orders/resolution", bytes.NewReader(resolutionBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	handler.handleCreateOrderResolution(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Failed to create resolution: %d - %s", w.Code, w.Body.String())
	}
}

func floatPtr(f float64) *float64 {
	return &f
}

func TestOrderResolutionValidation(t *testing.T) {
	testDB := SetupTestDB(t)
	defer testDB.CleanupTestDB()
	db := testDB.DB

	adminUserID := testDB.CreateTestUser(t, "admin@test.com", "Admin", "User")
	
	// Update user role
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminUserID)
	if err != nil {
		t.Fatalf("Failed to set admin role: %v", err)
	}
	
	adminToken := CreateTestJWTToken(adminUserID)

	realtime := NewMockRealtimeHandler()
	adminHandler := NewAdminHandler(db, realtime)
	
	// Mock the auth function to return the admin user
	adminHandler.getUserID = func(r *http.Request, db *sql.DB) (int, error) {
		auth := r.Header.Get("Authorization")
		if auth == "Bearer "+adminToken {
			return adminUserID, nil
		}
		return 0, fmt.Errorf("unauthorized")
	}

	// Create address and order for testing
	addressID := testDB.CreateTestAddress(t, adminUserID)
	orderID := testDB.CreateTestOrder(t, adminUserID, addressID)
	
	// Set order to failed status
	_, err = db.Exec("UPDATE orders SET status = 'failed' WHERE id = $1", orderID)
	if err != nil {
		t.Fatalf("Failed to set order status to failed: %v", err)
	}

	testCases := []struct {
		name           string
		resolution     CreateOrderResolutionRequest
		expectedStatus int
		description    string
	}{
		{
			name: "InvalidResolutionType",
			resolution: CreateOrderResolutionRequest{
				OrderID:        orderID,
				ResolutionType: "invalid_type",
				Notes:          "Should fail",
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Invalid resolution type should return 400",
		},
		{
			name: "MissingRescheduleDate",
			resolution: CreateOrderResolutionRequest{
				OrderID:        orderID,
				ResolutionType: "reschedule",
				Notes:          "Missing date",
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Reschedule without date should return 400",
		},
		{
			name: "MissingRefundAmount",
			resolution: CreateOrderResolutionRequest{
				OrderID:        orderID,
				ResolutionType: "partial_refund",
				Notes:          "Missing amount",
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Refund without amount should return 400",
		},
		{
			name: "MissingCreditAmount",
			resolution: CreateOrderResolutionRequest{
				OrderID:        orderID,
				ResolutionType: "credit",
				Notes:          "Missing amount",
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Credit without amount should return 400",
		},
		{
			name: "NonExistentOrder",
			resolution: CreateOrderResolutionRequest{
				OrderID:        99999,
				ResolutionType: "waive_fee",
				Notes:          "Order doesn't exist",
			},
			expectedStatus: http.StatusNotFound,
			description:    "Non-existent order should return 404",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resolutionBody, _ := json.Marshal(tc.resolution)
			req := httptest.NewRequest("POST", "/api/v1/admin/orders/resolution", bytes.NewReader(resolutionBody))
			req.Header.Set("Authorization", "Bearer "+adminToken)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			adminHandler.handleCreateOrderResolution(w, req)

			if w.Code != tc.expectedStatus {
				t.Errorf("%s: Expected status %d, got %d: %s", 
					tc.description, tc.expectedStatus, w.Code, w.Body.String())
			}
		})
	}
}