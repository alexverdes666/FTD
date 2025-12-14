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
 * @throws {Error} - If decryption fails for encrypted data.
 */
const decrypt = (text) => {
  if (!text) return text;

  // If text is not encrypted (doesn't have prefix), return as-is
  if (typeof text !== "string" || !text.startsWith(PREFIX)) {
    return text;
  }

  // Text is encrypted, so we MUST decrypt it
  if (!ENCRYPTION_KEY) {
    console.error(
      "ENCRYPTION_KEY is not defined but encrypted data was found!"
    );
    throw new Error("Encryption key not configured - cannot decrypt data");
  }

  try {
    const ciphertext = text.slice(PREFIX.length);
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);

    // If decryption fails (empty string), the key is wrong
    if (!originalText && ciphertext) {
      console.error("Decryption produced empty result - wrong encryption key?");
      throw new Error(
        "Decryption failed - wrong encryption key or corrupted data"
      );
    }

    return originalText;
  } catch (error) {
    console.error("Decryption error:", error.message);
    throw error;
  }
};

module.exports = {
  encrypt,
  decrypt,
};
