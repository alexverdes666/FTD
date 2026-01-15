/**
 * Script to fetch all distinct countries from the leads database
 *
 * Run with: node backend/scripts/get-distinct-countries.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

async function getDistinctCountries() {
  try {
    console.log('=== Fetching Distinct Countries from Leads ===\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database\n');

    // Get distinct countries
    const countries = await Lead.distinct('country');

    // Sort alphabetically
    countries.sort((a, b) => a.localeCompare(b));

    console.log(`Found ${countries.length} distinct countries:\n`);

    countries.forEach((country, index) => {
      console.log(`  ${index + 1}. ${country}`);
    });

    console.log('\n--- Country Count by Lead Type ---\n');

    // Get count per country with lead type breakdown
    const countryStats = await Lead.aggregate([
      {
        $group: {
          _id: { country: '$country', leadType: '$leadType' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.country',
          total: { $sum: '$count' },
          types: {
            $push: {
              type: '$_id.leadType',
              count: '$count'
            }
          }
        }
      },
      { $sort: { total: -1 } }
    ]);

    console.log('Country'.padEnd(30) + 'Total'.padEnd(10) + 'FTD'.padEnd(10) + 'Filler'.padEnd(10) + 'Cold');
    console.log('-'.repeat(70));

    countryStats.forEach(stat => {
      const ftd = stat.types.find(t => t.type === 'ftd')?.count || 0;
      const filler = stat.types.find(t => t.type === 'filler')?.count || 0;
      const cold = stat.types.find(t => t.type === 'cold')?.count || 0;

      console.log(
        stat._id.padEnd(30) +
        stat.total.toString().padEnd(10) +
        ftd.toString().padEnd(10) +
        filler.toString().padEnd(10) +
        cold.toString()
      );
    });

    console.log('-'.repeat(70));
    const totalLeads = countryStats.reduce((sum, s) => sum + s.total, 0);
    console.log(`\nTotal leads: ${totalLeads}`);

  } catch (error) {
    console.error('Error fetching countries:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
getDistinctCountries()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
