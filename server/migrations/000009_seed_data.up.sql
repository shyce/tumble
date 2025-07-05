-- Insert subscription plans based on actual Tumble pricing
INSERT INTO subscription_plans (name, description, price_per_month, pounds_included, price_per_extra_pound, pickups_per_month) VALUES
('Weekly Standard', 'Standard Tumble bag service weekly', 170.00, 0, 0.00, 4),
('Bi-Weekly Standard', 'Standard Tumble bag service bi-weekly', 90.00, 0, 0.00, 2),
('Weekly Rush', 'Rush Tumble bag service weekly', 220.00, 0, 0.00, 4),
('Bi-Weekly Rush', 'Rush Tumble bag service bi-weekly', 110.00, 0, 0.00, 2);

-- Insert service types based on actual Tumble pricing
INSERT INTO services (name, description, base_price, price_per_pound) VALUES
('standard_bag', 'Standard Tumble Bag', 45.00, 0.00),
('rush_bag', 'Rush Tumble Bag (faster turnaround)', 55.00, 0.00),
('additional_bag', 'Additional bags beyond subscription', 40.00, 0.00),
('comforter', 'Comforter cleaning', 25.00, 0.00),
('sensitive_skin_detergent', 'Sensitive Skin Detergent add-on', 3.00, 0.00),
('scent_booster', 'Scent Booster add-on', 3.00, 0.00);

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