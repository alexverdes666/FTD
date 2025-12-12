const { MongoClient } = require("mongodb");
const { validationResult } = require("express-validator");
const Lead = require("../models/Lead");

// Function to extract country code and pure phone number
const extractPhoneComponents = (fullPhoneNumber) => {
  if (!fullPhoneNumber) {
    return { countryCode: null, purePhone: null };
  }

  // Remove all non-numeric characters
  const cleanPhone = fullPhoneNumber.replace(/\D/g, "");

  if (cleanPhone.length < 6) {
    return { countryCode: null, purePhone: fullPhoneNumber };
  }

  // Common country code patterns and their extraction logic
  let countryCode = null;
  let purePhone = null;

  // US/Canada (+1) - 11 digits total
  if (cleanPhone.length >= 11 && cleanPhone.startsWith("1")) {
    countryCode = "+1";
    purePhone = cleanPhone.substring(1);
  }
  // Russia (+7) - 11 digits total
  else if (cleanPhone.length >= 11 && cleanPhone.startsWith("7")) {
    countryCode = "+7";
    purePhone = cleanPhone.substring(1);
  }
  // European 2-digit codes
  else if (
    cleanPhone.length >= 10 &&
    ["44", "49", "33", "34", "39", "41", "43", "45", "46", "47", "48"].includes(
      cleanPhone.substring(0, 2)
    )
  ) {
    countryCode = "+" + cleanPhone.substring(0, 2);
    purePhone = cleanPhone.substring(2);
  }
  // European 3-digit codes (like Bulgaria +359)
  else if (
    cleanPhone.length >= 9 &&
    ["359", "371", "372", "373", "374", "375", "376", "377", "378"].includes(
      cleanPhone.substring(0, 3)
    )
  ) {
    countryCode = "+" + cleanPhone.substring(0, 3);
    purePhone = cleanPhone.substring(3);
  }
  // Default: assume no country code
  else {
    countryCode = null;
    purePhone = cleanPhone;
  }

  return { countryCode, purePhone };
};

// MongoDB connection for temporary database
const TEMPORARY_MONGODB_URI =
  "mongodb+srv://dani034406:Daniel6285@cluster0.g0vqepz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const TEMPORARY_DATABASE_NAME = "temporary";
const VERIFICATION_COLLECTION_NAME = "verifications";

let temporaryClient;
let temporaryDb;

// Initialize temporary database connection
async function initializeTemporaryDatabase() {
  if (!temporaryClient) {
    temporaryClient = new MongoClient(TEMPORARY_MONGODB_URI);
    await temporaryClient.connect();
    temporaryDb = temporaryClient.db(TEMPORARY_DATABASE_NAME);
    console.log("✅ Connected to temporary MongoDB database");
  }
  return temporaryDb;
}

// Get all pending verifications
exports.getPendingVerifications = async (req, res, next) => {
  try {
    const db = await initializeTemporaryDatabase();
    const collection = db.collection(VERIFICATION_COLLECTION_NAME);

    // Get query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || "pending";

    // Build filter
    const filter = {};
    if (status !== "all") {
      filter["metadata.status"] = status;
    }

    // Get verifications with pagination and ensure uniqueness by sessionId
    const allVerifications = await collection
      .find(filter, {
        projection: {
          "photos.idFront.data": 0,
          "photos.idBack.data": 0,
          "photos.selfieWithIdFront.data": 0,
          "photos.selfieWithIdBack.data": 0,
          "photos.selfieOnly.data": 0,
        },
      })
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    // Deduplicate by sessionId - keep the most recent processed status or oldest pending
    const uniqueVerifications = [];
    const seenSessionIds = new Set();

    for (const verification of allVerifications) {
      if (!seenSessionIds.has(verification.sessionId)) {
        seenSessionIds.add(verification.sessionId);
        uniqueVerifications.push(verification);
      }
    }

    // Apply pagination to deduplicated results
    const verifications = uniqueVerifications.slice(skip, skip + limit);

    console.log(
      `Found ${verifications.length} unique verifications for status: ${status} (${allVerifications.length} total, ${uniqueVerifications.length} after dedup)`,
      {
        verificationIds: verifications.map((v) => ({
          id: v.sessionId,
          status: v.metadata.status,
        })),
      }
    );

    // Get total count of unique verifications
    const totalCount = uniqueVerifications.length;

    res.status(200).json({
      success: true,
      data: verifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching pending verifications:", error);
    next(error);
  }
};

// Get verification details including photos
exports.getVerificationDetails = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const includePhotos = req.query.includePhotos === "true";

    const db = await initializeTemporaryDatabase();
    const collection = db.collection(VERIFICATION_COLLECTION_NAME);

    // Build projection based on whether photos are requested
    const projection = {};
    if (!includePhotos) {
      projection["photos.idFront.data"] = 0;
      projection["photos.idBack.data"] = 0;
      projection["photos.selfieWithIdFront.data"] = 0;
      projection["photos.selfieWithIdBack.data"] = 0;
      projection["photos.selfieOnly.data"] = 0;
    }

    const verification = await collection.findOne(
      { sessionId },
      { projection }
    );

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error("Error fetching verification details:", error);
    next(error);
  }
};

