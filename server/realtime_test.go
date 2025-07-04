package main

import (
	"context"
	"testing"

	"github.com/centrifugal/centrifuge"
)

// setupCentrifugeNode creates and starts a centrifuge node for testing
func setupCentrifugeNode(t *testing.T) *centrifuge.Node {
	node, err := centrifuge.New(centrifuge.Config{
		LogLevel: centrifuge.LogLevelError, // Reduce noise in tests
	})
	if err != nil {
		t.Fatalf("Failed to create centrifuge node: %v", err)
	}

	// Start the node for testing (without WebSocket server)
	if err := node.Run(); err != nil {
		t.Fatalf("Failed to run centrifuge node: %v", err)
	}

	// Schedule cleanup
	t.Cleanup(func() {
		node.Shutdown(context.Background())
	})

	return node
}

func TestRealtimeHandler_OrderUpdates(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create and start a test Centrifuge node
	node := setupCentrifugeNode(t)
	handler := NewRealtimeHandler(db.DB, node)

	// Create test data
	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	tests := []struct {
		name           string
		userID         int
		orderID        int
		status         string
		message        string
		expectError    bool
	}{
		{
			name:        "Valid order update",
			userID:      userID,
			orderID:     orderID,
			status:      "picked_up",
			message:     "Order picked up",
			expectError: false,
		},
		{
			name:        "Another valid update",
			userID:      userID,
			orderID:     orderID,
			status:      "delivered",
			message:     "Order delivered",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := handler.PublishOrderUpdate(tt.userID, tt.orderID, tt.status, tt.message, nil)
			
			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			} else if !tt.expectError && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}

			// For successful updates, we can't easily test the actual message delivery
			// without setting up WebSocket clients, so we just verify no error occurred
		})
	}
}

func TestRealtimeHandler_PickupNotifications(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	node := setupCentrifugeNode(t)

	handler := NewRealtimeHandler(db.DB, node)

	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	err := handler.PublishOrderPickup(userID, orderID, "2024-02-01 10:00:00")
	if err != nil {
		t.Errorf("Expected no error for pickup notification, got: %v", err)
	}
}

func TestRealtimeHandler_DeliveryNotifications(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	node := setupCentrifugeNode(t)

	handler := NewRealtimeHandler(db.DB, node)

	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	err := handler.PublishOrderDelivery(userID, orderID, "2024-02-03 14:00:00")
	if err != nil {
		t.Errorf("Expected no error for delivery notification, got: %v", err)
	}
}

func TestRealtimeHandler_OrderCompleteNotifications(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	node := setupCentrifugeNode(t)

	handler := NewRealtimeHandler(db.DB, node)

	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	err := handler.PublishOrderComplete(userID, orderID)
	if err != nil {
		t.Errorf("Expected no error for order complete notification, got: %v", err)
	}
}

func TestRealtimeHandler_DriverLocationUpdate(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	node := setupCentrifugeNode(t)

	handler := NewRealtimeHandler(db.DB, node)

	userID := db.CreateTestUser(t, "test@example.com", "Test", "User")
	addressID := db.CreateTestAddress(t, userID)
	orderID := db.CreateTestOrder(t, userID, addressID)

	// Test driver location update
	lat, lng := 37.7749, -122.4194 // San Francisco coordinates
	estimatedArrival := "15 minutes"

	err := handler.SendDriverLocationUpdate(userID, orderID, lat, lng, estimatedArrival)
	if err != nil {
		t.Errorf("Expected no error for driver location update, got: %v", err)
	}
}

func TestMockRealtimeHandler(t *testing.T) {
	mock := NewMockRealtimeHandler()

	// Test publishing updates
	err := mock.PublishOrderUpdate(123, 456, "picked_up", "Test message", nil)
	if err != nil {
		t.Errorf("Expected no error from mock, got: %v", err)
	}

	// Verify update was recorded
	if len(mock.PublishedUpdates) != 1 {
		t.Errorf("Expected 1 published update, got %d", len(mock.PublishedUpdates))
	}

	update := mock.PublishedUpdates[0]
	if update.UserID != 123 {
		t.Errorf("Expected UserID 123, got %d", update.UserID)
	}
	if update.OrderID != 456 {
		t.Errorf("Expected OrderID 456, got %d", update.OrderID)
	}
	if update.Status != "picked_up" {
		t.Errorf("Expected status 'picked_up', got '%s'", update.Status)
	}

	// Test clearing updates
	mock.ClearUpdates()
	if len(mock.PublishedUpdates) != 0 {
		t.Errorf("Expected 0 published updates after clear, got %d", len(mock.PublishedUpdates))
	}
}

// Test connection handling (simplified since we can't easily test WebSocket connections)
func TestRealtimeHandler_ConnectionHandling(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	node := setupCentrifugeNode(t)

	handler := NewRealtimeHandler(db.DB, node)

	// Test that handler was created successfully
	if handler == nil {
		t.Error("Expected realtime handler to be created")
	}

	if handler.db != db.DB {
		t.Error("Expected handler to have correct database reference")
	}

	if handler.node != node {
		t.Error("Expected handler to have correct node reference")
	}
}

// Performance test for realtime updates
func BenchmarkRealtimeHandler_PublishOrderUpdate(b *testing.B) {
	db := SetupTestDB(&testing.T{})
	defer db.CleanupTestDB()

	node, err := centrifuge.New(centrifuge.Config{
		LogLevel: centrifuge.LogLevelError,
	})
	if err != nil {
		b.Fatalf("Failed to create centrifuge node: %v", err)
	}

	handler := NewRealtimeHandler(db.DB, node)

	userID := 123
	orderID := 456

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		handler.PublishOrderUpdate(userID, orderID, "processing", "Order being processed", nil)
	}
}