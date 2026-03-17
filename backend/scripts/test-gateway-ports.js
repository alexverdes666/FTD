/**
 * Test: Check gateway ports for 188.126.10.151:4065
 * Queries both the database and the live device to see port counts.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB (test_local)\n");

  const GatewayDevice = require("../models/GatewayDevice");
  const GoIPGatewayService = require("../services/goipGatewayService");

  // Find all gateways on this host
  const gateways = await GatewayDevice.find({ host: "188.126.10.151" })
    .sort({ port: 1 })
    .lean();

  console.log(`Found ${gateways.length} gateways on 188.126.10.151\n`);

  for (const gw of gateways) {
    const portCount = gw.portNumbers ? Object.keys(gw.portNumbers).length : 0;
    console.log(`=== ${gw.name} (port ${gw.port}) ===`);
    console.log(`  DB port mappings: ${portCount}`);
    if (portCount > 0) {
      const ports = Object.keys(gw.portNumbers).sort((a, b) => parseInt(a) - parseInt(b));
      console.log(`  Port range: ${ports[0]} - ${ports[ports.length - 1]}`);
    }

    // Try to query the live device
    try {
      const service = GoIPGatewayService.createInstance({
        host: gw.host,
        port: gw.port,
        username: gw.username,
        password: gw.password,
        name: gw.name,
        _id: gw._id,
      });

      const result = await service.getNumbers();
      if (result.success && Array.isArray(result.data)) {
        console.log(`  Live device ports: ${result.data.length}`);
        if (result.data.length > 0) {
          const livePorts = result.data.map(d => d.port).sort((a, b) => a - b);
          console.log(`  Live port range: ${livePorts[0]} - ${livePorts[livePorts.length - 1]}`);
        }
      } else {
        console.log(`  Live device: unexpected response format`);
      }
    } catch (err) {
      console.log(`  Live device: UNREACHABLE (${err.message})`);
    }
    console.log();
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Error:", err);
  mongoose.disconnect();
  process.exit(1);
});
