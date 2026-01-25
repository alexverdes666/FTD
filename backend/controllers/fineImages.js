const FineImage = require('../models/FineImage');
const AgentFine = require('../models/AgentFine');
const sharp = require('sharp');
const crypto = require('crypto');

// Image processing configuration
const IMAGE_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1080,
  THUMBNAIL_SIZE: 150,
  JPEG_QUALITY: 85,
  WEBP_QUALITY: 80,
  CHUNK_SIZE: 16384, // 16KB per chunk
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

// Upload and process image for fine
exports.uploadFineImage = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const { fineId } = req.body;

    // If fineId is provided, verify fine exists and user has access
    if (fineId) {
      const fine = await AgentFine.findById(fineId);
      if (!fine) {
        return res.status(404).json({
          success: false,
          message: 'Fine not found'
        });
      }

      // Check permissions
      const isManager = ['admin', 'affiliate_manager'].includes(req.user.role);
      const isOwnFine = fine.agent.toString() === req.user._id.toString();

      // Allow managers/admins OR agents for their own fines
      if (!isManager && !isOwnFine) {
        return res.status(403).json({
          success: false,
          message: 'You can only attach images to your own fines'
        });
      }
    }

    const imageFile = req.files.image;

    // Validate file type
    if (!IMAGE_CONFIG.ALLOWED_FORMATS.includes(imageFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format. Supported formats: JPEG, PNG, GIF, WebP'
      });
    }

    // Validate file size
    if (imageFile.size > IMAGE_CONFIG.MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `Image size exceeds ${IMAGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB limit`
      });
    }

    // Generate hash for deduplication
    const imageHash = crypto.createHash('sha256').update(imageFile.data).digest('hex');

    // Check for duplicate
    const existingImage = await FineImage.findDuplicate(imageHash, req.user._id);
    if (existingImage && fineId) {
      await existingImage.incrementUsage();
      return res.status(200).json({
        success: true,
        message: 'Image already exists',
        data: existingImage,
        duplicate: true
      });
    }

    // Process image with Sharp
    let sharpInstance = sharp(imageFile.data);
    const metadata = await sharpInstance.metadata();

    // Determine if resizing is needed
    const needsResize = metadata.width > IMAGE_CONFIG.MAX_WIDTH ||
      metadata.height > IMAGE_CONFIG.MAX_HEIGHT;

    let processedBuffer;
    let finalWidth = metadata.width;
    let finalHeight = metadata.height;

    if (needsResize) {
      // Calculate new dimensions maintaining aspect ratio
      const aspectRatio = metadata.width / metadata.height;
      if (metadata.width > metadata.height) {
        finalWidth = Math.min(metadata.width, IMAGE_CONFIG.MAX_WIDTH);
        finalHeight = Math.round(finalWidth / aspectRatio);
      } else {
        finalHeight = Math.min(metadata.height, IMAGE_CONFIG.MAX_HEIGHT);
        finalWidth = Math.round(finalHeight * aspectRatio);
      }

      sharpInstance = sharpInstance.resize(finalWidth, finalHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to optimal format
    let outputFormat = 'jpeg';
    let quality = IMAGE_CONFIG.JPEG_QUALITY;

    // Use WebP for better compression if supported
    if (imageFile.mimetype === 'image/png' && metadata.hasAlpha) {
      outputFormat = 'png';
    } else if (imageFile.mimetype === 'image/gif') {
      outputFormat = 'gif';
    } else {
      outputFormat = 'webp';
      quality = IMAGE_CONFIG.WEBP_QUALITY;
    }

    // Apply compression
    switch (outputFormat) {
      case 'jpeg':
        processedBuffer = await sharpInstance
          .jpeg({ quality, progressive: true })
          .toBuffer();
        break;
      case 'webp':
        processedBuffer = await sharpInstance
          .webp({ quality })
          .toBuffer();
        break;
      case 'png':
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
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Chunk the processed image
    const { chunks, chunkCount } = FineImage.chunkImageData(
      processedBuffer,
      IMAGE_CONFIG.CHUNK_SIZE
    );

    // Create FineImage document
    const fineImage = new FineImage({
      originalName: imageFile.name,
      mimetype: `image/${outputFormat}`,
      originalSize: imageFile.size,
      processedSize: processedBuffer.length,
      width: finalWidth,
      height: finalHeight,
      chunks,
      chunkCount,
      chunkSize: IMAGE_CONFIG.CHUNK_SIZE,
      thumbnail: thumbnailBuffer.toString('base64'),
      hash: imageHash,
      compression: {
        quality,
        format: outputFormat,
        resized: needsResize,
        maxWidth: needsResize ? finalWidth : undefined,
        maxHeight: needsResize ? finalHeight : undefined
      },
      fineId: fineId || null,
      uploadedBy: req.user._id,
      usageCount: 1
    });

    await fineImage.save();

    // If fineId was provided, add image to fine's images array
    if (fineId) {
      await AgentFine.findByIdAndUpdate(fineId, {
        $push: { images: fineImage._id }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Image uploaded and processed successfully',
      data: {
        _id: fineImage._id,
        originalName: fineImage.originalName,
        mimetype: fineImage.mimetype,
        processedSize: fineImage.processedSize,
        width: fineImage.width,
        height: fineImage.height,
        url: fineImage.url,
        thumbnailUrl: fineImage.thumbnailUrl,
        formattedSize: fineImage.formattedSize,
        compression: fineImage.compression
      }
    });

  } catch (error) {
    console.error('Error uploading fine image:', error);
    next(error);
  }
};

// Get full image
exports.getFineImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const fineImage = await FineImage.findById(imageId);
    if (!fineImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has access
    if (fineImage.fineId) {
      const fine = await AgentFine.findById(fineImage.fineId);
      if (fine) {
        const isOwner = fine.agent.toString() === req.user._id.toString();
        const isManager = ['admin', 'affiliate_manager'].includes(req.user.role);

        if (!isOwner && !isManager) {
          return res.status(403).json({
            success: false,
            message: 'You can only view images from your own fines'
          });
        }
      }
    }

    // Reconstruct image from chunks
    const imageBuffer = fineImage.reconstructImageData();

    // Increment usage count (async, don't wait)
    fineImage.incrementUsage().catch(err =>
      console.error('Error incrementing usage:', err)
    );

    // Set appropriate headers
    res.set({
      'Content-Type': fineImage.mimetype,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': fineImage.hash,
      'Last-Modified': fineImage.updatedAt.toUTCString()
    });

    // Check for conditional requests
    const clientETag = req.get('If-None-Match');
    if (clientETag === fineImage.hash) {
      return res.status(304).end();
    }

    res.send(imageBuffer);

  } catch (error) {
    console.error('Error retrieving fine image:', error);
    next(error);
  }
};

// Get image thumbnail
exports.getFineImageThumbnail = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const fineImage = await FineImage.findById(imageId).select('thumbnail mimetype hash updatedAt fineId');
    if (!fineImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has access
    if (fineImage.fineId) {
      const fine = await AgentFine.findById(fineImage.fineId);
      if (fine) {
        const isOwner = fine.agent.toString() === req.user._id.toString();
        const isManager = ['admin', 'affiliate_manager'].includes(req.user.role);

        if (!isOwner && !isManager) {
          return res.status(403).json({
            success: false,
            message: 'You can only view images from your own fines'
          });
        }
      }
    }

    const thumbnailBuffer = Buffer.from(fineImage.thumbnail, 'base64');

    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg', // Thumbnails are always JPEG
      'Content-Length': thumbnailBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': `thumb-${fineImage.hash}`,
      'Last-Modified': fineImage.updatedAt.toUTCString()
    });

    // Check for conditional requests
    const clientETag = req.get('If-None-Match');
    if (clientETag === `thumb-${fineImage.hash}`) {
      return res.status(304).end();
    }

    res.send(thumbnailBuffer);

  } catch (error) {
    console.error('Error retrieving fine thumbnail:', error);
    next(error);
  }
};

