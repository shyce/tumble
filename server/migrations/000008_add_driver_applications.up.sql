CREATE TABLE driver_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    application_data JSONB NOT NULL,
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_applications_user_id ON driver_applications(user_id);
CREATE INDEX idx_driver_applications_status ON driver_applications(status);
CREATE INDEX idx_driver_applications_created_at ON driver_applications(created_at);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_driver_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_driver_applications_updated_at_trigger
    BEFORE UPDATE ON driver_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_applications_updated_at();