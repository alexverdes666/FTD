/**
 * Complete Lead Assignment Migration Script
 * 
 * This script fixes the lead assignment system by:
 * 1. Removing old fields (isAssigned, assignedTo, assignedAt)
 * 2. Ensuring all leads have assignedAgent field (set to null if not assigned)
 * 3. Ensuring all leads have assignedAgentAt field
 * 4. Verifying the fix
 * 
 * Run this script with: node scripts/fix-lead-assignments-complete.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

async function fixLeadAssignmentsComplete() {
  try {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║     LEAD ASSIGNMENT SYSTEM - COMPLETE FIX SCRIPT          ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const leadsCollection = db.collection("leads");

    // ============================================================
    // STEP 1: Get initial statistics
    // ============================================================
    console.log("📊 STEP 1: Gathering initial statistics...\n");
    
    const totalLeads = await leadsCollection.countDocuments();
    console.log(`   Total leads in database: ${totalLeads}`);

    const withOldFields = await leadsCollection.countDocuments({
      $or: [
        { isAssigned: { $exists: true } },
        { assignedTo: { $exists: true } },
        { assignedAt: { $exists: true } },
      ],
    });
    console.log(`   Leads with old fields: ${withOldFields}`);

    const withAssignedAgent = await leadsCollection.countDocuments({
      assignedAgent: { $ne: null, $exists: true },
    });
    console.log(`   Leads with assignedAgent: ${withAssignedAgent}`);

    const missingAssignedAgent = await leadsCollection.countDocuments({
      assignedAgent: { $exists: false },
    });
    console.log(`   Leads missing assignedAgent field: ${missingAssignedAgent}\n`);

    // ============================================================
    // STEP 2: Remove old assignment fields
    // ============================================================
    console.log("🧹 STEP 2: Removing old assignment fields...\n");

    if (withOldFields > 0) {
      const removeResult = await leadsCollection.updateMany(
        {},
        {
          $unset: {
            isAssigned: "",
            assignedTo: "",
            assignedAt: "",
          },
        }
      );
      console.log(`   ✅ Removed old fields from ${removeResult.modifiedCount} leads\n`);
    } else {
      console.log(`   ℹ️  No old fields found - skipping this step\n`);
    }

    // ============================================================
    // STEP 3: Set assignedAgent to null for leads without it
    // ============================================================
    console.log("🔧 STEP 3: Setting assignedAgent to null for unassigned leads...\n");

    if (missingAssignedAgent > 0) {
      const setNullResult = await leadsCollection.updateMany(
        { assignedAgent: { $exists: false } },
        { 
          $set: { 
            assignedAgent: null,
            assignedAgentAt: null
          } 
        }
      );
      console.log(`   ✅ Set assignedAgent=null for ${setNullResult.modifiedCount} leads\n`);
    } else {
      console.log(`   ℹ️  All leads have assignedAgent field - skipping this step\n`);
    }

    // ============================================================
    // STEP 4: Verify the fix
    // ============================================================
    console.log("✓ STEP 4: Verifying the fix...\n");

    const remainingOldFields = await leadsCollection.countDocuments({
      $or: [
        { isAssigned: { $exists: true } },
        { assignedTo: { $exists: true } },
        { assignedAt: { $exists: true } },
      ],
    });

    const finalMissingField = await leadsCollection.countDocuments({
      assignedAgent: { $exists: false },
    });

    const finalWithAgent = await leadsCollection.countDocuments({
      assignedAgent: { $ne: null },
    });

    const finalWithoutAgent = await leadsCollection.countDocuments({
      assignedAgent: null,
    });

    if (remainingOldFields === 0 && finalMissingField === 0) {
      console.log("   ✅ Verification PASSED!\n");
    } else {
      console.log("   ⚠️  Warning: Some issues remain:\n");
      if (remainingOldFields > 0) {
        console.log(`      - ${remainingOldFields} leads still have old fields`);
      }
      if (finalMissingField > 0) {
        console.log(`      - ${finalMissingField} leads missing assignedAgent field`);
      }
      console.log("");
    }

    // ============================================================
    // STEP 5: Final Statistics
    // ============================================================
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                     FINAL STATISTICS                      ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log(`   Total leads:                    ${totalLeads}`);
    console.log(`   Leads with assigned agent:      ${finalWithAgent}`);
    console.log(`   Leads without assigned agent:   ${finalWithoutAgent}`);
    console.log(`   Old fields remaining:           ${remainingOldFields}`);
    console.log("");

    // Get breakdown by lead type
    console.log("   Assignment breakdown by lead type:");
    const breakdown = await leadsCollection.aggregate([
      {
        $group: {
          _id: {
            leadType: "$leadType",
            isAssigned: { $cond: [{ $ne: ["$assignedAgent", null] }, "Assigned", "Unassigned"] },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.leadType": 1, "_id.isAssigned": -1 },
      },
    ]).toArray();

    const formatted = {
      ftd: { assigned: 0, unassigned: 0 },
      filler: { assigned: 0, unassigned: 0 },
      cold: { assigned: 0, unassigned: 0 },
      live: { assigned: 0, unassigned: 0 },
    };

    breakdown.forEach((stat) => {
      const { leadType, isAssigned } = stat._id;
      const count = stat.count;
      if (formatted[leadType]) {
        if (isAssigned === "Assigned") {
          formatted[leadType].assigned = count;
        } else {
          formatted[leadType].unassigned = count;
        }
      }
    });

    console.log(`      • FTD:    ${formatted.ftd.assigned} assigned, ${formatted.ftd.unassigned} unassigned`);
    console.log(`      • Filler: ${formatted.filler.assigned} assigned, ${formatted.filler.unassigned} unassigned`);
    console.log(`      • Cold:   ${formatted.cold.assigned} assigned, ${formatted.cold.unassigned} unassigned`);
    console.log(`      • Live:   ${formatted.live.assigned} assigned, ${formatted.live.unassigned} unassigned`);

    const totalAssigned = formatted.ftd.assigned + formatted.filler.assigned + formatted.cold.assigned + formatted.live.assigned;
    const totalUnassigned = formatted.ftd.unassigned + formatted.filler.unassigned + formatted.cold.unassigned + formatted.live.unassigned;
    
    console.log(`\n   TOTAL: ${totalAssigned} assigned, ${totalUnassigned} unassigned`);

    // ============================================================
    // Success message
    // ============================================================
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                    🎉 SUCCESS! 🎉                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log("\nYour database has been fixed!");
    console.log("\n📝 Next steps:");
    console.log("   1. Restart your backend server (Ctrl+C and npm start)");
    console.log("   2. Clear browser cache (Ctrl+Shift+R)");
    console.log("   3. Check the Leads page - stats should now be correct!\n");

  } catch (error) {
    console.error("\n❌ ERROR during migration:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("✅ Disconnected from MongoDB\n");
  }
}

// Run the script
if (require.main === module) {
  fixLeadAssignmentsComplete()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Migration failed:", error);
      process.exit(1);
    });
}

module.exports = fixLeadAssignmentsComplete;

