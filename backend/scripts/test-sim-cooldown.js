/**
 * Test script for SIM Card Cooldown Notification System
 * 
 * This script creates sample SIM cards with various dateCharged values
 * to test the notification system.
 * 
 * Usage:
 *   node scripts/test-sim-cooldown.js
 * 
 * What it does:
 * 1. Connects to the database
 * 2. Creates test SIM cards with different cooldown statuses
 * 3. Optionally triggers the cooldown check manually
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SimCard = require('../models/SimCard');
const User = require('../models/User');

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

// Trigger the notification check
const triggerNotificationCheck = async () => {
  try {
    const { checkSimCardCooldownAndNotify } = require('../controllers/simCards');
    console.log('\n🔔 Triggering SIM card cooldown notification check...\n');
    const result = await checkSimCardCooldownAndNotify(null); // Pass null for io since we're not in a server context
    console.log('✅ Notification check completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error triggering notification check:', error);
    throw error;
  }
};

// Create test SIM cards
const createTestSimCards = async () => {
  try {
    // Find an admin or inventory manager to use as creator
    let creator = await User.findOne({ role: 'admin' });
    if (!creator) {
      creator = await User.findOne({ role: 'inventory_manager' });
    }
    if (!creator) {
      console.error('❌ No admin or inventory manager found. Please create a user first.');
      return;
    }

    console.log(`📝 Using user ${creator.fullName} (${creator.email}) as creator`);

    const currentDate = new Date();
    const testCards = [];

    // Test card 1: Overdue (35 days old)
    const overdueDate = new Date();
    overdueDate.setUTCDate(currentDate.getUTCDate() - 35);
    testCards.push({
      geo: 'TEST-US',
      operator: 'TestOperator1',
      dateCharged: overdueDate,
      simNumber: `TEST-OVERDUE-${Date.now()}`,
      status: 'active',
      notes: 'Test SIM card - Overdue (35 days old)',
      createdBy: creator._id,
      lastModifiedBy: creator._id
    });

    // Test card 2: Critical (25 days old, 5 days remaining)
    const criticalDate = new Date();
    criticalDate.setUTCDate(currentDate.getUTCDate() - 25);
    testCards.push({
      geo: 'TEST-UK',
      operator: 'TestOperator2',
      dateCharged: criticalDate,
      simNumber: `TEST-CRITICAL-${Date.now()}`,
      status: 'active',
      notes: 'Test SIM card - Critical (25 days old, 5 days remaining)',
      createdBy: creator._id,
      lastModifiedBy: creator._id
    });

    // Test card 3: Warning (22 days old, 8 days remaining)
    const warningDate = new Date();
    warningDate.setUTCDate(currentDate.getUTCDate() - 22);
    testCards.push({
      geo: 'TEST-CA',
      operator: 'TestOperator3',
      dateCharged: warningDate,
      simNumber: `TEST-WARNING-${Date.now()}`,
      status: 'active',
      notes: 'Test SIM card - Warning (22 days old, 8 days remaining)',
      createdBy: creator._id,
      lastModifiedBy: creator._id
    });

    // Test card 4: OK (10 days old, 20 days remaining)
    const okDate = new Date();
    okDate.setUTCDate(currentDate.getUTCDate() - 10);
    testCards.push({
      geo: 'TEST-AU',
      operator: 'TestOperator4',
      dateCharged: okDate,
      simNumber: `TEST-OK-${Date.now()}`,
      status: 'active',
      notes: 'Test SIM card - OK (10 days old, should not trigger notification)',
      createdBy: creator._id,
      lastModifiedBy: creator._id
    });

    console.log('\n📦 Creating test SIM cards...\n');
    
    const createdCards = await SimCard.insertMany(testCards);
    
    console.log('✅ Test SIM cards created successfully:\n');
    createdCards.forEach((card, index) => {
      // Use UTC dates to avoid timezone issues
      const chargedDate = new Date(card.dateCharged);
      const chargedDateUTC = Date.UTC(chargedDate.getUTCFullYear(), chargedDate.getUTCMonth(), chargedDate.getUTCDate());
      const currentDateUTC = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
      const daysSinceCharged = Math.floor((currentDateUTC - chargedDateUTC) / (1000 * 60 * 60 * 24));
      const daysRemaining = 30 - daysSinceCharged;
      console.log(`${index + 1}. ${card.simNumber}`);
      console.log(`   GEO: ${card.geo}`);
      console.log(`   Operator: ${card.operator}`);
      console.log(`   Date Charged: ${card.dateCharged.toISOString().split('T')[0]}`);
      console.log(`   Days Since Charged: ${daysSinceCharged}`);
      console.log(`   Days Remaining: ${daysRemaining}`);
      console.log(`   Status: ${daysRemaining <= 0 ? '⚠️ OVERDUE' : daysRemaining <= 5 ? '🔴 CRITICAL' : daysRemaining <= 10 ? '🟡 WARNING' : '✅ OK'}`);
      console.log('');
    });

    return createdCards;
  } catch (error) {
    console.error('❌ Error creating test SIM cards:', error);
    throw error;
  }
};

// Check inventory managers
const checkInventoryManagers = async () => {
  try {
    const inventoryManagers = await User.find({ 
      role: 'inventory_manager',
      isActive: true 
    });
    
    console.log(`\n👥 Found ${inventoryManagers.length} active inventory manager(s):`);
    inventoryManagers.forEach(manager => {
      console.log(`   - ${manager.fullName} (${manager.email})`);
    });
    
    if (inventoryManagers.length === 0) {
      console.log('\n⚠️  WARNING: No active inventory managers found!');
      console.log('   Notifications will not be sent to anyone.');
      console.log('   Please create an inventory manager user to receive notifications.');
    }
    
    return inventoryManagers;
  } catch (error) {
    console.error('❌ Error checking inventory managers:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   SIM Card Cooldown Notification System - Test Script');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Check for inventory managers
    await checkInventoryManagers();
    
    // Create test SIM cards
    const createdCards = await createTestSimCards();
    
    // Trigger the notification check
    await triggerNotificationCheck();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   Test Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📋 What Happened:\n');
    console.log('1. ✅ Created test SIM cards with different cooldown statuses');
    console.log('2. ✅ Triggered the cooldown notification check');
    console.log('3. ✅ Sent notifications to all inventory managers\n');
    
    console.log('📋 Next Steps:\n');
    console.log('1. Log in as an inventory manager');
    console.log('2. Check the notification bell icon (🔔) in the header');
    console.log('3. You should see notifications about SIM cards needing attention\n');
    
    console.log('🔄 Scheduled Job:\n');
    console.log('   The system will automatically check daily at 9:00 AM (configurable)\n');
    
    console.log('🧹 Cleanup:\n');
    console.log('   To remove test SIM cards, run:');
    console.log('   db.simcards.deleteMany({ simNumber: /^TEST-/ })\n');
    
  } catch (error) {
    console.error('❌ Error in test script:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();

