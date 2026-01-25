const express = require('express');
const { param, query } = require('express-validator');
const { protect, isAdmin, isManager } = require('../middleware/auth');
const { imageAuth } = require('../middleware/imageAuth');
const {
  uploadFineImage,
  getFineImage,
  getFineImageThumbnail,
  getFineImageInfo,
  deleteFineImage,
  getFineImages,
  cleanupUnusedFineImages
} = require('../controllers/fineImages');

const router = express.Router();

// Validation middleware
const imageIdValidation = [
  param('imageId')
    .isMongoId()
    .withMessage('Invalid image ID')
];

const fineIdValidation = [
  param('fineId')
    .isMongoId()
    .withMessage('Invalid fine ID')
];

// Upload fine image (managers for creating fines, agents for responding to fines)
router.post('/upload', protect, uploadFineImage);

// Get fine image (full size) - uses imageAuth for <img> tag compatibility
router.get('/:imageId', imageAuth, imageIdValidation, getFineImage);

// Get fine image thumbnail - uses imageAuth for <img> tag compatibility
router.get('/:imageId/thumbnail', imageAuth, imageIdValidation, getFineImageThumbnail);

// Get fine image info/metadata
router.get('/:imageId/info', protect, imageIdValidation, getFineImageInfo);

// Delete fine image
router.delete('/:imageId', protect, imageIdValidation, deleteFineImage);

// Get all images for a fine
router.get('/fine/:fineId', protect, fineIdValidation, getFineImages);

// Admin: Cleanup unused images
router.delete('/admin/cleanup', protect, isAdmin, cleanupUnusedFineImages);

module.exports = router;
