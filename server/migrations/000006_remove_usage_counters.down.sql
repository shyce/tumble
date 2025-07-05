-- Restore usage counter columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pickups_used_this_period INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS bags_used_this_period INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pounds_used_this_period INTEGER DEFAULT 0 NOT NULL;

-- Remove indexes
DROP INDEX IF EXISTS idx_orders_user_subscription_period;
DROP INDEX IF EXISTS idx_order_items_order_service;