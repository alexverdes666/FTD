const express = require("express");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.S3_BUCKET_NAME || "creditopro-verification-sessions-2025";

// All routes require authentication and lead_manager or admin role
router.use(protect);
router.use(authorize("admin", "lead_manager"));

/**
 * GET /api/video/:sessionId/photos/:filename
 * Generate a signed URL for a verification photo stored in S3
 */
router.get("/:sessionId/photos/:filename", async (req, res) => {
  try {
    const { sessionId, filename } = req.params;

    if (!sessionId || !filename) {
      return res.status(400).json({
        success: false,
        error: "Session ID and filename are required",
      });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error("AWS credentials not configured");
      return res.status(500).json({
        success: false,
        error: "Photo service not configured. Please contact administrator.",
      });
    }

    const s3Key = `${sessionId}/photos/${filename}`;

    console.log(`[PHOTO] Generating signed URL for: ${s3Key} in bucket ${S3_BUCKET}`);

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    console.log(`[PHOTO] Successfully generated signed URL for: ${s3Key}`);

    res.json({
      success: true,
      url: signedUrl,
    });
  } catch (error) {
    console.error("[PHOTO] Error generating signed URL:", error);

    if (error.name === "NoSuchKey") {
      return res.status(404).json({
        success: false,
        error: "Photo not found",
      });
    }

    if (error.name === "AccessDenied") {
      return res.status(403).json({
        success: false,
        error: "Access denied to photo storage",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate photo URL",
    });
  }
});

/**
 * GET /api/video/:sessionId/:filename
 * Generate a signed URL for a video stored in S3
 */
router.get("/:sessionId/:filename", async (req, res) => {
  try {
    const { sessionId, filename } = req.params;

    if (!sessionId || !filename) {
      return res.status(400).json({
        success: false,
        error: "Session ID and filename are required",
      });
    }

    // Validate AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error("AWS credentials not configured");
      return res.status(500).json({
        success: false,
        error: "Video service not configured. Please contact administrator.",
      });
    }

    // Construct the S3 key
    const s3Key = `${sessionId}/${filename}`;

    console.log(`[VIDEO] Generating signed URL for: ${s3Key} in bucket ${S3_BUCKET}`);

    // Create the command to get the object
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    });

    // Generate a signed URL that expires in 1 hour
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    console.log(`[VIDEO] Successfully generated signed URL for: ${s3Key}`);

    res.json({
      success: true,
      url: signedUrl,
    });
  } catch (error) {
    console.error("[VIDEO] Error generating signed URL:", error);

    // Handle specific S3 errors
    if (error.name === "NoSuchKey") {
      return res.status(404).json({
        success: false,
        error: "Video not found",
      });
    }

    if (error.name === "AccessDenied") {
      return res.status(403).json({
        success: false,
        error: "Access denied to video storage",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate video URL",
    });
  }
});

module.exports = router;

