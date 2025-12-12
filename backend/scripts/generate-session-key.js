const crypto = require('crypto');

/**
 * Generates a new SESSION_AES_KEY_BASE64 for Telegram session encryption
 * This key should be added to your environment variables
 */

console.log('=== Telegram Session Encryption Key Generator ===\n');

// Generate a cryptographically secure 32-byte (256-bit) key
const sessionKey = crypto.randomBytes(32);
const sessionKeyBase64 = sessionKey.toString('base64');

console.log('Generated SESSION_AES_KEY_BASE64:');
console.log(sessionKeyBase64);
console.log('\nAdd this to your environment variables:');
console.log(`SESSION_AES_KEY_BASE64=${sessionKeyBase64}`);

console.log('\n=== Important Security Notes ===');
console.log('1. Store this key securely in your production environment');
console.log('2. Never commit this key to version control');
console.log('3. Use the same key across all services that need to decrypt sessions');
console.log('4. If this key is compromised, all stored sessions will need to be re-encrypted');

console.log('\n=== Next Steps ===');
console.log('1. Add the SESSION_AES_KEY_BASE64 to your backend environment variables');
console.log('2. Add the SESSION_AES_KEY_BASE64 to your tg-worker environment variables');
console.log('3. Restart both services to pick up the new key');

// Test the key format
const testKey = sessionKeyBase64;
try {
  const keyBuffer = Buffer.from(testKey, 'base64');
  if (keyBuffer.length === 32) {
    console.log('\n✅ Key format validation: PASSED');
  } else {
    console.log('\n❌ Key format validation: FAILED - Invalid length');
  }
} catch (error) {
  console.log('\n❌ Key format validation: FAILED - Invalid base64');
}
