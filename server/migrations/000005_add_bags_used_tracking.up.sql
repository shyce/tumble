-- Add bags_used_this_period column to track bag usage separately from pickup usage
ALTER TABLE subscriptions ADD COLUMN bags_used_this_period INTEGER DEFAULT 0 NOT NULL;