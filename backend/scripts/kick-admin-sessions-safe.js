/**
 * SAFE Session Kick Script with Backup & Restore capability
 *
 * This script creates a backup before invalidating sessions,
 * allowing you to restore if something goes wrong.
 *
 * Usage:
 *   KICK:    node backend/scripts/kick-admin-sessions-safe.js kick
 *   RESTORE: node backend/scripts/kick-admin-sessions-safe.js restore
 *   STATUS:  node backend/scripts/kick-admin-sessions-safe.js status
 */

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");

const TARGET_EMAIL = "kiro@abv.bg";
const BACKUP_FILE = path.join(__dirname, "session-backup.json");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGODB_URI environment variable not set");
    process.exit(1);
  }
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB\n");
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

function saveBackup(data) {
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));
  console.log(`💾 Backup saved to: ${BACKUP_FILE}`);
}

function loadBackup() {
  if (!fs.existsSync(BACKUP_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
}

async function showStatus() {
  await connectDB();

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    console.error(`❌ User "${TARGET_EMAIL}" not found`);
    await disconnectDB();
    return;
  }

  console.log("📋 Current Status:");
  console.log(`   - User: ${user.fullName} (${user.email})`);
  console.log(`   - Role: ${user.role}`);
  console.log(`   - 2FA Enabled: ${user.twoFactorEnabled ? "Yes ✓" : "No ✗"}`);
  console.log(
    `   - tokenInvalidatedAt: ${user.tokenInvalidatedAt || "Never set"}`
  );
  console.log("");

  const backup = loadBackup();
  if (backup) {
    console.log("💾 Backup file exists:");
    console.log(`   - Created: ${backup.backupCreatedAt}`);
    console.log(
      `   - Previous tokenInvalidatedAt: ${
        backup.previousTokenInvalidatedAt || "null"
      }`
    );
    console.log(`   - New tokenInvalidatedAt: ${backup.newTokenInvalidatedAt}`);
  } else {
    console.log("💾 No backup file found");
  }

  await disconnectDB();
}

async function kickSessions() {
  await connectDB();

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    console.error(`❌ User "${TARGET_EMAIL}" not found`);
    await disconnectDB();
    process.exit(1);
  }

  console.log("📋 User found:");
  console.log(`   - ID: ${user._id}`);
  console.log(`   - Name: ${user.fullName}`);
  console.log(`   - Email: ${user.email}`);
  console.log(`   - Role: ${user.role}`);
  console.log(`   - 2FA Enabled: ${user.twoFactorEnabled ? "Yes ✓" : "No ✗"}`);
  console.log(
    `   - Current tokenInvalidatedAt: ${user.tokenInvalidatedAt || "Never set"}`
  );
  console.log("");

  if (!user.twoFactorEnabled) {
    console.warn(
      "⚠️  WARNING: 2FA is NOT enabled! Anyone with password can still log in."
    );
    console.log("");
  }

  // Create backup BEFORE making changes
  const previousValue = user.tokenInvalidatedAt
    ? user.tokenInvalidatedAt.toISOString()
    : null;
  const newValue = new Date();

  const backupData = {
    userId: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    previousTokenInvalidatedAt: previousValue,
    newTokenInvalidatedAt: newValue.toISOString(),
    backupCreatedAt: new Date().toISOString(),
    note: 'Run "node backend/scripts/kick-admin-sessions-safe.js restore" to undo this change',
  };

  // Save backup FIRST
  saveBackup(backupData);
  console.log("");

  // Now apply the change
  user.tokenInvalidatedAt = newValue;
  await user.save({ validateBeforeSave: false });

  console.log("🔒 All sessions invalidated!");
  console.log(`   - tokenInvalidatedAt set to: ${newValue.toISOString()}`);
  console.log("");
  console.log("✅ Success! All existing tokens are now invalid.");
  console.log("");
  console.log("🔄 TO RESTORE (if something goes wrong):");
  console.log(
    "   Run: node backend/scripts/kick-admin-sessions-safe.js restore"
  );
  console.log("");

  if (user.twoFactorEnabled) {
    console.log(
      "🔐 Since 2FA is enabled, only the person with the authenticator app"
    );
    console.log("   can log in again with the credentials.");
  }

  await disconnectDB();
}

async function restoreSessions() {
  const backup = loadBackup();

  if (!backup) {
    console.error("❌ No backup file found!");
    console.log("   Cannot restore - no previous state saved.");
    console.log(`   Expected backup file: ${BACKUP_FILE}`);
    process.exit(1);
  }

  console.log("💾 Backup found:");
  console.log(`   - Created: ${backup.backupCreatedAt}`);
  console.log(`   - User: ${backup.fullName} (${backup.email})`);
  console.log(
    `   - Previous tokenInvalidatedAt: ${
      backup.previousTokenInvalidatedAt || "null"
    }`
  );
  console.log(
    `   - Current tokenInvalidatedAt: ${backup.newTokenInvalidatedAt}`
  );
  console.log("");

  await connectDB();

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    console.error(`❌ User "${TARGET_EMAIL}" not found`);
    await disconnectDB();
    process.exit(1);
  }

  // Restore the previous value
  const previousValue = backup.previousTokenInvalidatedAt
    ? new Date(backup.previousTokenInvalidatedAt)
    : null;

  user.tokenInvalidatedAt = previousValue;
  await user.save({ validateBeforeSave: false });

  console.log("🔄 Sessions RESTORED!");
  console.log(
    `   - tokenInvalidatedAt restored to: ${previousValue || "null"}`
  );
  console.log("");
  console.log("✅ Previous sessions are now VALID again.");
  console.log(
    "   Anyone who was logged in before the kick can access the system."
  );
  console.log("");
  console.log(
    "⚠️  WARNING: This means ALL previous sessions are restored, including"
  );
  console.log(
    "   any unauthorized ones. Only use this as an emergency fallback!"
  );

  await disconnectDB();
}

// Main
const action = process.argv[2]?.toLowerCase();

if (!action || !["kick", "restore", "status"].includes(action)) {
  console.log("Usage:");
  console.log(
    "  node kick-admin-sessions-safe.js kick     - Kick all sessions (creates backup first)"
  );
  console.log(
    "  node kick-admin-sessions-safe.js restore  - Restore from backup (emergency only)"
  );
  console.log(
    "  node kick-admin-sessions-safe.js status   - Show current status and backup info"
  );
  process.exit(0);
}

if (action === "kick") {
  kickSessions().catch(console.error);
} else if (action === "restore") {
  restoreSessions().catch(console.error);
} else if (action === "status") {
  showStatus().catch(console.error);
}
