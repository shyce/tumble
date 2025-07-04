package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type SubscriptionHandler struct {
	db        *sql.DB
	getUserID func(*http.Request, *sql.DB) (int, error)
}

type SubscriptionPlan struct {
	ID                  int     `json:"id"`
	Name                string  `json:"name"`
	Description         string  `json:"description"`
	PricePerMonth       float64 `json:"price_per_month"`
	PoundsIncluded      int     `json:"pounds_included"`
	PricePerExtraPound  float64 `json:"price_per_extra_pound"`
	PickupsPerMonth     int     `json:"pickups_per_month"`
	IsActive            bool    `json:"is_active"`
}

type Subscription struct {
	ID                    int              `json:"id"`
	UserID                int              `json:"user_id"`
	PlanID                int              `json:"plan_id"`
	Plan                  *SubscriptionPlan `json:"plan,omitempty"`
	Status                string           `json:"status"`
	CurrentPeriodStart    string           `json:"current_period_start"`
	CurrentPeriodEnd      string           `json:"current_period_end"`
	PoundsUsedThisPeriod  int              `json:"pounds_used_this_period"`
	PickupsUsedThisPeriod int              `json:"pickups_used_this_period"`
	StripeSubscriptionID  *string          `json:"stripe_subscription_id,omitempty"`
	CreatedAt             time.Time        `json:"created_at"`
	UpdatedAt             time.Time        `json:"updated_at"`
}

type CreateSubscriptionRequest struct {
	PlanID int `json:"plan_id"`
}

type UpdateSubscriptionRequest struct {
	Status string `json:"status"` // active, paused, cancelled
}

