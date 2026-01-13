const mongoose = require("mongoose");
const DeletedLead = require("../models/DeletedLead");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const DepositCall = require("../models/DepositCall");
const CallChangeRequest = require("../models/CallChangeRequest");
const RefundAssignment = require("../models/RefundAssignment");
const Fingerprint = require("../models/Fingerprint");
const ActivityLog = require("../models/ActivityLog");

require("dotenv").config();

/**
 * Migration script to recover historically deleted leads
 *
 * This script:
 * 1. Finds all orders with leads that no longer exist in the Leads collection
 * 2. Searches for traces of these leads in other collections
 * 3. Creates DeletedLead entries with all available data
 * 4. Marks them with migrationRecovered flag
 */

async function recoverHistoricallyDeletedLeads() {
  try {
    console.log("Starting historical deleted leads recovery...");
    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully!\n");

    // Step 1: Find all orders
    console.log("Step 1: Fetching all orders...");
    const orders = await Order.find({})
      .select("_id leads leadsMetadata createdAt")
      .lean();

    console.log(`Found ${orders.length} orders\n`);

    // Step 2: Collect all lead IDs referenced in orders
    console.log("Step 2: Collecting all lead IDs from orders...");
    const allLeadIdsInOrders = new Set();
    const leadToOrdersMap = new Map(); // Map lead ID to array of orders

    orders.forEach((order) => {
      if (order.leads && order.leads.length > 0) {
        order.leads.forEach((leadId) => {
          const leadIdStr = leadId.toString();
          allLeadIdsInOrders.add(leadIdStr);

          if (!leadToOrdersMap.has(leadIdStr)) {
            leadToOrdersMap.set(leadIdStr, []);
          }
          leadToOrdersMap.get(leadIdStr).push(order);
        });
      }
    });

    console.log(`Found ${allLeadIdsInOrders.size} unique lead IDs referenced in orders\n`);

    // Step 3: Check which leads still exist
    console.log("Step 3: Checking which leads still exist in database...");
    const existingLeadIds = await Lead.find({
      _id: { $in: Array.from(allLeadIdsInOrders) },
    }).distinct("_id");

    const existingLeadIdsSet = new Set(existingLeadIds.map((id) => id.toString()));
    console.log(`${existingLeadIds.length} leads still exist\n`);

    // Step 4: Find missing leads
    const missingLeadIds = Array.from(allLeadIdsInOrders).filter(
      (id) => !existingLeadIdsSet.has(id)
    );

    console.log(`Found ${missingLeadIds.length} MISSING (deleted) leads\n`);

    if (missingLeadIds.length === 0) {
      console.log("No historically deleted leads found. Migration complete!");
      await mongoose.connection.close();
      return;
    }

    // Step 5: Check if we already have these in DeletedLeads
    console.log("Step 5: Checking for existing DeletedLead records...");
    const existingDeletedLeadIds = await DeletedLead.find({
      "searchFields.originalLeadId": { $in: missingLeadIds },
    }).distinct("searchFields.originalLeadId");

    const existingDeletedLeadIdsSet = new Set(
      existingDeletedLeadIds.map((id) => id.toString())
    );

    const leadsToRecover = missingLeadIds.filter(
      (id) => !existingDeletedLeadIdsSet.has(id)
    );

    console.log(
      `${existingDeletedLeadIds.length} already have DeletedLead records`
    );
    console.log(`${leadsToRecover.length} need to be recovered\n`);

    if (leadsToRecover.length === 0) {
      console.log("All missing leads already have DeletedLead records. Migration complete!");
      await mongoose.connection.close();
      return;
    }

    // Step 6: Recover each missing lead
    console.log("Step 6: Recovering missing leads...");
    let recoveredCount = 0;

    for (const leadIdStr of leadsToRecover) {
      try {
        console.log(`\nRecovering lead: ${leadIdStr}`);
        const leadId = new mongoose.Types.ObjectId(leadIdStr);

        // Get orders that used this lead
        const ordersUsingLead = leadToOrdersMap.get(leadIdStr) || [];

        // Extract order references and metadata
        const orderReferences = ordersUsingLead.map((order) => {
          const metadata = order.leadsMetadata?.find(
            (m) => m.leadId && m.leadId.toString() === leadIdStr
          );
          return {
            orderId: order._id,
            orderedAs: metadata?.orderedAs || null,
            orderCreatedAt: order.createdAt,
          };
        });

        console.log(`  - Found in ${orderReferences.length} orders`);

        // Search for traces in other collections
        const [depositCalls, callChangeRequests, refundAssignments, fingerprint, activityLogs] =
          await Promise.all([
            DepositCall.find({ leadId: leadId }).lean(),
            CallChangeRequest.find({ leadId: leadId }).lean(),
            RefundAssignment.find({ leadId: leadId }).lean(),
            Fingerprint.findOne({ leadId: leadId }).lean(),
            ActivityLog.find({
              $or: [
                { "requestBody.id": leadIdStr },
                { "requestBody.leadId": leadIdStr },
                { path: { $regex: `/leads/${leadIdStr}` } },
              ],
            })
              .sort({ timestamp: -1 })
              .limit(10)
              .lean(),
          ]);

        console.log(`  - Traces found:`);
        console.log(`    - Deposit calls: ${depositCalls.length}`);
        console.log(`    - Call change requests: ${callChangeRequests.length}`);
        console.log(`    - Refund assignments: ${refundAssignments.length}`);
        console.log(`    - Fingerprints: ${fingerprint ? 1 : 0}`);
        console.log(`    - Activity logs: ${activityLogs.length}`);

        // Try to extract basic info from deposit calls (has denormalized data)
        let basicLeadData = {
          _id: leadId,
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          leadType: orderReferences[0]?.orderedAs || "unknown",
          country: "",
        };

        if (depositCalls.length > 0) {
          const dc = depositCalls[0];
          basicLeadData.firstName = dc.ftdName?.split(" ")[0] || "";
          basicLeadData.lastName = dc.ftdName?.split(" ").slice(1).join(" ") || "";
          basicLeadData.email = dc.ftdEmail || "";
          basicLeadData.phone = dc.ftdPhone || "";
        }

        // Check activity logs for deletion info
        let deletedBy = null;
        let deletedAt = null;
        let deletionReason = "Historical deletion - recovered during migration";

        const deletionLog = activityLogs.find((log) => log.method === "DELETE");
        if (deletionLog) {
          deletedBy = deletionLog.user;
          deletedAt = deletionLog.timestamp;
          deletionReason = `Deleted ${deletionLog.timestamp.toISOString()} - recovered from logs`;
          console.log(`  - Found deletion log from ${deletionLog.timestamp}`);
        }

        // Create DeletedLead entry
        const deletedLead = await DeletedLead.create({
          leadData: basicLeadData,
          deletedBy: deletedBy,
          deletedAt: deletedAt || new Date("2025-01-01"), // Default if unknown
          deletionReason: deletionReason,
          deletionType: "single",
          orderReferences: orderReferences,
          traces: {
            depositCalls: depositCalls || [],
            callChangeRequests: callChangeRequests || [],
            refundAssignments: refundAssignments || [],
            fingerprints: fingerprint ? [fingerprint] : [],
            clientBrokerAssignments: [],
          },
          searchFields: {
            email: basicLeadData.email,
            phone: basicLeadData.phone,
            firstName: basicLeadData.firstName,
            lastName: basicLeadData.lastName,
            originalLeadId: leadId,
          },
          migrationRecovered: true,
        });

        console.log(`  ✓ Created DeletedLead entry: ${deletedLead._id}`);
        recoveredCount++;
      } catch (error) {
        console.error(`  ✗ Error recovering lead ${leadIdStr}:`, error.message);
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Migration Complete!`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Total missing leads: ${missingLeadIds.length}`);
    console.log(`Already had DeletedLead records: ${existingDeletedLeadIds.length}`);
    console.log(`Successfully recovered: ${recoveredCount}`);
    console.log(`Failed: ${leadsToRecover.length - recoveredCount}`);
    console.log(`${"=".repeat(60)}\n`);

    await mongoose.connection.close();
    console.log("Database connection closed.");
  } catch (error) {
    console.error("Migration error:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the migration
recoverHistoricallyDeletedLeads();
