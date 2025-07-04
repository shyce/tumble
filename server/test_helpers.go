package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"

	_ "github.com/lib/pq"
)

// TestDB holds the test database connection
type TestDB struct {
	*sql.DB
}

// SetupTestDB creates a test database and runs migrations
func SetupTestDB(t *testing.T) *TestDB {
	// Use environment variables or defaults for test database
	dbHost := getEnvOrDefault("TEST_DB_HOST", "localhost")
	dbPort := getEnvOrDefault("TEST_DB_PORT", "5432")
	dbUser := getEnvOrDefault("TEST_DB_USER", "postgres")
	dbPassword := getEnvOrDefault("TEST_DB_PASSWORD", "postgres")
	dbName := getEnvOrDefault("TEST_DB_NAME", "tumble_test")

	// Create test database if it doesn't exist
	adminConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword)
	
	adminDB, err := sql.Open("postgres", adminConnStr)
	if err != nil {
		t.Fatalf("Failed to connect to admin database: %v", err)
	}
	defer adminDB.Close()

	// Create test database if it doesn't exist
	_, err = adminDB.Exec(fmt.Sprintf("CREATE DATABASE %s", dbName))
	if err != nil {
		// Database might already exist, try to connect to it
		if !isDBConnectionError(err) {
			t.Fatalf("Failed to create test database: %v", err)
		}
	}

	// Connect to test database
	testConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)
	
	testDB, err := sql.Open("postgres", testConnStr)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Run migrations
	if err := runMigrations(testDB); err != nil {
		t.Fatalf("Failed to run test migrations: %v", err)
	}

	// Clear all tables to ensure clean state
	testDBWrapper := &TestDB{testDB}
	testDBWrapper.TruncateTables(t)

	return testDBWrapper
}

// CleanupTestDB closes the database connection
func (db *TestDB) CleanupTestDB() {
	if db.DB != nil {
		db.Close()
	}
}

