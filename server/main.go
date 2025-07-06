package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

// Global API configuration
var (
	APIVersion = "v1"
	APIPrefix  = "/api/" + APIVersion
)

type Server struct {
	db       *sql.DB
	redis    *redis.Client
	centNode *centrifuge.Node
	realtime *RealtimeHandler
	auth     *AuthHandler
	orders   *OrderHandler
	subscriptions *SubscriptionHandler
	addresses *AddressHandler
	services *ServiceHandler
	admin    *AdminHandler
	payments *PaymentHandler
	driverApps *DriverApplicationHandler
	driverRoutes *DriverRouteHandler
}

type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Services  struct {
		Database string `json:"database"`
		Redis    string `json:"redis"`
		Realtime string `json:"realtime"`
	} `json:"services"`
}

func main() {
	// Initialize structured logging
	InitLogger()
	
	server := &Server{}

	// Initialize database connection
	if err := server.initDB(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer server.db.Close()

	// Run database migrations
	if err := runMigrations(server.db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize Redis connection
	if err := server.initRedis(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer server.redis.Close()

	// Initialize Centrifuge
	if err := server.initCentrifuge(); err != nil {
		log.Fatalf("Failed to initialize Centrifuge: %v", err)
	}

	// Initialize handlers
	server.realtime = NewRealtimeHandler(server.db, server.centNode)
	server.auth = NewAuthHandler(server.db)
	server.orders = NewOrderHandler(server.db, server.realtime)
	server.subscriptions = NewSubscriptionHandler(server.db)
	server.addresses = NewAddressHandler(server.db)
	server.services = NewServiceHandler(server.db)
	server.admin = NewAdminHandler(server.db, server.realtime)
	server.payments = NewPaymentHandler(server.db, server.realtime)
	server.driverApps = NewDriverApplicationHandler(server.db)
	server.driverRoutes = NewDriverRouteHandler(server.db, server.realtime)

	// Set up HTTP routes with Gorilla Mux
	r := mux.NewRouter()
	
	// Add middleware
	r.Use(CORSMiddleware)
	r.Use(LoggingMiddleware)

	// Basic routes
	r.HandleFunc("/", server.handleHome)
	r.HandleFunc("/health", server.handleHealth)
	r.Handle("/connection/websocket", centrifuge.NewWebsocketHandler(server.centNode, centrifuge.WebsocketConfig{}))

	// API subrouter
	api := r.PathPrefix(APIPrefix).Subrouter()

	// Auth routes (Go backend auth for NextAuth)
	api.HandleFunc("/auth/register", server.auth.handleRegister)
	api.HandleFunc("/auth/login", server.auth.handleLogin)
	api.HandleFunc("/auth/change-password", server.auth.handleChangePassword)
	api.HandleFunc("/auth/google", server.auth.handleGoogleLogin)
	api.HandleFunc("/auth/google/callback", server.auth.handleGoogleCallback)

	// Order routes
	api.HandleFunc("/orders", server.orders.handleGetOrders)
	api.HandleFunc("/orders/create", server.orders.handleCreateOrder)
	api.HandleFunc("/orders/{id}", server.orders.handleGetOrder)
	api.HandleFunc("/orders/{id}/status", server.orders.handleUpdateOrderStatus)
	api.HandleFunc("/orders/{id}/tracking", server.orders.handleGetOrderTracking)

	// Subscription routes
	api.HandleFunc("/subscriptions/plans", server.subscriptions.handleGetPlans)
	api.HandleFunc("/subscriptions/current", server.subscriptions.handleGetSubscription)
	api.HandleFunc("/subscriptions/create", server.subscriptions.handleCreateSubscription)
	api.HandleFunc("/subscriptions/usage", server.subscriptions.handleGetSubscriptionUsage)
	api.HandleFunc("/subscriptions/{id}", server.subscriptions.handleUpdateSubscription)
	api.HandleFunc("/subscriptions/{id}/cancel", server.subscriptions.handleCancelSubscription)

	// Address routes
	api.HandleFunc("/addresses", server.addresses.handleGetAddresses)
	api.HandleFunc("/addresses/create", server.addresses.handleCreateAddress)
	api.HandleFunc("/addresses/{id}", server.addresses.handleUpdateAddress).Methods("PUT", "PATCH")
	api.HandleFunc("/addresses/{id}", server.addresses.handleDeleteAddress).Methods("DELETE")

	// Service routes
	api.HandleFunc("/services", server.services.handleGetServices)

	// Admin routes (all require admin role)
	api.HandleFunc("/admin/users", server.admin.requireAdmin(server.admin.handleGetUsers))
	api.HandleFunc("/admin/users/{id}/role", server.admin.requireAdmin(server.admin.handleUpdateUserRole))
	api.HandleFunc("/admin/orders/summary", server.admin.requireAdmin(server.admin.handleGetOrdersSummary))
	api.HandleFunc("/admin/orders", server.admin.requireAdmin(server.admin.handleGetAllOrders))
	api.HandleFunc("/admin/analytics/revenue", server.admin.requireAdmin(server.admin.handleGetRevenueAnalytics))
	api.HandleFunc("/admin/drivers/stats", server.admin.requireAdmin(server.admin.handleGetDriverStats))
	api.HandleFunc("/admin/routes/assign", server.admin.requireAdmin(server.admin.handleAssignDriverToRoute))

	// Payment routes
	api.HandleFunc("/payments/setup-intent", server.payments.handleCreateSetupIntent)
	api.HandleFunc("/payments/methods", server.payments.handleGetPaymentMethods)
	api.HandleFunc("/payments/methods/default", server.payments.handleSetDefaultPaymentMethod)
	api.HandleFunc("/payments/methods/{id}", server.payments.handleDeletePaymentMethod)
	api.HandleFunc("/payments/subscription", server.payments.handleCreateSubscriptionPayment)
	api.HandleFunc("/payments/order", server.payments.handleCreateOrderPayment)
	api.HandleFunc("/payments/history", server.payments.handleGetPaymentHistory)
	api.HandleFunc("/payments/webhook", server.payments.handleStripeWebhook)

	// Driver application routes
	api.HandleFunc("/driver-applications/submit", server.driverApps.handleSubmitDriverApplication)
	api.HandleFunc("/driver-applications/mine", server.driverApps.handleGetUserApplication)
	api.HandleFunc("/admin/driver-applications", server.driverApps.requireAdmin(server.driverApps.handleGetAllApplications))
	api.HandleFunc("/admin/driver-applications/review", server.driverApps.requireAdmin(server.driverApps.handleReviewApplication))

	// Driver route management routes
	api.HandleFunc("/driver/routes", server.driverRoutes.requireDriver(server.driverRoutes.handleGetDriverRoutes))
	api.HandleFunc("/driver/routes/start", server.driverRoutes.requireDriver(server.driverRoutes.handleStartRoute))
	api.HandleFunc("/driver/route-orders/status", server.driverRoutes.requireDriver(server.driverRoutes.handleUpdateRouteOrderStatus))

	// Start Centrifuge node
	if err := server.centNode.Run(); err != nil {
		log.Fatalf("Failed to run Centrifuge node: %v", err)
	}

	port := os.Getenv("GO_BACKEND_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func (s *Server) initDB() error {
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	var err error
	s.db, err = sql.Open("postgres", connStr)
	if err != nil {
		return err
	}

	// Ping database to verify connection
	return s.db.Ping()
}

func (s *Server) initRedis() error {
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")

	s.redis = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost, redisPort),
	})

	// Ping Redis to verify connection
	ctx := context.Background()
	return s.redis.Ping(ctx).Err()
}

func (s *Server) initCentrifuge() error {
	node, err := centrifuge.New(centrifuge.Config{
		LogLevel: centrifuge.LogLevelInfo,
		LogHandler: func(entry centrifuge.LogEntry) {
			log.Printf("[Centrifuge] %v: %v", entry.Level, entry.Message)
		},
	})
	if err != nil {
		return err
	}

	node.OnConnect(func(client *centrifuge.Client) {
		log.Printf("Client connected: %s", client.ID())
	})

	s.centNode = node
	return nil
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintf(w, `
<!DOCTYPE html>
<html>
<head>
    <title>Tumble Backend</title>
</head>
<body>
    <h1>Hello World from Tumble Go Backend!</h1>
    <p>Services:</p>
    <ul>
        <li><a href="/health">Health Check</a></li>
        <li>WebSocket endpoint: /connection/websocket</li>
    </ul>
</body>
</html>
	`)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	health := HealthResponse{
		Status:    "ok",
		Timestamp: time.Now().Format(time.RFC3339),
	}

	// Check database
	if err := s.db.Ping(); err != nil {
		health.Services.Database = "unhealthy"
		health.Status = "degraded"
	} else {
		health.Services.Database = "healthy"
	}

	// Check Redis
	ctx := context.Background()
	if err := s.redis.Ping(ctx).Err(); err != nil {
		health.Services.Redis = "unhealthy"
		health.Status = "degraded"
	} else {
		health.Services.Redis = "healthy"
	}

	// Check Centrifuge
	if s.centNode != nil {
		health.Services.Realtime = "healthy"
	} else {
		health.Services.Realtime = "unhealthy"
		health.Status = "degraded"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// CORS middleware
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	}
}
