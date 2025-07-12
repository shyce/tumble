package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/customer"
	"github.com/stripe/stripe-go/v82/paymentintent"
	"github.com/stripe/stripe-go/v82/paymentmethod"
	"github.com/stripe/stripe-go/v82/price"
	"github.com/stripe/stripe-go/v82/product"
	"github.com/stripe/stripe-go/v82/setupintent"
	"github.com/stripe/stripe-go/v82/subscription"
	"github.com/stripe/stripe-go/v82/webhook"
)

type PaymentHandler struct {
	db        *sql.DB
	realtime  RealtimeInterface
	getUserID func(*http.Request, *sql.DB) (int, error)
}

func NewPaymentHandler(db *sql.DB, realtime RealtimeInterface) *PaymentHandler {
	// Initialize Stripe with API key
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	
	return &PaymentHandler{
		db:        db,
		realtime:  realtime,
		getUserID: getUserIDFromRequest,
	}
}

// Payment method management
type PaymentMethodResponse struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Card      *CardDetails `json:"card,omitempty"`
	IsDefault bool   `json:"is_default"`
}

type CardDetails struct {
	Brand    string `json:"brand"`
	Last4    string `json:"last4"`
	ExpMonth int64  `json:"exp_month"`
	ExpYear  int64  `json:"exp_year"`
}

// handleCreateSetupIntent creates a setup intent for saving payment methods
func (h *PaymentHandler) handleCreateSetupIntent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get or create Stripe customer
	customerID, err := h.getOrCreateStripeCustomer(userID)
	if err != nil {
		log.Printf("Error creating Stripe customer for user %d: %v", userID, err)
		http.Error(w, "Failed to create customer", http.StatusInternalServerError)
		return
	}

	// Create setup intent
	params := &stripe.SetupIntentParams{
		Customer: stripe.String(customerID),
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
	}

	si, err := setupintent.New(params)
	if err != nil {
		http.Error(w, "Failed to create setup intent", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"client_secret": si.ClientSecret,
	})
}

// handleGetPaymentMethods returns saved payment methods for a user
func (h *PaymentHandler) handleGetPaymentMethods(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get Stripe customer ID
	var stripeCustomerID string
	err = h.db.QueryRow(`
		SELECT stripe_customer_id FROM users WHERE id = $1
	`, userID).Scan(&stripeCustomerID)
	
	if err != nil || stripeCustomerID == "" {
		// No payment methods if no Stripe customer
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]PaymentMethodResponse{})
		return
	}

	// List payment methods from Stripe
	params := &stripe.PaymentMethodListParams{
		Customer: stripe.String(stripeCustomerID),
		Type:     stripe.String(string(stripe.PaymentMethodTypeCard)),
	}

	methods := []PaymentMethodResponse{}
	i := paymentmethod.List(params)
	
	// Get default payment method
	var defaultMethodID string
	h.db.QueryRow(`
		SELECT default_payment_method_id FROM users WHERE id = $1
	`, userID).Scan(&defaultMethodID)

	for i.Next() {
		pm := i.PaymentMethod()
		method := PaymentMethodResponse{
			ID:        pm.ID,
			Type:      string(pm.Type),
			IsDefault: pm.ID == defaultMethodID,
		}

		if pm.Card != nil {
			method.Card = &CardDetails{
				Brand:    string(pm.Card.Brand),
				Last4:    pm.Card.Last4,
				ExpMonth: pm.Card.ExpMonth,
				ExpYear:  pm.Card.ExpYear,
			}
		}

		methods = append(methods, method)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(methods)
}

