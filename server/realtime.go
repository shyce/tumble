package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/centrifugal/centrifuge"
)

type RealtimeHandler struct {
	db   *sql.DB
	node *centrifuge.Node
}

type OrderUpdateMessage struct {
	Type      string      `json:"type"`
	OrderID   int         `json:"order_id"`
	Status    string      `json:"status"`
	Message   string      `json:"message"`
	Timestamp string      `json:"timestamp"`
	Data      interface{} `json:"data,omitempty"`
}

func NewRealtimeHandler(db *sql.DB, node *centrifuge.Node) *RealtimeHandler {
	handler := &RealtimeHandler{
		db:   db,
		node: node,
	}

	// Set up connection handlers
	node.OnConnecting(handler.handleConnecting)
	node.OnConnect(handler.handleConnect)

	return handler
}

// handleConnecting validates the connection attempt
func (h *RealtimeHandler) handleConnecting(ctx context.Context, e centrifuge.ConnectEvent) (centrifuge.ConnectReply, error) {
	// For now, allow all connections
	// In production, you'd validate the JWT token here
	return centrifuge.ConnectReply{
		Credentials: &centrifuge.Credentials{
			UserID: e.ClientID, // Use client ID as user ID for now
		},
	}, nil
}

// handleConnect is called when a client connects
func (h *RealtimeHandler) handleConnect(client *centrifuge.Client) {
	log.Printf("Client connected: %s", client.ID())
	
	// Send a welcome message
	welcomeMsg := OrderUpdateMessage{
		Type:      "connection",
		Message:   "Connected to Tumble real-time updates",
		Timestamp: "now",
	}
	
	data, _ := json.Marshal(welcomeMsg)
	client.Send(data)
}

// Note: handleSubscribe is not available in newer Centrifuge versions
// Channel validation would be done in the OnConnecting handler instead

// PublishOrderUpdate sends real-time updates for an order
func (h *RealtimeHandler) PublishOrderUpdate(userID, orderID int, status, message string, data interface{}) error {
	update := OrderUpdateMessage{
		Type:      "order_status_update",
		OrderID:   orderID,
		Status:    status,
		Message:   message,
		Timestamp: "now",
		Data:      data,
	}

	updateData, err := json.Marshal(update)
	if err != nil {
		return fmt.Errorf("failed to marshal update: %v", err)
	}

	// Publish to user's order channel
	userChannel := fmt.Sprintf("order:%d", userID)
	_, err = h.node.Publish(userChannel, updateData)
	if err != nil {
		return fmt.Errorf("failed to publish to user channel: %v", err)
	}

	// Publish to specific order channel
	orderChannel := fmt.Sprintf("order:%d:%d", userID, orderID)
	_, err = h.node.Publish(orderChannel, updateData)
	if err != nil {
		return fmt.Errorf("failed to publish to order channel: %v", err)
	}

	log.Printf("Published order update: user=%d, order=%d, status=%s", userID, orderID, status)
	return nil
}

// PublishOrderPickup sends pickup notifications
func (h *RealtimeHandler) PublishOrderPickup(userID, orderID int, estimatedTime string) error {
	data := map[string]interface{}{
		"estimated_pickup_time": estimatedTime,
		"driver_info": map[string]interface{}{
			"name":  "John Driver",
			"phone": "555-0123",
		},
	}

	return h.PublishOrderUpdate(
		userID, 
		orderID, 
		"pickup_scheduled",
		"Your laundry pickup is scheduled",
		data,
	)
}

// PublishOrderDelivery sends delivery notifications
func (h *RealtimeHandler) PublishOrderDelivery(userID, orderID int, estimatedTime string) error {
	data := map[string]interface{}{
		"estimated_delivery_time": estimatedTime,
		"delivery_instructions":   "Please leave bags at front door if no one is home",
	}

	return h.PublishOrderUpdate(
		userID,
		orderID,
		"out_for_delivery", 
		"Your clean laundry is out for delivery",
		data,
	)
}

// PublishOrderComplete sends completion notifications
func (h *RealtimeHandler) PublishOrderComplete(userID, orderID int) error {
	// Get order details for the notification
	var orderNumber string
	err := h.db.QueryRow(`
		SELECT CONCAT('TUM-', EXTRACT(YEAR FROM created_at), '-', LPAD(id::text, 3, '0'))
		FROM orders WHERE id = $1`,
		orderID,
	).Scan(&orderNumber)
	if err != nil {
		orderNumber = fmt.Sprintf("TUM-%d", orderID)
	}

	data := map[string]interface{}{
		"order_number": orderNumber,
		"rating_url":   fmt.Sprintf("/orders/%d/rate", orderID),
	}

	return h.PublishOrderUpdate(
		userID,
		orderID,
		"delivered",
		"Your laundry has been delivered successfully!",
		data,
	)
}

// GetOrderSubscribers returns the number of active subscribers for an order
func (h *RealtimeHandler) GetOrderSubscribers(userID, orderID int) int {
	orderChannel := fmt.Sprintf("order:%d:%d", userID, orderID)
	presence, err := h.node.Presence(orderChannel)
	if err != nil {
		return 0
	}
	return len(presence.Presence)
}

// SendDriverLocationUpdate sends location updates for orders in transit
func (h *RealtimeHandler) SendDriverLocationUpdate(userID, orderID int, lat, lng float64, estimatedArrival string) error {
	data := map[string]interface{}{
		"driver_location": map[string]interface{}{
			"latitude":  lat,
			"longitude": lng,
		},
		"estimated_arrival": estimatedArrival,
	}

	update := OrderUpdateMessage{
		Type:      "driver_location",
		OrderID:   orderID,
		Message:   "Driver location updated",
		Timestamp: "now",
		Data:      data,
	}

	updateData, err := json.Marshal(update)
	if err != nil {
		return fmt.Errorf("failed to marshal location update: %v", err)
	}

	// Only send to specific order channel for location updates
	orderChannel := fmt.Sprintf("order:%d:%d", userID, orderID)
	_, err = h.node.Publish(orderChannel, updateData)
	if err != nil {
		return fmt.Errorf("failed to publish location update: %v", err)
	}

	return nil
}