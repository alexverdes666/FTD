const { MongoClient } = require("mongodb");
const { validationResult } = require("express-validator");
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const Lead = require("../models/Lead");

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET =
  process.env.S3_BUCKET_NAME || "creditopro-verification-sessions-2025";

const PHOTO_TYPES = [
  "idFront",
  "idBack",
  "selfieOnly",
  "selfieWithIdFront",
  "selfieWithIdBack",
];

// Generate a signed S3 URL for a photo
async function getPhotoSignedUrl(sessionId, photoFilename) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: `${sessionId}/photos/${photoFilename}`,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

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
      .find(filter)
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

    const verification = await collection.findOne({ sessionId });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    // Generate signed S3 URLs for photos
    if (includePhotos && verification.photos) {
      try {
        for (const photoType of PHOTO_TYPES) {
          if (verification.photos[photoType]) {
            verification.photos[photoType].data = await getPhotoSignedUrl(
              sessionId,
              `${photoType}.jpg`
            );
          }
        }
        console.log(
          `[VERIFY] Generated signed photo URLs for session ${sessionId}`
        );
      } catch (photoError) {
        console.error(
          `[VERIFY] Error generating photo URLs for session ${sessionId}:`,
          photoError.message
        );
      }
    }

    // If sessionRecordings is missing or empty, check S3 for recordings
    if (
      !verification.metadata.sessionRecordings ||
      verification.metadata.sessionRecordings.length === 0
    ) {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: `${sessionId}/`,
        });

        const s3Response = await s3Client.send(listCommand);

        if (s3Response.Contents && s3Response.Contents.length > 0) {
          const recordings = s3Response.Contents.filter((obj) =>
            obj.Key.endsWith(".mp4")
          ).map((obj) => {
            const filename = obj.Key.split("/").pop();
            // Extract camera type from filename (e.g., "front_2026-01-29T11-30-42-698Z.mp4")
            const cameraType = filename.startsWith("front")
              ? "front"
              : "back";

            return {
              s3Key: obj.Key,
              cameraType,
              fileSize: obj.Size,
              duration: 0,
              uploadedAt: obj.LastModified,
            };
          });

          if (recordings.length > 0) {
            verification.metadata.sessionRecordings = recordings;
            console.log(
              `[VERIFY] Found ${recordings.length} recording(s) in S3 for session ${sessionId}`
            );
          }
        }
      } catch (s3Error) {
        console.error(
          `[VERIFY] Error listing S3 recordings for session ${sessionId}:`,
          s3Error.message
        );
        // Continue without recordings - don't fail the whole request
      }
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
    const { notes, newEmail, newPhone, fullName, country, address, gender, dob } = req.body;

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
    if (verification.metadata.status === "manually_rejected" || verification.metadata.status === "verification_failed") {
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
    const isNA = (val) => !val || val.trim() === "" || val.trim() === "N/A";

    const originalEmail = verification.personalInfo.email;
    const originalPhone = verification.personalInfo.phone;
    const finalEmail =
      newEmail && newEmail.trim() && newEmail.trim() !== "N/A"
        ? newEmail.trim()
        : isNA(originalEmail)
          ? ""
          : originalEmail;
    const finalPhone =
      newPhone && newPhone.trim() && newPhone.trim() !== "N/A"
        ? newPhone.trim()
        : isNA(originalPhone)
          ? ""
          : originalPhone;

    // Determine firstName/lastName - use fullName override if provided
    let firstName = verification.personalInfo.firstName;
    let lastName = verification.personalInfo.lastName;
    if (fullName && fullName.trim()) {
      const nameParts = fullName.trim().split(/\s+/);
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(" ") || "";
    }

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
      firstName,
      lastName,
      newEmail: finalEmail || "N/A",
      newPhone: purePhone || finalPhone || "N/A", // Use pure phone number without country code
      prefix: countryCode || undefined, // Store country code separately
      // Store original values as old if they were changed
      oldEmail: finalEmail && finalEmail !== originalEmail && !isNA(originalEmail) ? originalEmail : undefined,
      oldPhone: purePhone && purePhone !== originalPurePhone && !isNA(originalPurePhone) ? originalPurePhone : undefined,
      country: country || "Bulgaria", // Default to Bulgaria if not provided
      client: "CreditoPro",
      status: "inactive",
      priority: "high",
      assignedAgent: null,
      address: address || (isNA(verification.personalInfo.address) ? undefined : verification.personalInfo.address),
      gender: gender || "not_defined",
      dob: dob ? new Date(dob) : undefined,
      sin: isNA(verification.personalInfo.egn) ? undefined : verification.personalInfo.egn,
      createdBy: req.user._id,
      submissionMode: "external",
      // Store verification reference
      verificationSessionId: sessionId,
      documents: PHOTO_TYPES.filter(
        (photoType) => verification.photos[photoType]
      ).map((photoType) => ({
        url: `s3:${sessionId}/photos/${photoType}.jpg`,
        description:
          {
            idFront: "ID Front (Verified)",
            idBack: "ID Back (Verified)",
            selfieWithIdFront: "Selfie with ID Front (Verified)",
            selfieWithIdBack: "Selfie with ID Back (Verified)",
            selfieOnly: "Selfie Only (Verified)",
          }[photoType] || photoType,
        uploadedAt: verification.photos[photoType].capturedAt,
        documentType: "verification_photo",
        verificationData: {
          photoType,
          sessionId,
          ...(photoType === "selfieOnly" && {
            rekognitionResult: verification.metadata.rekognitionResult,
          }),
        },
      })),
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

    // Delete ALL verification documents with this sessionId from temporary database
    // (there may be duplicates due to external source submissions)
    const deleteResult = await collection.deleteMany({ sessionId });

    if (deleteResult.deletedCount === 0) {
      console.warn(
        `Warning: Failed to delete verification ${sessionId} from temporary database`
      );
      // Continue execution - the lead was created successfully, this is just cleanup
    } else {
      console.log(
        `✅ Verification ${sessionId} successfully migrated to lead ${newLead._id} and ${deleteResult.deletedCount} document(s) removed from temporary database`
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
    if (verification.metadata.status === "manually_rejected" || verification.metadata.status === "verification_failed") {
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
      verification_failed: 0,
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
