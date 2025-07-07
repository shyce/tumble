#!/bin/bash

# Tumble Sample Data Generator
# This script generates realistic sample data for the Tumble laundry service
# using the docker-compose stack and PostgreSQL database
# This script is idempotent - it can be run multiple times safely

set -e

echo "🧺 Tumble Sample Data Generator"
echo "================================"

# Check if docker compose is running
if ! docker compose ps | grep -q "Up"; then
    echo "❌ Docker Compose stack is not running. Please start it with:"
    echo "   docker compose up -d"
    exit 1
fi

# Database connection details
DB_CONTAINER="tumble-postgres-1"
DB_NAME="tumble"
DB_USER="tumble"
PGPASSWORD="tumble_pass"

# Function to execute SQL commands
run_sql() {
    docker exec -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Function to generate deterministic future dates
get_future_date() {
    local index=$1
    local days_ahead=$(( (index % 14) + 1 ))  # 1-14 days ahead
    date -d "+$days_ahead days" '+%Y-%m-%d'
}

# Function to generate deterministic past dates  
get_past_date() {
    local index=$1
    local days_ago=$(( (index % 30) + 1 ))  # 1-30 days ago
    date -d "-$days_ago days" '+%Y-%m-%d'
}

echo "🧹 Clearing all existing data for fresh start..."

# Clear all data in proper order (respecting foreign keys)
run_sql "TRUNCATE TABLE order_resolutions RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE route_orders RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE driver_routes RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE order_status_history RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE payments RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE orders RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE subscription_preferences RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE driver_applications RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE addresses RESTART IDENTITY CASCADE;"
run_sql "TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;"

# Keep users table but remove all except the core seed users (admin, driver, customer)
run_sql "DELETE FROM users WHERE email NOT IN ('admin@tumble.com', 'driver@tumble.com', 'customer@tumble.com');"
run_sql "SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));"

echo "🏠 Creating sample addresses..."

# Insert sample addresses for existing core users
run_sql "
INSERT INTO addresses (user_id, type, street_address, city, state, zip_code, delivery_instructions, is_default) VALUES
(3, 'home', '123 Maple Street', 'Atlanta', 'GA', '30309', 'Leave at front door', true),
(3, 'work', '456 Peachtree St', 'Atlanta', 'GA', '30308', 'Reception desk', false),
(3, 'other', '789 Oak Avenue', 'Atlanta', 'GA', '30307', 'Side entrance', false);
"

echo "👥 Creating additional sample users..."

# Generate additional users with various roles
run_sql "
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified_at, status) VALUES
('sarah.johnson@email.com', '\$2a\$10\$hWzLSPkHy0aKoGAgltZITu46UJGqSSzAHfHxImwAm3dB567pbzQpO', 'Sarah', 'Johnson', '404-555-0101', 'customer', CURRENT_TIMESTAMP, 'active'),
('mike.rodriguez@email.com', '\$2a\$10\$hWzLSPkHy0aKoGAgltZITu46UJGqSSzAHfHxImwAm3dB567pbzQpO', 'Mike', 'Rodriguez', '404-555-0102', 'customer', CURRENT_TIMESTAMP, 'active'),
('lisa.chen@email.com', '\$2a\$10\$hWzLSPkHy0aKoGAgltZITu46UJGqSSzAHfHxImwAm3dB567pbzQpO', 'Lisa', 'Chen', '404-555-0103', 'customer', CURRENT_TIMESTAMP, 'active'),
('alex.turner@email.com', '\$2a\$10\$uaPYC1Z6.rZvpDOEGuXDButDMs5FXHNg4FK.Axhtlj06f6xkD2mnm', 'Alex', 'Turner', '404-555-0201', 'driver', CURRENT_TIMESTAMP, 'active'),
('maria.garcia@email.com', '\$2a\$10\$uaPYC1Z6.rZvpDOEGuXDButDMs5FXHNg4FK.Axhtlj06f6xkD2mnm', 'Maria', 'Garcia', '404-555-0202', 'driver', CURRENT_TIMESTAMP, 'active'),
('david.kim@email.com', '\$2a\$10\$hWzLSPkHy0aKoGAgltZITu46UJGqSSzAHfHxImwAm3dB567pbzQpO', 'David', 'Kim', '404-555-0104', 'customer', CURRENT_TIMESTAMP, 'active'),
('emma.wilson@email.com', '\$2a\$10\$hWzLSPkHy0aKoGAgltZITu46UJGqSSzAHfHxImwAm3dB567pbzQpO', 'Emma', 'Wilson', '404-555-0105', 'customer', CURRENT_TIMESTAMP, 'active'),
('carlos.martinez@email.com', '\$2a\$10\$uaPYC1Z6.rZvpDOEGuXDButDMs5FXHNg4FK.Axhtlj06f6xkD2mnm', 'Carlos', 'Martinez', '404-555-0203', 'driver', CURRENT_TIMESTAMP, 'active');
"

