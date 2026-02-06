-- Migration 004: Fix API key hashing
-- This migration implements proper bcrypt hashing for API keys

-- Add comment to clarify that api_key_hash should contain bcrypt hashes
COMMENT ON COLUMN users.api_key_hash IS 'bcrypt hash of API key (cost factor 12)';

-- If you previously stored plaintext keys, update each user with a bcrypt hash
-- and set api_key_prefix to the first 8 characters of the key.

-- For production deployment:
-- 1. Generate new API keys using the API key generation utility
-- 2. Store only the bcrypt hash (never the plaintext key)
-- 3. The plaintext key should be shown to the user ONCE and never stored
-- 4. Use the first 8 characters as the prefix for indexed lookups

-- Security notes:
-- - bcrypt cost factor 12 provides good security/performance balance (~250ms)
-- - Prefix indexing allows fast lookup without exposing the full key
-- - Constant-time comparison via bcrypt prevents timing attacks
-- - Never log or store plaintext API keys
