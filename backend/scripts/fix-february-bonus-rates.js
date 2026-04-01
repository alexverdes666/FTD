/**
 * Fix all AgentCallCounts records where bonusRates.verifiedAcc was incorrectly set to 50 instead of 5.
 * Also fixes the global SystemConfiguration bonus rates to prevent future occurrences.
 *
 * Usage:
 *   node scripts/fix-february-bonus-rates.js          # Dry run (default)
 *   node scripts/fix-february-bonus-rates.js --apply   # Apply changes
 */

require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");
require("../models/User");
const AgentCallCounts = require("../models/AgentCallCounts");
const SystemConfiguration = require("../models/SystemConfiguration");

const dryRun = !process.argv.includes("--apply");

async function fixBonusRates() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected\n");

    if (dryRun) {
      console.log("=== DRY RUN MODE - No changes will be made ===");
      console.log("Run with --apply to actually fix the records\n");
    }

    // ── 1. Fix global SystemConfiguration ──
    console.log("========================================");
    console.log("Checking Global Bonus Rates (SystemConfiguration)");
    console.log("========================================\n");

    const globalConfig = await SystemConfiguration.findOne({
      configType: "GLOBAL_BONUS_RATES",
    });

    if (!globalConfig) {
      console.log("No GLOBAL_BONUS_RATES config found.\n");
    } else {
      const globalRate = globalConfig.bonusRates?.verifiedAcc;
      console.log(`Current global verifiedAcc rate: $${globalRate}`);
      if (globalRate !== 5) {
        console.log(`  Needs fix: $${globalRate} -> $5`);
        if (!dryRun) {
          await SystemConfiguration.updateOne(
            { configType: "GLOBAL_BONUS_RATES" },
            { $set: { "bonusRates.verifiedAcc": 5 } }
          );
          console.log("  ✅ Global config fixed!\n");
        } else {
          console.log("  Would be fixed on --apply\n");
        }
      } else {
        console.log("  Already correct ($5). No change needed.\n");
      }
    }

    // ── 2. Fix all AgentCallCounts records ──
    console.log("========================================");
    console.log("Checking AgentCallCounts records (all months)");
    console.log("========================================\n");

    const records = await AgentCallCounts.find({
      "bonusRates.verifiedAcc": { $ne: 5 },
    })
      .populate("agent", "fullName email")
      .sort({ year: 1, month: 1 });

    console.log(`Found ${records.length} record(s) with incorrect verifiedAcc rate\n`);

    let currentPeriod = "";
    let periodCount = 0;
    let totalFixed = 0;

    for (const record of records) {
      const period = `${record.year}-${String(record.month).padStart(2, "0")}`;
      if (period !== currentPeriod) {
        if (currentPeriod) console.log();
        console.log(`--- ${period} ---`);
        currentPeriod = period;
        periodCount = 0;
      }

      const agentName = record.agent?.fullName || "Unknown";
      const agentEmail = record.agent?.email || "Unknown";
      const oldRate = record.bonusRates.verifiedAcc;
      const verifiedCount = record.callCounts.verifiedAccounts;
      const oldBonus = verifiedCount * oldRate;
      const newBonus = verifiedCount * 5;

      console.log(`  ${agentName} (${agentEmail})`);
      console.log(`    Verified: ${verifiedCount} | $${oldRate} -> $5 | Bonus: $${oldBonus} -> $${newBonus} (diff: -$${oldBonus - newBonus})`);

      if (!dryRun) {
        await AgentCallCounts.updateOne(
          { _id: record._id },
          { $set: { "bonusRates.verifiedAcc": 5 } }
        );
        console.log(`    ✅ Fixed!`);
      }

      totalFixed++;
    }

    // ── Summary ──
    console.log("\n========================================");
    console.log("Summary");
    console.log("========================================");
    if (totalFixed === 0) {
      console.log("No records to fix.");
    } else if (dryRun) {
      console.log(`${totalFixed} record(s) would be updated. Run with --apply to fix.`);
    } else {
      console.log(`✅ Successfully updated ${totalFixed} AgentCallCounts record(s).`);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nDisconnected from MongoDB.");
  }
}

fixBonusRates();
