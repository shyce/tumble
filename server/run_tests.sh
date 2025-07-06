#!/bin/bash

# Tumble API Test Runner
# This script sets up the test environment and runs tests
# Usage: ./run_tests.sh [test_pattern] [additional_go_test_args...]
# Examples:
#   ./run_tests.sh                              # Run all tests
#   ./run_tests.sh TestOrderHandler_CreateOrder # Run specific test
#   ./run_tests.sh TestOrder                    # Run all order tests
#   ./run_tests.sh -v -race                     # Run with verbose and race detection

set -e

echo "🧪 Tumble API Test Suite"
echo "========================"

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go to run tests."
    exit 1
fi

# Set test environment variables (use Docker environment if available)
export TEST_DB_HOST=${TEST_DB_HOST:-${DB_HOST:-postgres}}
export TEST_DB_PORT=${TEST_DB_PORT:-${DB_PORT:-5432}}
export TEST_DB_USER=${TEST_DB_USER:-${DB_USER:-tumble}}
export TEST_DB_PASSWORD=${TEST_DB_PASSWORD:-${DB_PASSWORD:-tumble_pass}}
export TEST_DB_NAME=${TEST_DB_NAME:-tumble_test}
export JWT_SECRET=${JWT_SECRET:-test-secret-key}

echo "🔧 Test Environment:"
echo "   Database: ${TEST_DB_HOST}:${TEST_DB_PORT}"
echo "   User: ${TEST_DB_USER}"
echo "   Test DB: ${TEST_DB_NAME}"
echo ""

# Check database connectivity using Go instead of pg_isready
echo "🔍 Checking database connectivity..."
cat > /tmp/test_db_connection.go << 'EOF'
package main

import (
    "database/sql"
    "fmt"
    "os"
    _ "github.com/lib/pq"
)

func main() {
    dbHost := os.Getenv("TEST_DB_HOST")
    dbPort := os.Getenv("TEST_DB_PORT")
    dbUser := os.Getenv("TEST_DB_USER")
    dbPassword := os.Getenv("TEST_DB_PASSWORD")
    
    connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=disable",
        dbHost, dbPort, dbUser, dbPassword)
    
    db, err := sql.Open("postgres", connStr)
    if err != nil {
        fmt.Printf("Failed to open connection: %v\n", err)
        os.Exit(1)
    }
    defer db.Close()
    
    if err := db.Ping(); err != nil {
        fmt.Printf("Failed to ping database: %v\n", err)
        os.Exit(1)
    }
    
    fmt.Println("Database connection successful")
}
EOF

# Run the connection test
if ! go run /tmp/test_db_connection.go; then
    echo "❌ Cannot connect to PostgreSQL database."
    echo "   Please ensure PostgreSQL is running and accessible."
    echo "   Connection: postgresql://${TEST_DB_USER}@${TEST_DB_HOST}:${TEST_DB_PORT}"
    rm -f /tmp/test_db_connection.go
    exit 1
fi
rm -f /tmp/test_db_connection.go
echo "✅ Database connection successful"

# Download dependencies
echo "📦 Installing Go dependencies..."
go mod tidy
go mod download

# Parse arguments
TEST_PATTERN=""
ADDITIONAL_ARGS=""

# Check if first argument looks like a test pattern (starts with uppercase or is a flag)
if [ $# -gt 0 ] && [[ "$1" =~ ^[A-Z] || "$1" =~ ^- ]]; then
    if [[ "$1" =~ ^[A-Z] ]]; then
        TEST_PATTERN="$1"
        shift
    fi
fi

# Collect remaining arguments
ADDITIONAL_ARGS="$@"

# Build test command
TEST_CMD="go test"

# Add verbose flag if not already present
if [[ ! "$ADDITIONAL_ARGS" =~ -v ]]; then
    TEST_CMD="$TEST_CMD -v"
fi

# Add test pattern if specified
if [ ! -z "$TEST_PATTERN" ]; then
    TEST_CMD="$TEST_CMD -run $TEST_PATTERN"
fi

# Add additional arguments
if [ ! -z "$ADDITIONAL_ARGS" ]; then
    TEST_CMD="$TEST_CMD $ADDITIONAL_ARGS"
fi

# Add current directory
TEST_CMD="$TEST_CMD ."

# Run tests
echo ""
echo "🧪 Running tests..."
echo "=================="
if [ ! -z "$TEST_PATTERN" ]; then
    echo "🎯 Test pattern: $TEST_PATTERN"
fi
echo "🚀 Command: $TEST_CMD"
echo ""

eval $TEST_CMD