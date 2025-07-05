-- Add Stripe-related fields to users table
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN default_payment_method_id VARCHAR(255);

-- Create index for Stripe customer lookups
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);