package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLoggingMiddleware(t *testing.T) {
	// Initialize logger for middleware
	InitLogger()
	
	// Create a test handler
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test response"))
	})
	
	// Wrap with logging middleware
	handler := LoggingMiddleware(testHandler)
	
	tests := []struct {
		name           string
		method         string
		path           string
		authHeader     string
		expectedStatus int
	}{
		{
			name:           "GET request without auth",
			method:         http.MethodGet,
			path:           "/test",
			authHeader:     "",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "POST request with auth",
			method:         http.MethodPost,
			path:           "/api/orders",
			authHeader:     "Bearer token123",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "PUT request with long path",
			method:         http.MethodPut,
			path:           "/api/orders/123/status",
			authHeader:     "",
			expectedStatus: http.StatusOK,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			req.Header.Set("User-Agent", "Test Agent")
			req.Header.Set("Referer", "http://example.com")
			
			w := httptest.NewRecorder()
			
			start := time.Now()
			handler.ServeHTTP(w, req)
			duration := time.Since(start)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}
			
			// Verify response was written
			body := w.Body.String()
			if body != "test response" {
				t.Errorf("Expected body 'test response', got '%s'", body)
			}
			
			// Verify logging doesn't break the request
			if duration > time.Second {
				t.Error("Logging middleware should not significantly slow down requests")
			}
		})
	}
}

func TestResponseWriter(t *testing.T) {
	w := httptest.NewRecorder()
	rw := &responseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
	}
	
	// Test default status code
	if rw.statusCode != http.StatusOK {
		t.Errorf("Expected default status code %d, got %d", http.StatusOK, rw.statusCode)
	}
	
	// Test WriteHeader
	rw.WriteHeader(http.StatusNotFound)
	if rw.statusCode != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, rw.statusCode)
	}
	
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected underlying writer status %d, got %d", http.StatusNotFound, w.Code)
	}
	
	// Test Write
	testData := []byte("test data")
	n, err := rw.Write(testData)
	if err != nil {
		t.Errorf("Write returned error: %v", err)
	}
	if n != len(testData) {
		t.Errorf("Expected to write %d bytes, wrote %d", len(testData), n)
	}
	
	if w.Body.String() != "test data" {
		t.Errorf("Expected body 'test data', got '%s'", w.Body.String())
	}
}

func TestCORSMiddleware(t *testing.T) {
	// Create a test handler
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test response"))
	})
	
	// Wrap with CORS middleware
	handler := CORSMiddleware(testHandler)
	
	tests := []struct {
		name           string
		method         string
		origin         string
		expectedStatus int
		expectBody     bool
	}{
		{
			name:           "GET request",
			method:         http.MethodGet,
			origin:         "http://localhost:3000",
			expectedStatus: http.StatusOK,
			expectBody:     true,
		},
		{
			name:           "POST request",
			method:         http.MethodPost,
			origin:         "http://example.com",
			expectedStatus: http.StatusOK,
			expectBody:     true,
		},
		{
			name:           "OPTIONS preflight request",
			method:         http.MethodOptions,
			origin:         "http://localhost:3000",
			expectedStatus: http.StatusOK,
			expectBody:     false,
		},
		{
			name:           "OPTIONS without origin",
			method:         http.MethodOptions,
			origin:         "",
			expectedStatus: http.StatusOK,
			expectBody:     false,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}
			
			// Check CORS headers
			expectedHeaders := map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			}
			
			for header, expectedValue := range expectedHeaders {
				actualValue := w.Header().Get(header)
				if actualValue != expectedValue {
					t.Errorf("Expected header %s to be '%s', got '%s'", header, expectedValue, actualValue)
				}
			}
			
			// Check response body
			body := w.Body.String()
			if tt.expectBody {
				if body != "test response" {
					t.Errorf("Expected body 'test response', got '%s'", body)
				}
			} else {
				if body != "" {
					t.Errorf("Expected empty body for OPTIONS, got '%s'", body)
				}
			}
		})
	}
}

func TestMiddlewareChaining(t *testing.T) {
	// Initialize logger
	InitLogger()
	
	// Create a test handler that sets a custom header
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Test-Handler", "executed")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("chained response"))
	})
	
	// Chain both middlewares
	handler := CORSMiddleware(LoggingMiddleware(testHandler))
	
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Authorization", "Bearer token123")
	
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	
	// Verify status
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
	
	// Verify CORS headers are present
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("CORS headers should be set")
	}
	
	// Verify test handler was executed
	if w.Header().Get("X-Test-Handler") != "executed" {
		t.Error("Test handler should have been executed")
	}
	
	// Verify response body
	body := w.Body.String()
	if body != "chained response" {
		t.Errorf("Expected body 'chained response', got '%s'", body)
	}
}

func TestLoggingMiddleware_LongUserAgent(t *testing.T) {
	// Initialize logger
	InitLogger()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	
	handler := LoggingMiddleware(testHandler)
	
	// Create a very long user agent string
	longUserAgent := strings.Repeat("Mozilla/5.0 ", 20) + "Very Long User Agent String"
	
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("User-Agent", longUserAgent)
	
	w := httptest.NewRecorder()
	
	// This should not panic or error
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestResponseWriter_MultipleWriteHeaders(t *testing.T) {
	w := httptest.NewRecorder()
	rw := &responseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
	}
	
	// First WriteHeader call
	rw.WriteHeader(http.StatusNotFound)
	if rw.statusCode != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, rw.statusCode)
	}
	
	// Second WriteHeader call (should not change status in our wrapper)
	rw.WriteHeader(http.StatusInternalServerError)
	
	// Our wrapper should still track the first status code written
	// (HTTP spec says subsequent WriteHeader calls should be ignored)
	if rw.statusCode != http.StatusNotFound {
		t.Errorf("Expected status code to remain %d, got %d", http.StatusNotFound, rw.statusCode)
	}
}

func TestCORSMiddleware_DebugLogging(t *testing.T) {
	// Initialize logger with debug level
	InitLogger()
	
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	
	handler := CORSMiddleware(testHandler)
	
	// Test OPTIONS request which should trigger debug logging
	req := httptest.NewRequest(http.MethodOptions, "/api/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	
	w := httptest.NewRecorder()
	
	// This should not panic and should log debug information
	handler.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}
	
	// Verify CORS headers are set for OPTIONS
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("CORS origin header should be set")
	}
}