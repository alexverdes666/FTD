/**
 * Script to check for and report duplicate client network assignments
 * This helps identify leads that have been assigned to the same client network multiple times
 */

const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const ClientNetwork = require('../models/ClientNetwork');
require('dotenv').config();

async function checkDuplicateAssignments() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || process.env.DATABASE_URL);
    console.log('Connected to database');

    // Get all client networks
    const clientNetworks = await ClientNetwork.find({});
    console.log(`\nChecking ${clientNetworks.length} client networks for duplicates...\n`);

    let totalDuplicates = 0;
    let totalLeadsChecked = 0;

    for (const network of clientNetworks) {
      console.log(`\n=== Checking: ${network.name} (${network._id}) ===`);

      // Find all leads that have this client network in their history
      const leadsWithThisNetwork = await Lead.find({
        'clientNetworkHistory.clientNetwork': network._id
      }).select('_id firstName lastName newEmail clientNetworkHistory');

      console.log(`Found ${leadsWithThisNetwork.length} leads assigned to this network`);
      totalLeadsChecked += leadsWithThisNetwork.length;

      // Check for duplicates within each lead
      let networkDuplicates = 0;
      for (const lead of leadsWithThisNetwork) {
        // Count how many times this network appears in the history
        const assignments = lead.clientNetworkHistory.filter(
          h => h.clientNetwork.toString() === network._id.toString()
        );

        if (assignments.length > 1) {
          networkDuplicates++;
          totalDuplicates++;
          console.log(`  ⚠️  DUPLICATE: ${lead.firstName} ${lead.lastName} (${lead.newEmail})`);
          console.log(`      Lead ID: ${lead._id}`);
          console.log(`      Assigned ${assignments.length} times to this network:`);
          assignments.forEach((assignment, idx) => {
            console.log(`        ${idx + 1}. Order: ${assignment.orderId || 'N/A'}, Date: ${assignment.assignedAt}`);
          });
        }
      }

      if (networkDuplicates > 0) {
        console.log(`  ❌ Found ${networkDuplicates} leads with duplicate assignments to ${network.name}`);
      } else {
        console.log(`  ✅ No duplicates found for ${network.name}`);
      }
    }

    console.log(`\n========================================`);
    console.log(`SUMMARY:`);
    console.log(`  Total leads checked: ${totalLeadsChecked}`);
    console.log(`  Total duplicates found: ${totalDuplicates}`);
    console.log(`========================================\n`);

    // Check for specific case: leads assigned to Trade Leads
    const tradeLeadsNetwork = clientNetworks.find(n => n.name === 'Trade Leads');
    if (tradeLeadsNetwork) {
      console.log(`\n=== DETAILED ANALYSIS: Trade Leads ===`);
      const tradeLeadsLeads = await Lead.find({
        'clientNetworkHistory.clientNetwork': tradeLeadsNetwork._id
      })
        .select('_id firstName lastName newEmail newPhone country leadType clientNetworkHistory orderId')
        .populate('orderId', 'createdAt status')
        .sort({ 'clientNetworkHistory.assignedAt': -1 })
        .limit(20);

      console.log(`Most recent 20 leads assigned to Trade Leads:`);
      for (const lead of tradeLeadsLeads) {
        const tradeLeadsAssignments = lead.clientNetworkHistory.filter(
          h => h.clientNetwork.toString() === tradeLeadsNetwork._id.toString()
        );
        const marker = tradeLeadsAssignments.length > 1 ? '⚠️  DUP' : '✅ OK';
        console.log(`  ${marker} - ${lead.firstName} ${lead.lastName} (${lead.newEmail})`);
        console.log(`        Lead ID: ${lead._id}`);
        console.log(`        Type: ${lead.leadType}, Country: ${lead.country}`);
        console.log(`        Assignments: ${tradeLeadsAssignments.length}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the check
checkDuplicateAssignments();

