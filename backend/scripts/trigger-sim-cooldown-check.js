/**
 * Manually trigger SIM Card Cooldown Notification Check
 * 
 * This script manually triggers the cooldown check and sends notifications
 * to inventory managers for SIM cards that need attention.
 * 
 * Usage:
 *   node scripts/trigger-sim-cooldown-check.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { checkSimCardCooldownAndNotify } = require('../controllers/simCards');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   SIM Card Cooldown Notification Check');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('🔔 Checking SIM cards and sending notifications...\n');
    
    // Trigger the notification check (pass null for io since we're not in server context)
    const result = await checkSimCardCooldownAndNotify(null);
    
    console.log('\n✅ Check completed successfully!\n');
    console.log('📊 Results:');
    console.log(`   • SIM cards checked: ${result.simCardsChecked || 0}`);
    console.log(`   • Notifications created: ${result.count || 0}`);
    console.log(`   • Inventory managers notified: ${result.inventoryManagers || 0}`);
    
    if (result.breakdown) {
      console.log('\n📈 Breakdown:');
      console.log(`   • ⚠️  Overdue (30+ days): ${result.breakdown.overdue}`);
      console.log(`   • 🔴 Critical (1-5 days left): ${result.breakdown.critical}`);
      console.log(`   • 🟡 Warning (6-10 days left): ${result.breakdown.warning}`);
    }
    
    console.log('\n💡 Tip:');
    console.log('   Log in as an inventory manager to see the notifications');
    console.log('   in the notification bell icon (🔔) in the header.\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();

