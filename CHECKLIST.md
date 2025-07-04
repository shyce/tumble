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
- [x] Implement subscription management API
- [x] Add real-time order tracking with Centrifuge
- [ ] Create admin panel API endpoints
- [ ] Add payment integration (Stripe)

## Advanced Features
- [ ] Add notification system (email/SMS)
- [ ] Implement route optimization for pickups/deliveries
- [ ] Create admin operations dashboard
- [ ] Add driver mobile interface