const RefundApprovalImage = require("../models/RefundApprovalImage");
const RefundApproval = require("../models/RefundApproval");
const sharp = require("sharp");
const crypto = require("crypto");
const fs = require("fs");

// Image processing configuration
const IMAGE_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1080,
  THUMBNAIL_SIZE: 150,
  JPEG_QUALITY: 85,
  WEBP_QUALITY: 80,
  CHUNK_SIZE: 16384, // 16KB per chunk
  ALLOWED_FORMATS: ["image/jpeg", "image/png", "image/gif", "image/webp"],
};

// Upload and process evidence image for refund approval
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    const { approvalId } = req.body;

    // Verify approval exists and user has permission
    if (approvalId) {
      const approval = await RefundApproval.findById(approvalId);
      if (!approval) {
        return res.status(404).json({
          success: false,
          message: "Approval not found",
        });
      }

      const isAdmin = req.user.role === "admin";
      const isSuperior =
        approval.superiorManager.toString() === req.user._id.toString();

      if (!isAdmin && !isSuperior) {
        return res.status(403).json({
          success: false,
          message:
            "Only admin or superior lead manager can upload evidence images",
        });
      }
    }

    const imageFile = req.files.image;

    // Validate file type
    if (!IMAGE_CONFIG.ALLOWED_FORMATS.includes(imageFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format. Supported formats: JPEG, PNG, GIF, WebP",
      });
    }

    // Validate file size
    if (imageFile.size > IMAGE_CONFIG.MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `Image size exceeds ${IMAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
      });
    }

    // Read file data
    const imageData = imageFile.tempFilePath
      ? fs.readFileSync(imageFile.tempFilePath)
      : imageFile.data;

    // Generate hash for deduplication
    const imageHash = crypto
      .createHash("sha256")
      .update(imageData)
      .digest("hex");

    // Check for duplicate
    const existingImage = await RefundApprovalImage.findDuplicate(
      imageHash,
      req.user._id
    );
    if (existingImage && approvalId) {
      existingImage.usageCount += 1;
      await existingImage.save();
      return res.status(200).json({
        success: true,
        message: "Image already exists",
        data: {
          _id: existingImage._id,
          originalName: existingImage.originalName,
          mimetype: existingImage.mimetype,
          processedSize: existingImage.processedSize,
          width: existingImage.width,
          height: existingImage.height,
          url: existingImage.url,
          thumbnailUrl: existingImage.thumbnailUrl,
          formattedSize: existingImage.formattedSize,
        },
        duplicate: true,
      });
    }

    // Process image with Sharp
    let sharpInstance = sharp(imageData);
    const metadata = await sharpInstance.metadata();

    const needsResize =
      metadata.width > IMAGE_CONFIG.MAX_WIDTH ||
      metadata.height > IMAGE_CONFIG.MAX_HEIGHT;

    let processedBuffer;
    let finalWidth = metadata.width;
    let finalHeight = metadata.height;

    if (needsResize) {
      const aspectRatio = metadata.width / metadata.height;
      if (metadata.width > metadata.height) {
        finalWidth = Math.min(metadata.width, IMAGE_CONFIG.MAX_WIDTH);
        finalHeight = Math.round(finalWidth / aspectRatio);
      } else {
        finalHeight = Math.min(metadata.height, IMAGE_CONFIG.MAX_HEIGHT);
        finalWidth = Math.round(finalHeight * aspectRatio);
      }

      sharpInstance = sharpInstance.resize(finalWidth, finalHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to optimal format
    let outputFormat = "jpeg";
    let quality = IMAGE_CONFIG.JPEG_QUALITY;

    if (imageFile.mimetype === "image/png" && metadata.hasAlpha) {
      outputFormat = "png";
    } else if (imageFile.mimetype === "image/gif") {
      outputFormat = "gif";
    } else {
      outputFormat = "webp";
      quality = IMAGE_CONFIG.WEBP_QUALITY;
    }

    switch (outputFormat) {
      case "jpeg":
        processedBuffer = await sharpInstance
          .jpeg({ quality, progressive: true })
          .toBuffer();
        break;
      case "webp":
        processedBuffer = await sharpInstance.webp({ quality }).toBuffer();
        break;
      case "png":
        processedBuffer = await sharpInstance
          .png({ compressionLevel: 9 })
          .toBuffer();
        break;
      default:
        processedBuffer = await sharpInstance.toBuffer();
    }

    // Generate thumbnail
    const thumbnailBuffer = await sharp(processedBuffer)
      .resize(IMAGE_CONFIG.THUMBNAIL_SIZE, IMAGE_CONFIG.THUMBNAIL_SIZE, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Chunk the processed image
    const { chunks, chunkCount } = RefundApprovalImage.chunkImageData(
      processedBuffer,
      IMAGE_CONFIG.CHUNK_SIZE
    );

    // Create image document
    const approvalImage = new RefundApprovalImage({
      originalName: imageFile.name,
      mimetype: `image/${outputFormat}`,
      originalSize: imageFile.size,
      processedSize: processedBuffer.length,
      width: finalWidth,
      height: finalHeight,
      chunks,
      chunkCount,
      chunkSize: IMAGE_CONFIG.CHUNK_SIZE,
      thumbnail: thumbnailBuffer.toString("base64"),
      hash: imageHash,
      compression: {
        quality,
        format: outputFormat,
        resized: needsResize,
        maxWidth: needsResize ? finalWidth : undefined,
        maxHeight: needsResize ? finalHeight : undefined,
      },
      approvalId: approvalId || null,
      uploadedBy: req.user._id,
      usageCount: 1,
    });

    await approvalImage.save();

    res.status(201).json({
      success: true,
      message: "Evidence image uploaded successfully",
      data: {
        _id: approvalImage._id,
        originalName: approvalImage.originalName,
        mimetype: approvalImage.mimetype,
        processedSize: approvalImage.processedSize,
        width: approvalImage.width,
        height: approvalImage.height,
        url: approvalImage.url,
        thumbnailUrl: approvalImage.thumbnailUrl,
        formattedSize: approvalImage.formattedSize,
        compression: approvalImage.compression,
      },
    });
  } catch (error) {
    console.error("Error uploading refund approval image:", error);
    next(error);
  }
};

// Get full image
exports.getImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const image = await RefundApprovalImage.findById(imageId);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Reconstruct image from chunks
    const imageBuffer = image.reconstructImageData();

    // Set headers
    res.set({
      "Content-Type": image.mimetype,
      "Content-Length": imageBuffer.length,
      "Cache-Control": "public, max-age=31536000",
      ETag: image.hash,
      "Last-Modified": image.updatedAt.toUTCString(),
    });

    // Check for conditional requests
    const clientETag = req.get("If-None-Match");
    if (clientETag === image.hash) {
      return res.status(304).end();
    }

    res.send(imageBuffer);
  } catch (error) {
    console.error("Error retrieving refund approval image:", error);
    next(error);
  }
};

// Get image thumbnail
exports.getImageThumbnail = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const image = await RefundApprovalImage.findById(imageId).select(
      "thumbnail mimetype hash updatedAt"
    );
    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    const thumbnailBuffer = Buffer.from(image.thumbnail, "base64");

    res.set({
      "Content-Type": "image/jpeg",
      "Content-Length": thumbnailBuffer.length,
      "Cache-Control": "public, max-age=31536000",
      ETag: `thumb-${image.hash}`,
      "Last-Modified": image.updatedAt.toUTCString(),
    });

    const clientETag = req.get("If-None-Match");
    if (clientETag === `thumb-${image.hash}`) {
      return res.status(304).end();
    }

    res.send(thumbnailBuffer);
  } catch (error) {
    console.error("Error retrieving refund approval thumbnail:", error);
    next(error);
  }
};

// Get images for an approval
exports.getApprovalImages = async (req, res, next) => {
  try {
    const { approvalId } = req.params;

    const images = await RefundApprovalImage.getImagesByApprovalId(approvalId);

    res.json({
      success: true,
      data: images,
    });
  } catch (error) {
    console.error("Error listing approval images:", error);
    next(error);
  }
};
