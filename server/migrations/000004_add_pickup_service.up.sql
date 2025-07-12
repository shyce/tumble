-- Add pickup service as a billable line item
INSERT INTO services (name, description, base_price_cents) VALUES
('pickup_service', 'Pickup Service', 1000);