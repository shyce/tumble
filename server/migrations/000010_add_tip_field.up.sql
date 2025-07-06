-- Add tip field to orders table for driver earnings
ALTER TABLE orders ADD COLUMN tip DECIMAL(10,2) DEFAULT 0.00;