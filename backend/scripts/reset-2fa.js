/**
 * Script to reset Two-Factor Authentication for a user
 * 
 * Usage: node scripts/reset-2fa.js [email]
 * Example: node scripts/reset-2fa.js admin@abv.bg
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2] || 'admin@abv.bg';

async function reset2FA() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🔍 Looking for user: ${email}`);
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.fullName} (${user.email})`);
    console.log(`   Role: ${user.role}`);
    console.log(`   2FA Enabled: ${user.twoFactorEnabled}`);

    if (!user.twoFactorEnabled) {
      console.log('\n⚠️  2FA is already disabled for this user.');
      process.exit(0);
    }

    // Reset 2FA fields
    const result = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: []
        }
      },
      { new: true }
    );

    console.log('\n✅ 2FA has been reset successfully!');
    console.log(`   User: ${result.email}`);
    console.log(`   2FA Enabled: ${result.twoFactorEnabled}`);
    console.log('\n📝 The user can now log in without 2FA and set it up again if needed.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

reset2FA();

