const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { imageAuth } = require('../middleware/imageAuth');
const {
  uploadImage,
  getImage,
  getImageThumbnail,
  getImageInfo,
  deleteImage,
  getUserImages,
  cleanupUnusedImages
} = require('../controllers/chatImages');

const router = express.Router();

// Upload a new image
router.post(
  '/upload',
  [
    protect, // This route needs standard auth
    // File validation is handled in the controller since we're using express-fileupload
    body('conversationId')
      .optional()
      .isMongoId()
      .withMessage('Invalid conversation ID')
  ],
  uploadImage
);

// Get full image by ID (uses imageAuth for token in query params)
router.get(
  '/:imageId',
  [
    param('imageId')
      .isMongoId()
      .withMessage('Invalid image ID')
  ],
  imageAuth, // 🔑 Image serving routes use imageAuth (handles token from query)
  getImage
);

// Get image thumbnail (uses imageAuth for token in query params)
router.get(
  '/:imageId/thumbnail',
  [
    param('imageId')
      .isMongoId()
      .withMessage('Invalid image ID')
  ],
  imageAuth, // 🔑 Image serving routes use imageAuth (handles token from query)
  getImageThumbnail
);

// Get image metadata/info
router.get(
  '/:imageId/info',
  [
    protect, // This route needs standard auth
    param('imageId')
      .isMongoId()
      .withMessage('Invalid image ID')
  ],
  getImageInfo
);

// Delete an image (owner or admin only)
router.delete(
  '/:imageId',
  [
    protect, // This route needs standard auth
    param('imageId')
      .isMongoId()
      .withMessage('Invalid image ID')
  ],
  deleteImage
);

// Get current user's images
router.get(
  '/my/images',
  [
    protect, // This route needs standard auth
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'originalName', 'processedSize', 'usageCount'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],
  getUserImages
);

// Admin: Cleanup unused images
router.delete(
  '/admin/cleanup',
  [
    protect, // This route needs standard auth
    authorize('admin'),
    query('daysOld')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days old must be between 1 and 365')
  ],
  cleanupUnusedImages
);

module.exports = router; 