func NewSubscriptionHandler(db *sql.DB) *SubscriptionHandler {
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
		SELECT id, name, description, price_per_month, pounds_included, 
			   price_per_extra_pound, pickups_per_month, is_active
		FROM subscription_plans
		WHERE is_active = true
		ORDER BY price_per_month ASC`)
	if err != nil {
		http.Error(w, "Failed to fetch plans", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	plans := []SubscriptionPlan{}
	for rows.Next() {
		var plan SubscriptionPlan
		err := rows.Scan(
			&plan.ID, &plan.Name, &plan.Description,
			&plan.PricePerMonth, &plan.PoundsIncluded,
			&plan.PricePerExtraPound, &plan.PickupsPerMonth,
			&plan.IsActive,
		)
		if err != nil {
			http.Error(w, "Failed to parse plans", http.StatusInternalServerError)
			return
		}
		plans = append(plans, plan)
	}

	// Transform plans to match frontend expectations
	transformedPlans := []map[string]interface{}{}
	for _, plan := range plans {
		// Calculate bags based on plan type
		bags := plan.PickupsPerMonth
		bagType := "standard"
		if strings.Contains(plan.Name, "Rush") {
			bagType = "rush"
		}

		// Determine frequency
		frequency := "weekly"
		if strings.Contains(plan.Name, "Bi-Weekly") {
			frequency = "bi-weekly"
		}

		// Build features list
		features := []string{
			fmt.Sprintf("%d %s bags per month", bags, bagType),
			"Pickup & delivery included",
			"Professional wash & fold",
			"Eco-friendly detergents",
		}

		if bagType == "standard" {
			if frequency == "weekly" {
				features = append(features, "24-hour turnaround")
				features = append(features, "Save $10/month vs pay-per-bag")
				features = append(features, "Priority support")
			} else {
				features = append(features, "48-hour turnaround")
			}
		} else {
			features = append(features, "Rush service - same day turnaround")
		}

		features = append(features, "Add sensitive skin detergent +$3")
		features = append(features, "Add scent booster +$3")

		// Adjust pricing to match README
		price := plan.PricePerMonth
		if plan.Name == "Weekly Standard" {
			price = 170.00
		} else if plan.Name == "Bi-Weekly Standard" {
			price = 90.00
		}

		transformedPlan := map[string]interface{}{
			"id":                   fmt.Sprintf("%s-%s", strings.ToLower(frequency), bagType),
			"name":                 plan.Name,
			"price":                price,
			"frequency":            frequency,
			"bags":                 bags,
			"additionalBagPrice":   40,
			"features":             features,
			"popular":              plan.Name == "Weekly Standard",
		}

		transformedPlans = append(transformedPlans, transformedPlan)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transformedPlans)
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
	
	err = h.db.QueryRow(`
		SELECT s.id, s.user_id, s.plan_id, s.status,
			   s.current_period_start, s.current_period_end,
			   s.pounds_used_this_period, s.pickups_used_this_period,
			   s.stripe_subscription_id, s.created_at, s.updated_at,
			   p.id, p.name, p.description, p.price_per_month,
			   p.pounds_included, p.price_per_extra_pound, p.pickups_per_month
		FROM subscriptions s
		JOIN subscription_plans p ON s.plan_id = p.id
		WHERE s.user_id = $1 AND s.status != 'cancelled'
		ORDER BY s.created_at DESC
		LIMIT 1`,
		userID,
	).Scan(
		&subscription.ID, &subscription.UserID, &subscription.PlanID,
		&subscription.Status, &subscription.CurrentPeriodStart,
		&subscription.CurrentPeriodEnd, &subscription.PoundsUsedThisPeriod,
		&subscription.PickupsUsedThisPeriod, &subscription.StripeSubscriptionID,
		&subscription.CreatedAt, &subscription.UpdatedAt,
		&plan.ID, &plan.Name, &plan.Description, &plan.PricePerMonth,
		&plan.PoundsIncluded, &plan.PricePerExtraPound, &plan.PickupsPerMonth,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No active subscription found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch subscription", http.StatusInternalServerError)
		}
		return
	}

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
			current_period_start, current_period_end,
			pounds_used_this_period, pickups_used_this_period
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		userID, req.PlanID, "active",
		periodStart, periodEnd, 0, 0,
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

// handleUpdateSubscription updates a subscription status
func (h *SubscriptionHandler) handleUpdateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get subscription ID from URL
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid subscription ID", http.StatusBadRequest)
		return
	}

	subscriptionID, err := strconv.Atoi(pathParts[3])
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

	// Validate status
	if req.Status != "active" && req.Status != "paused" && req.Status != "cancelled" {
		http.Error(w, "Invalid status", http.StatusBadRequest)
		return
	}

	// Update subscription
	result, err := h.db.Exec(`
		UPDATE subscriptions 
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND user_id = $3`,
		req.Status, subscriptionID, userID,
	)
	if err != nil {
		http.Error(w, "Failed to update subscription", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
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
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 || pathParts[4] != "cancel" {
		http.Error(w, "Invalid endpoint", http.StatusBadRequest)
		return
	}

	subscriptionID, err := strconv.Atoi(pathParts[3])
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

	// Cancel subscription
	result, err := h.db.Exec(`
		UPDATE subscriptions 
		SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2 AND status != 'cancelled'`,
		subscriptionID, userID,
	)
	if err != nil {
		http.Error(w, "Failed to cancel subscription", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Subscription not found or already cancelled", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Subscription cancelled successfully",
		"status":  "cancelled",
	})
}

// getSubscriptionByID fetches a subscription with plan details
func (h *SubscriptionHandler) getSubscriptionByID(subscriptionID int) (*Subscription, error) {
	var subscription Subscription
	var plan SubscriptionPlan
	
	err := h.db.QueryRow(`
		SELECT s.id, s.user_id, s.plan_id, s.status,
			   s.current_period_start, s.current_period_end,
			   s.pounds_used_this_period, s.pickups_used_this_period,
			   s.stripe_subscription_id, s.created_at, s.updated_at,
			   p.id, p.name, p.description, p.price_per_month,
			   p.pounds_included, p.price_per_extra_pound, p.pickups_per_month
		FROM subscriptions s
		JOIN subscription_plans p ON s.plan_id = p.id
		WHERE s.id = $1`,
		subscriptionID,
	).Scan(
		&subscription.ID, &subscription.UserID, &subscription.PlanID,
		&subscription.Status, &subscription.CurrentPeriodStart,
		&subscription.CurrentPeriodEnd, &subscription.PoundsUsedThisPeriod,
		&subscription.PickupsUsedThisPeriod, &subscription.StripeSubscriptionID,
		&subscription.CreatedAt, &subscription.UpdatedAt,
		&plan.ID, &plan.Name, &plan.Description, &plan.PricePerMonth,
		&plan.PoundsIncluded, &plan.PricePerExtraPound, &plan.PickupsPerMonth,
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
		WHERE s.user_id = $1 AND s.status = 'active'
		ORDER BY s.created_at DESC
		LIMIT 1`,
		userID,
	).Scan(&subscriptionID, &planID, &currentPeriodStart, &currentPeriodEnd, &pickupsPerMonth)
	
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No active subscription found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to fetch subscription", http.StatusInternalServerError)
		}
		return
	}

	// Count orders in current period
	var ordersCount int
	var totalBags int
	err = h.db.QueryRow(`
		SELECT COUNT(DISTINCT o.id), COALESCE(SUM(oi.quantity), 0)
		FROM orders o
		LEFT JOIN order_items oi ON o.id = oi.order_id
		LEFT JOIN services s ON oi.service_id = s.id
		WHERE o.user_id = $1 
		AND o.subscription_id = $2
		AND o.pickup_date >= $3::date 
		AND o.pickup_date < $4::date
		AND o.status != 'cancelled'
		AND s.name IN ('standard_bag', 'rush_bag')`,
		userID, subscriptionID, currentPeriodStart, currentPeriodEnd,
	).Scan(&ordersCount, &totalBags)
	
	if err != nil {
		http.Error(w, "Failed to fetch usage data", http.StatusInternalServerError)
		return
	}

	usage := map[string]interface{}{
		"subscription_id":      subscriptionID,
		"current_period_start": currentPeriodStart,
		"current_period_end":   currentPeriodEnd,
		"pickups_used":         ordersCount,
		"pickups_allowed":      pickupsPerMonth,
		"pickups_remaining":    pickupsPerMonth - ordersCount,
		"bags_used":            totalBags,
		"bags_allowed":         pickupsPerMonth,
		"bags_remaining":       pickupsPerMonth - totalBags,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(usage)
}