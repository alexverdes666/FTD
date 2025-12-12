const express = require('express');
const { param, query } = require('express-validator');
const { protect, isAdmin } = require('../middleware/auth');
const { imageAuth } = require('../middleware/imageAuth');
const {
  uploadTicketImage,
  getTicketImage,
  getTicketImageThumbnail,
  getTicketImageInfo,
  deleteTicketImage,
  getTicketImages,
  cleanupUnusedTicketImages
} = require('../controllers/ticketImages');

const router = express.Router();

// Validation middleware
const imageIdValidation = [
  param('imageId')
    .isMongoId()
    .withMessage('Invalid image ID')
];

const ticketIdValidation = [
  param('ticketId')
    .isMongoId()
    .withMessage('Invalid ticket ID')
];

// Upload ticket image (requires standard auth)
router.post('/upload', protect, uploadTicketImage);

// Get ticket image (full size) - uses imageAuth for <img> tag compatibility
router.get('/:imageId', imageAuth, imageIdValidation, getTicketImage);

// Get ticket image thumbnail - uses imageAuth for <img> tag compatibility
router.get('/:imageId/thumbnail', imageAuth, imageIdValidation, getTicketImageThumbnail);

// Get ticket image info/metadata
router.get('/:imageId/info', protect, imageIdValidation, getTicketImageInfo);

// Delete ticket image
router.delete('/:imageId', protect, imageIdValidation, deleteTicketImage);

// Get all images for a ticket
router.get('/ticket/:ticketId', protect, ticketIdValidation, getTicketImages);

// Admin: Cleanup unused images
router.delete('/admin/cleanup', protect, isAdmin, cleanupUnusedTicketImages);

module.exports = router;

