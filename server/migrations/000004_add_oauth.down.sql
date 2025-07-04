-- Drop OAuth additions
DROP TRIGGER IF EXISTS update_oauth_accounts_updated_at ON oauth_accounts;
DROP INDEX IF EXISTS idx_oauth_accounts_provider;
DROP INDEX IF EXISTS idx_oauth_accounts_user_id;
DROP INDEX IF EXISTS idx_users_google_id;
DROP TABLE IF EXISTS oauth_accounts;

-- Revert users table changes
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
UPDATE users SET email_verified = (email_verified_at IS NOT NULL);
ALTER TABLE users DROP COLUMN email_verified_at;
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE users DROP COLUMN google_id;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;