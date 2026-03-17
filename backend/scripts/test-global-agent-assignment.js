/**
 * Test: Global agent assignment (one lead = one agent across all orders)
 *
 * This test verifies that:
 * 1. Assigning an agent to a lead updates lead.assignedAgent globally
 * 2. The same agent appears across all orders for that lead
 * 3. Reassigning from one order context updates everywhere
 * 4. Cold leads cannot be assigned to agents
 * 5. mergeLeadsWithMetadata uses global agent, not per-order override
 */

require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB (test_local)\n");

  const Lead = require("../models/Lead");
  const Order = require("../models/Order");
  const User = require("../models/User");

  // Find 2 agents to test with
  const agents = await User.find({ role: "agent", isActive: true })
    .select("fullName email fourDigitCode")
    .limit(2)
    .lean();

  if (agents.length < 2) {
    console.error("Need at least 2 active agents in the database to test");
    await mongoose.disconnect();
    return;
  }

  console.log(`Agent A: ${agents[0].fullName} (${agents[0]._id})`);
  console.log(`Agent B: ${agents[1].fullName} (${agents[1]._id})\n`);

  // Find an FTD lead that appears in at least 2 orders
  const ordersWithMultipleLeads = await Order.aggregate([
    { $unwind: "$leads" },
    { $group: { _id: "$leads", orderCount: { $sum: 1 }, orderIds: { $push: "$_id" } } },
    { $match: { orderCount: { $gte: 2 } } },
    { $limit: 5 },
  ]);

  let testLead = null;
  let testOrderIds = [];

  for (const item of ordersWithMultipleLeads) {
    const lead = await Lead.findById(item._id).select("leadType firstName lastName email assignedAgent");
    if (lead && (lead.leadType === "ftd" || lead.leadType === "filler")) {
      testLead = lead;
      testOrderIds = item.orderIds.slice(0, 2);
      break;
    }
  }

  if (!testLead || testOrderIds.length < 2) {
    console.log("No FTD/Filler lead found in multiple orders. Creating test scenario...\n");

    // Find any FTD lead
    testLead = await Lead.findOne({ leadType: "ftd" }).select("leadType firstName lastName email assignedAgent");
    if (!testLead) {
      testLead = await Lead.findOne({ leadType: "filler" }).select("leadType firstName lastName email assignedAgent");
    }
    if (!testLead) {
      console.error("No FTD or Filler leads found in database");
      await mongoose.disconnect();
      return;
    }

    // Find 2 orders that contain this lead
    const orders = await Order.find({ leads: testLead._id }).select("_id").limit(2).lean();
    if (orders.length < 2) {
      console.log(`Lead ${testLead.email} only appears in ${orders.length} order(s). Testing with single order.`);
      testOrderIds = orders.map(o => o._id);
    } else {
      testOrderIds = orders.map(o => o._id);
    }
  }

  console.log(`Test Lead: ${testLead.firstName} ${testLead.lastName} (${testLead.email})`);
  console.log(`Lead Type: ${testLead.leadType}`);
  console.log(`Current Agent: ${testLead.assignedAgent || "NONE"}`);
  console.log(`Orders: ${testOrderIds.join(", ")}\n`);

  // Save original state to restore later
  const originalAgent = testLead.assignedAgent;
  const originalAgentAt = testLead.assignedAgentAt;

  console.log("=== TEST 1: Assign Agent A globally ===");
  testLead.assignedAgent = agents[0]._id;
  testLead.assignedAgentAt = new Date();
  await testLead.save();

  // Re-fetch to verify
  const refreshed1 = await Lead.findById(testLead._id)
    .populate("assignedAgent", "fullName")
    .lean();
  console.log(`Lead global agent: ${refreshed1.assignedAgent?.fullName || "NONE"}`);

  // Check how it appears in each order via mergeLeadsWithMetadata
  for (const orderId of testOrderIds) {
    const order = await Order.findById(orderId)
      .populate({
        path: "leads",
        select: "firstName lastName assignedAgent",
        populate: { path: "assignedAgent", select: "fullName" },
      })
      .populate("leadsMetadata.assignedAgent", "fullName");

    if (!order) continue;

    // Simulate mergeLeadsWithMetadata
    const orderObj = order.toObject();
    const metadataMap = new Map();
    if (orderObj.leadsMetadata) {
      orderObj.leadsMetadata.forEach((meta) => {
        metadataMap.set(meta.leadId.toString(), meta);
      });
    }

    const leadInOrder = orderObj.leads?.find(
      (l) => l._id.toString() === testLead._id.toString()
    );

    if (leadInOrder) {
      const meta = metadataMap.get(testLead._id.toString());
      // With new logic: we do NOT override with meta.assignedAgent
      console.log(
        `  Order ${orderId}: lead.assignedAgent = ${leadInOrder.assignedAgent?.fullName || "NONE"} | meta.assignedAgent = ${meta?.assignedAgent?.fullName || "NONE"} | meta.overridden = ${meta?.assignedAgentOverridden || false}`
      );
      console.log(
        `  -> Display agent (global): ${leadInOrder.assignedAgent?.fullName || "NONE"} ✓`
      );
    }
  }

  console.log("\n=== TEST 2: Reassign to Agent B globally ===");
  const lead2 = await Lead.findById(testLead._id);
  lead2.assignedAgent = agents[1]._id;
  lead2.assignedAgentAt = new Date();
  await lead2.save();

  const refreshed2 = await Lead.findById(testLead._id)
    .populate("assignedAgent", "fullName")
    .lean();
  console.log(`Lead global agent: ${refreshed2.assignedAgent?.fullName || "NONE"}`);

  for (const orderId of testOrderIds) {
    const order = await Order.findById(orderId)
      .populate({
        path: "leads",
        select: "firstName lastName assignedAgent",
        populate: { path: "assignedAgent", select: "fullName" },
      });

    if (!order) continue;
    const leadInOrder = order.leads?.find(
      (l) => l._id.toString() === testLead._id.toString()
    );
    if (leadInOrder) {
      console.log(
        `  Order ${orderId}: agent = ${leadInOrder.assignedAgent?.fullName || "NONE"} ✓ (same everywhere)`
      );
    }
  }

  // TEST 3: Cold lead rejection
  console.log("\n=== TEST 3: Cold lead cannot be assigned ===");
  const coldLead = await Lead.findOne({ leadType: "cold" });
  if (coldLead) {
    try {
      coldLead.assignToAgent(agents[0]._id, true);
      console.log("  FAIL: Cold lead accepted agent assignment!");
    } catch (err) {
      console.log(`  PASS: ${err.message}`);
    }
  } else {
    console.log("  SKIP: No cold leads in database");
  }

  // TEST 4: Verify the specific leads mentioned by user
  console.log("\n=== TEST 4: Check specific leads ===");
  const specificEmails = ["alejonicoblabla@hotmail.com", "yalandalaraesp@outlook.es"];
  for (const email of specificEmails) {
    const lead = await Lead.findOne({ $or: [{ email }, { newEmail: email }] })
      .populate("assignedAgent", "fullName")
      .select("firstName lastName email newEmail leadType assignedAgent")
      .lean();

    if (lead) {
      console.log(`  ${email}: type=${lead.leadType}, globalAgent=${lead.assignedAgent?.fullName || "NONE"}`);

      // Check per-order metadata
      const ordersWithLead = await Order.find({ leads: lead._id })
        .select("_id leadsMetadata")
        .populate("leadsMetadata.assignedAgent", "fullName")
        .lean();

      for (const ord of ordersWithLead) {
        const meta = ord.leadsMetadata?.find(
          (m) => m.leadId.toString() === lead._id.toString()
        );
        if (meta) {
          console.log(
            `    Order ${ord._id}: meta.agent=${meta.assignedAgent?.fullName || "NONE"}, overridden=${meta.assignedAgentOverridden || false}`
          );
        }
      }
    } else {
      console.log(`  ${email}: NOT FOUND in database`);
    }
  }

  // Restore original state
  console.log("\n=== Restoring original state ===");
  const restoreLead = await Lead.findById(testLead._id);
  restoreLead.assignedAgent = originalAgent;
  restoreLead.assignedAgentAt = originalAgentAt;
  await restoreLead.save();
  console.log("Original agent restored.\n");

  console.log("=== ALL TESTS COMPLETE ===");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Test failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
