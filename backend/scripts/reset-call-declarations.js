/**
 * Script to reset all call declarations (soft-delete).
 *
 * What it does:
 *   1. Reverses agent bonus expenses from AffiliateManagerTable rows
 *      (subtracts the totalBonus that was added when declarations were approved)
 *   2. Resets DepositCall call slots that were marked "completed" via declaration approval
 *      (sets them back to "pending" and clears approval fields)
 *   3. Soft-deletes ALL AgentCallDeclarations (isActive = false)
 *      so agents can re-declare 1st, 2nd, 3rd calls etc. from scratch
 *
 * Usage:
 *   node scripts/reset-call-declarations.js                        # Reset ALL declarations
 *   node scripts/reset-call-declarations.js --month=2 --year=2026  # Reset specific month
 *   node scripts/reset-call-declarations.js --dry-run              # Preview without changes
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const AgentCallDeclaration = require("../models/AgentCallDeclaration");
const AffiliateManagerTable = require("../models/AffiliateManagerTable");
const DepositCall = require("../models/DepositCall");
const Lead = require("../models/Lead");

// Parse command-line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : null;
};
const dryRun = args.includes("--dry-run");
const monthArg = getArg("month");
const yearArg = getArg("year");

// Map call types to call slot numbers on DepositCall model
const CALL_TYPE_TO_CALL_NUMBER = {
  first_call: 1,
  second_call: 2,
  third_call: 3,
  fourth_call: 4,
  fifth_call: 5,
  sixth_call: 6,
  seventh_call: 7,
  eighth_call: 8,
  ninth_call: 9,
  tenth_call: 10,
};

// Map call types to affiliate manager table row IDs
const CALL_TYPE_TO_TABLE_ROW = {
  deposit: "deposit_calls",
  first_call: "first_am_call",
  second_call: "second_am_call",
  third_call: "third_am_call",
  fourth_call: "fourth_am_call",
  fifth_call: "fifth_am_call",
  sixth_call: "sixth_am_call",
  seventh_call: "seventh_am_call",
  eighth_call: "eighth_am_call",
  ninth_call: "ninth_am_call",
  tenth_call: "tenth_am_call",
};

/**
 * Find a DepositCall record for a lead (by leadId, then email fallback)
 */
const findDepositCallForLead = async (leadId) => {
  let depositCall = await DepositCall.findOne({ leadId });
  if (depositCall) return depositCall;

  const lead = await Lead.findById(leadId).select("newEmail");
  if (lead && lead.newEmail) {
    depositCall = await DepositCall.findOne({ ftdEmail: lead.newEmail });
  }
  return depositCall;
};

/**
 * Reverse the AM table expense that was added when a declaration was approved
 */
const reverseAMTableExpense = async (declaration) => {
  const { affiliateManager, callType, callCategory, totalBonus, declarationMonth, declarationYear } = declaration;

  // Skip filler calls and $0 bonuses (nothing was added)
  if (callCategory === "filler" || totalBonus === 0) {
    return false;
  }

  const rowId = CALL_TYPE_TO_TABLE_ROW[callType];
  if (!rowId) return false;

  // Find the AM table for this period
  const tableDate = new Date(declarationYear, declarationMonth - 1, 1);
  const startOfMonth = new Date(declarationYear, declarationMonth - 1, 1);
  const endOfMonth = new Date(declarationYear, declarationMonth, 0);

  const table = await AffiliateManagerTable.findOne({
    affiliateManager,
    period: "monthly",
    date: { $gte: startOfMonth, $lte: endOfMonth },
    isActive: true,
  });

  if (!table) return false;

  const rowIndex = table.tableData.findIndex((row) => row.id === rowId);
  if (rowIndex === -1) return false;

  const oldValue = table.tableData[rowIndex].value || 0;
  const newValue = Math.max(0, oldValue - totalBonus); // Don't go below 0

  if (!dryRun) {
    table.tableData[rowIndex].value = newValue;
    await table.save();
  }

  console.log(
    `  AM Table [${affiliateManager}] row "${rowId}": $${oldValue.toFixed(2)} -> $${newValue.toFixed(2)} (-$${totalBonus.toFixed(2)})`
  );
  return true;
};

/**
 * Reset the DepositCall call slot that was updated when a declaration was approved
 */
