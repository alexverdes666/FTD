/**
 * Fix Gateway Names Script
 * 
 * This script fixes incorrect gateway names in the database
 * Specifically:
 * - Renames "gsm32-2" at port 4064 to "gsm32-4"
 * - Renames "gsm32-2-4066" at port 4066 to "gsm32-2"
 * 
 * Usage: node scripts/fix-gateway-names.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const GatewayDevice = require('../models/GatewayDevice');

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

async function fixGatewayNames() {
  try {
    console.log('\n🔧 Fixing Gateway Names');
    console.log('================================\n');

    // List current gateways
    console.log('Current gateways:');
    const currentGateways = await GatewayDevice.find().sort({ port: 1 });
    currentGateways.forEach(gw => {
      console.log(`  - ${gw.name} (${gw.host}:${gw.port})`);
    });
    console.log('');

    let fixedCount = 0;

    // Fix 1: Rename gateway at port 4064 from "gsm32-2" to "gsm32-4"
    const gateway4064 = await GatewayDevice.findOne({ 
      host: '188.126.10.151', 
      port: 4064 
    });
    
    if (gateway4064) {
      if (gateway4064.name !== 'gsm32-4') {
        console.log(`🔄 Renaming "${gateway4064.name}" at port 4064 to "gsm32-4"`);
        gateway4064.name = 'gsm32-4';
        await gateway4064.save();
        fixedCount++;
      } else {
        console.log(`✅ Gateway at port 4064 already has correct name: "gsm32-4"`);
      }
    } else {
      console.log(`⚠️  No gateway found at port 4064`);
    }

    // Fix 2: Rename gateway at port 4066 from "gsm32-2-4066" to "gsm32-2"
    const gateway4066 = await GatewayDevice.findOne({ 
      host: '188.126.10.151', 
      port: 4066 
    });
    
    if (gateway4066) {
      if (gateway4066.name !== 'gsm32-2') {
        console.log(`🔄 Renaming "${gateway4066.name}" at port 4066 to "gsm32-2"`);
        gateway4066.name = 'gsm32-2';
        await gateway4066.save();
        fixedCount++;
      } else {
        console.log(`✅ Gateway at port 4066 already has correct name: "gsm32-2"`);
      }
    } else {
      console.log(`⚠️  No gateway found at port 4066`);
    }

    console.log('\n================================');
    console.log(`✅ Fixed ${fixedCount} gateway name(s)`);
    console.log('================================\n');

    // List updated gateways
    console.log('Updated gateways:');
    const updatedGateways = await GatewayDevice.find().sort({ port: 1 });
    updatedGateways.forEach(gw => {
      console.log(`  ✅ ${gw.name} (${gw.host}:${gw.port})`);
    });

    console.log('\n✅ Gateway names fixed successfully!\n');

  } catch (error) {
    console.error('❌ Error fixing gateway names:', error);
    process.exit(1);
  }
}

async function main() {
  await connectDB();
  await fixGatewayNames();
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
  process.exit(0);
}

main();

