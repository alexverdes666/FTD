/**
 * Migration Script: Update Agent Schedules to Unavailable by Default
 * 
 * This script updates all existing agent schedules in the database
 * to set all days as unavailable (false) by default.
 * 
 * Run with: node backend/scripts/migrate-schedules-to-unavailable.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const AgentSchedule = require('../models/AgentSchedule');

// Database connection
const connectDB = async () => {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ftd';
    await mongoose.connect(dbUri);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Migration function
const migrateSchedules = async () => {
  try {
    console.log('\n🔄 Starting migration...\n');

    // Find all agent schedules
    const schedules = await AgentSchedule.find({});
    console.log(`📊 Found ${schedules.length} schedule(s) to migrate\n`);

    if (schedules.length === 0) {
      console.log('ℹ️  No schedules found. Nothing to migrate.');
      return;
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Update each schedule
    for (const schedule of schedules) {
      try {
        console.log(`Processing schedule for agent: ${schedule.agentId} (${schedule.year}-${schedule.month})`);
        
        // Update all days to unavailable (false)
        const updatedMap = new Map();
        for (let day = 1; day <= 31; day++) {
          updatedMap.set(day.toString(), false);
        }
        
        schedule.availabilityMap = updatedMap;
        await schedule.save();
        
        updatedCount++;
        console.log(`  ✅ Updated successfully`);
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error updating schedule:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total schedules found: ${schedules.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (updatedCount > 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️  No schedules were updated.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await migrateSchedules();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateSchedules };

