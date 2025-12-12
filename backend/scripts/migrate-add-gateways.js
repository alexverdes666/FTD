/**
 * Migration Script: Add Multiple Gateway Devices
 * 
 * This script adds multiple GOIP gateway devices to the database.
 * Run this script once to populate your gateway devices.
 * 
 * Usage: node scripts/migrate-add-gateways.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const GatewayDevice = require('../models/GatewayDevice');
const User = require('../models/User');

// Gateway configurations to add
const GATEWAYS_TO_ADD = [
  {
    name: 'gsm32-4',
    host: '188.126.10.151',
    port: 4064,
    username: 'root',
    password: 'Aa123456',
    description: 'Primary gateway device (port 4064) - configured in env variables'
  },
  {
    name: 'gsm',
    host: '188.126.10.151',
    port: 4061,
    username: 'root',
    password: 'Greedisgood10!',
    description: 'Gateway device on port 4061'
  },
  {
    name: 'gsm32',
    host: '188.126.10.151',
    port: 4062,
    username: 'root',
    password: 'Greedisgood10!',
    description: 'Gateway device on port 4062'
  },
  {
    name: 'gsm32-1',
    host: '188.126.10.151',
    port: 4063,
    username: 'root',
    password: 'Aa123456',
    description: 'Gateway device on port 4063'
  },
  {
    name: 'gsm32-3',
    host: '188.126.10.151',
    port: 4065,
    username: 'root',
    password: 'Aa123456',
    description: 'Gateway device on port 4065'
  },
  {
    name: 'gsm32-2',
    host: '188.126.10.151',
    port: 4066,
    username: 'root',
    password: 'Aa123456',
    description: 'Gateway device on port 4066'
  }
];

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function migrateGateways() {
  try {
    console.log('\n🔧 Gateway Devices Migration');
    console.log('================================\n');

    // Find an admin user to set as creator
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`📝 Using admin user: ${adminUser.email}\n`);

    let addedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    for (const gatewayConfig of GATEWAYS_TO_ADD) {
      // Check if gateway already exists by host:port
      const existing = await GatewayDevice.findOne({
        host: gatewayConfig.host,
        port: gatewayConfig.port
      });

      if (existing) {
        console.log(`⏭️  Skipping: ${gatewayConfig.name} (${gatewayConfig.host}:${gatewayConfig.port}) - Already exists`);
        skippedCount++;
        continue;
      }

      // Check if name is already taken
      const existingName = await GatewayDevice.findOne({
        name: gatewayConfig.name
      });

      if (existingName) {
        console.log(`⚠️  Name conflict: ${gatewayConfig.name} - Updating with unique name`);
        gatewayConfig.name = `${gatewayConfig.name}-${gatewayConfig.port}`;
      }

      // Create new gateway
      const gateway = await GatewayDevice.create({
        ...gatewayConfig,
        isActive: true,
        createdBy: adminUser._id,
        lastModifiedBy: adminUser._id
      });

      console.log(`✅ Added: ${gateway.name} (${gateway.host}:${gateway.port})`);
      addedCount++;
    }

    console.log('\n================================');
    console.log('Migration Summary:');
    console.log(`  ✅ Added: ${addedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  📊 Total gateways in database: ${await GatewayDevice.countDocuments()}`);
    console.log('================================\n');

    // List all gateways
    console.log('Current Gateway Devices:');
    const allGateways = await GatewayDevice.find().sort({ name: 1 });
    allGateways.forEach((gw, index) => {
      console.log(`  ${index + 1}. ${gw.name} - ${gw.host}:${gw.port} [${gw.isActive ? 'Active' : 'Inactive'}]`);
    });

    console.log('\n✅ Migration completed successfully!\n');

    // Recommend next steps
    console.log('Next steps:');
    console.log('1. Test gateway connections in the Gateway Management UI');
    console.log('2. Configure status notifications for each gateway');
    console.log('3. Assign gateways to your SIM cards\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

async function main() {
  await connectDB();
  await migrateGateways();
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
  process.exit(0);
}

main();