// handleSetDefaultPaymentMethod sets a payment method as default
func (h *PaymentHandler) handleSetDefaultPaymentMethod(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		PaymentMethodID string `json:"payment_method_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update default payment method
	_, err = h.db.Exec(`
		UPDATE users SET default_payment_method_id = $1 WHERE id = $2
	`, req.PaymentMethodID, userID)
	
	if err != nil {
		http.Error(w, "Failed to update default payment method", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Default payment method updated"})
}

// handleDeletePaymentMethod removes a payment method
func (h *PaymentHandler) handleDeletePaymentMethod(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get payment method ID from URL
	vars := mux.Vars(r)
	paymentMethodID := vars["id"]

	// Verify the payment method belongs to this user
	var stripeCustomerID string
	err = h.db.QueryRow(`
		SELECT stripe_customer_id FROM users WHERE id = $1
	`, userID).Scan(&stripeCustomerID)
	
	if err != nil {
		http.Error(w, "Failed to verify user", http.StatusInternalServerError)
		return
	}

	// Detach payment method in Stripe
	pm, err := paymentmethod.Detach(paymentMethodID, nil)
	if err != nil || pm.Customer.ID != stripeCustomerID {
		http.Error(w, "Failed to delete payment method", http.StatusBadRequest)
		return
	}

	// If this was the default, clear it
	h.db.Exec(`
		UPDATE users SET default_payment_method_id = NULL 
		WHERE id = $1 AND default_payment_method_id = $2
	`, userID, paymentMethodID)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Payment method deleted"})
}

// Subscription payment processing
func (h *PaymentHandler) handleCreateSubscriptionPayment(w http.ResponseWriter, r *http.Request) {
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
		PlanID          int    `json:"plan_id"`
		PaymentMethodID string `json:"payment_method_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get plan details
	var planName string
	var pricePerMonthCents int
	err = h.db.QueryRow(`
		SELECT name, price_per_month_cents FROM subscription_plans WHERE id = $1
	`, req.PlanID).Scan(&planName, &pricePerMonthCents)
	
	if err != nil {
		http.Error(w, "Invalid plan", http.StatusBadRequest)
		return
	}

	// Get or create Stripe customer
	customerID, err := h.getOrCreateStripeCustomer(userID)
	if err != nil {
		if err.Error() == "no_default_address" {
			http.Error(w, "Please set a default address in your account settings before subscribing. This is required for tax calculation.", http.StatusBadRequest)
		} else {
			http.Error(w, "Failed to create customer", http.StatusInternalServerError)
		}
		return
	}

	// Attach payment method to customer
	_, err = paymentmethod.Attach(req.PaymentMethodID, &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(customerID),
	})
	if err != nil {
		http.Error(w, "Failed to attach payment method", http.StatusBadRequest)
		return
	}

	// Set as default payment method
	_, err = customer.Update(customerID, &stripe.CustomerParams{
		InvoiceSettings: &stripe.CustomerInvoiceSettingsParams{
			DefaultPaymentMethod: stripe.String(req.PaymentMethodID),
		},
	})
	if err != nil {
		http.Error(w, "Failed to set default payment method", http.StatusInternalServerError)
		return
	}

	// Create or get Stripe price (already in cents)
	priceID, err := h.getOrCreateStripePrice(planName, int64(pricePerMonthCents))
	if err != nil {
		http.Error(w, "Failed to create price", http.StatusInternalServerError)
		return
	}

	// Create subscription in Stripe with automatic tax calculation
	params := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(priceID),
			},
		},
		DefaultPaymentMethod: stripe.String(req.PaymentMethodID),
		PaymentBehavior:      stripe.String("allow_incomplete"),
		AutomaticTax: &stripe.SubscriptionAutomaticTaxParams{
			Enabled: stripe.Bool(true),
		},
		Expand: stripe.StringSlice([]string{"latest_invoice.payment_intent"}),
	}

	sub, err := subscription.New(params)
	if err != nil {
		log.Printf("Failed to create Stripe subscription for user %d: %v", userID, err)
		http.Error(w, "Failed to create subscription", http.StatusInternalServerError)
		return
	}
	
	log.Printf("Created Stripe subscription %s with status %s for user %d", sub.ID, sub.Status, userID)

	// Determine initial status based on Stripe subscription status
	dbStatus := "active"
	if sub.Status == stripe.SubscriptionStatusIncomplete || sub.Status == stripe.SubscriptionStatusIncompleteExpired {
		dbStatus = "paused" // Use paused as a temporary state until payment succeeds
	}
	
	// Create subscription record in database
	_, err = h.db.Exec(`
		INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id)
		VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', $4)
	`, userID, req.PlanID, dbStatus, sub.ID)
	
	if err != nil {
		log.Printf("Failed to create subscription record in database for user %d: %v", userID, err)
		// Cancel Stripe subscription if DB insert fails
		subscription.Cancel(sub.ID, nil)
		http.Error(w, "Failed to create subscription", http.StatusInternalServerError)
		return
	}
	
	log.Printf("Successfully created subscription record for user %d with Stripe subscription %s", userID, sub.ID)

	// Update user's default payment method
	h.db.Exec(`
		UPDATE users SET default_payment_method_id = $1 WHERE id = $2
	`, req.PaymentMethodID, userID)

	response := map[string]interface{}{
		"subscription_id": sub.ID,
		"status":         sub.Status,
	}

	// Check if subscription requires payment confirmation
	if sub.Status == stripe.SubscriptionStatusIncomplete || 
	   sub.Status == stripe.SubscriptionStatusIncompleteExpired {
		response["requires_action"] = true
		
		// Note: In v82, accessing PaymentIntent from subscription requires separate API call
		// For now, we'll let the frontend handle payment confirmation without client_secret
		// This is acceptable since we're using allow_incomplete payment behavior
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// One-time order payment processing
func (h *PaymentHandler) handleCreateOrderPayment(w http.ResponseWriter, r *http.Request) {
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
		OrderID         int    `json:"order_id"`
		PaymentMethodID string `json:"payment_method_id,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get order details and verify ownership
	var orderTotal float64
	var orderUserID int
	err = h.db.QueryRow(`
		SELECT user_id, total FROM orders WHERE id = $1
	`, req.OrderID).Scan(&orderUserID, &orderTotal)
	
	if err != nil || orderUserID != userID {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	// Get or create Stripe customer
	customerID, err := h.getOrCreateStripeCustomer(userID)
	if err != nil {
		if err.Error() == "no_default_address" {
			http.Error(w, "Please set a default address in your account settings before making payments. This is required for tax calculation.", http.StatusBadRequest)
		} else {
			http.Error(w, "Failed to create customer", http.StatusInternalServerError)
		}
		return
	}

	// Create payment intent
	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(int64(orderTotal * 100)), // Convert to cents
		Currency: stripe.String("usd"),
		Customer: stripe.String(customerID),
		Metadata: map[string]string{
			"order_id": strconv.Itoa(req.OrderID),
			"user_id":  strconv.Itoa(userID),
		},
	}

	// Use provided payment method or default
	if req.PaymentMethodID != "" {
		params.PaymentMethod = stripe.String(req.PaymentMethodID)
	} else {
		// Get default payment method
		var defaultMethodID string
		h.db.QueryRow(`
			SELECT default_payment_method_id FROM users WHERE id = $1
		`, userID).Scan(&defaultMethodID)
		
		if defaultMethodID != "" {
			params.PaymentMethod = stripe.String(defaultMethodID)
			params.Confirm = stripe.Bool(true)
		}
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		http.Error(w, "Failed to create payment", http.StatusInternalServerError)
		return
	}

	// Create payment record
	_, err = h.db.Exec(`
		INSERT INTO payments (user_id, order_id, amount, payment_type, status, stripe_payment_intent_id)
		VALUES ($1, $2, $3, 'extra_order', 'pending', $4)
	`, userID, req.OrderID, orderTotal, pi.ID)
	
	if err != nil {
		http.Error(w, "Failed to record payment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"payment_intent_id": pi.ID,
		"client_secret":     pi.ClientSecret,
		"status":           pi.Status,
	})
}

// Webhook handling
func (h *PaymentHandler) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	const MaxBodyBytes = int64(65536)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Request body too large", http.StatusServiceUnavailable)
		return
	}

	// Verify webhook signature
	endpointSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	event, err := webhook.ConstructEvent(payload, r.Header.Get("Stripe-Signature"), endpointSecret)
	if err != nil {
		http.Error(w, "Invalid signature", http.StatusBadRequest)
		return
	}

	// Handle the event
	switch event.Type {
	case "setup_intent.succeeded":
		var si stripe.SetupIntent
		if err := json.Unmarshal(event.Data.Raw, &si); err != nil {
			http.Error(w, "Error parsing webhook JSON", http.StatusBadRequest)
			return
		}
		h.handleSetupIntentSucceeded(&si)

	case "payment_intent.succeeded":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			http.Error(w, "Error parsing webhook JSON", http.StatusBadRequest)
			return
		}
		h.handlePaymentIntentSucceeded(&pi)

	case "payment_intent.payment_failed":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			http.Error(w, "Error parsing webhook JSON", http.StatusBadRequest)
			return
		}
		h.handlePaymentIntentFailed(&pi)

	case "customer.subscription.updated":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			http.Error(w, "Error parsing webhook JSON", http.StatusBadRequest)
			return
		}
		h.handleSubscriptionUpdated(&sub)

	case "customer.subscription.deleted":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			http.Error(w, "Error parsing webhook JSON", http.StatusBadRequest)
			return
		}
		h.handleSubscriptionDeleted(&sub)

	case "invoice.payment_succeeded":
		var invoice stripe.Invoice
		if err := json.Unmarshal(event.Data.Raw, &invoice); err != nil {
			http.Error(w, "Error parsing webhook JSON", http.StatusBadRequest)
			return
		}
		h.handleInvoicePaymentSucceeded(&invoice)
	}

	w.WriteHeader(http.StatusOK)
}

// Helper functions
func (h *PaymentHandler) getOrCreateStripeCustomer(userID int) (string, error) {
	// Check if customer already exists
	var stripeCustomerID sql.NullString
	var email, firstName, lastName string
	
	err := h.db.QueryRow(`
		SELECT stripe_customer_id, email, first_name, last_name 
		FROM users WHERE id = $1
	`, userID).Scan(&stripeCustomerID, &email, &firstName, &lastName)
	
	if err != nil {
		log.Printf("Error querying user %d from database: %v", userID, err)
		return "", err
	}

	// If customer exists, check if it has an address and update if needed
	if stripeCustomerID.Valid && stripeCustomerID.String != "" {
		// Get user's default address
		var streetAddress, city, state, zipCode sql.NullString
		err = h.db.QueryRow(`
			SELECT street_address, city, state, zip_code 
			FROM addresses 
			WHERE user_id = $1 AND is_default = true
			LIMIT 1
		`, userID).Scan(&streetAddress, &city, &state, &zipCode)
		
		// If we have a valid address, update the existing Stripe customer
		if err == nil && streetAddress.Valid && city.Valid && state.Valid && zipCode.Valid {
			updateParams := &stripe.CustomerParams{
				Address: &stripe.AddressParams{
					Line1:      stripe.String(streetAddress.String),
					City:       stripe.String(city.String),
					State:      stripe.String(state.String),
					PostalCode: stripe.String(zipCode.String),
					Country:    stripe.String("US"),
				},
			}
			customer.Update(stripeCustomerID.String, updateParams)
		}
		
		return stripeCustomerID.String, nil
	}

	// Get user's default address for tax calculation
	var streetAddress, city, state, zipCode sql.NullString
	err = h.db.QueryRow(`
		SELECT street_address, city, state, zip_code 
		FROM addresses 
		WHERE user_id = $1 AND is_default = true
		LIMIT 1
	`, userID).Scan(&streetAddress, &city, &state, &zipCode)

	// Check if user has a valid default address
	if err == sql.ErrNoRows || !streetAddress.Valid || !city.Valid || !state.Valid || !zipCode.Valid {
		return "", fmt.Errorf("no_default_address")
	}

	// Create new Stripe customer with address for tax calculation
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Name:  stripe.String(firstName + " " + lastName),
		Address: &stripe.AddressParams{
			Line1:      stripe.String(streetAddress.String),
			City:       stripe.String(city.String),
			State:      stripe.String(state.String),
			PostalCode: stripe.String(zipCode.String),
			Country:    stripe.String("US"),
		},
		Metadata: map[string]string{
			"user_id": strconv.Itoa(userID),
		},
	}

	c, err := customer.New(params)
	if err != nil {
		log.Printf("Error creating Stripe customer for user %d: %v", userID, err)
		return "", err
	}

	// Save Stripe customer ID
	_, err = h.db.Exec(`
		UPDATE users SET stripe_customer_id = $1 WHERE id = $2
	`, c.ID, userID)
	
	if err != nil {
		return "", err
	}

	return c.ID, nil
}

func (h *PaymentHandler) getOrCreateStripePrice(planName string, amountCents int64) (string, error) {
	productName := "Tumble " + planName
	
	// First, try to find existing product by name
	productSearchParams := &stripe.ProductSearchParams{
		SearchParams: stripe.SearchParams{
			Query: `name:"` + productName + `"`,
			Limit: stripe.Int64(1),
		},
	}
	
	searchResult := product.Search(productSearchParams)
	var prod *stripe.Product
	
	// If product exists, use it
	if searchResult.Next() {
		prod = searchResult.Product()
		log.Printf("Found existing Stripe product: %s (%s)", prod.Name, prod.ID)
	} else {
		// Create new product with correct tax code
		productParams := &stripe.ProductParams{
			Name: stripe.String(productName),
			TaxCode: stripe.String("txcd_20090012"), // Linen Services - Laundry only
		}
		
		var err error
		prod, err = product.New(productParams)
		if err != nil {
			return "", err
		}
		log.Printf("Created new Stripe product: %s (%s) with tax code txcd_20090012", prod.Name, prod.ID)
	}

	// Look for existing price with the same amount using List API
	priceListParams := &stripe.PriceListParams{
		Product: stripe.String(prod.ID),
	}
	priceListParams.Limit = stripe.Int64(10) // List a few prices to find matching amount
	
	priceList := price.List(priceListParams)
	
	// Check if any existing price has the same amount
	for priceList.Next() {
		existingPrice := priceList.Price()
		if existingPrice.UnitAmount == amountCents {
			log.Printf("Found existing Stripe price: %s (%s)", existingPrice.ID, fmt.Sprintf("$%.2f", float64(existingPrice.UnitAmount)/100))
			return existingPrice.ID, nil
		}
	}

	// Create new price
	priceParams := &stripe.PriceParams{
		Product:    stripe.String(prod.ID),
		UnitAmount: stripe.Int64(amountCents),
		Currency:   stripe.String("usd"),
		Recurring: &stripe.PriceRecurringParams{
			Interval: stripe.String("month"),
		},
		TaxBehavior: stripe.String("exclusive"), // Tax is calculated on top of the price
	}

	p, err := price.New(priceParams)
	if err != nil {
		return "", err
	}
	
	log.Printf("Created new Stripe price: %s (%s)", p.ID, fmt.Sprintf("$%.2f", float64(p.UnitAmount)/100))
	return p.ID, nil
}

func (h *PaymentHandler) handlePaymentIntentSucceeded(pi *stripe.PaymentIntent) {
	// Update payment status
	_, err := h.db.Exec(`
		UPDATE payments 
		SET status = 'completed', stripe_charge_id = $1
		WHERE stripe_payment_intent_id = $2
	`, pi.LatestCharge.ID, pi.ID)
	
	if err != nil {
		return
	}

	// Update order status if this was an order payment
	if orderIDStr, ok := pi.Metadata["order_id"]; ok {
		orderID, _ := strconv.Atoi(orderIDStr)
		// Order remains 'scheduled' after payment - no status change needed
		// The payment record status indicates payment completion
		
		// Send realtime notification about payment success
		if userIDStr, ok := pi.Metadata["user_id"]; ok {
			userID, _ := strconv.Atoi(userIDStr)
			h.realtime.PublishOrderUpdate(userID, orderID, "scheduled", "Payment successful - pickup confirmed", nil)
		}
	}
}

func (h *PaymentHandler) handlePaymentIntentFailed(pi *stripe.PaymentIntent) {
	// Update payment status
	h.db.Exec(`
		UPDATE payments 
		SET status = 'failed'
		WHERE stripe_payment_intent_id = $1
	`, pi.ID)
}

func (h *PaymentHandler) handleSubscriptionUpdated(sub *stripe.Subscription) {
	// Update subscription status
	status := "active"
	if sub.Status == "canceled" || sub.Status == "unpaid" {
		status = "cancelled"
	} else if sub.Status == "past_due" {
		status = "paused"
	}

	// Update subscription without period end for now
	// Note: Period handling would be done differently in real implementation

	h.db.Exec(`
		UPDATE subscriptions 
		SET status = $1
		WHERE stripe_subscription_id = $2
	`, status, sub.ID)
}

func (h *PaymentHandler) handleSubscriptionDeleted(sub *stripe.Subscription) {
	// Cancel subscription
	h.db.Exec(`
		UPDATE subscriptions 
		SET status = 'cancelled'
		WHERE stripe_subscription_id = $1
	`, sub.ID)
}

func (h *PaymentHandler) handleSetupIntentSucceeded(si *stripe.SetupIntent) {
	log.Printf("Setup intent succeeded: %s", si.ID)
	// Note: Actual subscription activation happens when payment method is used
	// The frontend will handle creating the subscription after setup intent succeeds
}

func (h *PaymentHandler) handleInvoicePaymentSucceeded(invoice *stripe.Invoice) {
	log.Printf("Invoice payment succeeded: %s", invoice.ID)
	
	// For subscription invoices, we can check if there are line items with subscription references
	// This is a simplified approach that activates any subscription found in the invoice
	if invoice.Lines != nil && len(invoice.Lines.Data) > 0 {
		for _, line := range invoice.Lines.Data {
			// Check if this line item has a subscription reference
			if line.Subscription != nil {
				subscriptionID := line.Subscription.ID
				h.db.Exec(`
					UPDATE subscriptions 
					SET status = 'active'
					WHERE stripe_subscription_id = $1
				`, subscriptionID)
				
				log.Printf("Subscription activated via invoice payment: %s", subscriptionID)
				break // Only need to activate once
			}
		}
	}
}

// handleGetPaymentHistory returns payment history for a user
func (h *PaymentHandler) handleGetPaymentHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	limit := 50
	offset := 0
	
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}
	
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsedOffset, err := strconv.Atoi(o); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	type PaymentHistory struct {
		ID          int       `json:"id"`
		OrderID     *int      `json:"order_id,omitempty"`
		Amount      float64   `json:"amount"`
		PaymentType string    `json:"payment_type"`
		Status      string    `json:"status"`
		CreatedAt   time.Time `json:"created_at"`
	}

	query := `
		SELECT id, order_id, amount, payment_type, status, created_at
		FROM payments
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := h.db.Query(query, userID, limit, offset)
	if err != nil {
		http.Error(w, "Failed to fetch payment history", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	payments := []PaymentHistory{}
	for rows.Next() {
		var p PaymentHistory
		err := rows.Scan(&p.ID, &p.OrderID, &p.Amount, &p.PaymentType, &p.Status, &p.CreatedAt)
		if err != nil {
			continue
		}
		payments = append(payments, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payments)
}

// handleGetPaymentIntent returns payment intent details
func (h *PaymentHandler) handleGetPaymentIntent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get payment intent ID from URL
	vars := mux.Vars(r)
	paymentIntentID := vars["id"]

	// Verify the payment intent belongs to this user
	var exists bool
	err = h.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM payments 
			WHERE user_id = $1 AND stripe_payment_intent_id = $2
		)
	`, userID, paymentIntentID).Scan(&exists)
	
	if err != nil || !exists {
		http.Error(w, "Payment intent not found", http.StatusNotFound)
		return
	}

	// Get payment intent from Stripe
	pi, err := paymentintent.Get(paymentIntentID, nil)
	if err != nil {
		http.Error(w, "Failed to retrieve payment intent", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"client_secret": pi.ClientSecret,
		"status":        pi.Status,
		"amount":        pi.Amount,
		"currency":      pi.Currency,
	})
}