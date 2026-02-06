import crypto from 'crypto';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const API_KEY_PREFIX = 'omni_';
const API_KEY_LENGTH = 32; // characters after prefix

/**
 * Generate a new API key and its bcrypt hash
 * @returns Object with plaintext key (show once) and hash (store in DB)
 */
export async function generateApiKey(): Promise<{ key: string; hash: string }> {
  // Generate 24 random bytes (will become 32 base64 chars)
  const randomBytes = crypto.randomBytes(24);

  // Create readable, URL-safe key
  const key = API_KEY_PREFIX + randomBytes
    .toString('base64')
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .substring(0, API_KEY_LENGTH);

  // Hash with bcrypt (cost factor 12 = ~250ms, good security/performance balance)
  const hash = await bcrypt.hash(key, BCRYPT_ROUNDS);

  return { key, hash };
}

/**
 * Verify an API key against its stored hash
 * @param providedKey - The key from the request
 * @param storedHash - The bcrypt hash from the database
 * @returns Promise<boolean> - True if key matches
 */
export async function verifyApiKey(
  providedKey: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(providedKey, storedHash);
  } catch (error) {
    // Log error but don't expose details
    console.error('API key verification error:', error);
    return false;
  }
}

/**
 * Validate API key format (without checking database)
 * @param key - The key to validate
 * @returns boolean - True if format is valid
 */
export function isValidApiKeyFormat(key: string): boolean {
  return (
    key.startsWith(API_KEY_PREFIX) &&
    key.length === API_KEY_PREFIX.length + API_KEY_LENGTH
  );
}

/**
 * Hash an existing plaintext API key (for migration)
 * @param plainKey - The plaintext key to hash
 * @returns Promise<string> - The bcrypt hash
 */
export async function hashApiKey(plainKey: string): Promise<string> {
  return bcrypt.hash(plainKey, BCRYPT_ROUNDS);
}