const reverseDepositCallUpdate = async (declaration) => {
  const { lead, callType, callCategory } = declaration;

  // Skip filler calls and deposit type
  if (callCategory === "filler" || callType === "deposit") {
    return false;
  }

  const callNumber = CALL_TYPE_TO_CALL_NUMBER[callType];
  if (!callNumber) return false;

  const depositCall = await findDepositCallForLead(lead);
  if (!depositCall) return false;

  const callField = `call${callNumber}`;
  const currentStatus = depositCall[callField].status;

  // Only reset if it was set to "completed" by the approval process
  if (currentStatus !== "completed") return false;

  if (!dryRun) {
    depositCall[callField].status = "pending";
    depositCall[callField].doneDate = null;
    depositCall[callField].approvedBy = null;
    depositCall[callField].approvedAt = null;
    await depositCall.save();
  }

  console.log(
    `  DepositCall [${depositCall._id}] call${callNumber}: completed -> pending`
  );
  return true;
};

async function resetCallDeclarations() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    if (dryRun) {
      console.log("=== DRY RUN MODE - No changes will be made ===\n");
    }

    // Build query for declarations to reset (all active, regardless of status)
    const query = { isActive: true };

    if (monthArg && yearArg) {
      query.declarationMonth = parseInt(monthArg);
      query.declarationYear = parseInt(yearArg);
      console.log(`Filtering: month=${monthArg}, year=${yearArg}\n`);
    } else {
      console.log("Resetting ALL call declarations (no month/year filter)\n");
    }

    // Find all declarations that need resetting
    const declarations = await AgentCallDeclaration.find(query)
      .populate("agent", "fullName email fourDigitCode")
      .populate("affiliateManager", "fullName email")
      .populate("lead", "firstName lastName newEmail")
      .sort({ createdAt: -1 });

    if (declarations.length === 0) {
      console.log("No declarations found to reset.");
      return;
    }

    const approved = declarations.filter((d) => d.status === "approved");
    const pending = declarations.filter((d) => d.status === "pending");

    console.log(`Found ${declarations.length} declarations to reset:`);
    console.log(`  - ${approved.length} approved (will reverse expenses + deposit calls)`);
    console.log(`  - ${pending.length} pending (will clear review fields)\n`);

    // === Step 1: Reverse expenses for approved declarations ===
    console.log("--- Step 1: Reversing AM table expenses ---");
    let amReversed = 0;
    for (const decl of approved) {
      const agentName = decl.agent?.fullName || "Unknown";
      const amName = decl.affiliateManager?.fullName || "Unknown";
      const leadName = decl.lead ? `${decl.lead.firstName} ${decl.lead.lastName}` : "Unknown";

      console.log(
        `\n[${decl.callCategory}/${decl.callType || "N/A"}] Agent: ${agentName} | AM: ${amName} | Lead: ${leadName} | Bonus: $${decl.totalBonus}`
      );

      const reversed = await reverseAMTableExpense(decl);
      if (reversed) amReversed++;
    }
    console.log(`\nAM table expenses reversed: ${amReversed}/${approved.length}\n`);

    // === Step 2: Reset DepositCall slots for approved declarations ===
    console.log("--- Step 2: Resetting DepositCall slots ---");
    let dcReversed = 0;
    for (const decl of approved) {
      const reversed = await reverseDepositCallUpdate(decl);
      if (reversed) dcReversed++;
    }
    console.log(`\nDepositCall slots reset: ${dcReversed}/${approved.length}\n`);

    // === Step 3: Soft-delete all declarations (isActive = false) ===
    console.log("--- Step 3: Soft-deleting all declarations (isActive = false) ---");
    if (!dryRun) {
      const result = await AgentCallDeclaration.updateMany(
        { _id: { $in: declarations.map((d) => d._id) } },
        { $set: { isActive: false } }
      );
      console.log(`Deactivated ${result.modifiedCount} declarations`);
    } else {
      console.log(`Would deactivate ${declarations.length} declarations`);
    }

    // === Summary ===
    console.log("\n=== RESET SUMMARY ===");
    console.log(`Total declarations processed: ${declarations.length}`);
    console.log(`  Approved (expenses reversed): ${approved.length}`);
    console.log(`  Pending (deactivated): ${pending.length}`);
    console.log(`  AM table rows reversed: ${amReversed}`);
    console.log(`  DepositCall slots reset: ${dcReversed}`);
    if (dryRun) {
      console.log("\n(DRY RUN - no changes were actually made)");
    } else {
      console.log("\nAll declarations soft-deleted. Agents can now re-declare calls from scratch.");
    }
  } catch (error) {
    console.error("Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

resetCallDeclarations();
