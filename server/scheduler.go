package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/robfig/cron/v3"
)

type AutoScheduler struct {
	db   *sql.DB
	cron *cron.Cron
}

type ScheduleableUser struct {
	UserID                   int              `json:"user_id"`
	DefaultPickupAddressID   *int             `json:"default_pickup_address_id"`
	DefaultDeliveryAddressID *int             `json:"default_delivery_address_id"`
	PreferredPickupTimeSlot  string           `json:"preferred_pickup_time_slot"`
	PreferredDeliveryTimeSlot string          `json:"preferred_delivery_time_slot"`
	PreferredPickupDay       string           `json:"preferred_pickup_day"`
	DefaultServices          []ServiceRequest `json:"default_services"`
	LeadTimeDays             int              `json:"lead_time_days"`
	SpecialInstructions      string           `json:"special_instructions"`
	SubscriptionID           *int             `json:"subscription_id"`
	PickupsRemaining         int              `json:"pickups_remaining"`
}

func NewAutoScheduler(db *sql.DB) *AutoScheduler {
	c := cron.New(cron.WithLocation(time.UTC))
	return &AutoScheduler{
		db:   db,
		cron: c,
	}
}

func (s *AutoScheduler) Start() {
	// Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
	s.cron.AddFunc("0 * * * *", s.processAutoScheduledOrders)
	
	// Also run once on startup for testing
	go func() {
		time.Sleep(5 * time.Second) // Give time for startup
		s.processAutoScheduledOrders()
	}()
	
	s.cron.Start()
	log.Println("Auto-scheduler started - running every hour")
}

func (s *AutoScheduler) Stop() {
	s.cron.Stop()
	log.Println("Auto-scheduler stopped")
}

func (s *AutoScheduler) processAutoScheduledOrders() {
	log.Println("Processing auto-scheduled orders...")
	
	// Get all users with auto-scheduling enabled
	users, err := s.getScheduleableUsers()
	if err != nil {
		log.Printf("Error getting scheduleable users: %v", err)
		return
	}
	
	log.Printf("Found %d users with auto-scheduling enabled", len(users))
	
	for _, user := range users {
		err := s.createOrderForUser(user)
		if err != nil {
			log.Printf("Error creating order for user %d: %v", user.UserID, err)
		}
	}
	
	log.Println("Finished processing auto-scheduled orders")
}

func (s *AutoScheduler) getScheduleableUsers() ([]ScheduleableUser, error) {
	query := `
		SELECT 
			sp.user_id,
			sp.default_pickup_address_id,
			sp.default_delivery_address_id,
			sp.preferred_pickup_time_slot,
			sp.preferred_delivery_time_slot,
			sp.preferred_pickup_day,
			sp.default_services,
			sp.lead_time_days,
			sp.special_instructions,
			s.id as subscription_id,
			COALESCE(
				(sp_plan.pickups_per_month - 
				 (SELECT COUNT(*) FROM orders o 
				  WHERE o.user_id = sp.user_id 
				    AND o.subscription_id = s.id
				    AND o.pickup_date >= s.current_period_start::date 
				    AND o.pickup_date < s.current_period_end::date
				    AND o.status != 'cancelled')), 
				0
			) as pickups_remaining
		FROM subscription_preferences sp
		JOIN subscriptions s ON sp.user_id = s.user_id AND s.status = 'active'
		JOIN subscription_plans sp_plan ON s.plan_id = sp_plan.id
		WHERE sp.auto_schedule_enabled = true
		  AND sp.default_pickup_address_id IS NOT NULL
		  AND sp.default_delivery_address_id IS NOT NULL
	`
	
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query scheduleable users: %w", err)
	}
	defer rows.Close()
	
	var users []ScheduleableUser
	for rows.Next() {
		var user ScheduleableUser
		var defaultServicesJSON []byte
		
		err := rows.Scan(
			&user.UserID,
			&user.DefaultPickupAddressID,
			&user.DefaultDeliveryAddressID,
			&user.PreferredPickupTimeSlot,
			&user.PreferredDeliveryTimeSlot,
			&user.PreferredPickupDay,
			&defaultServicesJSON,
			&user.LeadTimeDays,
			&user.SpecialInstructions,
			&user.SubscriptionID,
			&user.PickupsRemaining,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		
		// Parse default services JSON
		if len(defaultServicesJSON) > 0 {
			err = json.Unmarshal(defaultServicesJSON, &user.DefaultServices)
			if err != nil {
				log.Printf("Error parsing default services for user %d: %v", user.UserID, err)
				continue
			}
		}
		
		users = append(users, user)
	}
	
	return users, nil
}

