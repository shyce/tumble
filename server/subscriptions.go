package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/price"
	"github.com/stripe/stripe-go/v82/product"
	"github.com/stripe/stripe-go/v82/subscription"
)

type SubscriptionHandler struct {
	db        *sql.DB
	getUserID func(*http.Request, *sql.DB) (int, error)
}

type SubscriptionPlan struct {
	ID              int     `json:"id"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	PricePerMonth   float64 `json:"price_per_month"`   // Convert from cents for JSON
	PickupsPerMonth int     `json:"pickups_per_month"`
	IsActive        bool    `json:"is_active"`
}

type Subscription struct {
	ID                   int               `json:"id"`
	UserID               int               `json:"user_id"`
	PlanID               int               `json:"plan_id"`
	Plan                 *SubscriptionPlan `json:"plan,omitempty"`
	Status               string            `json:"status"`
	CurrentPeriodStart   string            `json:"current_period_start"`
	CurrentPeriodEnd     string            `json:"current_period_end"`
	StripeSubscriptionID *string           `json:"stripe_subscription_id,omitempty"`
	CreatedAt            time.Time         `json:"created_at"`
	UpdatedAt            time.Time         `json:"updated_at"`
}

type CreateSubscriptionRequest struct {
	PlanID int `json:"plan_id"`
}

type UpdateSubscriptionRequest struct {
	Status string `json:"status,omitempty"` // active, paused, cancelled
	PlanID *int   `json:"plan_id,omitempty"`
}

// SubscriptionPreferences represents user preferences for recurring orders
type SubscriptionPreferences struct {
	ID                       int              `json:"id"`
	UserID                   int              `json:"user_id"`
	DefaultPickupAddressID   *int             `json:"default_pickup_address_id"`
	DefaultDeliveryAddressID *int             `json:"default_delivery_address_id"`
	PreferredPickupTimeSlot  string           `json:"preferred_pickup_time_slot"`
	PreferredDeliveryTimeSlot string          `json:"preferred_delivery_time_slot"`
	PreferredPickupDay       string           `json:"preferred_pickup_day"`
	DefaultServices          []ServiceRequest `json:"default_services"`
	AutoScheduleEnabled      bool             `json:"auto_schedule_enabled"`
	LeadTimeDays             int              `json:"lead_time_days"`
	SpecialInstructions      string           `json:"special_instructions"`
	CreatedAt                time.Time        `json:"created_at"`
	UpdatedAt                time.Time        `json:"updated_at"`
}

// ServiceRequest represents a service selection for recurring orders
type ServiceRequest struct {
	ServiceID int `json:"service_id"`
	Quantity  int `json:"quantity"`
}

// CreateSubscriptionPreferencesRequest represents the request body for creating preferences
type CreateSubscriptionPreferencesRequest struct {
	DefaultPickupAddressID   *int             `json:"default_pickup_address_id"`
	DefaultDeliveryAddressID *int             `json:"default_delivery_address_id"`
	PreferredPickupTimeSlot  string           `json:"preferred_pickup_time_slot"`
	PreferredDeliveryTimeSlot string          `json:"preferred_delivery_time_slot"`
	PreferredPickupDay       string           `json:"preferred_pickup_day"`
	DefaultServices          []ServiceRequest `json:"default_services"`
	AutoScheduleEnabled      bool             `json:"auto_schedule_enabled"`
	LeadTimeDays             int              `json:"lead_time_days"`
	SpecialInstructions      string           `json:"special_instructions"`
}

func NewSubscriptionHandler(db *sql.DB) *SubscriptionHandler {
	// Initialize Stripe with API key
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	
	return &SubscriptionHandler{
		db:        db,
		getUserID: getUserIDFromRequest,
	}
}

// handleGetPlans returns all available subscription plans
func (h *SubscriptionHandler) handleGetPlans(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.db.Query(`
		SELECT id, name, description, price_per_month_cents, pickups_per_month, is_active
		FROM subscription_plans
		WHERE is_active = true
		ORDER BY price_per_month_cents ASC`)
	if err != nil {
		http.Error(w, "Failed to fetch plans", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	plans := []SubscriptionPlan{}
	for rows.Next() {
		var plan SubscriptionPlan
		var pricePerMonthCents int
		err := rows.Scan(
			&plan.ID, &plan.Name, &plan.Description,
			&pricePerMonthCents, &plan.PickupsPerMonth,
			&plan.IsActive,
		)
		if err != nil {
			http.Error(w, "Failed to parse plans", http.StatusInternalServerError)
			return
		}
		// Convert cents to dollars for JSON response
		plan.PricePerMonth = float64(pricePerMonthCents) / 100.0
		plans = append(plans, plan)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plans)
}

// handleGetSubscription returns the current user's subscription
func (h *SubscriptionHandler) handleGetSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var subscription Subscription
	var plan SubscriptionPlan
	var pricePerMonthCents int

	err = h.db.QueryRow(`
		SELECT s.id, s.user_id, s.plan_id, s.status,
			   s.current_period_start, s.current_period_end,
			   s.stripe_subscription_id, s.created_at, s.updated_at,
			   p.id, p.name, p.description, p.price_per_month_cents,
			   p.pickups_per_month
		FROM subscriptions s
		JOIN subscription_plans p ON s.plan_id = p.id
		WHERE s.user_id = $1
		ORDER BY s.created_at DESC
		LIMIT 1`,
		userID,
	).Scan(
		&subscription.ID, &subscription.UserID, &subscription.PlanID,
		&subscription.Status, &subscription.CurrentPeriodStart,
		&subscription.CurrentPeriodEnd, &subscription.StripeSubscriptionID, 
		&subscription.CreatedAt, &subscription.UpdatedAt,
		&plan.ID, &plan.Name, &plan.Description, &pricePerMonthCents,
		&plan.PickupsPerMonth,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No active subscription found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch subscription", http.StatusInternalServerError)
		}
		return
	}
	
	// Convert cents to dollars for JSON response
	plan.PricePerMonth = float64(pricePerMonthCents) / 100.0

	subscription.Plan = &plan

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscription)
}

// handleCreateSubscription creates a new subscription for the user
func (h *SubscriptionHandler) handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check if user already has an active subscription
	var existingCount int
	err = h.db.QueryRow(`
		SELECT COUNT(*) FROM subscriptions 
		WHERE user_id = $1 AND status IN ('active', 'paused')`,
		userID,
	).Scan(&existingCount)
	if err != nil {
		http.Error(w, "Failed to check existing subscription", http.StatusInternalServerError)
		return
	}
	if existingCount > 0 {
		http.Error(w, "User already has an active subscription", http.StatusBadRequest)
		return
	}

	// Verify plan exists and is active
	var planExists bool
	err = h.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM subscription_plans WHERE id = $1 AND is_active = true)`,
		req.PlanID,
	).Scan(&planExists)
	if err != nil || !planExists {
		http.Error(w, "Invalid subscription plan", http.StatusBadRequest)
		return
	}

	// Calculate billing period
	now := time.Now()
	periodStart := now.Format("2006-01-02")
	periodEnd := now.AddDate(0, 1, 0).Format("2006-01-02")

	// Create subscription
	var subscriptionID int
	err = h.db.QueryRow(`
		INSERT INTO subscriptions (
			user_id, plan_id, status, 
			current_period_start, current_period_end
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		userID, req.PlanID, "active",
		periodStart, periodEnd,
	).Scan(&subscriptionID)
	if err != nil {
		http.Error(w, "Failed to create subscription", http.StatusInternalServerError)
		return
	}

	// Fetch the created subscription
	subscription, err := h.getSubscriptionByID(subscriptionID)
	if err != nil {
		http.Error(w, "Failed to fetch created subscription", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscription)
}

// SubscriptionChangePreview represents the preview of a subscription change
type SubscriptionChangePreview struct {
	CurrentPlan          *SubscriptionPlan `json:"current_plan"`
	NewPlan              *SubscriptionPlan `json:"new_plan"`
	ImmediateCharge      float64           `json:"immediate_charge"`
	ImmediateCredit      float64           `json:"immediate_credit"`
	ProrationDescription string            `json:"proration_description"`
	NewBillingDate       string            `json:"new_billing_date"`
	RequiresPaymentMethod bool             `json:"requires_payment_method"`
}

// handlePreviewSubscriptionChange returns a preview of what would happen if the user changes plans
func (h *SubscriptionHandler) handlePreviewSubscriptionChange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		NewPlanID int `json:"new_plan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get current subscription
	var currentSub struct {
		ID                   int
		PlanID               int
		StripeSubscriptionID sql.NullString
		CurrentPeriodEnd     string
	}
	
	err = h.db.QueryRow(`
		SELECT id, plan_id, stripe_subscription_id, current_period_end
		FROM subscriptions 
		WHERE user_id = $1 AND status = 'active'
		ORDER BY created_at DESC 
		LIMIT 1
	`, userID).Scan(&currentSub.ID, &currentSub.PlanID, &currentSub.StripeSubscriptionID, &currentSub.CurrentPeriodEnd)
	
	if err != nil {
		http.Error(w, "No active subscription found", http.StatusNotFound)
		return
	}

	if currentSub.PlanID == req.NewPlanID {
		http.Error(w, "Cannot change to the same plan", http.StatusBadRequest)
		return
	}

	// Get plan details
	var currentPlan, newPlan SubscriptionPlan
	
	var currentPlanPriceCents int
	err = h.db.QueryRow(`
		SELECT id, name, description, price_per_month_cents, pickups_per_month, is_active
		FROM subscription_plans WHERE id = $1
	`, currentSub.PlanID).Scan(
		&currentPlan.ID, &currentPlan.Name, &currentPlan.Description,
		&currentPlanPriceCents, &currentPlan.PickupsPerMonth,
		&currentPlan.IsActive,
	)
	if err != nil {
		http.Error(w, "Current plan not found", http.StatusInternalServerError)
		return
	}
	currentPlan.PricePerMonth = float64(currentPlanPriceCents) / 100.0

	var newPlanPriceCents int
	err = h.db.QueryRow(`
		SELECT id, name, description, price_per_month_cents, pickups_per_month, is_active
		FROM subscription_plans WHERE id = $1 AND is_active = true
	`, req.NewPlanID).Scan(
		&newPlan.ID, &newPlan.Name, &newPlan.Description,
		&newPlanPriceCents, &newPlan.PickupsPerMonth,
		&newPlan.IsActive,
	)
	if err != nil {
		http.Error(w, "New plan not found", http.StatusBadRequest)
		return
	}
	newPlan.PricePerMonth = float64(newPlanPriceCents) / 100.0

	preview := SubscriptionChangePreview{
		CurrentPlan: &currentPlan,
		NewPlan:     &newPlan,
		NewBillingDate: currentSub.CurrentPeriodEnd,
	}

	// Calculate proration if we have Stripe subscription
	if currentSub.StripeSubscriptionID.Valid {
		err = h.calculateProrationPreview(&preview, currentSub.StripeSubscriptionID.String, req.NewPlanID)
		if err != nil {
			log.Printf("Failed to calculate proration preview: %v", err)
			// Continue without Stripe proration data
		}
	}

	// Determine if payment method is required (for upgrades)
	if newPlan.PricePerMonth > currentPlan.PricePerMonth {
		preview.RequiresPaymentMethod = true
		
		// Check if user has a valid payment method
		var hasPaymentMethod bool
		h.db.QueryRow(`
			SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND default_payment_method_id IS NOT NULL)
		`, userID).Scan(&hasPaymentMethod)
		
		if !hasPaymentMethod {
			preview.ProrationDescription = "⚠️ This upgrade requires a valid payment method. Please add a payment method before proceeding."
		}
	}

	// Generate description based on price difference
	priceDiff := newPlan.PricePerMonth - currentPlan.PricePerMonth
	if priceDiff > 0 {
		if preview.ProrationDescription == "" {
			preview.ProrationDescription = fmt.Sprintf("You'll be charged a prorated amount of approximately $%.2f today for the upgrade, and your next billing will be $%.2f/month.", 
				preview.ImmediateCharge, newPlan.PricePerMonth)
		}
	} else {
		preview.ProrationDescription = fmt.Sprintf("You'll receive a prorated credit of approximately $%.2f, and your next billing will be $%.2f/month.", 
			preview.ImmediateCredit, newPlan.PricePerMonth)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
}

// handleUpdateSubscription updates a subscription status or plan with proper Stripe integration
func (h *SubscriptionHandler) handleUpdateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get subscription ID from URL
	vars := mux.Vars(r)
	subscriptionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid subscription ID", http.StatusBadRequest)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate status if provided
	if req.Status != "" && req.Status != "active" && req.Status != "paused" && req.Status != "cancelled" {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	// Check current subscription status - prevent changes to cancelled subscriptions
	var currentStatus string
	var currentPlanID int
	var stripeSubscriptionID sql.NullString
	var currentPeriodEnd string
	
	err = h.db.QueryRow(`
		SELECT status, plan_id, stripe_subscription_id, current_period_end
		FROM subscriptions WHERE id = $1 AND user_id = $2
	`, subscriptionID, userID).Scan(&currentStatus, &currentPlanID, &stripeSubscriptionID, &currentPeriodEnd)
	
	if err != nil {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
	}
	
	if currentStatus == "cancelled" {
		http.Error(w, "Cannot modify a cancelled subscription", http.StatusBadRequest)
		return
	}

	// Handle plan changes with proper Stripe integration
	if req.PlanID != nil && *req.PlanID != currentPlanID {
		err = h.processSubscriptionPlanChange(subscriptionID, userID, currentPlanID, *req.PlanID, stripeSubscriptionID)
		if err != nil {
			if err.Error() == "no_payment_method" {
				http.Error(w, "This upgrade requires a valid payment method. Please add a payment method before changing plans.", http.StatusBadRequest)
			} else if err.Error() == "invalid_plan" {
				http.Error(w, "Invalid subscription plan", http.StatusBadRequest)
			} else {
				log.Printf("Failed to process plan change: %v", err)
				http.Error(w, "Failed to update subscription plan", http.StatusInternalServerError)
			}
			return
		}
	}

	// Handle status changes
	if req.Status != "" && req.Status != currentStatus {
		// Build update query for status change
		_, err := h.db.Exec(`
			UPDATE subscriptions 
			SET status = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2 AND user_id = $3
		`, req.Status, subscriptionID, userID)
		
		if err != nil {
			http.Error(w, "Failed to update subscription status", http.StatusInternalServerError)
			return
		}
	}

	// Fetch updated subscription
	subscription, err := h.getSubscriptionByID(subscriptionID)
	if err != nil {
		http.Error(w, "Failed to fetch updated subscription", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscription)
}

// handleCancelSubscription cancels a subscription
func (h *SubscriptionHandler) handleCancelSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get subscription ID from URL
	vars := mux.Vars(r)
	subscriptionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid subscription ID", http.StatusBadRequest)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	
	log.Printf("User %d attempting to cancel subscription %d", userID, subscriptionID)

	// Get Stripe subscription ID first
	var stripeSubscriptionID sql.NullString
	err = h.db.QueryRow(`
		SELECT stripe_subscription_id 
		FROM subscriptions 
		WHERE id = $1 AND user_id = $2 AND status != 'cancelled'`,
		subscriptionID, userID,
	).Scan(&stripeSubscriptionID)
	
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Subscription not found or already cancelled", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch subscription", http.StatusInternalServerError)
		}
		return
	}

	// Cancel subscription in Stripe if we have a Stripe subscription ID
	if stripeSubscriptionID.Valid && stripeSubscriptionID.String != "" {
		params := &stripe.SubscriptionParams{
			CancelAtPeriodEnd: stripe.Bool(true),
		}
		
		_, err = subscription.Update(stripeSubscriptionID.String, params)
		if err != nil {
			log.Printf("Failed to cancel Stripe subscription %s: %v", stripeSubscriptionID.String, err)
			http.Error(w, "Failed to cancel subscription in Stripe", http.StatusInternalServerError)
			return
		}
		
		log.Printf("Successfully scheduled Stripe subscription %s for cancellation at period end", stripeSubscriptionID.String)
	}

	// Update local database - mark as cancelled but subscription remains active until period end
	result, err := h.db.Exec(`
		UPDATE subscriptions 
		SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2`,
		subscriptionID, userID,
	)
	if err != nil {
		http.Error(w, "Failed to update subscription status", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
	}

	// Fetch and return the updated subscription
	subscription, err := h.getSubscriptionByID(subscriptionID)
	if err != nil {
		http.Error(w, "Failed to fetch updated subscription", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscription)
}

// getSubscriptionByID fetches a subscription with plan details
func (h *SubscriptionHandler) getSubscriptionByID(subscriptionID int) (*Subscription, error) {
	var subscription Subscription
	var plan SubscriptionPlan

	err := h.db.QueryRow(`
		SELECT s.id, s.user_id, s.plan_id, s.status,
			   s.current_period_start, s.current_period_end,
			   s.stripe_subscription_id, s.created_at, s.updated_at,
			   p.id, p.name, p.description, p.price_per_month_cents,
			   p.pickups_per_month
		FROM subscriptions s
		JOIN subscription_plans p ON s.plan_id = p.id
		WHERE s.id = $1`,
		subscriptionID,
	).Scan(
		&subscription.ID, &subscription.UserID, &subscription.PlanID,
		&subscription.Status, &subscription.CurrentPeriodStart,
		&subscription.CurrentPeriodEnd, &subscription.StripeSubscriptionID,
		&subscription.CreatedAt, &subscription.UpdatedAt,
		&plan.ID, &plan.Name, &plan.Description, &plan.PricePerMonth,
		&plan.PickupsPerMonth,
	)

	if err != nil {
		return nil, err
	}

	subscription.Plan = &plan
	return &subscription, nil
}

// handleGetSubscriptionUsage returns usage statistics for the current billing period
func (h *SubscriptionHandler) handleGetSubscriptionUsage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from auth token
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get active subscription
	var subscriptionID int
	var planID int
	var pickupsPerMonth int
	var currentPeriodStart, currentPeriodEnd string

	err = h.db.QueryRow(`
		SELECT s.id, s.plan_id, s.current_period_start, s.current_period_end, p.pickups_per_month
		FROM subscriptions s
		JOIN subscription_plans p ON s.plan_id = p.id
		WHERE s.user_id = $1
		ORDER BY s.created_at DESC
		LIMIT 1`,
		userID,
	).Scan(&subscriptionID, &planID, &currentPeriodStart, &currentPeriodEnd, &pickupsPerMonth)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No subscription found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch subscription", http.StatusInternalServerError)
		}
		return
	}

	// Count orders in current period
	var ordersCount int
	var coveredBags int
	err = h.db.QueryRow(`
		SELECT 
			COUNT(DISTINCT o.id), 
			COALESCE(SUM(CASE WHEN oi.price_cents = 0 AND s.name = 'standard_bag' THEN oi.quantity ELSE 0 END), 0)
		FROM orders o
		LEFT JOIN order_items oi ON o.id = oi.order_id
		LEFT JOIN services s ON oi.service_id = s.id
		WHERE o.user_id = $1 
		AND o.subscription_id = $2
		AND o.pickup_date >= $3::date 
		AND o.pickup_date < $4::date
		AND o.status != 'cancelled'`,
		userID, subscriptionID, currentPeriodStart, currentPeriodEnd,
	).Scan(&ordersCount, &coveredBags)

	if err != nil {
		http.Error(w, "Failed to fetch usage data", http.StatusInternalServerError)
		return
	}

	// Calculate remaining values, ensuring they never go below 0
	pickupsRemaining := pickupsPerMonth - ordersCount
	if pickupsRemaining < 0 {
		pickupsRemaining = 0
	}
	
	bagsRemaining := pickupsPerMonth - coveredBags
	if bagsRemaining < 0 {
		bagsRemaining = 0
	}

	usage := map[string]interface{}{
		"subscription_id":      subscriptionID,
		"current_period_start": currentPeriodStart,
		"current_period_end":   currentPeriodEnd,
		"pickups_used":         ordersCount,
		"pickups_allowed":      pickupsPerMonth,
		"pickups_remaining":    pickupsRemaining,
		"bags_used":            coveredBags,
		"bags_allowed":         pickupsPerMonth,             // Total bags allowed per month
		"bags_remaining":       bagsRemaining, // Remaining bags = total allowed - bags covered (min 0)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(usage)
}

