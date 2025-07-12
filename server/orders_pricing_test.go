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

func TestOrderHandler_SubscriptionPricingCalculations(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "pricing@example.com", "Pricing", "User")
	addressID := db.CreateTestAddress(t, userID)
	
	// Get service IDs
	standardBagID := db.GetServiceID(t, "standard_bag")
	rushBagID := db.GetServiceID(t, "rush_bag")
	
	// Create a Family Fresh subscription (6 pickups/bags per month)
	_ = db.CreateTestSubscription(t, userID, 2) // Plan ID 2 = Family Fresh
	
	mockRealtime := NewMockRealtimeHandler()

	tests := []struct {
		name                    string
		orderItems              []OrderItem
		expectedSubtotal        float64
		expectedTax             float64
		expectedTotal           float64
		expectedCoveredBags     int
		expectedChargedBags     int
		description             string
	}{
		{
			name: "Single standard bag - fully covered",
			orderItems: []OrderItem{
				{ServiceID: standardBagID, Quantity: 1, Price: 30.00},
			},
			expectedSubtotal:    0.00,  // Pickup covered, bag covered
			expectedTax:         0.00,  // No tax on $0
			expectedTotal:       0.00,
			expectedCoveredBags: 1,
			expectedChargedBags: 0,
			description:         "First bag and pickup should be covered by subscription",
		},
		{
			name: "Six standard bags - all covered",
			orderItems: []OrderItem{
				{ServiceID: standardBagID, Quantity: 6, Price: 30.00},
			},
			expectedSubtotal:    0.00,  // Pickup covered, all 6 bags covered
			expectedTax:         0.00,
			expectedTotal:       0.00,
			expectedCoveredBags: 6,
			expectedChargedBags: 0,
			description:         "All 6 bags and pickup should be covered with 6-bag subscription",
		},
		{
			name: "Seven standard bags - partial coverage",
			orderItems: []OrderItem{
				{ServiceID: standardBagID, Quantity: 7, Price: 30.00},
			},
			expectedSubtotal:    30.00, // Pickup covered, 6 bags covered, 1 bag charged at $30
			expectedTax:         1.80,  // 6% of $30
			expectedTotal:       31.80,
			expectedCoveredBags: 6,
			expectedChargedBags: 1,
			description:         "Pickup covered, 6 bags covered, 7th bag charged",
		},
		{
			name: "Standard + Rush bags - only standard covered",
			orderItems: []OrderItem{
				{ServiceID: standardBagID, Quantity: 2, Price: 30.00},
				{ServiceID: rushBagID, Quantity: 1, Price: 10.00}, // Rush service is $10 addon
			},
			expectedSubtotal:    10.00, // Pickup covered, 2 standard covered, rush charged
			expectedTax:         0.60,  // 6% of $10
			expectedTotal:       10.60,
			expectedCoveredBags: 2,
			expectedChargedBags: 0, // Rush bags don't count toward bag limit
			description:         "Pickup and standard bags covered, rush service charged",
		},
		{
			name: "Only rush service - no coverage",
			orderItems: []OrderItem{
				{ServiceID: rushBagID, Quantity: 2, Price: 10.00}, // Rush service is $10 addon
			},
			expectedSubtotal:    20.00, // Pickup covered, rush service charged
			expectedTax:         1.20,  // 6% of $20
			expectedTotal:       21.20,
			expectedCoveredBags: 0,
			expectedChargedBags: 0, // Rush service doesn't count toward bag limit
			description:         "Pickup covered, rush service should never be covered by subscription",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// No need to reset subscription usage - we calculate dynamically from orders
			
			// Create handler with mocked getUserID
			testHandler := &OrderHandler{
				db:       db.DB,
				realtime: mockRealtime,
				getUserID: func(r *http.Request, db *sql.DB) (int, error) {
					return userID, nil
				},
			}

			// Create order request
			requestBody := CreateOrderRequest{
				PickupAddressID:   addressID,
				DeliveryAddressID: addressID,
				PickupDate:        "2024-12-01",
				DeliveryDate:      "2024-12-03",
				PickupTimeSlot:    "9am-12pm",
				DeliveryTimeSlot:  "1pm-5pm",
				Items:             tt.orderItems,
			}

			// Create request
			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/orders/create", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

			// Create response recorder
			w := httptest.NewRecorder()

			// Call handler
			testHandler.handleCreateOrder(w, req)

			// Check status code
			if w.Code != http.StatusOK {
				t.Errorf("Expected status %d, got %d. Response: %s", http.StatusOK, w.Code, w.Body.String())
				return
			}

			// Parse response
			var order Order
			if err := json.Unmarshal(w.Body.Bytes(), &order); err != nil {
				t.Errorf("Failed to unmarshal response: %v", err)
				return
			}

			// Verify pricing calculations
			if order.Subtotal == nil {
				t.Error("Expected subtotal to be set")
				return
			}
			if *order.Subtotal != tt.expectedSubtotal {
				t.Errorf("%s: Expected subtotal %.2f, got %.2f", tt.description, tt.expectedSubtotal, *order.Subtotal)
			}

			if order.Tax == nil {
				t.Error("Expected tax to be set")
				return
			}
			if *order.Tax != tt.expectedTax {
				t.Errorf("%s: Expected tax %.2f, got %.2f", tt.description, tt.expectedTax, *order.Tax)
			}

			if order.Total == nil {
				t.Error("Expected total to be set")
				return
			}
			if *order.Total != tt.expectedTotal {
				t.Errorf("%s: Expected total %.2f, got %.2f", tt.description, tt.expectedTotal, *order.Total)
			}

			// Note: Order items may be split due to partial coverage, so don't check exact count
			// Just verify we have at least the minimum expected items
			if len(order.Items) == 0 {
				t.Error("Expected at least 1 order item")
				return
			}

			// Count covered vs charged standard bags
			coveredBags := 0
			chargedBags := 0
			for _, item := range order.Items {
				if item.ServiceName == "standard_bag" {
					if item.Price == 0 {
						coveredBags += item.Quantity
					} else {
						chargedBags += item.Quantity
					}
				}
			}

			if coveredBags != tt.expectedCoveredBags {
				t.Errorf("%s: Expected %d covered bags, got %d", tt.description, tt.expectedCoveredBags, coveredBags)
			}

			if chargedBags != tt.expectedChargedBags {
				t.Errorf("%s: Expected %d charged bags, got %d", tt.description, tt.expectedChargedBags, chargedBags)
			}

			// Subscription usage is now calculated dynamically from actual orders, 
			// so no need to verify counter columns that no longer exist

			// Clear realtime updates for next test
			mockRealtime.ClearUpdates()
		})
	}
}

