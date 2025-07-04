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

-- Insert sample admin user (password is 'admin123' hashed with bcrypt)
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified) VALUES
('admin@tumble.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', true);

-- Insert sample driver (password is 'driver123' hashed with bcrypt)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified) VALUES
('driver@tumble.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John', 'Driver', '555-0123', 'driver', true);