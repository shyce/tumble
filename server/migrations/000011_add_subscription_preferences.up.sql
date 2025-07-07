-- Add subscription preferences table for recurring orders
CREATE TABLE subscription_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    default_pickup_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    default_delivery_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    preferred_pickup_time_slot VARCHAR(50) DEFAULT '8:00 AM - 12:00 PM',
    preferred_delivery_time_slot VARCHAR(50) DEFAULT '8:00 AM - 12:00 PM',
    preferred_pickup_day VARCHAR(10) DEFAULT 'monday', -- 'monday', 'tuesday', etc.
    default_services JSONB DEFAULT '[]'::jsonb, -- Array of default service selections
    auto_schedule_enabled BOOLEAN DEFAULT true,
    lead_time_days INTEGER DEFAULT 1, -- Days ahead to schedule
    special_instructions TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Add indexes for performance
CREATE INDEX idx_subscription_preferences_user_id ON subscription_preferences(user_id);
CREATE INDEX idx_subscription_preferences_auto_schedule ON subscription_preferences(auto_schedule_enabled);

-- Add trigger to update updated_at
CREATE TRIGGER update_subscription_preferences_updated_at
    BEFORE UPDATE ON subscription_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();