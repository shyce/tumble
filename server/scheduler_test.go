package main

import (
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

func TestGetNextPickupDate(t *testing.T) {
	scheduler := &AutoScheduler{}
	
	tests := []struct {
		name         string
		preferredDay string
		leadTimeDays int
		expected     time.Weekday
	}{
		{
			name:         "Monday pickup with 1 day lead",
			preferredDay: "monday",
			leadTimeDays: 1,
			expected:     time.Monday,
		},
		{
			name:         "Friday pickup with 2 days lead",
			preferredDay: "friday",
			leadTimeDays: 2,
			expected:     time.Friday,
		},
		{
			name:         "Invalid day defaults to Monday",
			preferredDay: "invalid",
			leadTimeDays: 1,
			expected:     time.Monday,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := scheduler.getNextPickupDate(tt.preferredDay, tt.leadTimeDays)
			if result.Weekday() != tt.expected {
				t.Errorf("Expected weekday %v, got %v", tt.expected, result.Weekday())
			}
			
			// Verify the date is in the future
			now := time.Now()
			if !result.After(now) {
				t.Errorf("Expected pickup date to be in the future, got %v", result)
			}
		})
	}
}

func TestCreateOrderForUser(t *testing.T) {
	// This test requires a test database
	if testing.Short() {
		t.Skip("Skipping integration test")
	}
	
	db, err := setupTestDB()
	if err != nil {
		t.Skipf("Cannot setup test database: %v", err)
	}
	defer db.Close()
	
	scheduler := NewAutoScheduler(db)
	
	// Create test user with subscription and preferences
	userID, subscriptionID := createTestUserWithSubscription(t, db)
	
	// Create test user data
	user := ScheduleableUser{
		UserID:                   userID,
		DefaultPickupAddressID:   createTestAddress(t, db, userID),
		DefaultDeliveryAddressID: createTestAddress(t, db, userID),
		PreferredPickupTimeSlot:  "8:00 AM - 12:00 PM",
		PreferredDeliveryTimeSlot: "8:00 AM - 12:00 PM",
		PreferredPickupDay:       "monday",
		DefaultServices:          []ServiceRequest{{ServiceID: getTestServiceID(t, db), Quantity: 1}},
		LeadTimeDays:             1,
		SpecialInstructions:      "Test instructions",
		SubscriptionID:           &subscriptionID,
		PickupsRemaining:         4, // Weekly plan has 4 pickups per month
	}
	
	err = scheduler.createOrderForUser(user)
	if err != nil {
		t.Fatalf("Failed to create order: %v", err)
	}
	
	// Verify order was created
	var orderCount int
	err = db.QueryRow("SELECT COUNT(*) FROM orders WHERE user_id = $1", userID).Scan(&orderCount)
	if err != nil {
		t.Fatalf("Failed to count orders: %v", err)
	}
	
	if orderCount != 1 {
		t.Errorf("Expected 1 order, got %d", orderCount)
	}
	
	// Verify order has correct status
	var status string
	err = db.QueryRow("SELECT status FROM orders WHERE user_id = $1", userID).Scan(&status)
	if err != nil {
		t.Fatalf("Failed to get order status: %v", err)
	}
	
	if status != "pending" {
		t.Errorf("Expected status 'pending', got '%s'", status)
	}
}

func TestGetScheduleableUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}
	
	db, err := setupTestDB()
	if err != nil {
		t.Skipf("Cannot setup test database: %v", err)
	}
	defer db.Close()
	
	scheduler := NewAutoScheduler(db)
	
	// Create test user with auto-scheduling enabled
	userID, _ := createTestUserWithSubscription(t, db)
	createTestPreferences(t, db, userID, true) // auto_schedule_enabled = true
	
	// Create another user with auto-scheduling disabled
	userID2, _ := createTestUserWithSubscription(t, db)
	createTestPreferences(t, db, userID2, false) // auto_schedule_enabled = false
	
	users, err := scheduler.getScheduleableUsers()
	if err != nil {
		t.Fatalf("Failed to get scheduleable users: %v", err)
	}
	
	// Should only return user with auto-scheduling enabled
	if len(users) != 1 {
		t.Errorf("Expected 1 scheduleable user, got %d", len(users))
	}
	
	if len(users) > 0 && users[0].UserID != userID {
		t.Errorf("Expected user ID %d, got %d", userID, users[0].UserID)
	}
}

// Helper functions for testing

func setupTestDB() (*sql.DB, error) {
	// This would connect to a test database
	// In production, you'd use a separate test database
	return nil, sql.ErrNoRows // Skip for now
}

func createTestUserWithSubscription(t *testing.T, db *sql.DB) (int, int) {
	// Create a test user and subscription
	var userID, subscriptionID int
	
	// Insert test user
	err := db.QueryRow(`
		INSERT INTO users (email, password_hash, first_name, last_name, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id
	`, "test@example.com", "hash", "Test", "User", "customer").Scan(&userID)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	
	// Insert test subscription plan if not exists
	var planID int
	err = db.QueryRow(`
		INSERT INTO subscription_plans (name, description, price_per_month, pounds_included, price_per_extra_pound, pickups_per_month, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, "Test Plan", "Test description", 99.99, 50, 2.50, 4, true).Scan(&planID)
	if err != nil {
		t.Fatalf("Failed to create test plan: %v", err)
	}
	
	// Insert test subscription
	now := time.Now()
	periodStart := now.Format("2006-01-02")
	periodEnd := now.AddDate(0, 1, 0).Format("2006-01-02")
	
	err = db.QueryRow(`
		INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id
	`, userID, planID, "active", periodStart, periodEnd).Scan(&subscriptionID)
	if err != nil {
		t.Fatalf("Failed to create test subscription: %v", err)
	}
	
	return userID, subscriptionID
}

func createTestAddress(t *testing.T, db *sql.DB, userID int) *int {
	var addressID int
	err := db.QueryRow(`
		INSERT INTO addresses (user_id, type, street_address, city, state, zip_code, is_default, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id
	`, userID, "home", "123 Test St", "Test City", "TS", "12345", true).Scan(&addressID)
	if err != nil {
		t.Fatalf("Failed to create test address: %v", err)
	}
	return &addressID
}

func getTestServiceID(t *testing.T, db *sql.DB) int {
	var serviceID int
	err := db.QueryRow(`
		INSERT INTO services (name, description, base_price, is_active)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, "standard_bag", "Standard laundry bag", 45.00, true).Scan(&serviceID)
	if err != nil {
		t.Fatalf("Failed to create test service: %v", err)
	}
	return serviceID
}

func createTestPreferences(t *testing.T, db *sql.DB, userID int, autoScheduleEnabled bool) {
	addressID := createTestAddress(t, db, userID)
	serviceID := getTestServiceID(t, db)
	
	defaultServices := []ServiceRequest{{ServiceID: serviceID, Quantity: 1}}
	defaultServicesJSON, _ := json.Marshal(defaultServices)
	
	_, err := db.Exec(`
		INSERT INTO subscription_preferences (
			user_id, default_pickup_address_id, default_delivery_address_id,
			preferred_pickup_time_slot, preferred_delivery_time_slot, preferred_pickup_day,
			default_services, auto_schedule_enabled, lead_time_days, special_instructions
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, userID, addressID, addressID, "8:00 AM - 12:00 PM", "8:00 AM - 12:00 PM", "monday",
		defaultServicesJSON, autoScheduleEnabled, 1, "Test instructions")
	if err != nil {
		t.Fatalf("Failed to create test preferences: %v", err)
	}
}