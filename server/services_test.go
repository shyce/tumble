package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceHandler_GetServices(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	handler := NewServiceHandler(db.DB)

	t.Run("Get all active services", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/services", nil)
		w := httptest.NewRecorder()

		handler.handleGetServices(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		contentType := w.Header().Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("Expected Content-Type 'application/json', got '%s'", contentType)
		}

		var services []Service
		err := json.NewDecoder(w.Body).Decode(&services)
		if err != nil {
			t.Errorf("Failed to decode response: %v", err)
		}

		// Should return services (assuming seed data exists)
		if len(services) == 0 {
			t.Log("No services found - this might be expected if no seed data")
		}

		// Verify service structure if services exist
		for _, service := range services {
			if service.ID == 0 {
				t.Error("Service ID should not be zero")
			}
			if service.Name == "" {
				t.Error("Service name should not be empty")
			}
			if service.BasePrice < 0 {
				t.Error("Service base price should not be negative")
			}
			if !service.IsActive {
				t.Error("Only active services should be returned")
			}
		}
	})

	t.Run("Method not allowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/services", nil)
		w := httptest.NewRecorder()

		handler.handleGetServices(w, req)

		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("Expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
		}
	})

}

func TestServiceHandler_ServiceStructure(t *testing.T) {
	service := Service{
		ID:            1,
		Name:          "test_service",
		Description:   "Test Service",
		BasePrice:     25.99,
		PricePerPound: nil,
		IsActive:      true,
	}

	// Test JSON marshaling
	data, err := json.Marshal(service)
	if err != nil {
		t.Errorf("Failed to marshal service: %v", err)
	}

	// Test JSON unmarshaling
	var unmarshalled Service
	err = json.Unmarshal(data, &unmarshalled)
	if err != nil {
		t.Errorf("Failed to unmarshal service: %v", err)
	}

	// Verify fields
	if unmarshalled.ID != service.ID {
		t.Errorf("Expected ID %d, got %d", service.ID, unmarshalled.ID)
	}
	if unmarshalled.Name != service.Name {
		t.Errorf("Expected Name '%s', got '%s'", service.Name, unmarshalled.Name)
	}
	if unmarshalled.BasePrice != service.BasePrice {
		t.Errorf("Expected BasePrice %.2f, got %.2f", service.BasePrice, unmarshalled.BasePrice)
	}
	if unmarshalled.IsActive != service.IsActive {
		t.Errorf("Expected IsActive %t, got %t", service.IsActive, unmarshalled.IsActive)
	}
}

func TestServiceHandler_ServiceWithPricePerPound(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Insert a service with price per pound
	pricePerPound := 2.50
	_, err := db.Exec(`
		INSERT INTO services (name, description, base_price, price_per_pound, is_active)
		VALUES ($1, $2, $3, $4, true)
	`, "weight_service", "Weight-based Service", 10.00, pricePerPound)
	if err != nil {
		t.Fatalf("Failed to insert test service: %v", err)
	}

	handler := NewServiceHandler(db.DB)

	req := httptest.NewRequest(http.MethodGet, "/services", nil)
	w := httptest.NewRecorder()

	handler.handleGetServices(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var services []Service
	err = json.NewDecoder(w.Body).Decode(&services)
	if err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	// Find our weight service
	var weightService *Service
	for _, service := range services {
		if service.Name == "weight_service" {
			weightService = &service
			break
		}
	}

	if weightService == nil {
		t.Error("Weight service not found in response")
		return
	}

	if weightService.PricePerPound == nil {
		t.Error("Expected PricePerPound to be set")
	} else if *weightService.PricePerPound != pricePerPound {
		t.Errorf("Expected PricePerPound %.2f, got %.2f", 
			pricePerPound, *weightService.PricePerPound)
	}
}

func TestServiceHandler_InactiveServicesNotReturned(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Insert active and inactive services
	services := []struct {
		name     string
		isActive bool
	}{
		{"active_service", true},
		{"inactive_service", false},
	}

	for _, service := range services {
		_, err := db.Exec(`
			INSERT INTO services (name, description, base_price, is_active)
			VALUES ($1, $2, $3, $4)
		`, service.name, "Test Service", 25.00, service.isActive)
		if err != nil {
			t.Fatalf("Failed to insert test service: %v", err)
		}
	}

	handler := NewServiceHandler(db.DB)

	req := httptest.NewRequest(http.MethodGet, "/services", nil)
	w := httptest.NewRecorder()

	handler.handleGetServices(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var returnedServices []Service
	err := json.NewDecoder(w.Body).Decode(&returnedServices)
	if err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	// Verify inactive service is not returned
	for _, service := range returnedServices {
		if service.Name == "inactive_service" {
			t.Error("Inactive service should not be returned")
		}
		if !service.IsActive {
			t.Error("All returned services should be active")
		}
	}

	// Verify active service is returned
	foundActive := false
	for _, service := range returnedServices {
		if service.Name == "active_service" {
			foundActive = true
			break
		}
	}
	if !foundActive {
		t.Error("Active service should be returned")
	}
}

func TestNewServiceHandler(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	handler := NewServiceHandler(db.DB)

	if handler == nil {
		t.Error("NewServiceHandler should return a handler")
	}

	if handler.db != db.DB {
		t.Error("Handler should use the provided database connection")
	}
}

func TestServiceHandler_DatabaseError(t *testing.T) {
	db := SetupTestDB(t)
	db.CleanupTestDB() // Close database to simulate error

	handler := NewServiceHandler(db.DB)

	req := httptest.NewRequest(http.MethodGet, "/services", nil)
	w := httptest.NewRecorder()

	handler.handleGetServices(w, req)

	// Should return an error status due to database connection being closed
	if w.Code == http.StatusOK {
		t.Error("Expected error status due to closed database connection")
	}
}