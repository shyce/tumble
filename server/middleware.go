package main

import (
	"fmt"
	"net/http"
	"time"
)

// LoggingMiddleware provides structured HTTP request logging
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		// Create a response writer wrapper to capture status code
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}
		
		// Generate request ID for tracking
		requestID := fmt.Sprintf("%d", start.UnixNano()%1000000)
		
		// Extract auth info if available
		var userContext string
		if authHeader := r.Header.Get("Authorization"); authHeader != "" {
			userContext = "authenticated"
		} else {
			userContext = "anonymous"
		}
		
		// Log request start
		userAgent := r.Header.Get("User-Agent")
		if len(userAgent) > 50 {
			userAgent = userAgent[:50] + "..."
		}
		
		Logger.Info("HTTP request started",
			"method", r.Method,
			"path", r.URL.Path,
			"request_id", requestID,
			"user_context", userContext,
			"remote_addr", r.RemoteAddr,
			"referer", r.Header.Get("Referer"),
			"user_agent", userAgent,
		)
		
		// Call the next handler
		next.ServeHTTP(wrapped, r)
		
		// Log request completion
		duration := time.Since(start)
		Logger.Info("HTTP request completed",
			"method", r.Method,
			"path", r.URL.Path,
			"request_id", requestID,
			"status_code", wrapped.statusCode,
			"duration_ms", duration.Milliseconds(),
			"remote_addr", r.RemoteAddr,
		)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode    int
	headerWritten bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.headerWritten {
		rw.statusCode = code
		rw.headerWritten = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

// CORSMiddleware handles CORS with logging
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if r.Method == "OPTIONS" {
			Logger.Debug("CORS preflight request",
				"origin", origin,
				"path", r.URL.Path,
			)
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}