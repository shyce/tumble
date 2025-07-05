package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
)

// Logger is a global structured logger instance
var Logger *slog.Logger

// InitLogger initializes the structured logger with configuration
func InitLogger() {
	// Get log level from environment
	logLevel := strings.ToUpper(os.Getenv("LOG_LEVEL"))
	if logLevel == "" {
		logLevel = "INFO"
	}
	
	// Get log format from environment (json or text)
	logFormat := strings.ToLower(os.Getenv("LOG_FORMAT"))
	if logFormat == "" {
		logFormat = "json"
	}
	
	// Debug environment variables
	fmt.Printf("DEBUG: LOG_LEVEL=%s, LOG_FORMAT=%s\n", logLevel, logFormat)

	var level slog.Level
	switch logLevel {
	case "DEBUG":
		level = slog.LevelDebug
	case "INFO":
		level = slog.LevelInfo
	case "WARN", "WARNING":
		level = slog.LevelWarn
	case "ERROR":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	// Create handler options
	opts := &slog.HandlerOptions{
		Level: level,
		AddSource: true, // Add source file and line number
	}

	var handler slog.Handler
	if logFormat == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		// Use custom colored text handler for development
		handler = NewColoredTextHandler(os.Stdout, opts)
	}

	Logger = slog.New(handler)
	
	// Set as default logger
	slog.SetDefault(Logger)
	
	Logger.Info("Logger initialized", 
		"level", logLevel, 
		"format", logFormat,
	)
}

// LogContext creates a logger with common request context
func LogContext(ctx context.Context, operation string) *slog.Logger {
	return Logger.With(
		"operation", operation,
	)
}

// LogRequest creates a logger with HTTP request context
func LogRequest(operation, method, path string, userID int) *slog.Logger {
	return Logger.With(
		"operation", operation,
		"method", method,
		"path", path,
		"user_id", userID,
	)
}

// LogDatabase creates a logger for database operations
func LogDatabase(operation string, userID int) *slog.Logger {
	return Logger.With(
		"operation", operation,
		"component", "database",
		"user_id", userID,
	)
}

// ANSI color codes
const (
	ColorReset  = "\033[0m"
	ColorRed    = "\033[31m"
	ColorYellow = "\033[33m"
	ColorBlue   = "\033[34m"
	ColorGreen  = "\033[32m"
	ColorPurple = "\033[35m"
	ColorCyan   = "\033[36m"
	ColorGray   = "\033[37m"
	ColorBold   = "\033[1m"
	ColorDim    = "\033[2m"
)

// ColoredTextHandler is a custom slog handler with colors and better formatting
type ColoredTextHandler struct {
	opts   slog.HandlerOptions
	writer io.Writer
	attrs  []slog.Attr
	groups []string
}

// NewColoredTextHandler creates a new colored text handler
func NewColoredTextHandler(w io.Writer, opts *slog.HandlerOptions) *ColoredTextHandler {
	if opts == nil {
		opts = &slog.HandlerOptions{}
	}
	return &ColoredTextHandler{
		opts:   *opts,
		writer: w,
		attrs:  []slog.Attr{},
		groups: []string{},
	}
}

// Enabled reports whether the handler handles records at the given level
func (h *ColoredTextHandler) Enabled(_ context.Context, level slog.Level) bool {
	minLevel := slog.LevelInfo
	if h.opts.Level != nil {
		minLevel = h.opts.Level.Level()
	}
	return level >= minLevel
}

