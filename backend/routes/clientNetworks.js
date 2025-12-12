const express = require("express");
const { body } = require("express-validator");
const {
  getClientNetworks,
  getClientNetwork,
  createClientNetwork,
  updateClientNetwork,
  deleteClientNetwork,
} = require("../controllers/clientNetworks");
const { protect, isAdmin, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, getClientNetworks);
router.get("/:id", protect, getClientNetwork);

router.post(
  "/",
  [
    protect,
    isAdmin,
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name is required and must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
  ],
  createClientNetwork
);

router.put(
  "/:id",
  [
    protect,
    isAdmin,
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  updateClientNetwork
);

router.delete("/:id", [protect, isAdmin], deleteClientNetwork);

module.exports = router;