func TestOrderHandler_OrderViewingAccuracy(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "viewing@example.com", "Viewing", "User")
	addressID := db.CreateTestAddress(t, userID)
	
	// Get service IDs
	standardBagID := db.GetServiceID(t, "standard_bag")
	rushBagID := db.GetServiceID(t, "rush_bag")
	
	// Create subscription
	_ = db.CreateTestSubscription(t, userID, 2) // Family Fresh
	
	mockRealtime := NewMockRealtimeHandler()
	handler := &OrderHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	// Create an order with mixed items (some covered, some not)
	requestBody := CreateOrderRequest{
		PickupAddressID:   addressID,
		DeliveryAddressID: addressID,
		PickupDate:        "2024-12-01",
		DeliveryDate:      "2024-12-03",
		PickupTimeSlot:    "9am-12pm",
		DeliveryTimeSlot:  "1pm-5pm",
		Items: []OrderItem{
			{ServiceID: standardBagID, Quantity: 2, Price: 30.00}, // Should be covered
			{ServiceID: rushBagID, Quantity: 1, Price: 10.00},     // Should be charged
		},
	}

	// Create the order
	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/api/orders/create", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w := httptest.NewRecorder()
	handler.handleCreateOrder(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Failed to create order: %d - %s", w.Code, w.Body.String())
	}

	var createdOrder Order
	if err := json.Unmarshal(w.Body.Bytes(), &createdOrder); err != nil {
		t.Fatalf("Failed to unmarshal created order: %v", err)
	}

	// Now retrieve the order and verify it shows the same pricing
	// Set up router for get order
	router := mux.NewRouter()
	router.HandleFunc("/orders/{id}", handler.handleGetOrder).Methods("GET")
	
	req = httptest.NewRequest("GET", fmt.Sprintf("/orders/%d", createdOrder.ID), nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Failed to retrieve order: %d - %s", w.Code, w.Body.String())
	}

	var retrievedOrder Order
	if err := json.Unmarshal(w.Body.Bytes(), &retrievedOrder); err != nil {
		t.Fatalf("Failed to unmarshal retrieved order: %v", err)
	}

	// Verify pricing consistency between creation and retrieval
	if *retrievedOrder.Subtotal != *createdOrder.Subtotal {
		t.Errorf("Subtotal mismatch: created=%.2f, retrieved=%.2f", *createdOrder.Subtotal, *retrievedOrder.Subtotal)
	}

	if *retrievedOrder.Tax != *createdOrder.Tax {
		t.Errorf("Tax mismatch: created=%.2f, retrieved=%.2f", *createdOrder.Tax, *retrievedOrder.Tax)
	}

	if *retrievedOrder.Total != *createdOrder.Total {
		t.Errorf("Total mismatch: created=%.2f, retrieved=%.2f", *createdOrder.Total, *retrievedOrder.Total)
	}

	// Note: Item counts may differ due to line item splitting for partial coverage
	// We'll verify the item pricing logic separately

	// Verify all standard bags with price=0 are properly covered
	// and all rush bags have price > 0
	for _, item := range retrievedOrder.Items {
		if item.ServiceName == "standard_bag" {
			// Standard bags should either be $0 (covered) or $30 (charged)
			if item.Price != 0 && item.Price != 30.00 {
				t.Errorf("Standard bag has unexpected price: %.2f (should be 0 or 30)", item.Price)
			}
		}

		if item.ServiceName == "rush_bag" {
			// Rush bags should never be covered (price should be > 0)
			if item.Price == 0 {
				t.Error("Rush bag should never be covered (price should be > 0)")
			}
		}
	}

	// Test order list endpoint as well
	req = httptest.NewRequest("GET", "/api/orders", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w = httptest.NewRecorder()
	handler.handleGetOrders(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Failed to retrieve orders list: %d - %s", w.Code, w.Body.String())
	}

	var ordersList []Order
	if err := json.Unmarshal(w.Body.Bytes(), &ordersList); err != nil {
		t.Fatalf("Failed to unmarshal orders list: %v", err)
	}

	if len(ordersList) == 0 {
		t.Fatal("Expected at least 1 order in list")
	}

	// Find our order in the list
	var foundOrder *Order
	for _, order := range ordersList {
		if order.ID == createdOrder.ID {
			foundOrder = &order
			break
		}
	}

	if foundOrder == nil {
		t.Fatal("Created order not found in orders list")
	}

	// Verify pricing consistency in list view
	if *foundOrder.Subtotal != *createdOrder.Subtotal {
		t.Errorf("List view subtotal mismatch: created=%.2f, list=%.2f", *createdOrder.Subtotal, *foundOrder.Subtotal)
	}

	if *foundOrder.Total != *createdOrder.Total {
		t.Errorf("List view total mismatch: created=%.2f, list=%.2f", *createdOrder.Total, *foundOrder.Total)
	}

	// Verify items are included in list view with correct pricing
	// Note: Item counts may differ due to line splitting, so we just check that items exist
	if len(foundOrder.Items) == 0 {
		t.Error("List view should include order items")
	}
}

