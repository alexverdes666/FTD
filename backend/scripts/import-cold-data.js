const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Lead = require("../models/Lead");

const COLD_DATA_DIR = path.join(__dirname, "..", "cold_data");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Split "FirstName LastName" into { firstName, lastName }
const splitName = (fullName) => {
  if (!fullName || typeof fullName !== "string") return { firstName: "Unknown", lastName: "Unknown" };
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "Unknown" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
};

// Normalize phone number - ensure it has a + prefix
const normalizePhone = (phone, country) => {
  if (!phone) return null;
  let p = String(phone).trim().replace(/[^\d+]/g, "");
  if (!p) return null;
  if (p.startsWith("+")) return p;
  const countryLower = (country || "").toLowerCase();
  if (countryLower.includes("australia") && !p.startsWith("61")) p = "61" + p;
  else if (countryLower.includes("canada") && !p.startsWith("1")) p = "1" + p;
  else if (countryLower.includes("united kingdom") && !p.startsWith("44")) p = "44" + p;
  return "+" + p;
};

// Build additionalDetails object, filtering out empty values
const buildDetails = (obj) => {
  const details = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== null && val !== undefined && val !== "") {
      details[key] = val;
    }
  }
  return Object.keys(details).length > 0 ? details : null;
};

// Parse a CSV file and return rows as array of objects
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

// Parse an XLSX file and return rows as array of objects
const parseXLSX = (filePath, hasHeaders = true) => {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (hasHeaders) return XLSX.utils.sheet_to_json(sheet);
  return XLSX.utils.sheet_to_json(sheet, { header: 1 });
};

// --- File parsers ---

// Format: accountname, phone, email1, account_status, brand, bill_country, agentname, ftd_status, ftd_amount, total_deposited_usd
const parseAccountNameFormat = (rows, sourceFile) => {
  return rows.map((row) => {
    const { firstName, lastName } = splitName(row.accountname);
    const country = (row.bill_country || "").trim();
    return {
      firstName,
      lastName,
      newEmail: (row.email1 || "").trim().toLowerCase(),
      newPhone: normalizePhone(row.phone, country),
      country,
      source: sourceFile,
      additionalDetails: buildDetails({
        accountStatus: (row.account_status || "").trim(),
        brand: (row.brand || "").trim(),
        agentName: (row.agentname || "").trim(),
        ftdAmount: row.ftd_amount || null,
        totalDepositedUsd: row.total_deposited_usd || null,
      }),
    };
  });
};

// Format: EMAIL, FIRST NAME, LAST NAME, PHONE, Amount, GEO
const parseCanadaFormat = (rows, sourceFile) => {
  return rows.map((row) => {
    const email = String(row.EMAIL || row.email || "").trim().toLowerCase();
    const firstName = String(row["FIRST NAME"] || row["first name"] || "").trim();
    const lastName = String(row["LAST NAME"] || row["last name"] || "").trim();
    const phone = row.PHONE || row.phone || "";
    const country = String(row.GEO || row.geo || "Canada").trim();
    // Parse amount - remove currency symbols and commas
    const rawAmount = String(row.Amount || row.amount || "").replace(/[^\d.]/g, "");
    const amount = rawAmount ? parseFloat(rawAmount) : null;
    return {
      firstName: firstName || "Unknown",
      lastName: lastName || "Unknown",
      newEmail: email,
      newPhone: normalizePhone(phone, country),
      country,
      source: sourceFile,
      additionalDetails: buildDetails({
        amount: amount,
      }),
    };
  });
};

// AU500(2) - no headers. Columns by position:
// 0: accountname, 1: phone, 2: email, 3: account_status, 4: brand, 5: country, 6: agentname, 7: ftd_status, 8: amount, 9: amount
const parseAU500v2 = (rows, sourceFile) => {
  return rows.map((row) => {
    const { firstName, lastName } = splitName(String(row[0] || ""));
    const country = String(row[5] || "Australia").trim();
    return {
      firstName,
      lastName,
      newEmail: String(row[2] || "").trim().toLowerCase(),
      newPhone: normalizePhone(row[1], country),
      country,
      source: sourceFile,
      additionalDetails: buildDetails({
        accountStatus: String(row[3] || "").trim(),
        brand: String(row[4] || "").trim(),
        agentName: String(row[6] || "").trim(),
        ftdAmount: row[8] || null,
        totalDepositedUsd: row[9] || null,
      }),
    };
  });
};

