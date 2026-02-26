/**
 * One-time script to fix wrongly-linked deposit confirmations.
 *
 * Problem: AM selected wrong CDR calls when confirming deposits:
 *   - Jared Tyler Storimans got David Morrison's call (14377576727)
 *   - Michiel Vogel may also be incorrectly linked
 *
 * What it does for each affected lead:
 *   1. Reverses AM expense (bonus + talking time) from AffiliateManagerTable
 *   2. Soft-deletes the auto-created deposit AgentCallDeclaration
 *   3. Resets depositConfirmed in Order.leadsMetadata
 *   4. Resets the DepositCall record (depositConfirmed, depositCallDeclaration)
 *
 * Usage:
 *   node scripts/fix-wrong-deposit-declarations.js              # Execute fix
 *   node scripts/fix-wrong-deposit-declarations.js --dry-run    # Preview only
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const AgentCallDeclaration = require("../models/AgentCallDeclaration");
const AffiliateManagerTable = require("../models/AffiliateManagerTable");
const DepositCall = require("../models/DepositCall");
const Order = require("../models/Order");

const dryRun = process.argv.includes("--dry-run");

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

// The two affected lead+order combinations
const FIXES = [
  {
    label: "Jared Tyler Storimans",
    leadId: "6995b00505c3de3bf63f5b07",
    orderId: "6995b1e605c3de3bf63f71ac",
    declarationId: "69a00d6e2276c2444bea2689",
    depositCallId: "69a00d6e2276c2444bea2685",
  },
  {
    label: "Michiel Vogel",
    leadId: "6995e4117c36eba93ade7bbb",
    orderId: "69970c5ce6c01472c8af4349",
    declarationId: "69a00e7c2276c2444bea4f33",
    depositCallId: "69a00e7c2276c2444bea4f2f",
  },
];

/**
 * Reverse AM table expense for a declaration
 */
const reverseAMExpense = async (declaration) => {
  const { affiliateManager, callType, callCategory, callDuration, totalBonus, declarationMonth, declarationYear } = declaration;

  if (callCategory === "filler" || totalBonus === 0) {
    console.log("    Skipping expense reversal (filler or $0 bonus)");
    return;
  }

  const rowId = CALL_TYPE_TO_TABLE_ROW[callType];
  if (!rowId) {
    console.log(`    No table row mapping for callType: ${callType}`);
    return;
  }

  const startOfMonth = new Date(declarationYear, declarationMonth - 1, 1);
  const endOfMonth = new Date(declarationYear, declarationMonth, 0);

  const table = await AffiliateManagerTable.findOne({
    affiliateManager,
    period: "monthly",
    date: { $gte: startOfMonth, $lte: endOfMonth },
    isActive: true,
  });

  if (!table) {
    console.log(`    AM table not found for ${declarationMonth}/${declarationYear}`);
    return;
  }

  // Reverse bonus
  const rowIndex = table.tableData.findIndex((row) => row.id === rowId);
  if (rowIndex !== -1) {
    const oldValue = table.tableData[rowIndex].value || 0;
    const newValue = Math.max(0, oldValue - totalBonus);
    console.log(`    AM Table row "${rowId}": $${oldValue.toFixed(2)} -> $${newValue.toFixed(2)} (-$${totalBonus.toFixed(2)})`);
    if (!dryRun) {
      table.tableData[rowIndex].value = newValue;
    }
  }

  // Reverse talking time
  if (callDuration > 0) {
    const ttIndex = table.tableData.findIndex((row) => row.id === "total_talking_time");
    if (ttIndex !== -1) {
      const hoursToSubtract = callDuration / 3600;
      const oldTT = table.tableData[ttIndex].value || 0;
      const newTT = Math.max(0, Math.round((oldTT - hoursToSubtract) * 100) / 100);
      console.log(`    AM Table row "total_talking_time": ${oldTT.toFixed(2)}h -> ${newTT.toFixed(2)}h (-${hoursToSubtract.toFixed(2)}h)`);
      if (!dryRun) {
        table.tableData[ttIndex].value = newTT;
      }
    }
  }

  if (!dryRun) {
    await table.save();
  }
};

