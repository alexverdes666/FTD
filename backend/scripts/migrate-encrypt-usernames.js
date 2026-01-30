/**
 * Migration Script: Encrypt existing plaintext usernames in LeadProfileCredential
 *
 * This script finds all LeadProfileCredential documents where the username
 * field is not encrypted (doesn't start with "ENC:") and encrypts them.
 *
 * Usage: node scripts/migrate-encrypt-usernames.js
 *
 * IMPORTANT: Run this AFTER deploying the model change that adds username
 * to the encryptFields plugin.
 *
 * This script is idempotent - safe to run multiple times.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { encrypt } = require("../utils/encryption");

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Access the raw collection to avoid triggering Mongoose plugin hooks
    const collection = mongoose.connection.collection(
      "leadprofilecredentials"
    );

    // Find all documents where username exists, is not empty,
    // and does NOT start with "ENC:"
    const cursor = collection.find({
      username: { $exists: true, $ne: null, $ne: "", $not: /^ENC:/ },
    });

    let count = 0;
    let errors = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      try {
        const encrypted = encrypt(doc.username);
        await collection.updateOne(
          { _id: doc._id },
          { $set: { username: encrypted } }
        );
        count++;
        console.log(`Encrypted username for document ${doc._id}`);
      } catch (err) {
        errors++;
        console.error(
          `Failed to encrypt username for ${doc._id}:`,
          err.message
        );
      }
    }

    console.log(
      `\nMigration complete: ${count} usernames encrypted, ${errors} errors`
    );
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