const loadAllFiles = async () => {
  const allLeads = [];

  console.log("\n--- Parsing files ---\n");

  // 1. AU50_MP.xlsx (accountname format)
  const au50 = parseXLSX(path.join(COLD_DATA_DIR, "AU50_MP.xlsx"));
  const au50Leads = parseAccountNameFormat(au50, "AU50_MP.xlsx");
  console.log(`AU50_MP.xlsx: ${au50Leads.length} rows`);
  allLeads.push(...au50Leads);

  // 2. AU500(2)_MP.xlsx (no headers)
  const au500v2Raw = parseXLSX(path.join(COLD_DATA_DIR, "AU500(2)_MP.xlsx"), false);
  const au500v2 = parseAU500v2(au500v2Raw, "AU500(2)_MP.xlsx");
  console.log(`AU500(2)_MP.xlsx: ${au500v2.length} rows`);
  allLeads.push(...au500v2);

  // 3. AUTest_MP.xlsx (accountname format)
  const auTest = parseXLSX(path.join(COLD_DATA_DIR, "AUTest_MP.xlsx"));
  const auTestLeads = parseAccountNameFormat(auTest, "AUTest_MP.xlsx");
  console.log(`AUTest_MP.xlsx: ${auTestLeads.length} rows`);
  allLeads.push(...auTestLeads);

  // 4. CA500_MP.xlsx (Canada format)
  const ca500 = parseXLSX(path.join(COLD_DATA_DIR, "CA500_MP.xlsx"));
  const ca500Leads = parseCanadaFormat(ca500, "CA500_MP.xlsx");
  console.log(`CA500_MP.xlsx: ${ca500Leads.length} rows`);
  allLeads.push(...ca500Leads);

  // 5. CA500(2)_MP.csv (Canada format)
  const ca500v2 = await parseCSV(path.join(COLD_DATA_DIR, "CA500(2)_MP.csv"));
  const ca500v2Leads = parseCanadaFormat(ca500v2, "CA500(2)_MP.csv");
  console.log(`CA500(2)_MP.csv: ${ca500v2Leads.length} rows`);
  allLeads.push(...ca500v2Leads);

  // 6. UK-data.csv (accountname format)
  const ukData = await parseCSV(path.join(COLD_DATA_DIR, "UK-data.csv"));
  const ukLeads = parseAccountNameFormat(ukData, "UK-data.csv");
  console.log(`UK-data.csv: ${ukLeads.length} rows`);
  allLeads.push(...ukLeads);

  // SKIPPED: AU500_MP - Sheet1.csv (email-only, missing required fields)
  console.log(`AU500_MP - Sheet1.csv: SKIPPED (email-only, missing name & phone)`);

  return allLeads;
};

const importColdData = async () => {
  // Delete previously imported cold leads first
  const deleteResult = await Lead.deleteMany({ leadType: "cold" });
  console.log(`Deleted ${deleteResult.deletedCount} existing cold leads`);

  const allLeads = await loadAllFiles();

  console.log(`\nTotal parsed: ${allLeads.length} rows`);

  // Filter out invalid records (missing required fields)
  const validLeads = allLeads.filter((lead) => {
    return lead.newEmail && lead.newPhone && lead.firstName && lead.country;
  });
  console.log(`Valid leads (with required fields): ${validLeads.length}`);

  // Deduplicate by email (keep first occurrence)
  const emailSeen = new Set();
  const uniqueLeads = [];
  for (const lead of validLeads) {
    const email = lead.newEmail.toLowerCase();
    if (!emailSeen.has(email)) {
      emailSeen.add(email);
      uniqueLeads.push(lead);
    }
  }
  console.log(`After deduplication: ${uniqueLeads.length} unique leads`);

  // Build documents for insertion
  const documents = uniqueLeads.map((lead) => ({
    leadType: "cold",
    firstName: lead.firstName,
    lastName: lead.lastName,
    newEmail: lead.newEmail,
    newPhone: lead.newPhone,
    country: lead.country,
    source: lead.source,
    additionalDetails: lead.additionalDetails,
    status: "active",
  }));

  // Insert in batches of 100
  const BATCH_SIZE = 100;
  let insertedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    try {
      const result = await Lead.insertMany(batch, { ordered: false });
      insertedCount += result.length;
      process.stdout.write(`\rInserted: ${insertedCount}/${documents.length}`);
    } catch (error) {
      if (error.insertedDocs) {
        insertedCount += error.insertedDocs.length;
      }
      errorCount += batch.length - (error.insertedDocs ? error.insertedDocs.length : 0);
      console.error(`\nBatch error at index ${i}: ${error.message}`);
    }
  }

  console.log(`\n\n--- Import Summary ---`);
  console.log(`Successfully inserted: ${insertedCount}`);
  console.log(`Skipped (duplicates in files): ${validLeads.length - uniqueLeads.length}`);
  console.log(`Errors: ${errorCount}`);

  return { inserted: insertedCount, errors: errorCount };
};

const main = async () => {
  try {
    await connectDB();
    await importColdData();
    console.log("\nImport script completed successfully!");
  } catch (error) {
    console.error("Import script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
};

if (require.main === module) {
  main();
}

module.exports = { importColdData };
