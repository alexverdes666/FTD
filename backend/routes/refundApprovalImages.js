const express = require("express");
const { param } = require("express-validator");
const { protect } = require("../middleware/auth");
const { imageAuth } = require("../middleware/imageAuth");
const {
  uploadImage,
  getImage,
  getImageThumbnail,
  getApprovalImages,
} = require("../controllers/refundApprovalImages");

const router = express.Router();

// Validation middleware
const imageIdValidation = [
  param("imageId").isMongoId().withMessage("Invalid image ID"),
];

const approvalIdValidation = [
  param("approvalId").isMongoId().withMessage("Invalid approval ID"),
];

// Upload evidence image (admin and superior lead manager)
router.post("/upload", protect, uploadImage);

// Get full image - uses imageAuth for <img> tag compatibility
router.get("/:imageId", imageAuth, imageIdValidation, getImage);

// Get image thumbnail - uses imageAuth for <img> tag compatibility
router.get(
  "/:imageId/thumbnail",
  imageAuth,
  imageIdValidation,
  getImageThumbnail
);

// Get all images for an approval
router.get(
  "/approval/:approvalId",
  protect,
  approvalIdValidation,
  getApprovalImages
);

module.exports = router;
