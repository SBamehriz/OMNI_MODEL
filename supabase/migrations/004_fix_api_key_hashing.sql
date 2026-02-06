-- Migration 004: Fix API key hashing
-- This migration implements proper bcrypt hashing for API keys

-- Add comment to clarify that api_key_hash should contain bcrypt hashes
COMMENT ON COLUMN users.api_key_hash IS 'bcrypt hash of API key (cost factor 12)';

-- Update the dev user with properly hashed API key
-- Original key: 'omni-dev-key-change-in-production'
-- Hash generated with: bcrypt.hash('omni-dev-key-change-in-production', 12)
-- Prefix: 'omni-dev' (first 8 chars)
UPDATE users
SET
  api_key_hash = '$2b$12$nRpDjOWxlH8wV95ZoHaBMunUNyzjyZ1eCezhsc5PIcW.Bw9Zo117.',
  api_key_prefix = 'omni-dev'
WHERE email = 'dev@localhost';

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