echo "🏠 Creating addresses for new users..."

# Create addresses for new users - using known user IDs after fresh start
run_sql "
INSERT INTO addresses (user_id, type, street_address, city, state, zip_code, delivery_instructions, is_default) VALUES
-- Sarah Johnson (ID 4)
(4, 'home', '555 Piedmont Ave', 'Atlanta', 'GA', '30309', 'Ring doorbell twice', true),
(4, 'work', '100 Corporate Blvd', 'Atlanta', 'GA', '30308', 'Security desk', false),
-- Mike Rodriguez (ID 5)
(5, 'home', '777 Highland Ave', 'Atlanta', 'GA', '30312', 'Leave with neighbor if not home', true),
-- Lisa Chen (ID 6)
(6, 'home', '200 Spring St', 'Atlanta', 'GA', '30303', 'Apartment 5B', true),
(6, 'work', '50 Tech Square', 'Atlanta', 'GA', '30308', 'Building lobby', false),
-- Alex Turner (ID 7)
(7, 'home', '888 North Ave', 'Atlanta', 'GA', '30318', '', true),
-- Maria Garcia (ID 8)
(8, 'home', '333 West End Ave', 'Atlanta', 'GA', '30310', '', true),
-- David Kim (ID 9)
(9, 'home', '400 Ponce de Leon', 'Atlanta', 'GA', '30308', 'Gate code 1234', true),
-- Emma Wilson (ID 10)
(10, 'home', '600 Virginia Ave', 'Atlanta', 'GA', '30306', 'Leave at front door', true),
-- Carlos Martinez (ID 11)
(11, 'home', '150 Memorial Dr', 'Atlanta', 'GA', '30312', '', true);
"

echo "📋 Creating sample subscriptions..."

# Create subscriptions for customers
run_sql "
INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end) VALUES
(3, 1, 'active', '$(date '+%Y-%m-01')', '$(date -d '+1 month' '+%Y-%m-01')'),
(4, 2, 'active', '$(date '+%Y-%m-01')', '$(date -d '+1 month' '+%Y-%m-01')'),
(5, 1, 'active', '$(date '+%Y-%m-01')', '$(date -d '+1 month' '+%Y-%m-01')'),
(6, 3, 'active', '$(date '+%Y-%m-01')', '$(date -d '+1 month' '+%Y-%m-01')'),
(9, 2, 'paused', '$(date '+%Y-%m-01')', '$(date -d '+1 month' '+%Y-%m-01')'),
(10, 1, 'active', '$(date '+%Y-%m-01')', '$(date -d '+1 month' '+%Y-%m-01')');
"

echo "📦 Creating sample orders..."

# Generate sample orders with realistic data
customer_emails=("customer@tumble.com" "sarah.johnson@email.com" "mike.rodriguez@email.com" "lisa.chen@email.com" "david.kim@email.com" "emma.wilson@email.com")

