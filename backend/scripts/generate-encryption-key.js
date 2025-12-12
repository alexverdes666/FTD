const { generateEncryptionKey } = require('../utils/messageEncryption');

console.log('Generating secure encryption key for message encryption...\n');

const key = generateEncryptionKey();

console.log('Generated encryption key:');
console.log(key);
console.log('\nAdd this to your .env file:');
console.log(`MESSAGE_ENCRYPTION_KEY=${key}`);
console.log('\n⚠️  IMPORTANT: Keep this key secure and never commit it to version control!');
console.log('⚠️  If you lose this key, previously encrypted messages cannot be decrypted!');
console.log('\nRestart your server after adding the key to .env file.'); 