async function fixWrongDeclarations() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected\n");

    if (dryRun) {
      console.log("=== DRY RUN MODE - No changes will be made ===\n");
    }

    for (const fix of FIXES) {
      console.log(`\n========================================`);
      console.log(`Processing: ${fix.label}`);
      console.log(`  Lead: ${fix.leadId}`);
      console.log(`  Order: ${fix.orderId}`);
      console.log(`========================================`);

      // 1. Find and reverse the declaration
      const declaration = await AgentCallDeclaration.findById(fix.declarationId);
      if (!declaration) {
        console.log(`  WARNING: Declaration ${fix.declarationId} not found, skipping`);
        continue;
      }
      if (!declaration.isActive) {
        console.log(`  Declaration already inactive, skipping expense reversal`);
      } else {
        console.log(`\n  Step 1: Reversing AM expense...`);
        console.log(`    Declaration: ${declaration._id} (${declaration.callType}, $${declaration.totalBonus}, ${declaration.callDuration}s)`);
        await reverseAMExpense(declaration);

        console.log(`\n  Step 2: Soft-deleting declaration...`);
        if (!dryRun) {
          declaration.isActive = false;
          await declaration.save();
        }
        console.log(`    Declaration ${declaration._id}: isActive -> false`);
      }

      // 3. Reset order leadsMetadata
      console.log(`\n  Step 3: Resetting order leadsMetadata...`);
      const order = await Order.findById(fix.orderId);
      if (!order) {
        console.log(`    WARNING: Order ${fix.orderId} not found`);
      } else {
        const metaIndex = order.leadsMetadata.findIndex(
          (m) => m.leadId.toString() === fix.leadId
        );
        if (metaIndex === -1) {
          console.log(`    WARNING: Lead ${fix.leadId} not found in order metadata`);
        } else {
          const meta = order.leadsMetadata[metaIndex];
          console.log(`    Current: depositConfirmed=${meta.depositConfirmed}, confirmedAt=${meta.depositConfirmedAt}`);
          if (!dryRun) {
            order.leadsMetadata[metaIndex].depositConfirmed = false;
            order.leadsMetadata[metaIndex].depositConfirmedBy = null;
            order.leadsMetadata[metaIndex].depositConfirmedAt = null;
            order.leadsMetadata[metaIndex].depositPSP = null;
            order.leadsMetadata[metaIndex].depositCardIssuer = null;
            await order.save();
          }
          console.log(`    Reset: depositConfirmed=false, cleared all confirmation fields`);
        }
      }

      // 4. Reset DepositCall record
      console.log(`\n  Step 4: Resetting DepositCall record...`);
      const depositCall = await DepositCall.findById(fix.depositCallId);
      if (!depositCall) {
        console.log(`    WARNING: DepositCall ${fix.depositCallId} not found`);
      } else {
        console.log(`    Current: depositConfirmed=${depositCall.depositConfirmed}, declaration=${depositCall.depositCallDeclaration}`);
        if (!dryRun) {
          depositCall.depositConfirmed = false;
          depositCall.depositConfirmedBy = null;
          depositCall.depositConfirmedAt = null;
          depositCall.depositCallDeclaration = null;
          await depositCall.save();
        }
        console.log(`    Reset: depositConfirmed=false, cleared depositCallDeclaration`);
      }

      console.log(`\n  Done: ${fix.label}`);
    }

    console.log("\n\n=== SUMMARY ===");
    console.log(`Processed ${FIXES.length} leads`);
    if (dryRun) {
      console.log("(DRY RUN - no changes were made)");
    } else {
      console.log("All deposit confirmations reset. AM can now re-confirm with correct calls.");
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

fixWrongDeclarations();
