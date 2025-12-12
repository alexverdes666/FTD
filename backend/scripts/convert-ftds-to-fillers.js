/**
 * Script to convert all FTD leads into filler leads
 * This creates duplicate filler leads from existing FTD leads while preserving all their data
 * 
 * Usage:
 *   node convert-ftds-to-fillers.js                  # Dry run (preview only)
 *   node convert-ftds-to-fillers.js --execute        # Actually create the filler leads
 *   node convert-ftds-to-fillers.js --execute --limit 10  # Create only first 10
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Lead = require('../models/Lead');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const LIMIT = args.find(arg => arg.startsWith('--limit'))
  ? parseInt(args.find(arg => arg.startsWith('--limit')).split('=')[1])
  : null;

async function convertFTDsToFillers() {
  try {
    // Check if we have MongoDB URI
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI not found in environment variables');
      console.error('   Please make sure you have a .env file in the backend directory');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB successfully\n');

    // Show current database stats
    const currentFTDs = await Lead.countDocuments({ leadType: 'ftd' });
    const currentFillers = await Lead.countDocuments({ leadType: 'filler' });
    console.log('📊 CURRENT DATABASE STATE:');
    console.log(`   FTD leads: ${currentFTDs}`);
    console.log(`   Filler leads: ${currentFillers}`);
    console.log('');

    // Fetch all FTD leads
    console.log('📥 Fetching FTD leads...');
    let query = Lead.find({ leadType: 'ftd' });
    if (LIMIT) {
      query = query.limit(LIMIT);
      console.log(`   ⚠️  Limit set to ${LIMIT} leads`);
    }
    const ftdLeads = await query.lean();
    console.log(`✅ Found ${ftdLeads.length} FTD leads to convert\n`);

    if (ftdLeads.length === 0) {
      console.log('⚠️  No FTD leads found to convert');
      await mongoose.connection.close();
      return;
    }

    if (DRY_RUN) {
      console.log('🔍 DRY RUN MODE - No changes will be made to the database');
      console.log('   To actually create the filler leads, run with --execute flag\n');
    }

    // Track statistics
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log('🔄 Starting conversion process...\n');

    for (let i = 0; i < ftdLeads.length; i++) {
      const ftdLead = ftdLeads[i];
      
      try {
        const originalEmail = ftdLead.newEmail;
        let newEmail;
        
        // Create a natural-looking email variation
        // Using Gmail-style + addressing: john@example.com → john+filler@example.com
        // Or if that fails, append .filler to the local part: john.filler@example.com
        if (originalEmail.includes('@')) {
          const [localPart, domain] = originalEmail.split('@');
          // Try Gmail + style first (most natural looking)
          newEmail = `${localPart}+filler${i}@${domain}`;
        } else {
          // Fallback if email format is unusual
          newEmail = `${originalEmail}.filler${i}`;
        }

        if (DRY_RUN) {
          console.log(`📋 [${i + 1}/${ftdLeads.length}] Would create filler lead:`);
          console.log(`   Name: ${ftdLead.firstName} ${ftdLead.lastName}`);
          console.log(`   Original Email: ${originalEmail}`);
          console.log(`   New Email: ${newEmail}`);
          console.log(`   Phone: ${ftdLead.newPhone}`);
          console.log(`   Country: ${ftdLead.country}`);
          console.log(`   Gender: ${ftdLead.gender || 'not_defined'}`);
          console.log(`   Has Documents: ${ftdLead.documents?.length > 0 ? 'Yes' : 'No'}`);
          console.log('');
          successCount++;
          continue;
        }

        // Create a new filler lead based on the FTD lead
        const fillerLeadData = {
          ...ftdLead,
          _id: new mongoose.Types.ObjectId(), // New ID for the filler
          leadType: 'filler',
          
          // Modify email to make it unique (required field with unique constraint)
          newEmail: newEmail,
          
          // Keep phone numbers as-is (they're not unique)
          newPhone: ftdLead.newPhone,
          oldPhone: ftdLead.oldPhone,
          
          // Reset assignment fields for the filler lead
          isAssigned: false,
          assignedTo: null,
          assignedAt: null,
          
          // Keep all other data including:
          // - firstName, lastName, prefix
          // - country, gender
          // - documents, comments
          // - address, dob, sin
          // - socialMedia
          // - campaign, clientBroker, clientNetwork, ourNetwork
          // - clientBrokerHistory, clientNetworkHistory, campaignHistory, ourNetworkHistory
          // - fingerprint, deviceType, proxyAssignments
          // - browserSession, sessionHistory, currentSessionId
          // - callNumber, callHistory
          
          // Update timestamps
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Remove Mongoose-specific fields
        delete fillerLeadData.__v;

        // Create the new filler lead
        const newFillerLead = new Lead(fillerLeadData);
        await newFillerLead.save();
        
        successCount++;
        console.log(`✅ [${successCount}/${ftdLeads.length}] Created filler from FTD:`);
        console.log(`   ${ftdLead.firstName} ${ftdLead.lastName} | ${ftdLead.country} | ${ftdLead.newPhone}`);
        
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error - email already exists
          skipCount++;
          console.log(`⏭️  [${i + 1}/${ftdLeads.length}] Skipped (duplicate email): ${ftdLead.newEmail}`);
        } else {
          errorCount++;
          const errorMsg = `Lead ${ftdLead._id}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ [${i + 1}/${ftdLeads.length}] Error converting lead:`, errorMsg);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(70));
    if (DRY_RUN) {
      console.log('🔍 DRY RUN RESULTS:');
      console.log(`   Would create: ${successCount} filler leads`);
      console.log(`   Potential errors: ${errorCount} leads`);
    } else {
      console.log(`✅ Successfully created: ${successCount} filler leads`);
      console.log(`⏭️  Skipped (duplicates): ${skipCount} leads`);
      console.log(`❌ Errors: ${errorCount} leads`);
    }
    console.log(`📈 Total FTD leads processed: ${ftdLeads.length}`);
    console.log('='.repeat(70) + '\n');

    if (errors.length > 0 && !DRY_RUN) {
      console.log('❌ ERRORS ENCOUNTERED:');
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
      console.log('');
    }

    // Show final counts
    if (!DRY_RUN) {
      const totalFTDs = await Lead.countDocuments({ leadType: 'ftd' });
      const totalFillers = await Lead.countDocuments({ leadType: 'filler' });
      console.log('📊 FINAL DATABASE STATE:');
      console.log(`   FTD leads: ${totalFTDs}`);
      console.log(`   Filler leads: ${totalFillers} (was ${currentFillers}, added ${totalFillers - currentFillers})`);
      console.log('');
    } else {
      console.log('💡 To execute this conversion, run:');
      console.log('   node convert-ftds-to-fillers.js --execute');
      if (LIMIT) {
        console.log(`   (with limit: node convert-ftds-to-fillers.js --execute --limit=${LIMIT})`);
      }
      console.log('');
    }

    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    console.log('✅ Script completed successfully!\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Run the script
console.log('\n' + '='.repeat(60));
console.log('🚀 FTD to Filler Conversion Script');
console.log('='.repeat(60) + '\n');

convertFTDsToFillers();

