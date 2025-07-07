-- Add status column to users table
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));

-- Set all existing users to active
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Make status not null after setting defaults
ALTER TABLE users ALTER COLUMN status SET NOT NULL;