/**
 * Test: Save and read 32 ports on a gateway device
 */
require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB (test_local)\n");

  const GatewayDevice = require("../models/GatewayDevice");

  // Find the device at port 4065
  const gw = await GatewayDevice.findOne({ host: "188.126.10.151", port: 4065 });
  if (!gw) {
    console.log("Gateway not found");
    await mongoose.disconnect();
    return;
  }

  console.log(`Gateway: ${gw.name} (${gw.host}:${gw.port})`);
  console.log(`Current portNumbers count: ${gw.portNumbers ? gw.portNumbers.size : 0}\n`);

  // Save original state
  const originalPorts = gw.portNumbers ? new Map(gw.portNumbers) : new Map();

  // Test: Set 32 ports
  console.log("=== TEST: Saving 32 ports ===");
  const testPorts = {};
  for (let i = 1; i <= 32; i++) {
    testPorts[String(i)] = `+3461700${String(i).padStart(4, '0')}`;
  }

  // Simulate what the update controller does
  gw.portNumbers = new Map(Object.entries(testPorts));
  gw.markModified('portNumbers');
  await gw.save();

  // Re-read from DB
  const saved = await GatewayDevice.findById(gw._id);
  const savedPorts = saved.portNumbers ? Object.fromEntries(saved.portNumbers) : {};
  const savedCount = Object.keys(savedPorts).length;
  console.log(`Saved port count: ${savedCount}`);
  console.log(`Port keys: ${Object.keys(savedPorts).sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`);

  if (savedCount === 32) {
    console.log("PASS: All 32 ports saved and retrieved correctly\n");
  } else {
    console.log(`FAIL: Expected 32, got ${savedCount}\n`);
  }

  // Test: Simulate frontend create flow (raw object to Mongoose)
  console.log("=== TEST: Create flow with plain object ===");
  const createData = {
    portNumbers: testPorts, // plain object, not Map
  };
  gw.portNumbers = createData.portNumbers; // How create does it
  await gw.save();

  const saved2 = await GatewayDevice.findById(gw._id);
  const saved2Ports = saved2.portNumbers ? Object.fromEntries(saved2.portNumbers) : {};
  console.log(`Saved port count (create flow): ${Object.keys(saved2Ports).length}`);

  if (Object.keys(saved2Ports).length === 32) {
    console.log("PASS: All 32 ports saved via create flow\n");
  } else {
    console.log(`FAIL: Expected 32, got ${Object.keys(saved2Ports).length}\n`);
  }

  // Test: What the frontend sees (toJSON)
  console.log("=== TEST: JSON serialization ===");
  const jsonGw = saved2.toJSON();
  const jsonPortCount = jsonGw.portNumbers ? Object.keys(jsonGw.portNumbers).length : 0;
  console.log(`JSON port count: ${jsonPortCount}`);

  if (jsonPortCount === 32) {
    console.log("PASS: JSON serialization preserves all 32 ports\n");
  } else {
    console.log(`FAIL: Expected 32, got ${jsonPortCount}\n`);
    console.log("JSON portNumbers:", JSON.stringify(jsonGw.portNumbers));
  }

  // Restore original
  console.log("=== Restoring original state ===");
  gw.portNumbers = originalPorts;
  gw.markModified('portNumbers');
  await gw.save();
  console.log("Done.\n");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Error:", err);
  mongoose.disconnect();
  process.exit(1);
});
