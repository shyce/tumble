-- Drop the order_resolutions table
DROP TABLE IF EXISTS order_resolutions;

-- Remove the 'failed' status from orders table
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
    'cancelled'
));