// handleGetSubscriptionPreferences retrieves user's subscription preferences
func (h *SubscriptionHandler) handleGetSubscriptionPreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var prefs SubscriptionPreferences
	var defaultServicesJSON []byte

	err = h.db.QueryRow(`
		SELECT id, user_id, default_pickup_address_id, default_delivery_address_id,
			   preferred_pickup_time_slot, preferred_delivery_time_slot, preferred_pickup_day,
			   default_services, auto_schedule_enabled, lead_time_days, special_instructions,
			   created_at, updated_at
		FROM subscription_preferences
		WHERE user_id = $1
	`, userID).Scan(
		&prefs.ID, &prefs.UserID, &prefs.DefaultPickupAddressID, &prefs.DefaultDeliveryAddressID,
		&prefs.PreferredPickupTimeSlot, &prefs.PreferredDeliveryTimeSlot, &prefs.PreferredPickupDay,
		&defaultServicesJSON, &prefs.AutoScheduleEnabled, &prefs.LeadTimeDays, &prefs.SpecialInstructions,
		&prefs.CreatedAt, &prefs.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Get standard_bag service ID for default
			var standardBagServiceID int
			err = h.db.QueryRow("SELECT id FROM services WHERE name = 'standard_bag' AND is_active = true LIMIT 1").Scan(&standardBagServiceID)
			if err != nil {
				http.Error(w, "Standard bag service not found", http.StatusInternalServerError)
				return
			}
			
			// Return default preferences if none exist
			prefs = SubscriptionPreferences{
				UserID:                   userID,
				PreferredPickupTimeSlot:  "8:00 AM - 12:00 PM",
				PreferredDeliveryTimeSlot: "8:00 AM - 12:00 PM",
				PreferredPickupDay:       "monday",
				DefaultServices:          []ServiceRequest{{ServiceID: standardBagServiceID, Quantity: 1}}, // Default to 1 standard bag
				AutoScheduleEnabled:      true,
				LeadTimeDays:             1,
				SpecialInstructions:      "",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(prefs)
			return
		}
		http.Error(w, "Failed to retrieve preferences", http.StatusInternalServerError)
		return
	}

	// Parse the default services JSON
	if len(defaultServicesJSON) > 0 {
		err = json.Unmarshal(defaultServicesJSON, &prefs.DefaultServices)
		if err != nil {
			http.Error(w, "Failed to parse default services", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prefs)
}

// handleCreateOrUpdateSubscriptionPreferences creates or updates user's subscription preferences
func (h *SubscriptionHandler) handleCreateOrUpdateSubscriptionPreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateSubscriptionPreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.PreferredPickupTimeSlot == "" {
		req.PreferredPickupTimeSlot = "8:00 AM - 12:00 PM"
	}
	if req.PreferredDeliveryTimeSlot == "" {
		req.PreferredDeliveryTimeSlot = "8:00 AM - 12:00 PM"
	}
	if req.PreferredPickupDay == "" {
		req.PreferredPickupDay = "monday"
	}
	if req.LeadTimeDays == 0 {
		req.LeadTimeDays = 1
	}
	if req.DefaultServices == nil {
		// Get standard_bag service ID for default
		var standardBagServiceID int
		err = h.db.QueryRow("SELECT id FROM services WHERE name = 'standard_bag' AND is_active = true LIMIT 1").Scan(&standardBagServiceID)
		if err != nil {
			http.Error(w, "Standard bag service not found", http.StatusInternalServerError)
			return
		}
		req.DefaultServices = []ServiceRequest{{ServiceID: standardBagServiceID, Quantity: 1}}
	}

	// Validate addresses exist and belong to user
	if req.DefaultPickupAddressID != nil {
		var count int
		err = h.db.QueryRow("SELECT COUNT(*) FROM addresses WHERE id = $1 AND user_id = $2", 
			*req.DefaultPickupAddressID, userID).Scan(&count)
		if err != nil || count == 0 {
			http.Error(w, "Invalid pickup address", http.StatusBadRequest)
			return
		}
	}

	if req.DefaultDeliveryAddressID != nil {
		var count int
		err = h.db.QueryRow("SELECT COUNT(*) FROM addresses WHERE id = $1 AND user_id = $2", 
			*req.DefaultDeliveryAddressID, userID).Scan(&count)
		if err != nil || count == 0 {
			http.Error(w, "Invalid delivery address", http.StatusBadRequest)
			return
		}
	}

	// Convert default services to JSON
	defaultServicesJSON, err := json.Marshal(req.DefaultServices)
	if err != nil {
		http.Error(w, "Failed to process default services", http.StatusInternalServerError)
		return
	}

	// Use UPSERT to create or update preferences
	_, err = h.db.Exec(`
		INSERT INTO subscription_preferences (
			user_id, default_pickup_address_id, default_delivery_address_id,
			preferred_pickup_time_slot, preferred_delivery_time_slot, preferred_pickup_day,
			default_services, auto_schedule_enabled, lead_time_days, special_instructions
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id) DO UPDATE SET
			default_pickup_address_id = EXCLUDED.default_pickup_address_id,
			default_delivery_address_id = EXCLUDED.default_delivery_address_id,
			preferred_pickup_time_slot = EXCLUDED.preferred_pickup_time_slot,
			preferred_delivery_time_slot = EXCLUDED.preferred_delivery_time_slot,
			preferred_pickup_day = EXCLUDED.preferred_pickup_day,
			default_services = EXCLUDED.default_services,
			auto_schedule_enabled = EXCLUDED.auto_schedule_enabled,
			lead_time_days = EXCLUDED.lead_time_days,
			special_instructions = EXCLUDED.special_instructions,
			updated_at = CURRENT_TIMESTAMP
	`, userID, req.DefaultPickupAddressID, req.DefaultDeliveryAddressID,
		req.PreferredPickupTimeSlot, req.PreferredDeliveryTimeSlot, req.PreferredPickupDay,
		defaultServicesJSON, req.AutoScheduleEnabled, req.LeadTimeDays, req.SpecialInstructions)

	if err != nil {
		http.Error(w, "Failed to save preferences", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Preferences saved successfully"})
}

// processSubscriptionPlanChange handles the complete process of changing subscription plans
func (h *SubscriptionHandler) processSubscriptionPlanChange(subscriptionID, userID, currentPlanID, newPlanID int, stripeSubscriptionID sql.NullString) error {
	// Validate new plan exists and is active
	var planExists bool
	var newPlanPriceCents int
	var currentPlanPriceCents int
	
	err := h.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM subscription_plans WHERE id = $1 AND is_active = true),
		       (SELECT price_per_month_cents FROM subscription_plans WHERE id = $1),
		       (SELECT price_per_month_cents FROM subscription_plans WHERE id = $2)
	`, newPlanID, currentPlanID).Scan(&planExists, &newPlanPriceCents, &currentPlanPriceCents)
	
	if err != nil || !planExists {
		return fmt.Errorf("invalid_plan")
	}

	// For upgrades, check if user has payment method
	if newPlanPriceCents > currentPlanPriceCents {
		var hasPaymentMethod bool
		err = h.db.QueryRow(`
			SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND default_payment_method_id IS NOT NULL)
		`, userID).Scan(&hasPaymentMethod)
		
		if err != nil || !hasPaymentMethod {
			return fmt.Errorf("no_payment_method")
		}
	}

	// Update Stripe subscription if we have one
	if stripeSubscriptionID.Valid {
		err = h.updateStripeSubscriptionPlan(stripeSubscriptionID.String, newPlanID)
		if err != nil {
			return fmt.Errorf("stripe_update_failed: %v", err)
		}
	}

	// Update database
	_, err = h.db.Exec(`
		UPDATE subscriptions 
		SET plan_id = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND user_id = $3
	`, newPlanID, subscriptionID, userID)
	
	if err != nil {
		return fmt.Errorf("database_update_failed: %v", err)
	}

	return nil
}

// calculateProrationPreview calculates what the proration would be for a plan change
func (h *SubscriptionHandler) calculateProrationPreview(preview *SubscriptionChangePreview, stripeSubscriptionID string, newPlanID int) error {
	// Get new plan details for Stripe price lookup
	var planName string
	var pricePerMonthCents int
	err := h.db.QueryRow(`
		SELECT name, price_per_month_cents FROM subscription_plans WHERE id = $1
	`, newPlanID).Scan(&planName, &pricePerMonthCents)
	
	if err != nil {
		return err
	}

	// Get or create Stripe price for the new plan (already in cents)
	_, err = h.getOrCreateStripePrice(planName, int64(pricePerMonthCents))
	if err != nil {
		return err
	}

	// Get current subscription from Stripe
	sub, err := subscription.Get(stripeSubscriptionID, nil)
	if err != nil {
		return err
	}

	// Create a preview of the subscription update to get proration amount
	// Note: This is a simplified approach. In production, you might want to use
	// Stripe's upcoming invoice preview API for more accurate calculations
	currentPrice := float64(sub.Items.Data[0].Price.UnitAmount) / 100
	newPrice := float64(pricePerMonthCents) / 100.0
	
	// Calculate simple price difference for preview
	// Note: This is a simplified calculation. For accurate proration,
	// use Stripe's invoice preview API in production
	priceDifference := newPrice - currentPrice
	
	if priceDifference > 0 {
		// For upgrades, proration will be added to next invoice
		preview.ImmediateCharge = priceDifference
		preview.ProrationDescription = fmt.Sprintf("Upgrade to %s plan - $%.2f prorated charge will be added to your next bill", planName, priceDifference)
	} else if priceDifference < 0 {
		// For downgrades, proration credit will reduce next invoice
		preview.ImmediateCredit = -priceDifference
		preview.ProrationDescription = fmt.Sprintf("Downgrade to %s plan - $%.2f prorated credit will reduce your next bill", planName, -priceDifference)
	} else {
		preview.ProrationDescription = "No additional charge - plans have the same price"
	}

	return nil
}

// updateStripeSubscriptionPlan updates the Stripe subscription to use a new plan
func (h *SubscriptionHandler) updateStripeSubscriptionPlan(stripeSubscriptionID string, newPlanID int) error {
	// Get plan details
	var planName string
	var pricePerMonthCents int
	err := h.db.QueryRow(`
		SELECT name, price_per_month_cents FROM subscription_plans WHERE id = $1
	`, newPlanID).Scan(&planName, &pricePerMonthCents)
	
	if err != nil {
		return fmt.Errorf("failed to get plan details: %v", err)
	}

	// Get or create Stripe price for the new plan (already in cents)
	priceID, err := h.getOrCreateStripePrice(planName, int64(pricePerMonthCents))
	if err != nil {
		return fmt.Errorf("failed to create Stripe price: %v", err)
	}

	// Get the current subscription from Stripe
	sub, err := subscription.Get(stripeSubscriptionID, nil)
	if err != nil {
		return fmt.Errorf("failed to get Stripe subscription: %v", err)
	}

	// Update the subscription items to use the new price with prorations
	params := &stripe.SubscriptionParams{
		Items: []*stripe.SubscriptionItemsParams{
			{
				ID:    stripe.String(sub.Items.Data[0].ID),
				Price: stripe.String(priceID),
			},
		},
		ProrationBehavior: stripe.String("create_prorations"),
	}

	_, err = subscription.Update(stripeSubscriptionID, params)
	if err != nil {
		return fmt.Errorf("failed to update Stripe subscription: %v", err)
	}

	log.Printf("Successfully updated Stripe subscription %s to new plan with proration", stripeSubscriptionID)
	return nil
}

func (h *SubscriptionHandler) getOrCreateStripePrice(planName string, amountCents int64) (string, error) {
	// Create product if it doesn't exist
	productParams := &stripe.ProductParams{
		Name: stripe.String("Tumble " + planName),
	}
	
	prod, err := product.New(productParams)
	if err != nil {
		return "", err
	}

	// Create price
	priceParams := &stripe.PriceParams{
		Product:    stripe.String(prod.ID),
		UnitAmount: stripe.Int64(amountCents),
		Currency:   stripe.String("usd"),
		Recurring: &stripe.PriceRecurringParams{
			Interval: stripe.String("month"),
		},
	}

	p, err := price.New(priceParams)
	if err != nil {
		return "", err
	}

	return p.ID, nil
}
