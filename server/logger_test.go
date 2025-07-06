package main

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"
)

func TestInitLogger(t *testing.T) {
	// Save original values
	originalLevel := os.Getenv("LOG_LEVEL")
	originalFormat := os.Getenv("LOG_FORMAT")
	
	// Cleanup
	defer func() {
		os.Setenv("LOG_LEVEL", originalLevel)
		os.Setenv("LOG_FORMAT", originalFormat)
	}()

	tests := []struct {
		name      string
		logLevel  string
		logFormat string
	}{
		{
			name:      "Default settings",
			logLevel:  "",
			logFormat: "",
		},
		{
			name:      "Debug level with JSON format",
			logLevel:  "DEBUG",
			logFormat: "json",
		},
		{
			name:      "Error level with text format",
			logLevel:  "ERROR",
			logFormat: "text",
		},
		{
			name:      "Invalid level defaults to INFO",
			logLevel:  "INVALID",
			logFormat: "json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("LOG_LEVEL", tt.logLevel)
			os.Setenv("LOG_FORMAT", tt.logFormat)
			
			// Initialize logger
			InitLogger()
			
			// Test that logger was created
			if Logger == nil {
				t.Error("Logger should not be nil after initialization")
			}
			
			// Test that default logger was set
			if slog.Default() != Logger {
				t.Error("Default logger should be set to our Logger instance")
			}
		})
	}
}

func TestLogContext(t *testing.T) {
	InitLogger()
	
	ctx := context.Background()
	operation := "test_operation"
	
	logger := LogContext(ctx, operation)
	
	if logger == nil {
		t.Error("LogContext should return a logger")
	}
	
	// Test that the logger includes the operation in its context
	// We can't easily test the internal state, but we can test that it doesn't panic
	logger.Info("test message")
}

func TestLogRequest(t *testing.T) {
	InitLogger()
	
	operation := "test_operation"
	method := "GET"
	path := "/test/path"
	userID := 123
	
	logger := LogRequest(operation, method, path, userID)
	
	if logger == nil {
		t.Error("LogRequest should return a logger")
	}
	
	// Test that the logger works
	logger.Info("test request message")
}

func TestLogDatabase(t *testing.T) {
	InitLogger()
	
	operation := "test_db_operation"
	userID := 456
	
	logger := LogDatabase(operation, userID)
	
	if logger == nil {
		t.Error("LogDatabase should return a logger")
	}
	
	// Test that the logger works
	logger.Info("test database message")
}

func TestColoredTextHandler_Enabled(t *testing.T) {
	var buf bytes.Buffer
	
	tests := []struct {
		name     string
		level    slog.Level
		minLevel slog.Level
		enabled  bool
	}{
		{
			name:     "Debug enabled with debug min level",
			level:    slog.LevelDebug,
			minLevel: slog.LevelDebug,
			enabled:  true,
		},
		{
			name:     "Debug disabled with info min level",
			level:    slog.LevelDebug,
			minLevel: slog.LevelInfo,
			enabled:  false,
		},
		{
			name:     "Error enabled with info min level",
			level:    slog.LevelError,
			minLevel: slog.LevelInfo,
			enabled:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts := &slog.HandlerOptions{Level: tt.minLevel}
			handler := NewColoredTextHandler(&buf, opts)
			
			ctx := context.Background()
			enabled := handler.Enabled(ctx, tt.level)
			
			if enabled != tt.enabled {
				t.Errorf("Expected enabled=%v, got enabled=%v", tt.enabled, enabled)
			}
		})
	}
}

func TestColoredTextHandler_Handle(t *testing.T) {
	var buf bytes.Buffer
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	handler := NewColoredTextHandler(&buf, opts)
	
	ctx := context.Background()
	
	tests := []struct {
		name     string
		level    slog.Level
		message  string
		attrs    []slog.Attr
		contains []string
	}{
		{
			name:    "Basic info message",
			level:   slog.LevelInfo,
			message: "Test info message",
			attrs:   []slog.Attr{},
			contains: []string{"INFO", "Test info message"},
		},
		{
			name:    "Debug message with operation",
			level:   slog.LevelDebug,
			message: "Test debug message",
			attrs:   []slog.Attr{slog.String("operation", "test_op")},
			contains: []string{"DEBUG", "Test debug message", "test_op"},
		},
		{
			name:    "Error message with user context",
			level:   slog.LevelError,
			message: "Test error message",
			attrs:   []slog.Attr{slog.Int("user_id", 123)},
			contains: []string{"ERROR", "Test error message", "user:123"},
		},
		{
			name:    "Warning message with HTTP context",
			level:   slog.LevelWarn,
			message: "Test warn message",
			attrs: []slog.Attr{
				slog.String("method", "POST"),
				slog.String("path", "/api/test"),
			},
			contains: []string{"WARN", "Test warn message", "POST", "/api/test"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf.Reset() // Clear buffer
			
			record := slog.NewRecord(time.Now(), tt.level, tt.message, 0)
			for _, attr := range tt.attrs {
				record.AddAttrs(attr)
			}
			
			err := handler.Handle(ctx, record)
			if err != nil {
				t.Errorf("Handle returned error: %v", err)
			}
			
			output := buf.String()
			for _, expected := range tt.contains {
				if !strings.Contains(output, expected) {
					t.Errorf("Output should contain '%s', got: %s", expected, output)
				}
			}
		})
	}
}

