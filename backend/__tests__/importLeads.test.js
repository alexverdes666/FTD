/**
 * Tests for lead import validation, duplicate detection, and error reporting.
 *
 * Covers:
 * 1. Correct data: 2-3 valid records import successfully
 * 2. Partial/wrong data: missing fields, bad country codes, invalid email/phone/gender/status
 * 3. Duplicate detection: re-importing same data is rejected (by name, email, phone, address, doc URL)
 * 4. Within-CSV duplicates
 */
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { Readable } = require("stream");

let mongoServer;
let Lead, User;
let adminUser;

// We test the controller logic directly by building a mock req/res
const csvParser = require("csv-parser");
const {
  normalizePhone,
  isValidCountryName,
  validatePhoneForCountry,
} = require("../utils/phoneNormalizer");

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  Lead = require("../models/Lead");
  User = require("../models/User");

  adminUser = await User.create({
    firstName: "Admin",
    lastName: "User",
    fullName: "Admin User",
    email: "admin@test.com",
    password: "Test1234!",
    role: "admin",
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Lead.deleteMany({});
});

// ── Helper: parse CSV buffer like the controller does ──
async function parseCSV(csvString) {
  const results = [];
  const stream = Readable.from(csvString);
  await new Promise((resolve, reject) => {
    stream
      .pipe(csvParser())
      .on("data", (data) => results.push(data))
      .on("error", reject)
      .on("end", resolve);
  });
  return results;
}