// Approve verification and migrate to leads
exports.approveVerification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { sessionId } = req.params;
    const { notes, newEmail, newPhone } = req.body;

    const db = await initializeTemporaryDatabase();
    const collection = db.collection(VERIFICATION_COLLECTION_NAME);

    // Get the verification
    const verification = await collection.findOne({ sessionId });
    if (!verification) {
      console.log("Verification not found:", sessionId);
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    console.log("Current verification status:", verification.metadata.status);
    console.log("Full verification metadata:", verification.metadata);

    // Allow status changes - including approving previously rejected verifications
    // Add audit logging for status changes
    if (verification.metadata.status === "manually_rejected") {
      console.log(`[AUDIT] Approving previously rejected verification ${sessionId}:`, {
        previousStatus: verification.metadata.status,
        previouslyRejectedBy: verification.metadata.rejectedBy,
        previouslyRejectedAt: verification.metadata.rejectedAt,
        rejectionReason: verification.metadata.rejectionReason,
        nowApprovedBy: req.user._id,
        approvedAt: new Date()
      });
    }

    // Create lead from verification data
    const originalEmail = verification.personalInfo.email;
    const originalPhone = verification.personalInfo.phone;
    const finalEmail =
      newEmail && newEmail.trim() ? newEmail.trim() : originalEmail;
    const finalPhone =
      newPhone && newPhone.trim() ? newPhone.trim() : originalPhone;

    // Extract country code and pure phone number
    const { countryCode, purePhone } = extractPhoneComponents(finalPhone);
    const { countryCode: originalCountryCode, purePhone: originalPurePhone } =
      extractPhoneComponents(originalPhone);

    console.log(`[PHONE-MIGRATION] Processing phone: ${finalPhone}`);
    console.log(
      `[PHONE-MIGRATION] Extracted - Country Code: ${countryCode}, Pure Phone: ${purePhone}`
    );

    const leadData = {
      leadType: "ftd",
      firstName: verification.personalInfo.firstName,
      lastName: verification.personalInfo.lastName,
      newEmail: finalEmail,
      newPhone: purePhone || finalPhone, // Use pure phone number without country code
      prefix: countryCode, // Store country code separately
      // Store original values as old if they were changed
      oldEmail: finalEmail !== originalEmail ? originalEmail : undefined,
      oldPhone: purePhone !== originalPurePhone ? originalPurePhone : undefined,
      country: "Bulgaria", // Default since EGN is Bulgarian
      client: "CreditoPro",
      status: "active",
      priority: "high",
      assignedAgent: null,
      address: verification.personalInfo.address,
      sin: verification.personalInfo.egn,
      createdBy: req.user._id,
      submissionMode: "external",
      // Store verification reference
      verificationSessionId: sessionId,
      documents: [
        {
          url: verification.photos.idFront.data,
          description: "ID Front (Verified)",
          uploadedAt: verification.photos.idFront.capturedAt,
          documentType: "verification_photo",
          verificationData: {
            photoType: "idFront",
            sessionId: sessionId,
          },
        },
        {
          url: verification.photos.idBack.data,
          description: "ID Back (Verified)",
          uploadedAt: verification.photos.idBack.capturedAt,
          documentType: "verification_photo",
          verificationData: {
            photoType: "idBack",
            sessionId: sessionId,
          },
        },
        {
          url: verification.photos.selfieWithIdFront.data,
          description: "Selfie with ID Front (Verified)",
          uploadedAt: verification.photos.selfieWithIdFront.capturedAt,
          documentType: "verification_photo",
          verificationData: {
            photoType: "selfieWithIdFront",
            sessionId: sessionId,
          },
        },
        {
          url: verification.photos.selfieWithIdBack.data,
          description: "Selfie with ID Back (Verified)",
          uploadedAt: verification.photos.selfieWithIdBack.capturedAt,
          documentType: "verification_photo",
          verificationData: {
            photoType: "selfieWithIdBack",
            sessionId: sessionId,
          },
        },
        {
          url: verification.photos.selfieOnly.data,
          description: "Selfie Only (Verified)",
          uploadedAt: verification.photos.selfieOnly.capturedAt,
          documentType: "verification_photo",
          verificationData: {
            photoType: "selfieOnly",
            sessionId: sessionId,
            rekognitionResult: verification.metadata.rekognitionResult,
          },
        },
      ],
      // Add session recordings if available
      sessionRecordings: verification.metadata.sessionRecordings || [],
      comments: notes
        ? [
            {
              text: `Lead created from verification approval. Notes: ${notes}`,
              author: req.user._id,
              createdAt: new Date(),
            },
          ]
        : [
            {
              text: "Lead created from verification approval.",
              author: req.user._id,
              createdAt: new Date(),
            },
          ],
    };

    // Create the lead
    const newLead = await Lead.create(leadData);

    // Delete verification from temporary database since it's now migrated to leads
    const deleteResult = await collection.deleteOne({ sessionId });

    if (deleteResult.deletedCount === 0) {
      console.warn(
        `Warning: Failed to delete verification ${sessionId} from temporary database`
      );
      // Continue execution - the lead was created successfully, this is just cleanup
    } else {
      console.log(
        `✅ Verification ${sessionId} successfully migrated to lead ${newLead._id} and removed from temporary database`
      );
    }

    // Populate the created lead for response
    await newLead.populate("createdBy", "fullName fourDigitCode");

    res.status(200).json({
      success: true,
      message: "Verification approved and lead migrated successfully",
      data: {
        verification: {
          sessionId,
          status: "migrated_to_lead",
          migratedToLeadId: newLead._id,
          approvedBy: req.user._id,
          approvedAt: new Date(),
        },
        lead: newLead,
      },
    });
  } catch (error) {
    console.error("Error approving verification:", error);
    next(error);
  }
};