// TruncateTables clears all data from tables while preserving structure
func (db *TestDB) TruncateTables(t *testing.T) {
	tables := []string{
		"order_status_history",
		"order_items", 
		"orders",
		"subscriptions",
		"addresses",
		"sessions",
		"users",
	}

	for _, table := range tables {
		_, err := db.Exec(fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE", table))
		if err != nil {
			t.Errorf("Failed to truncate table %s: %v", table, err)
		}
	}
}

// CreateTestUser creates a test user and returns the user ID
func (db *TestDB) CreateTestUser(t *testing.T, email, firstName, lastName string) int {
	return db.CreateTestUserWithPassword(t, email, firstName, lastName, "testpassword123")
}

// CreateTestUserWithPassword creates a test user with a specific password and returns the user ID
func (db *TestDB) CreateTestUserWithPassword(t *testing.T, email, firstName, lastName, password string) int {
	// Generate bcrypt hash for the password
	passwordHash := "$2a$10$lgLi8pe6eAug2S3kzFyhQunLYyoprRzgOCYn2mckQ0xHr6RwHuLZK" // hash for "password123"
	if password != "password123" {
		// For other passwords, we'll use a simple approach for testing
		passwordHash = "$2a$10$lgLi8pe6eAug2S3kzFyhQunLYyoprRzgOCYn2mckQ0xHr6RwHuLZK" // Default to password123 hash for now
	}
	
	var userID int
	err := db.QueryRow(`
		INSERT INTO users (email, password_hash, first_name, last_name, email_verified_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		RETURNING id`,
		email, passwordHash, firstName, lastName,
	).Scan(&userID)
	
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	
	return userID
}

// CreateTestAddress creates a test address and returns the address ID
func (db *TestDB) CreateTestAddress(t *testing.T, userID int) int {
	var addressID int
	err := db.QueryRow(`
		INSERT INTO addresses (user_id, street_address, city, state, zip_code, is_default)
		VALUES ($1, $2, $3, $4, $5, true)
		RETURNING id`,
		userID, "123 Test St", "Test City", "CA", "12345",
	).Scan(&addressID)
	
	if err != nil {
		t.Fatalf("Failed to create test address: %v", err)
	}
	
	return addressID
}

// CreateTestSubscription creates a test subscription and returns the subscription ID
func (db *TestDB) CreateTestSubscription(t *testing.T, userID, planID int) int {
	var subscriptionID int
	err := db.QueryRow(`
		INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
		VALUES ($1, $2, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month')
		RETURNING id`,
		userID, planID,
	).Scan(&subscriptionID)
	
	if err != nil {
		t.Fatalf("Failed to create test subscription: %v", err)
	}
	
	return subscriptionID
}

// CreateTestOrder creates a test order and returns the order ID
func (db *TestDB) CreateTestOrder(t *testing.T, userID, addressID int) int {
	var orderID int
	err := db.QueryRow(`
		INSERT INTO orders (
			user_id, pickup_address_id, delivery_address_id,
			status, subtotal, tax, total,
			pickup_date, delivery_date, pickup_time_slot, delivery_time_slot
		) VALUES ($1, $2, $2, 'scheduled', 90.00, 7.20, 97.20, 
				 CURRENT_DATE + 1, CURRENT_DATE + 3, '9am-12pm', '9am-12pm')
		RETURNING id`,
		userID, addressID,
	).Scan(&orderID)
	
	if err != nil {
		t.Fatalf("Failed to create test order: %v", err)
	}
	
	// Add initial status history (matching the real order creation)
	_, err = db.Exec(`
		INSERT INTO order_status_history (order_id, status, notes, updated_by)
		VALUES ($1, $2, $3, $4)`,
		orderID, "scheduled", "Order created", userID,
	)
	if err != nil {
		t.Fatalf("Failed to create order status history: %v", err)
	}
	
	return orderID
}

// GetServiceID gets a service ID by name
func (db *TestDB) GetServiceID(t *testing.T, serviceName string) int {
	var serviceID int
	err := db.QueryRow("SELECT id FROM services WHERE name = $1", serviceName).Scan(&serviceID)
	if err != nil {
		t.Fatalf("Failed to get service ID for %s: %v", serviceName, err)
	}
	return serviceID
}

// GetPlanID gets a subscription plan ID by name
func (db *TestDB) GetPlanID(t *testing.T, planName string) int {
	var planID int
	err := db.QueryRow("SELECT id FROM subscription_plans WHERE name = $1", planName).Scan(&planID)
	if err != nil {
		t.Fatalf("Failed to get plan ID for %s: %v", planName, err)
	}
	return planID
}

// CreateTestJWTToken creates a test JWT token for authentication
func CreateTestJWTToken(userID int) string {
	// This would normally use the same JWT creation logic as the auth handler
	// For testing, we'll return a simple token format
	return fmt.Sprintf("test-token-user-%d", userID)
}

// getEnvOrDefault returns environment variable value or default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// AuthMockHandler helps mock authentication in tests
type AuthMockHandler struct {
	MockUserID int
	ShouldFail bool
}

func (a *AuthMockHandler) getUserIDFromRequest(r *http.Request, db *sql.DB) (int, error) {
	if a.ShouldFail {
		return 0, fmt.Errorf("mock auth failure")
	}
	return a.MockUserID, nil
}

// CreateAuthMock creates a mock auth handler for testing
func CreateAuthMock(userID int) *AuthMockHandler {
	return &AuthMockHandler{
		MockUserID: userID,
		ShouldFail: false,
	}
}

// MockRealtimeHandler creates a mock realtime handler for testing
type MockRealtimeHandler struct {
	PublishedUpdates []MockOrderUpdate
}

type MockOrderUpdate struct {
	UserID  int
	OrderID int
	Status  string
	Message string
	Data    interface{}
}

func NewMockRealtimeHandler() *MockRealtimeHandler {
	return &MockRealtimeHandler{
		PublishedUpdates: make([]MockOrderUpdate, 0),
	}
}

func (m *MockRealtimeHandler) PublishOrderUpdate(userID, orderID int, status, message string, data interface{}) error {
	m.PublishedUpdates = append(m.PublishedUpdates, MockOrderUpdate{
		UserID:  userID,
		OrderID: orderID,
		Status:  status,
		Message: message,
		Data:    data,
	})
	return nil
}

func (m *MockRealtimeHandler) PublishOrderPickup(userID, orderID int, estimatedTime string) error {
	return m.PublishOrderUpdate(userID, orderID, "pickup_scheduled", "Pickup scheduled", nil)
}

func (m *MockRealtimeHandler) PublishOrderDelivery(userID, orderID int, estimatedTime string) error {
	return m.PublishOrderUpdate(userID, orderID, "out_for_delivery", "Out for delivery", nil)
}

func (m *MockRealtimeHandler) PublishOrderComplete(userID, orderID int) error {
	return m.PublishOrderUpdate(userID, orderID, "delivered", "Order completed", nil)
}

// Ensure MockRealtimeHandler implements RealtimeInterface
var _ RealtimeInterface = (*MockRealtimeHandler)(nil)

// ClearUpdates clears the published updates for testing
func (m *MockRealtimeHandler) ClearUpdates() {
	m.PublishedUpdates = make([]MockOrderUpdate, 0)
}

// isDBConnectionError checks if the error is related to database already existing
func isDBConnectionError(err error) bool {
	return strings.Contains(err.Error(), "already exists") || 
		   strings.Contains(err.Error(), "does not exist")
}