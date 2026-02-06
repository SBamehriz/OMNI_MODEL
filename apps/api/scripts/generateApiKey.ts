#!/usr/bin/env ts-node
/**
 * Generate a new API key and its hash
 * Usage: npm run generate-key
 *
 * This script generates a secure API key and its bcrypt hash.
 * Show the plaintext key to the user ONCE, then store only the hash.
 */

import { generateApiKey } from '../src/lib/apiKeys.js';

async function main() {
  console.log('Generating new API key...\n');

  const { key, hash } = await generateApiKey();

  console.log('API Key (show this to user ONCE):');
  console.log('=====================================');
  console.log(key);
  console.log('=====================================\n');

  console.log('Prefix (for api_key_prefix column):');
  console.log(key.substring(0, 8));
  console.log('');

  console.log('Hash (store this in api_key_hash column):');
  console.log(hash);
  console.log('');

  console.log('⚠️  WARNING: The plaintext key will NOT be shown again.');
  console.log('   Make sure to save it securely before closing this window.');
}

main().catch(console.error);
