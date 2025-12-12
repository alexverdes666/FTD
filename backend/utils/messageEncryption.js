const crypto = require('crypto');

// AES-256-CBC encryption for secure message storage
const ALGORITHM = 'aes-256-cbc';
// Generate or use environment key - ensure it's always a Buffer
const getEncryptionKey = () => {
  if (process.env.MESSAGE_ENCRYPTION_KEY) {
    try {
      return Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY, 'base64');
    } catch (error) {
      console.warn('Invalid MESSAGE_ENCRYPTION_KEY format, generating new key');
      return crypto.randomBytes(32);
    }
  }
  return crypto.randomBytes(32);
};
const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16; // 16 bytes IV for CBC mode

/**
 * Encrypts a message using AES-256-GCM
 * @param {string} text - The plain text message to encrypt
 * @returns {object} - Object containing encrypted data, IV, and auth tag
 */
function encryptMessage(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid message content for encryption');
    }

    // Generate a random IV for each message
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher with CBC mode using modern API
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    // Encrypt the message
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedContent: encrypted,
      iv: iv.toString('hex'),
      authTag: crypto.createHash('sha256').update(text + iv.toString('hex')).digest('hex') // Simple integrity check
    };
  } catch (error) {
    console.error('Message encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypts a message using AES-256-GCM
 * @param {object} encryptedData - Object containing encrypted content, IV, and auth tag
 * @returns {string} - The decrypted plain text message
 */
function decryptMessage(encryptedData) {
  try {
    const { encryptedContent, iv, authTag } = encryptedData;
    
    if (!encryptedContent || !iv) {
      throw new Error('Invalid encrypted message data');
    }

    // Create decipher with CBC mode using proper API
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
    
    // Decrypt the message
    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Verify integrity if authTag is provided
    if (authTag) {
      const expectedAuthTag = crypto.createHash('sha256').update(decrypted + iv).digest('hex');
      if (expectedAuthTag !== authTag) {
        throw new Error('Message integrity check failed');
      }
    }
    
    return decrypted;
  } catch (error) {
    console.error('Message decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
}

/**
 * Encrypts message content for database storage
 * @param {string} content - The message content to encrypt
 * @returns {object} - Encrypted message data for database
 */
function encryptForStorage(content) {
  try {
    if (!content) return null;
    
    const encrypted = encryptMessage(content);
    return {
      isEncrypted: true,
      encryptedContent: encrypted.encryptedContent,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      algorithm: ALGORITHM
    };
  } catch (error) {
    console.error('Storage encryption error:', error);
    return {
      isEncrypted: false,
      content: content // Fallback to plain text if encryption fails
    };
  }
}

/**
 * Decrypts message content from database
 * @param {object} messageData - The message data from database
 * @returns {string} - The decrypted content
 */
function decryptFromStorage(messageData) {
  try {
    // Handle both encrypted and non-encrypted messages
    if (!messageData.isEncrypted) {
      return messageData.content || messageData.encryptedContent;
    }
    
    if (!messageData.encryptedContent || !messageData.iv || !messageData.authTag) {
      throw new Error('Invalid encrypted message structure');
    }
    
    return decryptMessage({
      encryptedContent: messageData.encryptedContent,
      iv: messageData.iv,
      authTag: messageData.authTag
    });
  } catch (error) {
    console.error('Storage decryption error:', error);
    // Return original content if decryption fails (for backward compatibility)
    return messageData.content || '[Encrypted message - decryption failed]';
  }
}

/**
 * Generates a new encryption key (should be stored securely)
 * @returns {string} - Base64 encoded encryption key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Validates encryption key format
 * @param {string} key - The encryption key to validate
 * @returns {boolean} - Whether the key is valid
 */
function validateEncryptionKey(key) {
  try {
    if (!key || typeof key !== 'string') return false;
    const keyBuffer = Buffer.from(key, 'base64');
    return keyBuffer.length === 32;
  } catch (error) {
    return false;
  }
}

module.exports = {
  encryptMessage,
  decryptMessage,
  encryptForStorage,
  decryptFromStorage,
  generateEncryptionKey,
  validateEncryptionKey
}; 