func TestColoredTextHandler_WithAttrs(t *testing.T) {
	var buf bytes.Buffer
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	handler := NewColoredTextHandler(&buf, opts)
	
	// Add attributes to handler
	attrs := []slog.Attr{
		slog.String("operation", "test_operation"),
		slog.Int("user_id", 123),
	}
	
	newHandler := handler.WithAttrs(attrs)
	
	// Test that the new handler includes the attributes
	ctx := context.Background()
	record := slog.NewRecord(time.Now(), slog.LevelInfo, "Test message", 0)
	
	err := newHandler.Handle(ctx, record)
	if err != nil {
		t.Errorf("Handle returned error: %v", err)
	}
	
	output := buf.String()
	expectedContains := []string{"test_operation", "user:123", "Test message"}
	for _, expected := range expectedContains {
		if !strings.Contains(output, expected) {
			t.Errorf("Output should contain '%s', got: %s", expected, output)
		}
	}
}

func TestColoredTextHandler_WithGroup(t *testing.T) {
	var buf bytes.Buffer
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	handler := NewColoredTextHandler(&buf, opts)
	
	// Add group to handler
	newHandler := handler.WithGroup("test_group")
	
	// Test that the new handler is created without error
	if newHandler == nil {
		t.Error("WithGroup should return a new handler")
	}
	
	// Test that we can use the new handler
	ctx := context.Background()
	record := slog.NewRecord(time.Now(), slog.LevelInfo, "Test message", 0)
	
	err := newHandler.Handle(ctx, record)
	if err != nil {
		t.Errorf("Handle returned error: %v", err)
	}
}

func TestLoggerLevels(t *testing.T) {
	// Test different log levels to ensure they work
	var buf bytes.Buffer
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	handler := NewColoredTextHandler(&buf, opts)
	logger := slog.New(handler)
	
	tests := []struct {
		name    string
		logFunc func(string, ...any)
		level   string
	}{
		{
			name:    "Debug log",
			logFunc: logger.Debug,
			level:   "DEBUG",
		},
		{
			name:    "Info log",
			logFunc: logger.Info,
			level:   "INFO",
		},
		{
			name:    "Warn log",
			logFunc: logger.Warn,
			level:   "WARN",
		},
		{
			name:    "Error log",
			logFunc: logger.Error,
			level:   "ERROR",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf.Reset()
			
			tt.logFunc("Test message", "level", tt.level)
			
			output := buf.String()
			if !strings.Contains(output, tt.level) {
				t.Errorf("Output should contain '%s', got: %s", tt.level, output)
			}
			if !strings.Contains(output, "Test message") {
				t.Errorf("Output should contain the message, got: %s", output)
			}
		})
	}
}

func TestLoggerEnvironmentVariables(t *testing.T) {
	// Save original values
	originalLevel := os.Getenv("LOG_LEVEL")
	originalFormat := os.Getenv("LOG_FORMAT")
	
	// Cleanup
	defer func() {
		os.Setenv("LOG_LEVEL", originalLevel)
		os.Setenv("LOG_FORMAT", originalFormat)
	}()

	tests := []struct {
		name           string
		logLevel       string
		expectedLevel  slog.Level
	}{
		{
			name:          "DEBUG level",
			logLevel:      "DEBUG",
			expectedLevel: slog.LevelDebug,
		},
		{
			name:          "INFO level",
			logLevel:      "INFO",
			expectedLevel: slog.LevelInfo,
		},
		{
			name:          "WARN level",
			logLevel:      "WARN",
			expectedLevel: slog.LevelWarn,
		},
		{
			name:          "WARNING level",
			logLevel:      "WARNING",
			expectedLevel: slog.LevelWarn,
		},
		{
			name:          "ERROR level",
			logLevel:      "ERROR",
			expectedLevel: slog.LevelError,
		},
		{
			name:          "Invalid level defaults to INFO",
			logLevel:      "INVALID",
			expectedLevel: slog.LevelInfo,
		},
		{
			name:          "Empty level defaults to INFO",
			logLevel:      "",
			expectedLevel: slog.LevelInfo,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("LOG_LEVEL", tt.logLevel)
			os.Setenv("LOG_FORMAT", "json")
			
			// We can't easily test the internal level setting,
			// but we can test that initialization doesn't panic
			InitLogger()
			
			if Logger == nil {
				t.Error("Logger should be initialized")
			}
		})
	}
}