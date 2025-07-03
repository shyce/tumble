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
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

type Server struct {
	db       *sql.DB
	redis    *redis.Client
	centNode *centrifuge.Node
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

	// Initialize Redis connection
	if err := server.initRedis(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer server.redis.Close()

	// Initialize Centrifuge
	if err := server.initCentrifuge(); err != nil {
		log.Fatalf("Failed to initialize Centrifuge: %v", err)
	}

	// Set up HTTP routes
	http.HandleFunc("/", server.handleHome)
	http.HandleFunc("/health", server.handleHealth)
	http.Handle("/connection/websocket", centrifuge.NewWebsocketHandler(server.centNode, centrifuge.WebsocketConfig{}))

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
			log.Printf("[Centrifuge] %s: %v", entry.Level, entry.Message)
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
