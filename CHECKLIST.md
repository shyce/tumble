# MVP Setup Checklist

## Infrastructure
- [x] Create project directory structure (./server, ./client)
- [x] Create compose.yml with all services
- [x] Set up PostgreSQL container
- [x] Set up Redis container
- [x] Create .env file for environment variables

## Go Server (API & Real-time)
- [x] Create main.go with basic HTTP server using net/http
- [x] Create Dockerfile.dev with Air for hot reload
- [x] Create production Dockerfile
- [x] Install and configure Centrifuge for real-time communication
- [x] Set up database connection to PostgreSQL
- [x] Set up Redis connection
- [x] Configure database migration system
- [x] Test Go server is accessible (http://localhost:8080)

## Next.js Client (Frontend with SSR)
- [x] Initialize Next.js project in ./client
- [x] Create Dockerfile.dev for development with Node LTS
- [x] Create production Dockerfile
- [x] Configure Next.js for SSR with Turbopack
- [x] Test Next.js client is accessible (http://localhost:3001)

## Integration
- [x] Ensure all containers can communicate
- [x] Configure port mappings correctly (8080, 3001, 5432, 6380)
- [x] Test hot reload in development
- [ ] Verify production build works
- [x] Document ports and endpoints
- [x] Note: Nginx will be added later for production

## Application Development
- [x] Design database schema for Tumble laundry service
- [x] Create database migrations for core tables
- [x] Add Google OAuth support to authentication system
- [x] Implement authentication API endpoints (login/register/OAuth)
- [x] Set up NextAuth.js configuration and UI
- [x] Add automatic database migration runner
- [x] Add nginx reverse proxy to eliminate CORS issues
- [x] Configure nginx routing (/api -> Go, / -> Next.js, /connection -> WebSocket)
- [x] Update API URLs to use relative paths
- [x] Test complete authentication flow (login/register working)

## Frontend Development
- [x] Create marketing homepage with Tumble branding
- [x] Build customer dashboard UI (/dashboard)
- [x] Create subscription selection page
- [x] Build order history and tracking pages
- [x] Add account settings and profile management

## Backend API Development
- [x] Create order management API endpoints
- [x] Implement subscription management API (create, read, update, cancel, plan changes)
- [x] Add real-time order tracking with Centrifuge
- [x] Create comprehensive test suite with 55%+ coverage  
- [x] Create pickup scheduling system (frontend page + API integration)
- [x] Create admin panel API endpoints
- [x] Add payment integration (Stripe)

## Consolidated Role-Based Dashboard
- [x] **Unified dashboard with role-specific UI** (/dashboard)
- [x] **Customer view**: Schedule pickup, subscription management, order history, driver application (2x2 grid + banner)
- [x] **Driver view**: Routes, earnings, schedule, assigned orders, driver settings
- [x] **Admin view**: Driver applications, user management, order oversight, analytics, admin settings  
- [x] **Role-based action cards** with appropriate icons and navigation
- [x] **FULLY removed separate /driver and /admin routes** - everything under /dashboard
- [x] **Fixed all API routes to use /api/v1/ consistently**
- [x] **Subscription plans API working** (/api/v1/subscriptions/plans)
- [x] **Driver application form functional** (/apply-driver)
- [x] **Moved admin pages to /dashboard structure** (driver-applications, users, analytics, etc)
- [x] **Removed AdminNavigation component** - no special admin navigation needed

### Dashboard Sub-Pages to Implement
#### Customer Features
- [x] Order scheduling (/dashboard/schedule)  
- [x] Subscription management (/dashboard/subscription)
- [x] Order history (/dashboard/orders)
- [x] Account settings (/dashboard/settings)
- [x] Driver application form (/apply-driver)

#### Driver Features  
- [x] **Driver routes page (/dashboard/routes)** - Route management interface
- [x] **Driver earnings page (/dashboard/earnings)** - Earnings tracking and history
- [x] Driver schedule (/dashboard/schedule) - shared with customer view
- [x] Driver orders (/dashboard/orders) - show assigned orders
- [x] Driver settings (/dashboard/settings) - driver-specific settings

#### Admin Features
- [x] Driver application review (/admin/driver-applications) - existing page
- [x] **Users management page (/dashboard/users)** - View, edit, manage all users  
- [x] **Admin order management (/dashboard/orders)** - System-wide order oversight
- [ ] **Analytics dashboard (/dashboard/analytics)** - System metrics and reporting
- [ ] **Admin settings page (/dashboard/settings)** - System configuration

## Authentication & Authorization
- [x] NextAuth.js v5 configuration with credential provider
- [x] Role-based access control (customer/driver/admin)
- [x] JWT token management with user role persistence
- [x] Session management and automatic redirects
- [x] API route protection with role verification
- [x] Frontend role-based UI rendering

## Advanced Features
- [ ] Add notification system (email/SMS)
- [ ] Implement route optimization for pickups/deliveries
- [ ] Driver earnings and payment system
- [ ] Advanced analytics dashboard for admins
- [ ] Mobile-responsive driver interface improvements

## Route Automation (Next Phase)
### Phase 1: Foundation (1-2 weeks)
- [ ] **Add Geographic Capabilities**
  - [ ] Add lat/long columns to addresses table
  - [ ] Integrate geocoding API (Google Maps/Mapbox)
  - [ ] Geocode existing addresses
  - [ ] Add distance calculation utilities

- [ ] **Driver Availability System**
  - [ ] Create driver_availability table
  - [ ] Connect existing schedule UI to backend
  - [ ] Store weekly recurring schedules
  - [ ] Track driver capacity (max orders/day)

### Phase 2: Basic Automation (2-3 weeks)
- [ ] **Service Area Management**
  - [ ] Define service zones/boundaries
  - [ ] Validate addresses during order creation
  - [ ] Group orders by geographic proximity
  - [ ] Create zone-based route suggestions

- [ ] **Automated Route Generation**
  - [ ] Daily batch job to process pending orders
  - [ ] Group orders by time slot/proximity/service type
  - [ ] Generate draft routes for admin review
  - [ ] Admin interface to review/approve routes

### Phase 3: Smart Assignment (2-3 weeks)
- [ ] **Driver Matching Algorithm**
  - [ ] Match drivers based on availability/location/workload
  - [ ] Performance metrics consideration
  - [ ] Admin override/adjustment capability
  - [ ] Driver notification system

- [ ] **Route Optimization**
  - [ ] Implement traveling salesman algorithm
  - [ ] Optimize order sequence within routes
  - [ ] Time estimation for routes
  - [ ] Map interface for route visualization

### Phase 4: Full Automation (3-4 weeks)
- [ ] **Auto-Assignment System**
  - [ ] Configurable automation rules
  - [ ] Auto-assign routes to drivers
  - [ ] Driver acceptance/rejection system
  - [ ] Fallback to manual assignment

- [ ] **Real-time Adjustments**
  - [ ] Handle same-day order additions
  - [ ] Dynamic route rebalancing
  - [ ] Real-time driver location tracking
  - [ ] Customer notification system

### Quick Wins (Can start immediately)
- [x] **Subscription Auto-Orders** - Generate recurring orders from subscriptions
  - [x] Database migration for subscription_preferences table
  - [x] API endpoints for managing user preferences (GET/POST/PUT)
  - [x] Comprehensive test suite (6 tests + 2 benchmarks)
  - [x] User preference storage (addresses, time slots, services, auto-schedule)
  - [ ] Scheduled task/cron job for recurring order generation
  - [ ] Frontend UI for subscription preferences
- [ ] **Bulk Route Creation** - UI to assign multiple orders at once
- [ ] **Driver Performance Metrics** - Track metrics for better assignment
- [ ] **Service Area Display** - Show coverage areas on signup