// Handle handles the Record
func (h *ColoredTextHandler) Handle(_ context.Context, r slog.Record) error {
	// Format timestamp
	timestamp := r.Time.Format("15:04:05.000")
	
	// Color-code the level
	var levelStr string
	switch r.Level {
	case slog.LevelDebug:
		levelStr = ColorGray + "DEBUG" + ColorReset
	case slog.LevelInfo:
		levelStr = ColorBlue + " INFO" + ColorReset
	case slog.LevelWarn:
		levelStr = ColorYellow + " WARN" + ColorReset
	case slog.LevelError:
		levelStr = ColorRed + "ERROR" + ColorReset
	default:
		levelStr = fmt.Sprintf("%5s", r.Level.String())
	}

	// Extract key attributes
	var operation, component, method, path string
	var userID, addressID int
	
	// Collect other attributes
	otherAttrs := make(map[string]any)
	
	// Process record attributes
	r.Attrs(func(a slog.Attr) bool {
		switch a.Key {
		case "operation":
			operation = a.Value.String()
		case "component":
			component = a.Value.String()
		case "method":
			method = a.Value.String()
		case "path":
			path = a.Value.String()
		case "user_id":
			if a.Value.Kind() == slog.KindInt64 {
				userID = int(a.Value.Int64())
			}
		case "address_id":
			if a.Value.Kind() == slog.KindInt64 {
				addressID = int(a.Value.Int64())
			}
		default:
			otherAttrs[a.Key] = a.Value.Any()
		}
		return true
	})
	
	// Process handler attributes
	for _, attr := range h.attrs {
		switch attr.Key {
		case "operation":
			operation = attr.Value.String()
		case "component":
			component = attr.Value.String()
		case "method":
			method = attr.Value.String()
		case "path":
			path = attr.Value.String()
		case "user_id":
			if attr.Value.Kind() == slog.KindInt64 {
				userID = int(attr.Value.Int64())
			}
		case "address_id":
			if attr.Value.Kind() == slog.KindInt64 {
				addressID = int(attr.Value.Int64())
			}
		default:
			otherAttrs[attr.Key] = attr.Value.Any()
		}
	}

	// Build the log line
	var line strings.Builder
	
	// Timestamp and level
	line.WriteString(ColorDim + timestamp + ColorReset)
	line.WriteString(" ")
	line.WriteString(levelStr)
	line.WriteString(" ")
	
	// Operation context
	if operation != "" {
		line.WriteString(ColorPurple + "[" + operation + "]" + ColorReset + " ")
	}
	
	// Component
	if component != "" {
		line.WriteString(ColorCyan + component + ColorReset + " ")
	}
	
	// HTTP context
	if method != "" && path != "" {
		line.WriteString(ColorGreen + method + ColorReset + " " + ColorDim + path + ColorReset + " ")
	}
	
	// User context
	if userID > 0 {
		line.WriteString(ColorYellow + fmt.Sprintf("user:%d", userID) + ColorReset + " ")
	}
	if addressID > 0 {
		line.WriteString(ColorYellow + fmt.Sprintf("addr:%d", addressID) + ColorReset + " ")
	}
	
	// Main message
	line.WriteString(ColorBold + r.Message + ColorReset)
	
	// Additional attributes
	if len(otherAttrs) > 0 {
		line.WriteString(" " + ColorDim)
		first := true
		for k, v := range otherAttrs {
			if !first {
				line.WriteString(" ")
			}
			line.WriteString(fmt.Sprintf("%s=%v", k, v))
			first = false
		}
		line.WriteString(ColorReset)
	}
	
	line.WriteString("\n")
	
	_, err := h.writer.Write([]byte(line.String()))
	return err
}

// WithAttrs returns a new handler with the given attributes
func (h *ColoredTextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	newAttrs := make([]slog.Attr, 0, len(h.attrs)+len(attrs))
	newAttrs = append(newAttrs, h.attrs...)
	newAttrs = append(newAttrs, attrs...)
	
	return &ColoredTextHandler{
		opts:   h.opts,
		writer: h.writer,
		attrs:  newAttrs,
		groups: h.groups,
	}
}

// WithGroup returns a new handler with the given group
func (h *ColoredTextHandler) WithGroup(name string) slog.Handler {
	newGroups := make([]string, 0, len(h.groups)+1)
	newGroups = append(newGroups, h.groups...)
	newGroups = append(newGroups, name)
	
	return &ColoredTextHandler{
		opts:   h.opts,
		writer: h.writer,
		attrs:  h.attrs,
		groups: newGroups,
	}
}