// Get image metadata
exports.getFineImageInfo = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const fineImage = await FineImage.findById(imageId)
      .select('-chunks -thumbnail')
      .populate('uploadedBy', 'fullName email');

    if (!fineImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has access
    if (fineImage.fineId) {
      const fine = await AgentFine.findById(fineImage.fineId);
      if (fine) {
        const isOwner = fine.agent.toString() === req.user._id.toString();
        const isManager = ['admin', 'affiliate_manager'].includes(req.user.role);

        if (!isOwner && !isManager) {
          return res.status(403).json({
            success: false,
            message: 'You can only view images from your own fines'
          });
        }
      }
    }

    res.json({
      success: true,
      data: fineImage
    });

  } catch (error) {
    console.error('Error getting fine image info:', error);
    next(error);
  }
};

// Delete image (admin only or uploader)
exports.deleteFineImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const fineImage = await FineImage.findById(imageId);
    if (!fineImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check permission (uploader, manager, or admin)
    const isUploader = fineImage.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isUploader && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this image'
      });
    }

    // Remove from fine's images array if associated
    if (fineImage.fineId) {
      await AgentFine.findByIdAndUpdate(fineImage.fineId, {
        $pull: { images: fineImage._id }
      });
    }

    await FineImage.findByIdAndDelete(imageId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting fine image:', error);
    next(error);
  }
};

// List fine's images
exports.getFineImages = async (req, res, next) => {
  try {
    const { fineId } = req.params;

    // Verify fine exists
    const fine = await AgentFine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: 'Fine not found'
      });
    }

    // Check if user has access
    const isOwner = fine.agent.toString() === req.user._id.toString();
    const isManager = ['admin', 'affiliate_manager'].includes(req.user.role);

    if (!isOwner && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'You can only view images from your own fines'
      });
    }

    const images = await FineImage.getImagesByFineId(fineId);

    res.json({
      success: true,
      data: images
    });

  } catch (error) {
    console.error('Error listing fine images:', error);
    next(error);
  }
};

// Admin: Cleanup unused images
exports.cleanupUnusedFineImages = async (req, res, next) => {
  try {
    const { daysOld = 30 } = req.query;

    const deletedCount = await FineImage.cleanupUnused(parseInt(daysOld));

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} unused fine images`,
      deletedCount
    });

  } catch (error) {
    console.error('Error cleaning up fine images:', error);
    next(error);
  }
};

module.exports = {
  uploadFineImage: exports.uploadFineImage,
  getFineImage: exports.getFineImage,
  getFineImageThumbnail: exports.getFineImageThumbnail,
  getFineImageInfo: exports.getFineImageInfo,
  deleteFineImage: exports.deleteFineImage,
  getFineImages: exports.getFineImages,
  cleanupUnusedFineImages: exports.cleanupUnusedFineImages
};