for i in {1..25}; do
    # Deterministic customer email selection
    email_index=$(( (i - 1) % ${#customer_emails[@]} ))
    customer_email="${customer_emails[$email_index]}"
    
    # Deterministic dates - first 8 orders are future, rest are past
    if [ $i -le 8 ]; then
        # Future order
        pickup_date=$(get_future_date $i)
        order_status="scheduled"
    else
        # Past order with deterministic status
        pickup_date=$(get_past_date $i)
        statuses=("pending" "scheduled" "picked_up" "in_process" "ready" "out_for_delivery" "delivered")
        status_index=$(( (i - 9) % ${#statuses[@]} ))
        order_status="${statuses[$status_index]}"
    fi
    
    delivery_date=$(date -d "$pickup_date +2 days" '+%Y-%m-%d')
    
    # Initial pricing - will be recalculated after items are added
    subtotal=0.00
    tax=0.00
    total=0.00
    
    # Deterministic time slots
    time_slots=("8:00 AM - 12:00 PM" "12:00 PM - 4:00 PM" "4:00 PM - 8:00 PM")
    pickup_slot="${time_slots[$((i % ${#time_slots[@]}))]}"
    delivery_slot="${time_slots[$(((i + 1) % ${#time_slots[@]}))]}"
    
    run_sql "
    INSERT INTO orders (user_id, pickup_address_id, delivery_address_id, subscription_id, status, subtotal, tax, total, pickup_date, delivery_date, pickup_time_slot, delivery_time_slot, special_instructions, created_at) 
    SELECT u.id, a.id, a.id, s.id, '$order_status', $subtotal, $tax, $total, '$pickup_date', '$delivery_date', '$pickup_slot', '$delivery_slot', 'Standard wash and fold service', '$(date -d "$pickup_date -1 day" '+%Y-%m-%d %H:%M:%S')'
    FROM users u 
    JOIN addresses a ON a.user_id = u.id AND a.is_default = true
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
    WHERE u.email = '$customer_email'
    LIMIT 1;
    "
done

echo "🛍️ Creating order items..."

# Add pickup service for all orders (most basic service)
run_sql "
INSERT INTO order_items (order_id, service_id, quantity, price, notes) 
SELECT 
    o.id,
    s.id as service_id,
    1 as quantity,
    s.base_price as price,
    'Pickup service' as notes
FROM orders o
CROSS JOIN services s
WHERE o.special_instructions = 'Standard wash and fold service'
AND s.name = 'pickup_service'
AND s.description = 'Pickup Service'  -- Use the first one with this exact description
;"

# Add primary bag service for each order (deterministic based on order ID)
run_sql "
INSERT INTO order_items (order_id, service_id, quantity, price, notes) 
SELECT 
    o.id,
    CASE 
        WHEN o.id % 10 < 7 THEN standard_bag.id    -- Standard bag (70%)
        WHEN o.id % 10 < 9 THEN rush_bag.id        -- Rush bag (20%) 
        ELSE additional_bag.id                     -- Additional bag (10%)
    END as service_id,
    1 as quantity,
    CASE 
        WHEN o.id % 10 < 7 THEN standard_bag.base_price
        WHEN o.id % 10 < 9 THEN rush_bag.base_price  
        ELSE additional_bag.base_price
    END as price,
    'Primary service' as notes
FROM orders o
CROSS JOIN (SELECT id, base_price FROM services WHERE name = 'standard_bag') standard_bag
CROSS JOIN (SELECT id, base_price FROM services WHERE name = 'rush_bag') rush_bag
CROSS JOIN (SELECT id, base_price FROM services WHERE name = 'additional_bag') additional_bag
WHERE o.special_instructions = 'Standard wash and fold service'
;
"

# Add deterministic add-ons (30% of orders)
run_sql "
INSERT INTO order_items (order_id, service_id, quantity, price, notes)
SELECT 
    o.id,
    CASE 
        WHEN o.id % 2 = 0 THEN sensitive_skin.id   -- Sensitive skin detergent
        ELSE scent_booster.id                      -- Scent booster
    END as service_id,
    1 as quantity,
    CASE 
        WHEN o.id % 2 = 0 THEN sensitive_skin.base_price
        ELSE scent_booster.base_price
    END as price,
    'Add-on service' as notes
FROM orders o 
CROSS JOIN (SELECT id, base_price FROM services WHERE name = 'sensitive_skin_detergent') sensitive_skin
CROSS JOIN (SELECT id, base_price FROM services WHERE name = 'scent_booster') scent_booster
WHERE o.special_instructions = 'Standard wash and fold service'
AND o.id % 10 < 3  -- 30% of orders get add-ons (deterministic)
;
"

echo "💰 Updating order totals and applying subscription coverage..."

# Apply subscription coverage for orders with subscriptions
run_sql "
-- For orders with subscriptions, set pickup service to \$0 (covered by subscription)
UPDATE order_items 
SET price = 0.0, notes = 'Pickup service (covered by subscription)'
FROM orders o
JOIN subscriptions s ON o.subscription_id = s.id
WHERE order_items.order_id = o.id 
AND order_items.service_id = (SELECT id FROM services WHERE name = 'pickup_service' AND description = 'Pickup Service')
AND s.status = 'active';
"

# Apply bag coverage (first bag covered per order with active subscription)
run_sql "
-- For orders with subscriptions, cover first standard bag
UPDATE order_items 
SET price = 0.0, notes = 'Standard bag (covered by subscription)'
FROM orders o
JOIN subscriptions s ON o.subscription_id = s.id
WHERE order_items.order_id = o.id 
AND order_items.service_id = (SELECT id FROM services WHERE name = 'standard_bag')
AND order_items.notes = 'Primary service'
AND s.status = 'active';
"

# Recalculate order totals based on actual items
run_sql "
UPDATE orders 
SET 
    subtotal = item_totals.total_amount,
    tax = ROUND((item_totals.total_amount * 0.08)::numeric, 2),
    total = ROUND((item_totals.total_amount * 1.08)::numeric, 2)
FROM (
    SELECT 
        oi.order_id,
        SUM(oi.price * oi.quantity) as total_amount
    FROM order_items oi
    GROUP BY oi.order_id
) item_totals
WHERE orders.id = item_totals.order_id;
"

echo "🚚 Creating driver routes..."

# Clear existing routes to avoid duplicates
run_sql "DELETE FROM route_orders WHERE route_id IN (SELECT id FROM driver_routes WHERE route_date >= CURRENT_DATE);"
run_sql "DELETE FROM driver_routes WHERE route_date >= CURRENT_DATE;"

# Create routes for the next 7 days for each driver
driver_emails=("driver@tumble.com" "alex.turner@email.com" "maria.garcia@email.com" "carlos.martinez@email.com")

for email in "${driver_emails[@]}"; do
    for day in {0..6}; do
        route_date=$(date -d "+$day days" '+%Y-%m-%d')
        
        # Morning pickup route
        run_sql "
        INSERT INTO driver_routes (driver_id, route_date, route_type, estimated_start_time, estimated_end_time, status) 
        SELECT u.id, '$route_date', 'pickup', '08:00:00', '12:00:00', 'planned'
        FROM users u WHERE u.email = '$email';
        "
        
        # Afternoon delivery route  
        run_sql "
        INSERT INTO driver_routes (driver_id, route_date, route_type, estimated_start_time, estimated_end_time, status) 
        SELECT u.id, '$route_date', 'delivery', '13:00:00', '17:00:00', 'planned'
        FROM users u WHERE u.email = '$email';
        "
    done
done

echo "🗺️ Assigning orders to routes..."

# Update specific orders to have future pickup dates that match routes
run_sql "
UPDATE orders 
SET pickup_date = CURRENT_DATE + ((id % 6) + 1),  -- Spread across next 6 days
    delivery_date = CURRENT_DATE + ((id % 6) + 3), -- Delivery 2+ days after pickup
    status = CASE 
        WHEN id % 2 = 0 THEN 'scheduled'
        ELSE 'pending'
    END
WHERE special_instructions = 'Standard wash and fold service'
AND id % 5 = 0;  -- Update every 5th order (deterministic 20%)
"

# Update specific past orders to delivery status for delivery routes
run_sql "
UPDATE orders 
SET status = CASE 
        WHEN id % 2 = 0 THEN 'ready'
        ELSE 'out_for_delivery'
    END,
    delivery_date = CURRENT_DATE + ((id % 6) + 1)  -- Set future delivery dates
WHERE special_instructions = 'Standard wash and fold service'
AND pickup_date < CURRENT_DATE  -- Past orders that could be ready for delivery
AND id % 3 = 0;  -- Update every 3rd past order (deterministic ~33%)
"

# Assign orders to pickup routes (future dates) - ONE ORDER PER ROUTE ONLY
run_sql "
INSERT INTO route_orders (route_id, order_id, sequence_number, estimated_time, status)
SELECT DISTINCT ON (o.id)  -- Ensure each order is only assigned once
    dr.id as route_id,
    o.id as order_id,
    1 as sequence_number,  -- Start with sequence 1
    dr.estimated_start_time as estimated_time,
    'pending' as status
FROM driver_routes dr
JOIN orders o ON (
    dr.route_type = 'pickup' 
    AND o.pickup_date = dr.route_date 
    AND o.status IN ('scheduled', 'pending')
)
WHERE dr.route_date >= CURRENT_DATE
-- Order assignment spread deterministically across drivers
ORDER BY o.id, (dr.driver_id + o.id) % 4, dr.id;  -- Spread orders across drivers deterministically
"

# Assign orders to delivery routes - ONE ORDER PER ROUTE ONLY  
run_sql "
INSERT INTO route_orders (route_id, order_id, sequence_number, estimated_time, status)
SELECT DISTINCT ON (o.id)  -- Ensure each order is only assigned once
    dr.id as route_id,
    o.id as order_id,
    1 as sequence_number,
    dr.estimated_start_time as estimated_time,
    'pending' as status
FROM driver_routes dr
JOIN orders o ON (
    dr.route_type = 'delivery' 
    AND o.delivery_date = dr.route_date 
    AND o.status IN ('ready', 'out_for_delivery')
)
WHERE dr.route_date >= CURRENT_DATE
-- Order assignment spread deterministically across drivers
ORDER BY o.id, (dr.driver_id + o.id) % 4, dr.id;  -- Spread orders across drivers deterministically
"

# For routes that still have no orders, assign unassigned orders deterministically
run_sql "
INSERT INTO route_orders (route_id, order_id, sequence_number, estimated_time, status)
SELECT DISTINCT ON (o.id)  -- Ensure each order is only assigned once
    dr.id as route_id,
    o.id as order_id,
    1 as sequence_number,
    dr.estimated_start_time as estimated_time,
    'pending' as status
FROM driver_routes dr
JOIN orders o ON (
    dr.route_type = 'pickup' 
    AND o.pickup_date BETWEEN dr.route_date - interval '1 day' AND dr.route_date + interval '1 day'
    AND o.status IN ('scheduled', 'pending')
    AND o.id % 4 = dr.driver_id % 4  -- Deterministic assignment by driver
)
WHERE dr.route_date >= CURRENT_DATE
AND dr.id NOT IN (SELECT DISTINCT route_id FROM route_orders WHERE route_id IS NOT NULL)  -- Routes with no orders yet
-- Order assignment spread deterministically across drivers
ORDER BY o.id, (dr.driver_id + o.id) % 4, dr.id
LIMIT 15;  -- Limit to prevent too many assignments
"

echo "📊 Creating subscription preferences..."

# Use INSERT ... ON CONFLICT to handle duplicates
run_sql "
INSERT INTO subscription_preferences (user_id, default_pickup_address_id, default_delivery_address_id, preferred_pickup_time_slot, preferred_delivery_time_slot, preferred_pickup_day, default_services, auto_schedule_enabled)
SELECT 
    s.user_id,
    a.id as pickup_addr,
    a.id as delivery_addr,
    '8:00 AM - 12:00 PM' as pickup_slot,
    '8:00 AM - 12:00 PM' as delivery_slot,
    CASE (s.user_id % 7)
        WHEN 0 THEN 'sunday'
        WHEN 1 THEN 'monday' 
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        ELSE 'saturday'
    END as pickup_day,
    '[\"standard_bag\"]'::jsonb as services,
    true as auto_schedule
FROM subscriptions s
JOIN addresses a ON a.user_id = s.user_id AND a.is_default = true
WHERE s.status = 'active'
;
"

echo "📋 Creating sample driver applications..."

# Create some driver applications (only if they don't exist)
run_sql "
INSERT INTO driver_applications (user_id, status, application_data, admin_notes, reviewed_by, reviewed_at)
SELECT u.id, app.status, app.application_data::jsonb, app.admin_notes, 
       CASE WHEN app.reviewed_by_email IS NOT NULL THEN admin.id ELSE NULL END,
       CASE WHEN app.reviewed_at IS NOT NULL THEN app.reviewed_at::timestamp ELSE NULL END
FROM (VALUES
    ('sarah.johnson@email.com', 'pending', '{\"vehicle_type\": \"SUV\", \"license_number\": \"ABC123\", \"insurance_company\": \"State Farm\", \"years_experience\": 3, \"availability\": [\"monday\", \"tuesday\", \"wednesday\"]}', NULL, NULL, NULL),
    ('lisa.chen@email.com', 'approved', '{\"vehicle_type\": \"Sedan\", \"license_number\": \"XYZ789\", \"insurance_company\": \"Geico\", \"years_experience\": 5, \"availability\": [\"thursday\", \"friday\", \"saturday\"]}', 'Good driving record, approved for weekend shifts', 'admin@tumble.com', '$(date "+%Y-%m-%d %H:%M:%S")'),
    ('david.kim@email.com', 'rejected', '{\"vehicle_type\": \"Motorcycle\", \"license_number\": \"BIKE99\", \"insurance_company\": \"Progressive\", \"years_experience\": 1, \"availability\": [\"sunday\"]}', 'Vehicle not suitable for laundry pickup', 'admin@tumble.com', '$(date -d "-2 days" "+%Y-%m-%d %H:%M:%S")')
) AS app(email, status, application_data, admin_notes, reviewed_by_email, reviewed_at)
JOIN users u ON u.email = app.email
LEFT JOIN users admin ON admin.email = app.reviewed_by_email
;
"

echo "🔔 Creating sample notifications..."

# Clear existing sample notifications
run_sql "DELETE FROM notifications WHERE title IN ('Pickup Scheduled', 'Order Picked Up', 'Order Ready', 'Order Delivered', 'Order Update');"

# Create notifications for recent activities
run_sql "
INSERT INTO notifications (user_id, order_id, type, title, message, is_read, sent_via_email) 
SELECT 
    o.user_id,
    o.id,
    CASE o.status
        WHEN 'scheduled' THEN 'pickup_scheduled'
        WHEN 'picked_up' THEN 'order_picked_up'
        WHEN 'ready' THEN 'order_ready'
        WHEN 'delivered' THEN 'delivery_complete'
        ELSE 'order_update'
    END as type,
    CASE o.status
        WHEN 'scheduled' THEN 'Pickup Scheduled'
        WHEN 'picked_up' THEN 'Order Picked Up'
        WHEN 'ready' THEN 'Order Ready'
        WHEN 'delivered' THEN 'Order Delivered'
        ELSE 'Order Update'
    END as title,
    CASE o.status
        WHEN 'scheduled' THEN 'Your laundry pickup has been scheduled for ' || o.pickup_date || ' during ' || o.pickup_time_slot
        WHEN 'picked_up' THEN 'Your laundry has been picked up and is being processed'
        WHEN 'ready' THEN 'Your laundry is ready for delivery'
        WHEN 'delivered' THEN 'Your laundry has been delivered successfully'
        ELSE 'Your order status has been updated to ' || o.status
    END as message,
    CASE WHEN o.id % 10 < 3 THEN true ELSE false END as is_read,  -- 30% read deterministically
    true as sent_via_email
FROM orders o 
WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days'
AND o.special_instructions = 'Standard wash and fold service'
ORDER BY o.created_at DESC
LIMIT 30;
"

echo "📈 Creating sample payments..."

# Clear existing sample payments
run_sql "DELETE FROM payments WHERE stripe_payment_intent_id LIKE 'pi_%' OR stripe_charge_id LIKE 'ch_%';"

# Create payment records for delivered orders
run_sql "
INSERT INTO payments (user_id, order_id, amount, payment_type, status, stripe_payment_intent_id, stripe_charge_id)
SELECT 
    o.user_id,
    o.id,
    o.total,
    'extra_order' as payment_type,
    'completed' as status,
    'pi_' || substr(md5(o.id::text), 1, 24) as payment_intent_id,
    'ch_' || substr(md5(o.id::text), 1, 24) as charge_id
FROM orders o 
WHERE o.status = 'delivered' 
AND o.total > 0
AND o.special_instructions = 'Standard wash and fold service';
"

# Create subscription payments
run_sql "
INSERT INTO payments (user_id, subscription_id, amount, payment_type, status, stripe_payment_intent_id, stripe_charge_id)
SELECT 
    s.user_id,
    s.id,
    sp.price_per_month,
    'subscription' as payment_type,
    'completed' as status,
    'pi_' || substr(md5(s.id::text), 1, 24) as payment_intent_id,
    'ch_' || substr(md5(s.id::text), 1, 24) as charge_id
FROM subscriptions s
JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE s.status = 'active';
"

echo ""
echo "✅ Sample data generation complete!"
echo ""
echo "📊 Data Summary:"
echo "================"

# Show data counts
run_sql "
SELECT 
    'Users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'Addresses', COUNT(*) FROM addresses
UNION ALL SELECT 'Subscriptions', COUNT(*) FROM subscriptions  
UNION ALL SELECT 'Orders', COUNT(*) FROM orders
UNION ALL SELECT 'Order Items', COUNT(*) FROM order_items
UNION ALL SELECT 'Driver Routes', COUNT(*) FROM driver_routes
UNION ALL SELECT 'Route Orders', COUNT(*) FROM route_orders
UNION ALL SELECT 'Driver Applications', COUNT(*) FROM driver_applications
UNION ALL SELECT 'Notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'Payments', COUNT(*) FROM payments
UNION ALL SELECT 'Subscription Preferences', COUNT(*) FROM subscription_preferences;
"

echo ""
echo "🔑 Test Login Credentials:"
echo "=========================="
echo "Admin:    admin@tumble.com / admin123"
echo "Driver:   driver@tumble.com / driver123" 
echo "Customer: customer@tumble.com / customer123"
echo ""
echo "Additional customers:"
echo "  sarah.johnson@email.com / customer123"
echo "  mike.rodriguez@email.com / customer123"
echo "  lisa.chen@email.com / customer123"
echo ""
echo "🚀 Your Tumble application now has realistic sample data!"
echo "   Access the app at: http://localhost:3005"
echo ""
echo "📝 Note: This script is idempotent - you can run it multiple times safely."