func TestOrderHandler_SubscriptionExhaustionScenarios(t *testing.T) {
	db := SetupTestDB(t)
	defer db.CleanupTestDB()

	// Create test data
	userID := db.CreateTestUser(t, "exhaustion@example.com", "Exhaustion", "User")
	addressID := db.CreateTestAddress(t, userID)
	
	standardBagID := db.GetServiceID(t, "standard_bag")
	
	// Create subscription with specific dates that match our test orders
	var subscriptionID int
	err := db.QueryRow(`
		INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
		VALUES ($1, $2, 'active', '2024-12-01', '2024-12-31')
		RETURNING id`,
		userID, 2, // Family Fresh (3 bags)
	).Scan(&subscriptionID)
	if err != nil {
		t.Fatalf("Failed to create test subscription: %v", err)
	}
	
	mockRealtime := NewMockRealtimeHandler()
	handler := &OrderHandler{
		db:       db.DB,
		realtime: mockRealtime,
		getUserID: func(r *http.Request, db *sql.DB) (int, error) {
			return userID, nil
		},
	}

	// First order: Use 4 bags (2 remaining)
	requestBody := CreateOrderRequest{
		PickupAddressID:   addressID,
		DeliveryAddressID: addressID,
		PickupDate:        "2024-12-01",
		DeliveryDate:      "2024-12-03",
		PickupTimeSlot:    "9am-12pm",
		DeliveryTimeSlot:  "1pm-5pm",
		Items: []OrderItem{
			{ServiceID: standardBagID, Quantity: 4, Price: 30.00},
		},
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/api/orders/create", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w := httptest.NewRecorder()
	handler.handleCreateOrder(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("First order failed: %d - %s", w.Code, w.Body.String())
	}

	// Verify first order used 4 covered bags
	var firstOrder Order
	json.Unmarshal(w.Body.Bytes(), &firstOrder)
	
	if *firstOrder.Subtotal != 0.00 {
		t.Errorf("First order should have $0 subtotal (all covered), got %.2f", *firstOrder.Subtotal)
	}

	// Second order: Try to use 3 more bags (should cover 2, charge 1)
	requestBody.Items = []OrderItem{
		{ServiceID: standardBagID, Quantity: 3, Price: 30.00},
	}

	body, _ = json.Marshal(requestBody)
	req = httptest.NewRequest("POST", "/api/orders/create", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w = httptest.NewRecorder()
	handler.handleCreateOrder(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Second order failed: %d - %s", w.Code, w.Body.String())
	}

	var secondOrder Order
	json.Unmarshal(w.Body.Bytes(), &secondOrder)

	// Should charge for 1 bag (2 covered, 1 charged)
	expectedSubtotal := 30.00
	expectedTax := expectedSubtotal * 0.06 // 6% tax
	expectedTotal := expectedSubtotal + expectedTax

	if *secondOrder.Subtotal != expectedSubtotal {
		t.Errorf("Second order subtotal: expected %.2f, got %.2f", expectedSubtotal, *secondOrder.Subtotal)
	}

	if *secondOrder.Tax != expectedTax {
		t.Errorf("Second order tax: expected %.2f, got %.2f", expectedTax, *secondOrder.Tax)
	}

	if *secondOrder.Total != expectedTotal {
		t.Errorf("Second order total: expected %.2f, got %.2f", expectedTotal, *secondOrder.Total)
	}

	// Verify item-level pricing in second order
	coveredBags := 0
	chargedBags := 0
	for _, item := range secondOrder.Items {
		if item.ServiceName == "standard_bag" {
			if item.Price == 0 {
				coveredBags += item.Quantity
			} else {
				chargedBags += item.Quantity
			}
		}
	}

	if coveredBags != 2 {
		t.Errorf("Expected 2 covered bags in second order, got %d", coveredBags)
	}

	if chargedBags != 1 {
		t.Errorf("Expected 1 charged bag in second order, got %d", chargedBags)
	}

	// Third order: Try to use 1 more bag (should be fully charged)
	requestBody.Items = []OrderItem{
		{ServiceID: standardBagID, Quantity: 1, Price: 30.00},
	}

	body, _ = json.Marshal(requestBody)
	req = httptest.NewRequest("POST", "/api/orders/create", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", CreateTestJWTToken(userID)))

	w = httptest.NewRecorder()
	handler.handleCreateOrder(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Third order failed: %d - %s", w.Code, w.Body.String())
	}

	var thirdOrder Order
	json.Unmarshal(w.Body.Bytes(), &thirdOrder)

	// Should charge full price (no coverage left)
	if *thirdOrder.Subtotal != 30.00 {
		t.Errorf("Third order should charge full price, got subtotal %.2f", *thirdOrder.Subtotal)
	}

	// Verify no bags are covered in third order
	for _, item := range thirdOrder.Items {
		if item.ServiceName == "standard_bag" && item.Price == 0 {
			t.Error("Third order should have no covered bags (subscription exhausted)")
		}
	}
}