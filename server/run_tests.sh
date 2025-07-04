#!/bin/bash

# Tumble API Test Runner
# This script sets up the test environment and runs all tests

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

# Run tests with coverage
echo ""
echo "🧪 Running tests..."
echo "=================="

# Test individual packages
echo ""
echo "📝 Testing Authentication..."
go test -v -run "TestAuth" . -coverprofile=coverage_auth.out

echo ""
echo "📬 Testing Address Management..."
go test -v -run "TestAddress" . -coverprofile=coverage_addresses.out

echo ""
echo "📦 Testing Order Management..."
go test -v -run "TestOrder" . -coverprofile=coverage_orders.out

echo ""
echo "💳 Testing Subscription Management..."
go test -v -run "TestSubscription" . -coverprofile=coverage_subscriptions.out

# Run all tests together
echo ""
echo "🚀 Running full test suite..."
go test -v . -coverprofile=coverage_all.out

# Generate coverage report
echo ""
echo "📊 Test Coverage Report:"
go tool cover -func=coverage_all.out | tail -1

# Run benchmarks
echo ""
echo "⚡ Running benchmarks..."
go test -bench=. -benchmem . > benchmark_results.txt
echo "Benchmark results saved to benchmark_results.txt"

# Check for race conditions
echo ""
echo "🏁 Checking for race conditions..."
go test -race . > /dev/null 2>&1 && echo "✅ No race conditions detected" || echo "⚠️  Race conditions detected"

echo ""
echo "🎉 Test suite completed!"
echo ""
echo "📋 Summary:"
echo "   - All unit tests: ✅"
echo "   - Coverage report: Generated"
echo "   - Benchmarks: Completed"
echo "   - Race detection: Completed"
echo ""
echo "📁 Generated files:"
echo "   - coverage_*.out (coverage data)"
echo "   - benchmark_results.txt (benchmark results)"
echo ""
echo "🔍 To view detailed coverage:"
echo "   go tool cover -html=coverage_all.out"