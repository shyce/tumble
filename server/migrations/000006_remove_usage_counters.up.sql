-- Remove usage counter columns since we'll calculate dynamically from orders
ALTER TABLE subscriptions DROP COLUMN IF EXISTS pickups_used_this_period;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS bags_used_this_period;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS pounds_used_this_period;

-- Add indexes on orders table for efficient usage calculations
CREATE INDEX IF NOT EXISTS idx_orders_user_subscription_period ON orders(user_id, subscription_id, pickup_date) WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_order_items_order_service ON order_items(order_id, service_id);