func (s *AutoScheduler) createOrderForUser(user ScheduleableUser) error {
	// Check if user has pickups remaining
	if user.PickupsRemaining <= 0 {
		log.Printf("User %d has no pickups remaining this period", user.UserID)
		return nil
	}
	
	// Calculate the next pickup date based on preferred day and lead time
	nextPickupDate := s.getNextPickupDate(user.PreferredPickupDay, user.LeadTimeDays)
	
	// Check if an order already exists for this pickup date
	exists, err := s.orderExistsForDate(user.UserID, nextPickupDate)
	if err != nil {
		return fmt.Errorf("error checking existing orders: %w", err)
	}
	if exists {
		log.Printf("Order already exists for user %d on %s", user.UserID, nextPickupDate.Format("2006-01-02"))
		return nil
	}
	
	// Calculate delivery date (1-2 days after pickup)
	deliveryDate := nextPickupDate.AddDate(0, 0, 2) // 2 days after pickup
	
	// Create the order
	orderID, err := s.createOrder(user, nextPickupDate, deliveryDate)
	if err != nil {
		return fmt.Errorf("error creating order: %w", err)
	}
	
	log.Printf("Created auto-scheduled order %d for user %d (pickup: %s)", 
		orderID, user.UserID, nextPickupDate.Format("2006-01-02"))
	
	return nil
}

func (s *AutoScheduler) getNextPickupDate(preferredDay string, leadTimeDays int) time.Time {
	now := time.Now()
	targetDate := now.AddDate(0, 0, leadTimeDays)
	
	// Map day names to weekday numbers
	dayMap := map[string]time.Weekday{
		"sunday":    time.Sunday,
		"monday":    time.Monday,
		"tuesday":   time.Tuesday,
		"wednesday": time.Wednesday,
		"thursday":  time.Thursday,
		"friday":    time.Friday,
		"saturday":  time.Saturday,
	}
	
	preferredWeekday, exists := dayMap[preferredDay]
	if !exists {
		preferredWeekday = time.Monday // Default to Monday
	}
	
	// Find the next occurrence of the preferred weekday from the target date
	daysUntilPreferred := int(preferredWeekday - targetDate.Weekday())
	if daysUntilPreferred <= 0 {
		daysUntilPreferred += 7 // Next week
	}
	
	return targetDate.AddDate(0, 0, daysUntilPreferred)
}

func (s *AutoScheduler) orderExistsForDate(userID int, pickupDate time.Time) (bool, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM orders 
		WHERE user_id = $1 AND pickup_date = $2 AND status != 'cancelled'
	`, userID, pickupDate.Format("2006-01-02")).Scan(&count)
	
	return count > 0, err
}

func (s *AutoScheduler) createOrder(user ScheduleableUser, pickupDate, deliveryDate time.Time) (int, error) {
	// Start transaction
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	
	// Create the order
	var orderID int
	err = tx.QueryRow(`
		INSERT INTO orders (
			user_id, subscription_id, pickup_address_id, delivery_address_id,
			status, pickup_date, delivery_date, pickup_time_slot, delivery_time_slot,
			special_instructions, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id
	`, 
		user.UserID, user.SubscriptionID, user.DefaultPickupAddressID, user.DefaultDeliveryAddressID,
		"pending", pickupDate.Format("2006-01-02"), deliveryDate.Format("2006-01-02"),
		user.PreferredPickupTimeSlot, user.PreferredDeliveryTimeSlot, user.SpecialInstructions,
	).Scan(&orderID)
	
	if err != nil {
		return 0, err
	}
	
	// Add order items
	for _, service := range user.DefaultServices {
		// Get service price
		var price float64
		err = tx.QueryRow("SELECT base_price FROM services WHERE id = $1", service.ServiceID).Scan(&price)
		if err != nil {
			continue // Skip invalid services
		}
		
		// For subscription orders, standard_bag services are free (price = 0)
		var serviceName string
		err = tx.QueryRow("SELECT name FROM services WHERE id = $1", service.ServiceID).Scan(&serviceName)
		if err == nil && serviceName == "standard_bag" {
			price = 0 // Covered by subscription
		}
		
		_, err = tx.Exec(`
			INSERT INTO order_items (order_id, service_id, quantity, price, created_at)
			VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		`, orderID, service.ServiceID, service.Quantity, price)
		
		if err != nil {
			return 0, err
		}
	}
	
	// Calculate totals
	var subtotal, tax, total float64
	err = tx.QueryRow(`
		SELECT COALESCE(SUM(price * quantity), 0) FROM order_items WHERE order_id = $1
	`, orderID).Scan(&subtotal)
	if err != nil {
		return 0, err
	}
	
	tax = subtotal * 0.08 // 8% tax
	total = subtotal + tax
	
	// Update order totals
	_, err = tx.Exec(`
		UPDATE orders SET subtotal = $1, tax = $2, total = $3 WHERE id = $4
	`, subtotal, tax, total, orderID)
	if err != nil {
		return 0, err
	}
	
	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return 0, err
	}
	
	return orderID, nil
}