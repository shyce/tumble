# Tumble API Testing Guide

This document provides comprehensive information about testing the Tumble laundry service API.

## 🧪 Test Suite Overview

The test suite covers all major API endpoints and functionality:

- **Authentication** (`auth_test.go`) - Registration, login, JWT validation
- **Orders** (`orders_test.go`) - Order CRUD, status updates, tracking
- **Subscriptions** (`subscriptions_test.go`) - Plan management, subscription lifecycle
- **Addresses** (`addresses_test.go`) - Address management, default handling
- **Real-time** (`realtime_test.go`) - WebSocket notifications, live updates

## 🔧 Test Environment Setup

### Prerequisites

1. **PostgreSQL** - Running instance for test database
2. **Go 1.21+** - For running tests
3. **Environment Variables** - Test configuration

### Environment Configuration

Set these environment variables before running tests:

```bash
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=postgres
export TEST_DB_NAME=tumble_test
export JWT_SECRET=test-secret-key
```

### Database Setup

The test suite automatically:
- Creates a fresh test database for each test run
- Runs all migrations to set up schema
- Seeds with default data (services, plans)
- Cleans up after tests complete

## 🚀 Running Tests

### Quick Start

```bash
# Make the test runner executable
chmod +x run_tests.sh

# Run the complete test suite
./run_tests.sh
```

### Manual Test Commands

```bash
# Run all tests
go test -v .

# Run specific test categories
go test -v -run "TestAuth" .
go test -v -run "TestOrder" .
go test -v -run "TestSubscription" .
go test -v -run "TestAddress" .
go test -v -run "TestRealtime" .

# Run with coverage
go test -v . -coverprofile=coverage.out
go tool cover -html=coverage.out

# Run benchmarks
go test -bench=. -benchmem .

# Check for race conditions
go test -race .
```

## 📊 Test Categories

### 1. Authentication Tests (`auth_test.go`)

**Coverage:**
- User registration with validation
- User login with credentials
- JWT token generation and validation
- Password hashing and verification
- Duplicate registration prevention
- Email format validation

**Key Test Cases:**
```go
TestAuthHandler_Register
TestAuthHandler_Login
TestAuthHandler_DuplicateRegistration
TestGetUserIDFromRequest
TestPasswordHashing
```

### 2. Order Management Tests (`orders_test.go`)

**Coverage:**
- Order creation with items and addresses
- Order retrieval with filtering and pagination
- Order status updates with real-time notifications
- Order tracking with status history
- Order validation and error handling

**Key Test Cases:**
```go
TestOrderHandler_CreateOrder
TestOrderHandler_GetOrders
TestOrderHandler_GetOrder
TestOrderHandler_UpdateOrderStatus
TestOrderHandler_GetOrderTracking
```

### 3. Subscription Tests (`subscriptions_test.go`)

**Coverage:**
- Subscription plan retrieval with correct pricing
- Subscription creation and validation
- Subscription updates (pause, resume, cancel)
- Usage tracking and billing period calculations
- Duplicate subscription prevention

**Key Test Cases:**
```go
TestSubscriptionHandler_GetPlans
TestSubscriptionHandler_CreateSubscription
TestSubscriptionHandler_GetSubscription
TestSubscriptionHandler_UpdateSubscription
TestSubscriptionHandler_CancelSubscription
TestSubscriptionHandler_GetUsage
```

### 4. Address Management Tests (`addresses_test.go`)

**Coverage:**
- Address creation with validation
- Address retrieval with proper ordering
- Address updates and deletion
- Default address handling
- User isolation (can't access other users' addresses)

**Key Test Cases:**
```go
TestAddressHandler_CreateAddress
TestAddressHandler_GetAddresses
TestAddressHandler_UpdateAddress
TestAddressHandler_DeleteAddress
TestAddressHandler_DefaultAddressHandling
TestAddressHandler_UserIsolation
```

### 5. Real-time Feature Tests (`realtime_test.go`)

**Coverage:**
- Order update notifications
- Pickup and delivery notifications
- Driver location updates
- WebSocket connection handling
- Mock real-time handler for testing

**Key Test Cases:**
```go
TestRealtimeHandler_OrderUpdates
TestRealtimeHandler_PickupNotifications
TestRealtimeHandler_DeliveryNotifications
TestRealtimeHandler_OrderCompleteNotifications
TestRealtimeHandler_DriverLocationUpdate
```

## 🛠️ Test Utilities

### Test Helpers (`test_helpers.go`)

The test suite includes comprehensive helper functions:

- **Database Management:**
  - `SetupTestDB()` - Creates fresh test database
  - `TruncateTables()` - Cleans data between tests
  - `CleanupTestDB()` - Closes database connections

- **Data Creation:**
  - `CreateTestUser()` - Creates test users
  - `CreateTestAddress()` - Creates test addresses
  - `CreateTestOrder()` - Creates test orders
  - `CreateTestSubscription()` - Creates test subscriptions

