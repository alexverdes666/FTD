/**
 * Migration: Backfill leadsMetadata.assignedAgent for existing orders
 *
 * For each order, looks at each lead in leadsMetadata that doesn't have
 * an assignedAgent set, and snapshots the lead's current global assignedAgent.
 * This ensures existing orders are protected from future agent reassignments.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const Order = require("../models/Order");
const Lead = require("../models/Lead");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("Connected to MongoDB\n");

  // Find all orders that have leadsMetadata entries without assignedAgent
  const orders = await Order.find({
    leadsMetadata: { $exists: true, $not: { $size: 0 } },
  }).select("_id leadsMetadata");

  console.log(`Found ${orders.length} orders with leadsMetadata to check\n`);

  let updatedOrders = 0;
  let updatedEntries = 0;
  let skippedEntries = 0;

  for (const order of orders) {
    let needsSave = false;

    // Collect leadIds that need backfilling
    const leadsToFetch = [];
    for (const meta of order.leadsMetadata) {
      if (!meta.assignedAgent) {
        leadsToFetch.push(meta.leadId);
      }
    }

    if (leadsToFetch.length === 0) {
      continue;
    }

    // Fetch all leads at once
    const leads = await Lead.find(
      { _id: { $in: leadsToFetch } },
      "assignedAgent assignedAgentAt"
    ).lean();

    const leadMap = new Map();
    for (const lead of leads) {
      leadMap.set(lead._id.toString(), lead);
    }

    for (const meta of order.leadsMetadata) {
      if (!meta.assignedAgent) {
        const lead = leadMap.get(meta.leadId.toString());
        if (lead && lead.assignedAgent) {
          meta.assignedAgent = lead.assignedAgent;
          meta.assignedAgentAt = lead.assignedAgentAt || null;
          needsSave = true;
          updatedEntries++;
        } else {
          skippedEntries++;
        }
      }
    }

    if (needsSave) {
      await order.save();
      updatedOrders++;
    }
  }

  console.log(`Done!`);
  console.log(`  Orders updated: ${updatedOrders}`);
  console.log(`  LeadsMetadata entries backfilled: ${updatedEntries}`);
  console.log(`  Entries skipped (lead not found or no agent): ${skippedEntries}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
