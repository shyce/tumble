-- Add 'failed' status to orders table
ALTER TABLE orders DROP CONSTRAINT orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN (
    'pending', 
    'scheduled', 
    'picked_up', 
    'in_process', 
    'ready', 
    'out_for_delivery', 
    'delivered', 
    'failed',
    'cancelled'
));

-- Add order_resolutions table to track how failed orders are resolved
CREATE TABLE order_resolutions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    resolved_by INTEGER REFERENCES users(id),
    resolution_type VARCHAR(50) NOT NULL CHECK (resolution_type IN (
        'reschedule', 
        'partial_refund', 
        'full_refund', 
        'credit', 
        'waive_fee'
    )),
    reschedule_date DATE,
    refund_amount DECIMAL(10,2),
    credit_amount DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for performance
CREATE INDEX idx_order_resolutions_order_id ON order_resolutions(order_id);
CREATE INDEX idx_orders_failed_status ON orders(status) WHERE status = 'failed';

-- Add comment for documentation
COMMENT ON COLUMN orders.status IS 'Order status including failed for unsuccessful pickups/deliveries';
COMMENT ON TABLE order_resolutions IS 'Tracks resolutions for failed orders including refunds, credits, and rescheduling';