- **Authentication:**
  - `CreateTestJWTToken()` - Mock JWT tokens
  - Authentication mocking for protected endpoints

- **Real-time Testing:**
  - `MockRealtimeHandler` - Mock WebSocket notifications
  - Real-time event verification

## 📈 Performance Testing

### Benchmark Tests

The suite includes benchmark tests for performance-critical operations:

```go
BenchmarkOrderHandler_GetOrders
BenchmarkSubscriptionHandler_GetPlans
BenchmarkAuthHandler_Register
BenchmarkAuthHandler_Login
BenchmarkAddressHandler_GetAddresses
BenchmarkRealtimeHandler_PublishOrderUpdate
```

Run benchmarks:
```bash
go test -bench=. -benchmem . > benchmark_results.txt
```

### Performance Targets

- **API Response Time:** < 100ms for most endpoints
- **Database Queries:** < 50ms for simple operations
- **Real-time Notifications:** < 10ms to publish
- **Memory Usage:** Minimal allocations per request

## 🔍 Test Coverage

### Coverage Goals

- **Overall Coverage:** > 85%
- **Critical Paths:** > 95% (auth, orders, payments)
- **Business Logic:** 100% (pricing, validation, security)

### Coverage Reports

Generate detailed coverage reports:

```bash
# Generate coverage data
go test -coverprofile=coverage.out .

# View coverage summary
go tool cover -func=coverage.out

# Generate HTML coverage report
go tool cover -html=coverage.out -o coverage.html
```

## 🐛 Test Data and Scenarios

### Test Users

The test suite creates various user types:
- Standard customers
- Admin users
- Users with different subscription states
- Users with multiple addresses

### Test Orders

Various order scenarios are tested:
- Standard bag orders
- Rush orders with premium pricing
- Orders with add-ons (detergent, scent booster)
- Subscription vs. one-off orders
- Orders in different status states

### Test Subscriptions

Multiple subscription scenarios:
- Weekly and bi-weekly plans
- Active, paused, and cancelled states
- Usage tracking and billing periods
- Plan upgrades and downgrades

## 🚨 Error Handling Tests

The test suite verifies proper error handling for:

- **Authentication Errors:**
  - Invalid credentials
  - Expired tokens
  - Missing authorization headers

- **Validation Errors:**
  - Missing required fields
  - Invalid data formats
  - Business rule violations

- **Resource Errors:**
  - Non-existent resources (404)
  - Unauthorized access (403)
  - Duplicate creation attempts

- **Database Errors:**
  - Connection failures
  - Transaction rollbacks
  - Constraint violations

## 🔒 Security Testing

Security aspects covered by tests:

- **Authentication:**
  - JWT token validation
  - Password hashing verification
  - Session management

- **Authorization:**
  - User isolation (can't access other users' data)
  - Role-based access control
  - Resource ownership validation

- **Input Validation:**
  - SQL injection prevention
  - XSS prevention in responses
  - Data sanitization

## 📝 Test Maintenance

### Adding New Tests

When adding new features:

1. **Create test file:** `feature_test.go`
2. **Add test helpers:** Update `test_helpers.go` if needed
3. **Update documentation:** Add to this README
4. **Update coverage goals:** Ensure adequate coverage

### Test Best Practices

- **Isolation:** Each test should be independent
- **Cleanup:** Always clean up test data
- **Naming:** Use descriptive test names
- **Coverage:** Test both success and failure cases
- **Performance:** Include benchmark tests for critical paths

### Continuous Integration

Tests are designed to run in CI/CD pipelines:

- **Docker Support:** Tests can run in containers
- **Environment Variables:** Configurable for different environments
- **Exit Codes:** Proper exit codes for CI systems
- **Parallel Execution:** Tests are safe to run in parallel

## 🎯 Test Results Interpretation

### Success Criteria

A successful test run should show:
- ✅ All tests passing
- 📊 Coverage above target thresholds
- ⚡ Benchmarks within performance targets
- 🏁 No race conditions detected

### Common Issues

**Database Connection Failures:**
- Ensure PostgreSQL is running
- Check connection parameters
- Verify database permissions

**Test Timeouts:**
- May indicate performance regressions
- Check database query efficiency
- Verify test environment resources

**Flaky Tests:**
- Usually indicate race conditions
- Check for proper test isolation
- Verify cleanup procedures

## 🔄 Future Test Enhancements

Planned improvements:

- **E2E Tests:** Full browser automation tests
- **Load Tests:** High-concurrency scenarios
- **Chaos Testing:** Fault injection and recovery
- **Contract Tests:** API contract validation
- **Security Scans:** Automated vulnerability testing

---

For questions about testing or to report test issues, please check the [GitHub Issues](https://github.com/tumble/issues) page.