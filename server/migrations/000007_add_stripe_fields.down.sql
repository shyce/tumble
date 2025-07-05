-- Remove Stripe-related fields from users table
ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE users DROP COLUMN IF EXISTS default_payment_method_id;

-- Drop index
DROP INDEX IF EXISTS idx_users_stripe_customer;