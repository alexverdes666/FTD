const crypto = require('crypto');

// Get encryption key from environment or generate a consistent one
// IMPORTANT: In production, always set ENCRYPTION_KEY in .env
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.warn('⚠️  WARNING: ENCRYPTION_KEY not set in environment. Using fallback key.');
  console.warn('⚠️  For production, generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  // Use a consistent fallback for development (not secure for production!)
  ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex characters
}

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a string using AES-256-CBC
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted text in format "iv:encryptedData"
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM, 
    Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'), 
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a string that was encrypted with the encrypt function
 * @param {string} text - The encrypted text in format "iv:encryptedData"
 * @returns {string} - The decrypted plain text
 */
function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'), 
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

module.exports = {
  encrypt,
  decrypt
};