// Reject verification
exports.rejectVerification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { sessionId } = req.params;
    const { reason } = req.body;

    console.log("Rejecting verification:", {
      sessionId,
      reason: reason?.length,
      reasonText: reason,
    });

    const db = await initializeTemporaryDatabase();
    const collection = db.collection(VERIFICATION_COLLECTION_NAME);

    // Check if verification exists
    const verification = await collection.findOne({ sessionId });
    if (!verification) {
      console.log("Verification not found:", sessionId);
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    console.log("Current verification status:", verification.metadata.status);
    console.log("Full verification metadata:", verification.metadata);

    // Allow re-rejection for complete status flexibility
    // Add audit logging for re-rejection
    if (verification.metadata.status === "manually_rejected") {
      console.log(`[AUDIT] Re-rejecting already rejected verification ${sessionId}:`, {
        previousStatus: verification.metadata.status,
        previouslyRejectedBy: verification.metadata.rejectedBy,
        previouslyRejectedAt: verification.metadata.rejectedAt,
        previousRejectionReason: verification.metadata.rejectionReason,
        nowRejectedBy: req.user._id,
        newRejectionReason: reason,
        rejectedAt: new Date()
      });
    }

    // Update verification status
    const result = await collection.updateOne(
      { sessionId },
      {
        $set: {
          "metadata.status": "manually_rejected",
          "metadata.rejectedBy": req.user._id,
          "metadata.rejectedAt": new Date(),
          "metadata.rejectionReason": reason,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Verification rejected successfully",
      data: {
        sessionId,
        status: "manually_rejected",
        rejectedBy: req.user._id,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });
  } catch (error) {
    console.error("Error rejecting verification:", error);
    next(error);
  }
};

// Get verification statistics
exports.getVerificationStats = async (req, res, next) => {
  try {
    const db = await initializeTemporaryDatabase();
    const collection = db.collection(VERIFICATION_COLLECTION_NAME);

    // Get all verifications and deduplicate by sessionId (same logic as getPendingVerifications)
    const allVerifications = await collection
      .find(
        {},
        {
          projection: {
            sessionId: 1,
            "metadata.status": 1,
            "metadata.createdAt": 1,
          },
        }
      )
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    // Deduplicate by sessionId - keep the most recent processed status or oldest pending
    const uniqueVerifications = [];
    const seenSessionIds = new Set();

    for (const verification of allVerifications) {
      if (!seenSessionIds.has(verification.sessionId)) {
        seenSessionIds.add(verification.sessionId);
        uniqueVerifications.push(verification);
      }
    }

    // Count by status from deduplicated results
    const formattedStats = {
      total: 0,
      pending: 0,
      approved: 0,
      failed: 0,
      manually_approved: 0,
      manually_rejected: 0,
    };

    uniqueVerifications.forEach((verification) => {
      const status = verification.metadata.status;
      if (formattedStats.hasOwnProperty(status)) {
        formattedStats[status]++;
      }
      formattedStats.total++;
    });

    console.log(
      `Stats calculated from ${uniqueVerifications.length} unique verifications (${allVerifications.length} total before dedup)`
    );

    res.status(200).json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    console.error("Error fetching verification stats:", error);
    next(error);
  }
};

// Cleanup connection on process exit
process.on("SIGTERM", async () => {
  if (temporaryClient) {
    await temporaryClient.close();
  }
});

process.on("SIGINT", async () => {
  if (temporaryClient) {
    await temporaryClient.close();
  }
});
