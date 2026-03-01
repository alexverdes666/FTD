/**
 * Copies all collections from the "test" database to "test_local".
 * Usage: node copy-db.js
 */

const { MongoClient } = require("mongodb");
require("dotenv").config();

const SOURCE_DB = "test";
const TARGET_DB = "test_local";

const uri = process.env.MONGODB_URI;

async function copyDatabase() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");

    const sourceDb = client.db(SOURCE_DB);
    const targetDb = client.db(TARGET_DB);

    const collections = await sourceDb.listCollections().toArray();
    console.log(
      `Found ${collections.length} collections in "${SOURCE_DB}":`,
      collections.map((c) => c.name).join(", ")
    );

    for (const colInfo of collections) {
      const name = colInfo.name;
      const sourceCol = sourceDb.collection(name);
      const targetCol = targetDb.collection(name);

      const count = await sourceCol.countDocuments();
      console.log(`\nCopying "${name}" (${count} documents)...`);

      if (count === 0) {
        console.log(`  Skipped (empty)`);
        continue;
      }

      // Drop target collection if it already exists to avoid duplicates
      try {
        await targetCol.drop();
      } catch (e) {
        // Collection doesn't exist yet, that's fine
      }

      // Copy indexes first (excluding _id which is auto-created)
      const indexes = await sourceCol.indexes();
      const customIndexes = indexes.filter((idx) => idx.name !== "_id_");
      if (customIndexes.length > 0) {
        await targetCol.createIndexes(
          customIndexes.map(({ key, ...rest }) => {
            const { v, ns, ...options } = rest;
            return { key, ...options };
          })
        );
        console.log(`  Copied ${customIndexes.length} indexes`);
      }

      // Copy documents in batches of 1000
      const BATCH_SIZE = 1000;
      let copied = 0;
      const cursor = sourceCol.find();

      let batch = [];
      for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= BATCH_SIZE) {
          await targetCol.insertMany(batch);
          copied += batch.length;
          process.stdout.write(`  ${copied}/${count}\r`);
          batch = [];
        }
      }
      if (batch.length > 0) {
        await targetCol.insertMany(batch);
        copied += batch.length;
      }

      console.log(`  Done: ${copied} documents copied`);
    }

    console.log(`\nDatabase copy complete: "${SOURCE_DB}" -> "${TARGET_DB}"`);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

copyDatabase();
