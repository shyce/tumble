package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/centrifugal/centrifuge"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
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

	// Set up HTTP routes
	http.HandleFunc("/", server.handleHome)
	http.HandleFunc("/health", server.handleHealth)
	http.Handle("/connection/websocket", centrifuge.NewWebsocketHandler(server.centNode, centrifuge.WebsocketConfig{}))

	// Auth routes
	http.HandleFunc("/api/auth/register", server.auth.handleRegister)
	http.HandleFunc("/api/auth/login", server.auth.handleLogin)
	http.HandleFunc("/api/auth/google", server.auth.handleGoogleLogin)
	http.HandleFunc("/api/auth/google/callback", server.auth.handleGoogleCallback)

	// Order routes
	http.HandleFunc("/api/orders", server.orders.handleGetOrders)
	http.HandleFunc("/api/orders/create", server.orders.handleCreateOrder)
	http.HandleFunc("/api/orders/", func(w http.ResponseWriter, r *http.Request) {
		// Route to specific order handlers based on path
		pathParts := strings.Split(r.URL.Path, "/")
		if len(pathParts) >= 5 && pathParts[4] == "status" {
			server.orders.handleUpdateOrderStatus(w, r)
		} else if len(pathParts) >= 5 && pathParts[4] == "tracking" {
			server.orders.handleGetOrderTracking(w, r)
		} else {
			server.orders.handleGetOrder(w, r)
		}
	})

	// Subscription routes
	http.HandleFunc("/api/subscriptions/plans", server.subscriptions.handleGetPlans)
	http.HandleFunc("/api/subscriptions/current", server.subscriptions.handleGetSubscription)
	http.HandleFunc("/api/subscriptions/create", server.subscriptions.handleCreateSubscription)
	http.HandleFunc("/api/subscriptions/usage", server.subscriptions.handleGetSubscriptionUsage)
	http.HandleFunc("/api/subscriptions/", func(w http.ResponseWriter, r *http.Request) {
		// Route to specific subscription handlers based on path
		pathParts := strings.Split(r.URL.Path, "/")
		if len(pathParts) >= 5 && pathParts[4] == "cancel" {
			server.subscriptions.handleCancelSubscription(w, r)
		} else {
			server.subscriptions.handleUpdateSubscription(w, r)
		}
	})

	// Address routes
	http.HandleFunc("/api/addresses", server.addresses.handleGetAddresses)
	http.HandleFunc("/api/addresses/create", server.addresses.handleCreateAddress)
	http.HandleFunc("/api/addresses/", func(w http.ResponseWriter, r *http.Request) {
		// Route to specific address handlers based on method
		if r.Method == http.MethodDelete {
			server.addresses.handleDeleteAddress(w, r)
		} else {
			server.addresses.handleUpdateAddress(w, r)
		}
	})

	// Service routes
	http.HandleFunc("/api/services", server.services.handleGetServices)

	// Start Centrifuge node
	if err := server.centNode.Run(); err != nil {
		log.Fatalf("Failed to run Centrifuge node: %v", err)
	}

	port := os.Getenv("GO_BACKEND_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
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
