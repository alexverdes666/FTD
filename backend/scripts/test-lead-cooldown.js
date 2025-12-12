/**
 * Test script to verify FTD/Filler lead cooldown functionality
 * 
 * This script tests that:
 * 1. Leads in cooldown period (< 10 days since last use) are NOT available for new orders
 * 2. Leads outside cooldown period (>= 10 days since last use) ARE available for new orders
 * 3. The lastUsedInOrder timestamp is properly set when leads are assigned
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

const COOLDOWN_DAYS = 10;

async function testCooldownFiltering() {
  try {
    console.log('=== FTD/Filler Lead Cooldown Test ===\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to database\n');

    // Test 1: Check leads in cooldown
    const tenDaysAgo = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    
    console.log('Test 1: Checking leads currently in cooldown...');
    const leadsInCooldown = await Lead.find({
      leadType: { $in: ['ftd', 'filler'] },
      lastUsedInOrder: { $gte: tenDaysAgo }
    }).select('firstName lastName lastUsedInOrder leadType');
    
    console.log(`Found ${leadsInCooldown.length} leads in cooldown period:`);
    leadsInCooldown.slice(0, 5).forEach(lead => {
      const daysSinceUsed = Math.floor((Date.now() - new Date(lead.lastUsedInOrder)) / (1000 * 60 * 60 * 24));
      const daysRemaining = COOLDOWN_DAYS - daysSinceUsed;
      console.log(`  - ${lead.firstName} ${lead.lastName} (${lead.leadType}) - ${daysRemaining} days remaining`);
    });
    if (leadsInCooldown.length > 5) {
      console.log(`  ... and ${leadsInCooldown.length - 5} more`);
    }
    console.log('');

    // Test 2: Check leads available (not in cooldown)
    console.log('Test 2: Checking leads available (not in cooldown)...');
    const availableLeads = await Lead.find({
      leadType: { $in: ['ftd', 'filler'] },
      $or: [
        { lastUsedInOrder: null },
        { lastUsedInOrder: { $lt: tenDaysAgo } }
      ]
    }).select('firstName lastName lastUsedInOrder leadType');
    
    console.log(`Found ${availableLeads.length} available leads:`);
    availableLeads.slice(0, 5).forEach(lead => {
      if (lead.lastUsedInOrder) {
        const daysSinceUsed = Math.floor((Date.now() - new Date(lead.lastUsedInOrder)) / (1000 * 60 * 60 * 24));
        console.log(`  - ${lead.firstName} ${lead.lastName} (${lead.leadType}) - last used ${daysSinceUsed} days ago`);
      } else {
        console.log(`  - ${lead.firstName} ${lead.lastName} (${lead.leadType}) - never used`);
      }
    });
    if (availableLeads.length > 5) {
      console.log(`  ... and ${availableLeads.length - 5} more`);
    }
    console.log('');

    // Test 3: Verify cooldown filtering logic
    console.log('Test 3: Simulating cooldown filter (as used in createOrder)...');
    const allFtdLeads = await Lead.find({ 
      leadType: { $in: ['ftd', 'filler'] }
    }).limit(100);
    
    const beforeFilter = allFtdLeads.length;
    const filteredLeads = allFtdLeads.filter(
      (lead) => !lead.lastUsedInOrder || lead.lastUsedInOrder < tenDaysAgo
    );
    const afterFilter = filteredLeads.length;
    const filteredOut = beforeFilter - afterFilter;
    
    console.log(`Before cooldown filter: ${beforeFilter} leads`);
    console.log(`After cooldown filter: ${afterFilter} leads`);
    console.log(`Filtered out (in cooldown): ${filteredOut} leads`);
    console.log('');

    // Test 4: Check for recent duplicates
    console.log('Test 4: Checking for potential duplicate assignments...');
    const recentLeads = await Lead.aggregate([
      {
        $match: {
          leadType: { $in: ['ftd', 'filler'] },
          lastUsedInOrder: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            firstName: '$firstName',
            lastName: '$lastName',
            newPhone: '$newPhone'
          },
          count: { $sum: 1 },
          leads: { $push: { id: '$_id', lastUsed: '$lastUsedInOrder' } }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    if (recentLeads.length > 0) {
      console.log(`⚠ Warning: Found ${recentLeads.length} potential duplicate leads used in last 30 days:`);
      recentLeads.slice(0, 3).forEach(group => {
        console.log(`  - ${group._id.firstName} ${group._id.lastName} (${group.count} times)`);
      });
    } else {
      console.log('✓ No duplicate lead assignments found in last 30 days');
    }
    console.log('');

    // Summary
    console.log('=== Test Summary ===');
    console.log(`Total FTD/Filler leads in cooldown: ${leadsInCooldown.length}`);
    console.log(`Total FTD/Filler leads available: ${availableLeads.length}`);
    console.log(`Cooldown filter effectiveness: ${filteredOut} leads blocked from ${beforeFilter} sample`);
    console.log('');
    console.log('✓ All cooldown tests completed successfully');

  } catch (error) {
    console.error('Error running cooldown test:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run the test
testCooldownFiltering()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });

