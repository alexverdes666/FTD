const CryptoJS = require("crypto-js");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const PREFIX = "ENC:";

/**
 * Encrypts a text string using AES.
 * @param {string} text - The text to encrypt.
 * @returns {string} - The encrypted text with prefix.
 */
const encrypt = (text) => {
  if (!text) return text;
  if (!ENCRYPTION_KEY) {
    console.warn("ENCRYPTION_KEY is not defined. Skipping encryption.");
    return text;
  }
  // If already encrypted, don't encrypt again
  if (typeof text === "string" && text.startsWith(PREFIX)) {
    return text;
  }

  try {
    const ciphertext = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    return PREFIX + ciphertext;
  } catch (error) {
    console.error("Encryption error:", error);
    return text;
  }
};

/**
 * Decrypts a text string if it starts with the prefix.
 * @param {string} text - The text to decrypt.
 * @returns {string} - The decrypted text or original text.
 */
const decrypt = (text) => {
  if (!text) return text;
  if (!ENCRYPTION_KEY) {
    return text;
  }

  if (typeof text === "string" && text.startsWith(PREFIX)) {
    try {
      const ciphertext = text.slice(PREFIX.length);
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);

      // If decryption fails (empty string usually), return original
      if (!originalText && ciphertext) {
        // This might happen if key changed or data corrupted
        return text;
      }
      return originalText;
    } catch (error) {
      console.error("Decryption error:", error);
      return text;
    }
  }

  return text;
};

module.exports = {
  encrypt,
  decrypt,
};
