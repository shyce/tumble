package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDriverApplicationHandler_SubmitApplication(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	userID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	handler := NewDriverApplicationHandler(db.DB)
	
	// Mock auth
	authMock := CreateAuthMock(userID)
	handler.getUserID = authMock.getUserIDFromRequest

	tests := []struct {
		name           string
		requestBody    DriverApplicationRequest
		expectedStatus int
		expectError    bool
	}{
		{
			name: "Valid application",
			requestBody: DriverApplicationRequest{
				FirstName:         "John",
				LastName:          "Driver",
				Phone:             "555-0123",
				LicenseNumber:     "D123456789",
				LicenseState:      "CA",
				VehicleYear:       "2020",
				VehicleMake:       "Toyota",
				VehicleModel:      "Camry",
				VehicleColor:      "Blue",
				InsuranceProvider: "State Farm",
				InsurancePolicyID: "SF123456",
				Experience:        "2 years",
				Availability:      "Weekdays 9-5",
				WhyInterested:     "Want flexible work",
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "Missing required fields",
			requestBody: DriverApplicationRequest{
				FirstName: "John",
				// Missing LastName, Phone, LicenseNumber
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean tables for each test
			db.TruncateTables(t)
			userID = db.CreateTestUser(t, "driver@example.com", "Driver", "User")
			authMock.MockUserID = userID

			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest(http.MethodPost, "/driver/apply", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			
			w := httptest.NewRecorder()
			handler.handleSubmitDriverApplication(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestDriverApplicationHandler_GetUserApplication(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	userID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	handler := NewDriverApplicationHandler(db.DB)
	
	authMock := CreateAuthMock(userID)
	handler.getUserID = authMock.getUserIDFromRequest

	t.Run("No application exists", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/driver/application", nil)
		w := httptest.NewRecorder()
		
		handler.handleGetUserApplication(w, req)
		
		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status %d, got %d", http.StatusNotFound, w.Code)
		}
	})

	// Create an application first
	appData := DriverApplicationRequest{
		FirstName:     "John",
		LastName:      "Driver",
		Phone:         "555-0123",
		LicenseNumber: "D123456789",
	}
	appDataBytes, _ := json.Marshal(appData)
	
	_, err := db.Exec(`
		INSERT INTO driver_applications (user_id, application_data)
		VALUES ($1, $2)
	`, userID, appDataBytes)
	if err != nil {
		t.Fatalf("Failed to insert test application: %v", err)
	}

	t.Run("Application exists", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/driver/application", nil)
		w := httptest.NewRecorder()
		
		handler.handleGetUserApplication(w, req)
		
		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var app DriverApplication
		err := json.NewDecoder(w.Body).Decode(&app)
		if err != nil {
			t.Errorf("Failed to decode response: %v", err)
		}

		if app.UserID != userID {
			t.Errorf("Expected UserID %d, got %d", userID, app.UserID)
		}
	})
}

func TestDriverApplicationHandler_RequireAdmin(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create regular user
	userID := db.CreateTestUser(t, "user@example.com", "Regular", "User")
	
	// Create admin user
	adminUserID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminUserID)
	if err != nil {
		t.Fatalf("Failed to create admin user: %v", err)
	}

	handler := NewDriverApplicationHandler(db.DB)

	t.Run("Non-admin user denied", func(t *testing.T) {
		authMock := CreateAuthMock(userID)
		handler.getUserID = authMock.getUserIDFromRequest

		req := httptest.NewRequest(http.MethodGet, "/admin/applications", nil)
		w := httptest.NewRecorder()

		// Use the middleware
		middlewareHandler := handler.requireAdmin(handler.handleGetAllApplications)
		middlewareHandler(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("Expected status %d, got %d", http.StatusForbidden, w.Code)
		}
	})

	t.Run("Admin user allowed", func(t *testing.T) {
		authMock := CreateAuthMock(adminUserID)
		handler.getUserID = authMock.getUserIDFromRequest

		req := httptest.NewRequest(http.MethodGet, "/admin/applications", nil)
		w := httptest.NewRecorder()

		middlewareHandler := handler.requireAdmin(handler.handleGetAllApplications)
		middlewareHandler(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}
	})
}

func TestDriverApplicationHandler_GetAllApplications(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminUserID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminUserID)
	if err != nil {
		t.Fatalf("Failed to create admin user: %v", err)
	}

	// Create a regular user with application
	userID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	
	appData := DriverApplicationRequest{
		FirstName:     "John",
		LastName:      "Driver",
		Phone:         "555-0123",
		LicenseNumber: "D123456789",
	}
	appDataBytes, _ := json.Marshal(appData)
	
	_, err = db.Exec(`
		INSERT INTO driver_applications (user_id, application_data)
		VALUES ($1, $2)
	`, userID, appDataBytes)
	if err != nil {
		t.Fatalf("Failed to insert test application: %v", err)
	}

	handler := NewDriverApplicationHandler(db.DB)
	authMock := CreateAuthMock(adminUserID)
	handler.getUserID = authMock.getUserIDFromRequest

	req := httptest.NewRequest(http.MethodGet, "/admin/applications", nil)
	w := httptest.NewRecorder()
	
	handler.handleGetAllApplications(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var applications []DriverApplication
	err = json.NewDecoder(w.Body).Decode(&applications)
	if err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	if len(applications) != 1 {
		t.Errorf("Expected 1 application, got %d", len(applications))
	}
}

func TestDriverApplicationHandler_ReviewApplication(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create admin user
	adminUserID := db.CreateTestUser(t, "admin@example.com", "Admin", "User")
	_, err := db.Exec("UPDATE users SET role = 'admin' WHERE id = $1", adminUserID)
	if err != nil {
		t.Fatalf("Failed to create admin user: %v", err)
	}

	// Create a regular user with application
	userID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	
	appData := DriverApplicationRequest{
		FirstName:     "John",
		LastName:      "Driver",
		Phone:         "555-0123",
		LicenseNumber: "D123456789",
	}
	appDataBytes, _ := json.Marshal(appData)
	
	var appID int
	err = db.QueryRow(`
		INSERT INTO driver_applications (user_id, application_data)
		VALUES ($1, $2)
		RETURNING id
	`, userID, appDataBytes).Scan(&appID)
	if err != nil {
		t.Fatalf("Failed to insert test application: %v", err)
	}

	handler := NewDriverApplicationHandler(db.DB)
	authMock := CreateAuthMock(adminUserID)
	handler.getUserID = authMock.getUserIDFromRequest

	t.Run("Approve application", func(t *testing.T) {
		reviewReq := struct {
			Status     string `json:"status"`
			AdminNotes string `json:"admin_notes"`
		}{
			Status:     "approved",
			AdminNotes: "Good application",
		}

		body, _ := json.Marshal(reviewReq)
		req := httptest.NewRequest(http.MethodPut, "/admin/applications/review?id=1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		
		w := httptest.NewRecorder()
		handler.handleReviewApplication(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		// Check if user role was updated to driver
		var userRole string
		err = db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&userRole)
		if err != nil {
			t.Errorf("Failed to get user role: %v", err)
		}
		if userRole != "driver" {
			t.Errorf("Expected user role 'driver', got '%s'", userRole)
		}
	})
}

func TestDriverApplicationHandler_DuplicateApplication(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	userID := db.CreateTestUser(t, "driver@example.com", "Driver", "User")
	handler := NewDriverApplicationHandler(db.DB)
	
	authMock := CreateAuthMock(userID)
	handler.getUserID = authMock.getUserIDFromRequest

	// Create first application
	appData := DriverApplicationRequest{
		FirstName:     "John",
		LastName:      "Driver",
		Phone:         "555-0123",
		LicenseNumber: "D123456789",
	}
	appDataBytes, _ := json.Marshal(appData)
	
	_, err := db.Exec(`
		INSERT INTO driver_applications (user_id, application_data, status)
		VALUES ($1, $2, 'pending')
	`, userID, appDataBytes)
	if err != nil {
		t.Fatalf("Failed to insert test application: %v", err)
	}

	// Try to submit another application
	body, _ := json.Marshal(appData)
	req := httptest.NewRequest(http.MethodPost, "/driver/apply", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	
	w := httptest.NewRecorder()
	handler.handleSubmitDriverApplication(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}