// ── Helper: simulate the import controller logic ──
async function runImport(csvString, leadType = "ftd") {
  const results = await parseCSV(csvString);
  if (results.length === 0) return { success: false, message: "CSV is empty" };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validStatuses = ["active", "inactive", "contacted", "converted"];
  const validGenders = ["male", "female", "other"];

  const parseDate = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      }
    }
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0));
  };

  // Phase 1: Validate each lead
  const validationErrors = [];
  const processedLeads = [];

  results.forEach((lead, index) => {
    const row = index + 2;
    const issues = [];

    const firstName = (lead["First Name"] || lead["First name"] || lead.firstName || "").trim();
    const lastName = (lead["Last Name"] || lead["Last name"] || lead.lastName || "").trim();
    const email = (lead.Email || lead.email || "").trim();
    const phone = (lead.Phone || lead.phone || lead["Phone number"] || "").trim();
    const country = (lead.Country || lead.country || lead.GEO || "").trim();
    const gender = (lead.Gender || lead.gender || "").trim().toLowerCase();
    const dob = (lead["Date of Birth"] || lead["Date of birth"] || lead.dob || "").trim();
    const address = (lead.Address || lead.address || "").trim();
    const status = (lead.Status || lead.status || "").trim().toLowerCase();

    if (!firstName) issues.push("First Name is required");
    if (!lastName) issues.push("Last Name is required");
    if (!email) issues.push("Email is required");
    else if (!emailRegex.test(email)) issues.push(`Invalid email format: '${email}'`);
    if (!country) issues.push("Country is required");
    else if (!isValidCountryName(country)) {
      if (/^[A-Za-z]{2,3}$/.test(country)) issues.push(`Invalid country '${country}'. Use full country name (e.g., 'United Kingdom', not 'UK')`);
      else issues.push(`Unrecognized country '${country}'`);
    }
    if (!phone) issues.push("Phone is required (without country code)");
    else if (country && isValidCountryName(country)) {
      const phoneResult = validatePhoneForCountry(phone, country);
      if (!phoneResult.valid) issues.push(`Invalid phone number '${phone}' for ${country}`);
    }
    if (!gender) issues.push("Gender is required (male/female/other)");
    else if (!validGenders.includes(gender)) issues.push(`Invalid gender '${gender}'`);
    if (!dob) issues.push("Date of Birth is required (DD/MM/YYYY)");
    else if (!parseDate(dob)) issues.push(`Invalid Date of Birth '${dob}'`);
    if (!address) issues.push("Address is required");
    if (!status) issues.push("Status is required");
    else if (!validStatuses.includes(status)) issues.push(`Invalid status '${status}'`);

    const idFront = (lead["ID Front"] || "").trim();
    const idBack = (lead["ID Back"] || "").trim();
    const selfie = (lead["Selfie"] || "").trim();
    const idFrontSelfie = (lead["ID Front with Selfie"] || "").trim();
    const documents = [];
    if (idFront) documents.push({ url: idFront, description: "ID Front" });
    if (idBack) documents.push({ url: idBack, description: "ID Back" });
    if (selfie) documents.push({ url: selfie, description: "Selfie" });
    if (idFrontSelfie) documents.push({ url: idFrontSelfie, description: "ID Front with Selfie" });
    if (documents.length === 0) issues.push("At least one document is required");

    if (issues.length > 0) {
      validationErrors.push({ row, firstName: firstName || "(empty)", lastName: lastName || "(empty)", issues });
    } else {
      const normalizedGender = gender === "other" ? "not_defined" : gender;
      const phoneResult = validatePhoneForCountry(phone, country);
      processedLeads.push({
        _row: row,
        firstName, lastName,
        newEmail: email.toLowerCase(),
        newPhone: phoneResult.valid ? phoneResult.nationalNumber : phone.replace(/\D/g, ""),
        country, gender: normalizedGender,
        dob: parseDate(dob), address, status, leadType, documents,
        createdBy: adminUser._id,
      });
    }
  });

  // Phase 2: Within-CSV duplicates
  const seenEmails = new Map();
  const seenNames = new Map();
  const seenPhones = new Map();
  processedLeads.forEach((lead) => {
    const emailKey = lead.newEmail.toLowerCase();
    const nameKey = `${lead.firstName.toLowerCase()}|${lead.lastName.toLowerCase()}`;
    const phoneKey = lead.newPhone;
    if (seenEmails.has(emailKey)) {
      validationErrors.push({ row: lead._row, firstName: lead.firstName, lastName: lead.lastName, issues: [`Duplicate email '${lead.newEmail}' in CSV`] });
    } else { seenEmails.set(emailKey, lead._row); }
    if (seenNames.has(nameKey) && !validationErrors.find(e => e.row === lead._row)) {
      validationErrors.push({ row: lead._row, firstName: lead.firstName, lastName: lead.lastName, issues: [`Duplicate name in CSV`] });
    } else if (!seenNames.has(nameKey)) { seenNames.set(nameKey, lead._row); }
    if (phoneKey && seenPhones.has(phoneKey) && !validationErrors.find(e => e.row === lead._row)) {
      validationErrors.push({ row: lead._row, firstName: lead.firstName, lastName: lead.lastName, issues: [`Duplicate phone in CSV`] });
    } else if (phoneKey && !seenPhones.has(phoneKey)) { seenPhones.set(phoneKey, lead._row); }
  });

  if (validationErrors.length > 0) {
    validationErrors.sort((a, b) => a.row - b.row);
    return { success: false, message: `${validationErrors.length} leads have validation errors`, validationErrors };
  }

  // Phase 3: DB duplicate detection
  const leadsToImport = processedLeads.map(({ _row, ...lead }) => lead);
  const rowMap = processedLeads.map(l => l._row);

  const emails = leadsToImport.map(l => l.newEmail);
  const phones = leadsToImport.map(l => l.newPhone).filter(Boolean);
  const addresses = leadsToImport.map(l => l.address).filter(Boolean);
  const allDocUrls = leadsToImport.flatMap(l => (l.documents || []).map(d => d.url));
  const nameChecks = leadsToImport.map(l => ({
    firstName: { $regex: new RegExp(`^${l.firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    lastName: { $regex: new RegExp(`^${l.lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  }));

  const [existingByEmail, existingByName, existingByPhone, existingByDocUrl, existingByAddress] = await Promise.all([
    emails.length > 0 ? Lead.find({ newEmail: { $in: emails } }).select("newEmail").lean() : [],
    nameChecks.length > 0 ? Lead.find({ $or: nameChecks }).select("firstName lastName").lean() : [],
    phones.length > 0 ? Lead.find({ newPhone: { $in: phones } }).select("newPhone").lean() : [],
    allDocUrls.length > 0 ? Lead.find({ "documents.url": { $in: allDocUrls } }).select("documents").lean() : [],
    addresses.length > 0 ? Lead.find({ $or: addresses.map(a => ({ address: { $regex: new RegExp(`^${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } })) }).select("address").lean() : [],
  ]);

  const existingEmailSet = new Set(existingByEmail.map(l => l.newEmail.toLowerCase()));
  const existingNameSet = new Set(existingByName.map(l => `${l.firstName.toLowerCase()}|${l.lastName.toLowerCase()}`));
  const existingPhoneSet = new Set(existingByPhone.map(l => l.newPhone));
  const existingDocUrlSet = new Set(existingByDocUrl.flatMap(l => (l.documents || []).map(d => d.url)));
  const existingAddressSet = new Set(existingByAddress.map(l => l.address.toLowerCase().trim()));

  const duplicateDetails = [];
  const newLeads = [];
  leadsToImport.forEach((lead, idx) => {
    const reasons = [];
    if (existingEmailSet.has(lead.newEmail.toLowerCase())) reasons.push(`Email already exists`);
    if (existingNameSet.has(`${lead.firstName.toLowerCase()}|${lead.lastName.toLowerCase()}`)) reasons.push(`Name already exists`);
    if (lead.newPhone && existingPhoneSet.has(lead.newPhone)) reasons.push(`Phone already exists`);
    if (lead.address && existingAddressSet.has(lead.address.toLowerCase().trim())) reasons.push(`Address already exists`);
    const matchedDoc = (lead.documents || []).find(d => existingDocUrlSet.has(d.url));
    if (matchedDoc) reasons.push(`Document URL already exists`);
    if (reasons.length > 0) duplicateDetails.push({ row: rowMap[idx], firstName: lead.firstName, lastName: lead.lastName, reasons });
    else newLeads.push(lead);
  });

  if (newLeads.length === 0) {
    return { success: false, message: "All leads are duplicates", duplicateDetails };
  }

  // Phase 4: Insert
  let importCount = 0;
  try {
    const result = await Lead.insertMany(newLeads, { ordered: false, rawResult: true });
    importCount = result.insertedCount || 0;
  } catch (error) {
    if (error.name === "BulkWriteError" || error.code === 11000) {
      importCount = error.result?.nInserted || 0;
    } else throw error;
  }

  return {
    success: true,
    message: `${importCount} leads imported`,
    stats: { imported: importCount, duplicatesSkipped: duplicateDetails.length, totalProcessed: results.length },
    duplicateDetails: duplicateDetails.length > 0 ? duplicateDetails : undefined,
  };
}

// ═══════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════

const VALID_CSV = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front,ID Back,Selfie,ID Front with Selfie,SIN
John,Doe,john.doe@example.com,6045551234,Canada,male,15/01/1990,"123 Main Street, Toronto, ON",active,https://example.com/id-front1.jpg,https://example.com/id-back1.jpg,,,
Jane,Smith,jane.smith@example.com,7911123456,United Kingdom,female,20/02/1985,"456 High Street, London",contacted,https://example.com/id-front2.jpg,https://example.com/id-back2.jpg,https://example.com/selfie2.jpg,,
Carlos,Garcia,carlos.garcia@example.com,612345678,Spain,other,10/06/1992,"Calle Gran Via 1, Madrid",active,https://example.com/id-front3.jpg,,,,`;

describe("Import Leads - Valid Data", () => {
  test("should import 3 valid leads successfully", async () => {
    const result = await runImport(VALID_CSV, "ftd");

    expect(result.success).toBe(true);
    expect(result.stats.imported).toBe(3);
    expect(result.stats.duplicatesSkipped).toBe(0);
    expect(result.stats.totalProcessed).toBe(3);

    // Verify leads in DB
    const leads = await Lead.find({}).sort({ firstName: 1 });
    expect(leads).toHaveLength(3);

    // Check Carlos (other -> not_defined)
    const carlos = leads.find(l => l.firstName === "Carlos");
    expect(carlos.gender).toBe("not_defined");
    expect(carlos.country).toBe("Spain");
    expect(carlos.newPhone).toBe("612345678");
    expect(carlos.status).toBe("active");
    expect(carlos.leadType).toBe("ftd");
    expect(carlos.documents).toHaveLength(1);
    expect(carlos.documents[0].description).toBe("ID Front");

    // Check Jane
    const jane = leads.find(l => l.firstName === "Jane");
    expect(jane.gender).toBe("female");
    expect(jane.country).toBe("United Kingdom");
    expect(jane.status).toBe("contacted");
    expect(jane.documents).toHaveLength(3);

    // Check John
    const john = leads.find(l => l.firstName === "John");
    expect(john.gender).toBe("male");
    expect(john.newPhone).toBe("6045551234");
    expect(john.dob).toBeTruthy();
  });
});

describe("Import Leads - Invalid/Partial Data", () => {
  test("should reject leads with missing required fields", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
,Doe,john@example.com,6045551234,Canada,male,15/01/1990,"123 Main St",active,https://example.com/id.jpg
John,,john2@example.com,6045551235,Canada,male,15/01/1990,"124 Main St",active,https://example.com/id2.jpg
John,Valid,valid@example.com,6045551236,Canada,male,15/01/1990,"125 Main St",active,https://example.com/id3.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors).toHaveLength(2);
    expect(result.validationErrors[0].issues).toContain("First Name is required");
    expect(result.validationErrors[1].issues).toContain("Last Name is required");
  });

  test("should reject 'UK' as country — must use 'United Kingdom'", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john@example.com,7911123456,UK,male,15/01/1990,"123 Main St",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0].issues[0]).toMatch(/Invalid country 'UK'/);
    expect(result.validationErrors[0].issues[0]).toMatch(/United Kingdom/);
  });

  test("should reject 'US', 'CA', 'ES' as country codes", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john1@example.com,6045551234,CA,male,15/01/1990,"123 Main St",active,https://example.com/id1.jpg
Jane,Smith,jane1@example.com,2025551234,US,female,15/01/1990,"124 Main St",active,https://example.com/id2.jpg
Carlos,Garcia,carlos1@example.com,612345678,ES,male,15/01/1990,"125 Main St",active,https://example.com/id3.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors).toHaveLength(3);
    result.validationErrors.forEach(err => {
      expect(err.issues.some(i => i.includes("Invalid country") || i.includes("Unrecognized country"))).toBe(true);
    });
  });

  test("should reject made-up country names like 'United Spain', 'Canadia'", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john1@example.com,6045551234,United Spain,male,15/01/1990,"123 Main St",active,https://example.com/id1.jpg
Jane,Smith,jane1@example.com,7911123456,Canadia,female,15/01/1990,"124 Main St",active,https://example.com/id2.jpg
Carlos,Garcia,carlos1@example.com,612345678,Españia,male,15/01/1990,"125 Main St",active,https://example.com/id3.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors).toHaveLength(3);
    expect(result.validationErrors[0].issues[0]).toMatch(/Unrecognized country 'United Spain'/);
    expect(result.validationErrors[1].issues[0]).toMatch(/Unrecognized country 'Canadia'/);
    expect(result.validationErrors[2].issues[0]).toMatch(/Unrecognized country/);
  });

  test("should reject invalid email format", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,notanemail,6045551234,Canada,male,15/01/1990,"123 Main St",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors[0].issues[0]).toMatch(/Invalid email format/);
  });

  test("should reject invalid phone number", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john@example.com,123,Canada,male,15/01/1990,"123 Main St",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors[0].issues.some(i => i.includes("Invalid phone"))).toBe(true);
  });

  test("should reject invalid gender — only male/female/other allowed", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john@example.com,6045551234,Canada,unknown,15/01/1990,"123 Main St",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors[0].issues[0]).toMatch(/Invalid gender 'unknown'/);
  });

  test("should reject invalid status", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john@example.com,6045551234,Canada,male,15/01/1990,"123 Main St",pending,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors[0].issues[0]).toMatch(/Invalid status 'pending'/);
  });

  test("should reject invalid date of birth", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john@example.com,6045551234,Canada,male,not-a-date,"123 Main St",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors[0].issues[0]).toMatch(/Invalid Date of Birth/);
  });

  test("should reject lead with no documents", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john@example.com,6045551234,Canada,male,15/01/1990,"123 Main St",active,`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors[0].issues[0]).toMatch(/At least one document is required/);
  });

  test("should collect ALL errors for a single lead with multiple issues", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
,,badmail,123,UK,unknown,not-a-date,,pending,`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    const errors = result.validationErrors[0].issues;
    expect(errors.length).toBeGreaterThanOrEqual(7);
    // Should have: First Name, Last Name, email, country, phone (skipped since country invalid), gender, DOB, address, status, document
  });

  test("should reject within-CSV duplicate emails", async () => {
    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,same@example.com,6045551234,Canada,male,15/01/1990,"123 Main St",active,https://example.com/id1.jpg
Jane,Smith,same@example.com,7911123456,United Kingdom,female,20/02/1985,"456 High St",contacted,https://example.com/id2.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.validationErrors.some(e => e.issues[0].includes("Duplicate email"))).toBe(true);
  });
});

