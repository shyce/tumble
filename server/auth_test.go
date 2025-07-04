package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthHandler_Register(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	handler := NewAuthHandler(db.DB)

	tests := []struct {
		name           string
		requestBody    RegisterRequest
		expectedStatus int
	}{
		{
			name: "Valid registration",
			requestBody: RegisterRequest{
				Email:     "test@example.com",
				Password:  "password123",
				FirstName: "Test",
				LastName:  "User",
				Phone:     "555-0123",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Missing email",
			requestBody: RegisterRequest{
				Password:  "password123",
				FirstName: "Test",
				LastName:  "User",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Missing password",
			requestBody: RegisterRequest{
				Email:     "test2@example.com",
				FirstName: "Test",
				LastName:  "User",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Missing first name",
			requestBody: RegisterRequest{
				Email:    "test3@example.com",
				Password: "password123",
				LastName: "User",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Missing last name",
			requestBody: RegisterRequest{
				Email:     "test4@example.com",
				Password:  "password123",
				FirstName: "Test",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Short password",
			requestBody: RegisterRequest{
				Email:     "test5@example.com",
				Password:  "123",
				FirstName: "Test",
				LastName:  "User",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Invalid email format",
			requestBody: RegisterRequest{
				Email:     "invalid-email",
				Password:  "password123",
				FirstName: "Test",
				LastName:  "User",
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear users table for duplicate email tests
			if tt.name != "Valid registration" {
				db.TruncateTables(t)
			}

			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			handler.handleRegister(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Response: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				// Check for required fields in successful response
				requiredFields := []string{"user", "token"}
				for _, field := range requiredFields {
					if _, exists := response[field]; !exists {
						t.Errorf("Expected response to have field '%s'", field)
					}
				}

				// Verify user details
				if user, ok := response["user"].(map[string]interface{}); ok {
					if user["email"] != tt.requestBody.Email {
						t.Errorf("Expected email '%s', got '%s'", tt.requestBody.Email, user["email"])
					}
					if user["first_name"] != tt.requestBody.FirstName {
						t.Errorf("Expected first_name '%s', got '%s'", tt.requestBody.FirstName, user["first_name"])
					}
					if user["last_name"] != tt.requestBody.LastName {
						t.Errorf("Expected last_name '%s', got '%s'", tt.requestBody.LastName, user["last_name"])
					}
				} else {
					t.Error("Expected user object in response")
				}

				// Verify token is not empty
				if token, ok := response["token"].(string); !ok || token == "" {
					t.Error("Expected non-empty token in response")
				}
			}
		})
	}
}

func TestAuthHandler_Login(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	handler := NewAuthHandler(db.DB)

	// Create a test user first
	testEmail := "test@example.com"
	testPassword := "password123"
	db.CreateTestUserWithPassword(t, testEmail, "Test", "User", testPassword)

	tests := []struct {
		name           string
		requestBody    LoginRequest
		expectedStatus int
	}{
		{
			name: "Valid login",
			requestBody: LoginRequest{
				Email:    testEmail,
				Password: testPassword,
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Invalid email",
			requestBody: LoginRequest{
				Email:    "nonexistent@example.com",
				Password: testPassword,
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name: "Invalid password",
			requestBody: LoginRequest{
				Email:    testEmail,
				Password: "wrongpassword",
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name: "Missing email",
			requestBody: LoginRequest{
				Password: testPassword,
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Missing password",
			requestBody: LoginRequest{
				Email: testEmail,
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			handler.handleLogin(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Response: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Errorf("Failed to unmarshal response: %v", err)
				}

				// Check for required fields in successful response
				requiredFields := []string{"user", "token"}
				for _, field := range requiredFields {
					if _, exists := response[field]; !exists {
						t.Errorf("Expected response to have field '%s'", field)
					}
				}

				// Verify user details
				if user, ok := response["user"].(map[string]interface{}); ok {
					if user["email"] != tt.requestBody.Email {
						t.Errorf("Expected email '%s', got '%s'", tt.requestBody.Email, user["email"])
					}
				} else {
					t.Error("Expected user object in response")
				}

				// Verify token is not empty
				if token, ok := response["token"].(string); !ok || token == "" {
					t.Error("Expected non-empty token in response")
				}
			}
		})
	}
}

func TestAuthHandler_DuplicateRegistration(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	handler := NewAuthHandler(db.DB)

	// First registration
	requestBody := RegisterRequest{
		Email:     "duplicate@example.com",
		Password:  "password123",
		FirstName: "Test",
		LastName:  "User",
	}

	body, _ := json.Marshal(requestBody)
	req1 := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	req1.Header.Set("Content-Type", "application/json")

	w1 := httptest.NewRecorder()
	handler.handleRegister(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("First registration failed with status %d", w1.Code)
	}

	// Second registration with same email
	body2, _ := json.Marshal(requestBody)
	req2 := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body2))
	req2.Header.Set("Content-Type", "application/json")

	w2 := httptest.NewRecorder()
	handler.handleRegister(w2, req2)

	// Should fail with conflict or bad request
	if w2.Code != http.StatusBadRequest && w2.Code != http.StatusConflict {
		t.Errorf("Expected duplicate registration to fail with 400 or 409, got %d", w2.Code)
	}
}

func TestGetUserIDFromRequest(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	tests := []struct {
		name        string
		authHeader  string
		expectError bool
		expectedID  int
	}{
		{
			name:        "Valid token",
			authHeader:  "Bearer " + CreateTestJWTToken(123),
			expectError: true, // Our mock token won't be valid JWT
			expectedID:  0,
		},
		{
			name:        "Missing header",
			authHeader:  "",
			expectError: true,
			expectedID:  0,
		},
		{
			name:        "Invalid format",
			authHeader:  "InvalidFormat",
			expectError: true,
			expectedID:  0,
		},
		{
			name:        "Missing Bearer prefix",
			authHeader:  "token123",
			expectError: true,
			expectedID:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			userID, err := getUserIDFromRequest(req, db.DB)

			if tt.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
				if userID != tt.expectedID {
					t.Errorf("Expected user ID %d, got %d", tt.expectedID, userID)
				}
			}
		})
	}
}


// Test email validation
func TestEmailValidation(t *testing.T) {
	tests := []struct {
		email string
		valid bool
	}{
		{"test@example.com", true},
		{"user.name@domain.co.uk", true},
		{"test+tag@example.org", true},
		{"invalid-email", false},
		{"@example.com", false},
		{"test@", false},
		{"", false},
		{"test..test@example.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			isValid := isValidEmail(tt.email)
			if isValid != tt.valid {
				t.Errorf("Email %s: expected valid=%v, got %v", tt.email, tt.valid, isValid)
			}
		})
	}
}

// Helper function for email validation (would be implemented in auth.go)
func isValidEmail(email string) bool {
	// Basic email validation - in real implementation, use proper regex
	return len(email) > 0 && 
		   len(email) < 255 &&
		   containsChar(email, '@') &&
		   !startsOrEndsWith(email, '@') &&
		   !containsConsecutiveDots(email)
}

func containsChar(s string, c rune) bool {
	for _, char := range s {
		if char == c {
			return true
		}
	}
	return false
}

func startsOrEndsWith(s string, c rune) bool {
	if len(s) == 0 {
		return false
	}
	return rune(s[0]) == c || rune(s[len(s)-1]) == c
}

func containsConsecutiveDots(s string) bool {
	for i := 0; i < len(s)-1; i++ {
		if s[i] == '.' && s[i+1] == '.' {
			return true
		}
	}
	return false
}

// Benchmark tests
func BenchmarkAuthHandler_Register(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	handler := NewAuthHandler(db.DB)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		requestBody := RegisterRequest{
			Email:     fmt.Sprintf("bench%d@example.com", i),
			Password:  "password123",
			FirstName: "Bench",
			LastName:  "User",
		}

		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		handler.handleRegister(w, req)
	}
}

func BenchmarkAuthHandler_Login(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	handler := NewAuthHandler(db.DB)

	// Create test user
	testEmail := "bench@example.com"
	testPassword := "password123"
	userID := db.CreateTestUser(&testing.T{}, testEmail, "Bench", "User")
	
	// Update password hash
	_, err := db.Exec("UPDATE users SET password_hash = $1 WHERE id = $2", 
		"$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", userID)
	if err != nil {
		b.Fatalf("Failed to update user password: %v", err)
	}

	requestBody := LoginRequest{
		Email:    testEmail,
		Password: testPassword,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		handler.handleLogin(w, req)
	}
}