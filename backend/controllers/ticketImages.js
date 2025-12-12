const TicketImage = require('../models/TicketImage');
const Ticket = require('../models/Ticket');
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

// Upload and process image for ticket
exports.uploadTicketImage = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const { ticketId, commentIndex } = req.body;
    
    // If ticketId is provided, verify ticket exists and user has access
    if (ticketId) {
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      // Check permissions
      const isOwner = ticket.createdBy.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only attach images to your own tickets'
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
    const existingImage = await TicketImage.findDuplicate(imageHash, req.user._id);
    if (existingImage && ticketId) {
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
    const { chunks, chunkCount } = TicketImage.chunkImageData(
      processedBuffer, 
      IMAGE_CONFIG.CHUNK_SIZE
    );

    // Create TicketImage document
    const ticketImage = new TicketImage({
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
      ticketId: ticketId || null,
      commentIndex: commentIndex ? parseInt(commentIndex) : null,
      uploadedBy: req.user._id,
      usageCount: 1
    });

    await ticketImage.save();

    res.status(201).json({
      success: true,
      message: 'Image uploaded and processed successfully',
      data: {
        _id: ticketImage._id,
        originalName: ticketImage.originalName,
        mimetype: ticketImage.mimetype,
        processedSize: ticketImage.processedSize,
        width: ticketImage.width,
        height: ticketImage.height,
        url: ticketImage.url,
        thumbnailUrl: ticketImage.thumbnailUrl,
        formattedSize: ticketImage.formattedSize,
        compression: ticketImage.compression
      }
    });

  } catch (error) {
    console.error('Error uploading ticket image:', error);
    next(error);
  }
};

// Get full image
exports.getTicketImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const ticketImage = await TicketImage.findById(imageId);
    if (!ticketImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has access to the ticket
    const ticket = await Ticket.findById(ticketImage.ticketId);
    if (ticket) {
      const isOwner = ticket.createdBy.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only view images from your own tickets'
        });
      }
    }

    // Reconstruct image from chunks
    const imageBuffer = ticketImage.reconstructImageData();

    // Increment usage count (async, don't wait)
    ticketImage.incrementUsage().catch(err => 
      console.error('Error incrementing usage:', err)
    );

    // Set appropriate headers
    res.set({
      'Content-Type': ticketImage.mimetype,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': ticketImage.hash,
      'Last-Modified': ticketImage.updatedAt.toUTCString()
    });

    // Check for conditional requests
    const clientETag = req.get('If-None-Match');
    if (clientETag === ticketImage.hash) {
      return res.status(304).end();
    }

    res.send(imageBuffer);

  } catch (error) {
    console.error('Error retrieving ticket image:', error);
    next(error);
  }
};

// Get image thumbnail
exports.getTicketImageThumbnail = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const ticketImage = await TicketImage.findById(imageId).select('thumbnail mimetype hash updatedAt ticketId');
    if (!ticketImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has access to the ticket
    const ticket = await Ticket.findById(ticketImage.ticketId);
    if (ticket) {
      const isOwner = ticket.createdBy.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only view images from your own tickets'
        });
      }
    }

    const thumbnailBuffer = Buffer.from(ticketImage.thumbnail, 'base64');

    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg', // Thumbnails are always JPEG
      'Content-Length': thumbnailBuffer.length,
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': `thumb-${ticketImage.hash}`,
      'Last-Modified': ticketImage.updatedAt.toUTCString()
    });

    // Check for conditional requests
    const clientETag = req.get('If-None-Match');
    if (clientETag === `thumb-${ticketImage.hash}`) {
      return res.status(304).end();
    }

    res.send(thumbnailBuffer);

  } catch (error) {
    console.error('Error retrieving ticket thumbnail:', error);
    next(error);
  }
};

// Get image metadata
exports.getTicketImageInfo = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const ticketImage = await TicketImage.findById(imageId)
      .select('-chunks -thumbnail')
      .populate('uploadedBy', 'fullName email');

    if (!ticketImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has access to the ticket
    const ticket = await Ticket.findById(ticketImage.ticketId);
    if (ticket) {
      const isOwner = ticket.createdBy.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only view images from your own tickets'
        });
      }
    }

    res.json({
      success: true,
      data: ticketImage
    });

  } catch (error) {
    console.error('Error getting ticket image info:', error);
    next(error);
  }
};

// Delete image (admin only or owner)
exports.deleteTicketImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    const ticketImage = await TicketImage.findById(imageId);
    if (!ticketImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check permission (owner or admin)
    if (ticketImage.uploadedBy.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this image'
      });
    }

    await TicketImage.findByIdAndDelete(imageId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting ticket image:', error);
    next(error);
  }
};

// List ticket's images
exports.getTicketImages = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    // Verify ticket exists and user has access
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const isOwner = ticket.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only view images from your own tickets'
      });
    }

    const images = await TicketImage.find({ ticketId })
      .select('-chunks') // Exclude chunk data for listing
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'fullName email');

    res.json({
      success: true,
      data: images
    });

  } catch (error) {
    console.error('Error listing ticket images:', error);
    next(error);
  }
};

// Admin: Cleanup unused images
exports.cleanupUnusedTicketImages = async (req, res, next) => {
  try {
    const { daysOld = 30 } = req.query;

    const deletedCount = await TicketImage.cleanupUnused(parseInt(daysOld));

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} unused ticket images`,
      deletedCount
    });

  } catch (error) {
    console.error('Error cleaning up ticket images:', error);
    next(error);
  }
};

module.exports = {
  uploadTicketImage: exports.uploadTicketImage,
  getTicketImage: exports.getTicketImage,
  getTicketImageThumbnail: exports.getTicketImageThumbnail,
  getTicketImageInfo: exports.getTicketImageInfo,
  deleteTicketImage: exports.deleteTicketImage,
  getTicketImages: exports.getTicketImages,
  cleanupUnusedTicketImages: exports.cleanupUnusedTicketImages
};

