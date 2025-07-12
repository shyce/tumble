-- Insert subscription plans based on new PRICING.md structure
INSERT INTO subscription_plans (name, description, price_per_month_cents, pickups_per_month) VALUES
('Fresh Start', 'Single/Student Plan - 2 Standard Bag pickups per month (~4 loads)', 4800, 2),
('Family Fresh', 'Most Popular - 6 Standard Bag pickups per month (~12 loads)', 13000, 6),
('House Fresh', 'Large Family Plan - 12 Standard Bag pickups per month (~24 loads)', 24000, 12);

-- Insert service types based on new PRICING.md structure
INSERT INTO services (name, description, base_price_cents) VALUES
('standard_bag', 'Standard Bag (22"×33", ~2 loads)', 3000),
('rush_bag', 'Rush Service (faster turnaround)', 1000),
('additional_bag', 'Additional Standard Bag', 3000),
('bedding', 'Bedding', 2500),
('pickup_service', 'Pickup and delivery service', 1000),
('sensitive_skin_detergent', 'Sensitive Skin Detergent add-on', 300),
('scent_booster', 'Scent Booster add-on', 300);

-- Insert sample users with correct password hashes
-- Admin user (password: admin123)
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified_at) VALUES
('admin@tumble.com', '$2a$10$jeEIeDbnBKk12n.JfNjSFOXkB9LJwjWwSF9nyHIgU.X.TPqIgloDq', 'Admin', 'User', 'admin', CURRENT_TIMESTAMP);

-- Driver user (password: driver123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified_at) VALUES
('driver@tumble.com', '$2a$10$uaPYC1Z6.rZvpDOEGuXDButDMs5FXHNg4FK.Axhtlj06f6xkD2mnm', 'John', 'Driver', '555-0123', 'driver', CURRENT_TIMESTAMP);

-- Customer user (password: customer123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified_at) VALUES
('customer@tumble.com', '$2a$10$hWzLSPkHy0aKoGAgltZITu46UJGqSSzAHfHxImwAm3dB567pbzQpO', 'Jane', 'Customer', '555-0456', 'customer', CURRENT_TIMESTAMP);

-- Insert default addresses for the seeded users
-- Admin address (for tax calculation testing)
INSERT INTO addresses (user_id, type, street_address, city, state, zip_code, delivery_instructions, is_default) VALUES
((SELECT id FROM users WHERE email = 'admin@tumble.com'), 'home', '123 Admin Street', 'San Francisco', 'CA', '94102', 'Front door delivery', true);

-- Driver address
INSERT INTO addresses (user_id, type, street_address, city, state, zip_code, delivery_instructions, is_default) VALUES
((SELECT id FROM users WHERE email = 'driver@tumble.com'), 'home', '456 Driver Avenue', 'San Francisco', 'CA', '94103', 'Side entrance preferred', true);

-- Customer address (for tax calculation and testing)
INSERT INTO addresses (user_id, type, street_address, city, state, zip_code, delivery_instructions, is_default) VALUES
((SELECT id FROM users WHERE email = 'customer@tumble.com'), 'home', '789 Customer Lane', 'San Francisco', 'CA', '94104', 'Ring doorbell twice', true);