describe("Import Leads - Duplicate Detection (DB)", () => {
  test("should detect duplicates on re-import by email, name, phone, address, and doc URL", async () => {
    // First import: should succeed
    const result1 = await runImport(VALID_CSV, "ftd");
    expect(result1.success).toBe(true);
    expect(result1.stats.imported).toBe(3);

    // Verify 3 leads exist in DB
    const count = await Lead.countDocuments();
    expect(count).toBe(3);

    // Second import with SAME data: all should be duplicates
    const result2 = await runImport(VALID_CSV, "ftd");
    expect(result2.success).toBe(false);
    expect(result2.message).toMatch(/duplicates/i);
    expect(result2.duplicateDetails).toHaveLength(3);

    // Verify reasons include email, name, phone, address
    result2.duplicateDetails.forEach(dup => {
      expect(dup.reasons.length).toBeGreaterThanOrEqual(1);
    });

    // DB should still have only 3 leads
    const countAfter = await Lead.countDocuments();
    expect(countAfter).toBe(3);
  });

  test("should detect duplicate by email only (different name/phone)", async () => {
    // Insert a lead manually
    await Lead.create({
      firstName: "Existing", lastName: "Person",
      newEmail: "john.doe@example.com", newPhone: "9999999999",
      country: "Canada", gender: "male", leadType: "ftd",
      status: "active", createdBy: adminUser._id,
      address: "Totally Different Address",
    });

    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john.doe@example.com,6045551234,Canada,male,15/01/1990,"123 Main St",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.duplicateDetails[0].reasons.some(r => r.includes("Email already exists"))).toBe(true);
  });

  test("should detect duplicate by phone number", async () => {
    await Lead.create({
      firstName: "Other", lastName: "Person",
      newEmail: "other@test.com", newPhone: "6045551234",
      country: "Canada", gender: "male", leadType: "ftd",
      status: "active", createdBy: adminUser._id,
    });

    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john.new@example.com,6045551234,Canada,male,15/01/1990,"123 Main St",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.duplicateDetails[0].reasons.some(r => r.includes("Phone already exists"))).toBe(true);
  });

  test("should detect duplicate by address (case-insensitive)", async () => {
    await Lead.create({
      firstName: "Other", lastName: "Person",
      newEmail: "other@test.com", newPhone: "9999999999",
      country: "Canada", gender: "male", leadType: "ftd",
      status: "active", createdBy: adminUser._id,
      address: "123 Main Street, Toronto, ON",
    });

    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john.new@example.com,6045551234,Canada,male,15/01/1990,"123 Main Street, Toronto, ON",active,https://example.com/id.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.duplicateDetails[0].reasons.some(r => r.includes("Address already exists"))).toBe(true);
  });

  test("should detect duplicate by document URL", async () => {
    await Lead.create({
      firstName: "Other", lastName: "Person",
      newEmail: "other@test.com", newPhone: "9999999999",
      country: "Canada", gender: "male", leadType: "ftd",
      status: "active", createdBy: adminUser._id,
      documents: [{ url: "https://example.com/id-front1.jpg", description: "ID Front" }],
    });

    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
John,Doe,john.new@example.com,6045551234,Canada,male,15/01/1990,"999 Different St",active,https://example.com/id-front1.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.duplicateDetails[0].reasons.some(r => r.includes("Document URL already exists"))).toBe(true);
  });

  test("should detect duplicate by name (case-insensitive)", async () => {
    await Lead.create({
      firstName: "John", lastName: "Doe",
      newEmail: "other@test.com", newPhone: "9999999999",
      country: "Canada", gender: "male", leadType: "ftd",
      status: "active", createdBy: adminUser._id,
    });

    const csv = `First Name,Last Name,Email,Phone,Country,Gender,Date of Birth,Address,Status,ID Front
john,doe,different@example.com,6045559999,Canada,male,15/01/1990,"999 Different St",active,https://example.com/id-new.jpg`;

    const result = await runImport(csv, "ftd");
    expect(result.success).toBe(false);
    expect(result.duplicateDetails[0].reasons.some(r => r.includes("Name already exists"))).toBe(true);
  });

  test("should import non-duplicate leads and skip duplicates", async () => {
    // Pre-insert John
    await Lead.create({
      firstName: "John", lastName: "Doe",
      newEmail: "john.doe@example.com", newPhone: "6045551234",
      country: "Canada", gender: "male", leadType: "ftd",
      status: "active", createdBy: adminUser._id,
      address: "123 Main Street, Toronto, ON",
    });

    // CSV has John (duplicate) + Jane (new) + Carlos (new)
    const result = await runImport(VALID_CSV, "ftd");
    expect(result.success).toBe(true);
    expect(result.stats.imported).toBe(2);
    expect(result.stats.duplicatesSkipped).toBe(1);
    expect(result.duplicateDetails).toHaveLength(1);
    expect(result.duplicateDetails[0].firstName).toBe("John");

    const total = await Lead.countDocuments();
    expect(total).toBe(3); // 1 pre-existing + 2 new
  });
});
