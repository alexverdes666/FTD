/**
 * One-time script to invalidate all sessions for a specific user
 * This sets tokenInvalidatedAt to the current time, which causes
 * the auth middleware to reject all tokens issued before this timestamp.
 * 
 * Usage: node backend/scripts/kick-admin-sessions.js
 * 
 * After running this, only the person with access to the 2FA authenticator
 * can log in again since 2FA is enabled for this admin account.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const TARGET_EMAIL = 'kiro@abv.bg';

async function kickAllSessions() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable not set');
      console.log('   Make sure you have a .env file in the backend folder with MONGODB_URI');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find the user
    const user = await User.findOne({ email: TARGET_EMAIL });
    
    if (!user) {
      console.error(`❌ User with email "${TARGET_EMAIL}" not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 User found:');
    console.log(`   - ID: ${user._id}`);
    console.log(`   - Name: ${user.fullName}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - 2FA Enabled: ${user.twoFactorEnabled ? 'Yes ✓' : 'No'}`);
    console.log(`   - Previous tokenInvalidatedAt: ${user.tokenInvalidatedAt || 'Never'}`);
    console.log('');

    if (!user.twoFactorEnabled) {
      console.warn('⚠️  WARNING: 2FA is NOT enabled for this user!');
      console.warn('   After kicking sessions, anyone with the password can still log in.');
      console.warn('   Consider enabling 2FA first or changing the password.');
      console.log('');
    }

    // Set the invalidation timestamp to NOW
    const invalidationTime = new Date();
    user.tokenInvalidatedAt = invalidationTime;
    await user.save({ validateBeforeSave: false });

    console.log('🔒 All sessions invalidated!');
    console.log(`   - tokenInvalidatedAt set to: ${invalidationTime.toISOString()}`);
    console.log('');
    console.log('✅ Success! All existing tokens for this user are now invalid.');
    console.log('   Anyone currently logged in will be logged out on their next request.');
    console.log('');
    
    if (user.twoFactorEnabled) {
      console.log('🔐 Since 2FA is enabled, only the person with the authenticator app');
      console.log('   can log in again with the credentials.');
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

kickAllSessions();

