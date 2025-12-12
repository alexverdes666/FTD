const ChatImage = require('../models/ChatImage');
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

// Upload and process image
exports.uploadImage = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
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
    const existingImage = await ChatImage.findDuplicate(imageHash, req.user._id);
    if (existingImage) {
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
    const { chunks, chunkCount } = ChatImage.chunkImageData(
      processedBuffer, 
      IMAGE_CONFIG.CHUNK_SIZE
    );

    // Create ChatImage document
    const chatImage = new ChatImage({
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
      uploadedBy: req.user._id,
      usageCount: 1
    });

    await chatImage.save();

    res.status(201).json({
      success: true,
      message: 'Image uploaded and processed successfully',
      data: {
        _id: chatImage._id,
        originalName: chatImage.originalName,
        mimetype: chatImage.mimetype,
        processedSize: chatImage.processedSize,
        width: chatImage.width,
        height: chatImage.height,
        url: chatImage.url,
        thumbnailUrl: chatImage.thumbnailUrl,
        formattedSize: chatImage.formattedSize,
        compression: chatImage.compression
      }
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    next(error);
  }
};

// Get full image
exports.getImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const chatImage = await ChatImage.findById(imageId);
    if (!chatImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Reconstruct image from chunks
    const imageBuffer = chatImage.reconstructImageData();

    // Increment usage count (async, don't wait)
    chatImage.incrementUsage().catch(err => 
      console.error('Error incrementing usage:', err)
    );

    // Set appropriate headers
    res.set({
      'Content-Type': chatImage.mimetype,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': chatImage.hash,
      'Last-Modified': chatImage.updatedAt.toUTCString()
    });

    // Check for conditional requests
    const clientETag = req.get('If-None-Match');
    if (clientETag === chatImage.hash) {
      return res.status(304).end();
    }

    res.send(imageBuffer);

  } catch (error) {
    console.error('Error retrieving image:', error);
    next(error);
  }
};

// Get image thumbnail
exports.getImageThumbnail = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const chatImage = await ChatImage.findById(imageId).select('thumbnail mimetype hash updatedAt');
    if (!chatImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const thumbnailBuffer = Buffer.from(chatImage.thumbnail, 'base64');

    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg', // Thumbnails are always JPEG
      'Content-Length': thumbnailBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': `thumb-${chatImage.hash}`,
      'Last-Modified': chatImage.updatedAt.toUTCString()
    });

    // Check for conditional requests
    const clientETag = req.get('If-None-Match');
    if (clientETag === `thumb-${chatImage.hash}`) {
      return res.status(304).end();
    }

    res.send(thumbnailBuffer);

  } catch (error) {
    console.error('Error retrieving thumbnail:', error);
    next(error);
  }
};

// Get image metadata
exports.getImageInfo = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const chatImage = await ChatImage.findById(imageId)
      .select('-chunks -thumbnail')
      .populate('uploadedBy', 'fullName email');

    if (!chatImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.json({
      success: true,
      data: chatImage
    });

  } catch (error) {
    console.error('Error getting image info:', error);
    next(error);
  }
};

// Delete image (admin only or owner)
exports.deleteImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const chatImage = await ChatImage.findById(imageId);
    if (!chatImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check permission (owner or admin)
    if (chatImage.uploadedBy.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this image'
      });
    }

    await ChatImage.findByIdAndDelete(imageId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting image:', error);
    next(error);
  }
};

// List user's images
exports.getUserImages = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const images = await ChatImage.find({ uploadedBy: req.user._id })
      .select('-chunks') // Exclude chunk data for listing
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await ChatImage.countDocuments({ uploadedBy: req.user._id });

    res.json({
      success: true,
      data: images,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error listing user images:', error);
    next(error);
  }
};

// Admin: Cleanup unused images
exports.cleanupUnusedImages = async (req, res, next) => {
  try {
    const { daysOld = 30 } = req.query;

    const deletedCount = await ChatImage.cleanupUnused(parseInt(daysOld));

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} unused images`,
      deletedCount
    });

  } catch (error) {
    console.error('Error cleaning up images:', error);
    next(error);
  }
};

module.exports = {
  uploadImage: exports.uploadImage,
  getImage: exports.getImage,
  getImageThumbnail: exports.getImageThumbnail,
  getImageInfo: exports.getImageInfo,
  deleteImage: exports.deleteImage,
  getUserImages: exports.getUserImages,
  cleanupUnusedImages: exports.cleanupUnusedImages
}; 