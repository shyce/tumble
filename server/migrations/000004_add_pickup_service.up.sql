-- Add pickup service as a billable line item
INSERT INTO services (name, description, base_price, price_per_pound) VALUES
('pickup_service', 'Pickup Service', 10.00, 0.00);