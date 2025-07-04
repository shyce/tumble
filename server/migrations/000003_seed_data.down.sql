-- Remove seed data
DELETE FROM users WHERE email IN ('admin@tumble.com', 'driver@tumble.com');
DELETE FROM services;
DELETE FROM subscription_plans;