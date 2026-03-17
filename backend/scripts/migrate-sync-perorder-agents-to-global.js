/**
 * Migration: Sync per-order agent assignments back to global lead.assignedAgent
 *
 * After reverting from per-order to global agent assignment, some leads may have
 * agents assigned only in order leadsMetadata (via assignedAgentOverridden=true)
 * but not in the global lead.assignedAgent field.
 *
 * This script finds all such leads and syncs the most recent per-order assignment
 * back to the global lead.assignedAgent field.
 *
 * Only updates FTD and Filler leads (cold leads should not have agents).
 *
 * Usage: node scripts/migrate-sync-perorder-agents-to-global.js [--dry-run]
 */

require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const Order = require("../models/Order");
const Lead = require("../models/Lead");
const User = require("../models/User");

const isDryRun = process.argv.includes("--dry-run");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("Connected to MongoDB");
  if (isDryRun) console.log("*** DRY RUN - no changes will be made ***");
  console.log();

  // Find all orders that have per-order agent overrides
  const orders = await Order.find({
    "leadsMetadata.assignedAgentOverridden": true,
  })
    .select("_id leadsMetadata createdAt orderName")
    .sort({ createdAt: -1 })
    .lean();

  console.log(`Found ${orders.length} orders with per-order agent overrides:\n`);
  for (const order of orders) {
    const overriddenCount = order.leadsMetadata.filter(m => m.assignedAgentOverridden).length;
    console.log(`  Order ${order._id} (${order.orderName || "unnamed"}) - ${overriddenCount} overridden lead(s)`);
  }
  console.log();

  // Build a map: leadId -> { agentId, assignedAt, orderId, orderName } (most recent wins)
  const leadAgentMap = new Map();

  for (const order of orders) {
    for (const meta of order.leadsMetadata) {
      if (meta.assignedAgentOverridden && meta.assignedAgent) {
        const leadId = meta.leadId.toString();
        const existing = leadAgentMap.get(leadId);
        const metaDate = meta.assignedAgentAt || order.createdAt;

        if (!existing || metaDate > existing.assignedAt) {
          leadAgentMap.set(leadId, {
            agentId: meta.assignedAgent,
            assignedAt: metaDate,
            orderId: order._id,
            orderName: order.orderName || "unnamed",
          });
        }
      }
    }
  }

  console.log(`Found ${leadAgentMap.size} leads with per-order agent assignments\n`);

  // Pre-fetch agent names for display
  const agentIds = [...new Set([...leadAgentMap.values()].map(a => a.agentId.toString()))];
  const agents = await User.find({ _id: { $in: agentIds } }).select("fullName fourDigitCode").lean();
  const agentNameMap = new Map(agents.map(a => [a._id.toString(), `${a.fullName} (${a.fourDigitCode || "no code"})`]));

  let updated = 0;
  let skippedAlreadyAssigned = 0;
  let skippedCold = 0;
  let skippedNotFound = 0;
  const conflicts = [];

  console.log("--- Lead Details ---\n");

  for (const [leadId, assignment] of leadAgentMap) {
    const lead = await Lead.findById(leadId)
      .select("assignedAgent leadType firstName lastName newEmail")
      .populate("assignedAgent", "fullName fourDigitCode");

    const perOrderAgentName = agentNameMap.get(assignment.agentId.toString()) || assignment.agentId;

    if (!lead) {
      console.log(`  [NOT FOUND] Lead ${leadId} -> per-order agent: ${perOrderAgentName} (from order ${assignment.orderName})`);
      skippedNotFound++;
      continue;
    }

    const leadLabel = `${lead.firstName} ${lead.lastName} (${lead.newEmail || "no email"}) [${lead.leadType}]`;

    // Skip cold leads - they should not have agents
    if (lead.leadType !== "ftd" && lead.leadType !== "filler") {
      console.log(`  [SKIP COLD] ${leadLabel} -> per-order agent: ${perOrderAgentName}`);
      skippedCold++;
      continue;
    }

    // Lead already has a global agent
    if (lead.assignedAgent) {
      const globalAgentName = `${lead.assignedAgent.fullName} (${lead.assignedAgent.fourDigitCode || "no code"})`;
      const isSame = lead.assignedAgent._id.toString() === assignment.agentId.toString();
      if (isSame) {
        console.log(`  [ALREADY OK] ${leadLabel} -> global agent matches per-order: ${globalAgentName}`);
      } else {
        console.log(`  [CONFLICT] ${leadLabel}`);
        console.log(`      Global agent:    ${globalAgentName}`);
        console.log(`      Per-order agent: ${perOrderAgentName} (from order ${assignment.orderName})`);
        console.log(`      -> Keeping global agent (no change)`);
        conflicts.push({ leadLabel, globalAgent: globalAgentName, perOrderAgent: perOrderAgentName, orderName: assignment.orderName });
      }
      skippedAlreadyAssigned++;
      continue;
    }

    // No global agent - will update
    console.log(`  [UPDATE] ${leadLabel} -> assigning agent: ${perOrderAgentName} (from order ${assignment.orderName})`);

    if (!isDryRun) {
      lead.assignedAgent = assignment.agentId;
      lead.assignedAgentAt = assignment.assignedAt;
      await lead.save();
    }
    updated++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Leads updated: ${updated}`);
  console.log(`  Skipped (already has global agent): ${skippedAlreadyAssigned}`);
  if (conflicts.length > 0) {
    console.log(`    of which ${conflicts.length} had CONFLICTING per-order agent (kept global)`);
  }
  console.log(`  Skipped (cold lead): ${skippedCold}`);
  console.log(`  Skipped (lead not found): ${skippedNotFound}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
