const express = require("express");
const { body } = require("express-validator");
const {
  getOurNetworks,
  getOurNetwork,
  createOurNetwork,
  updateOurNetwork,
  deleteOurNetwork,
  getMyOurNetworks,
  getNetworkAuditLogs,
  getAllAuditLogs,
} = require("../controllers/ourNetworks");
const { protect, isAdmin, authorize } = require("../middleware/auth");
const {
  requireSensitiveActionVerification,
} = require("../middleware/sensitiveAction");

const router = express.Router();

router.get(
  "/",
  [protect, authorize("admin", "affiliate_manager", "lead_manager")],
  getOurNetworks
);
router.get(
  "/my-networks",
  [protect, authorize("affiliate_manager")],
  getMyOurNetworks
);
router.get(
  "/:id",
  [protect, authorize("admin", "affiliate_manager")],
  getOurNetwork
);

router.post(
  "/",
  [
    protect,
    isAdmin,
    // Require 2FA verification for creating networks (contains wallets)
    requireSensitiveActionVerification("WALLET_CREATE", {
      targetResourceType: "network",
      getTargetResource: () => null, // New resource, no ID yet
    }),
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name is required and must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("assignedAffiliateManager")
      .optional()
      .isMongoId()
      .withMessage("Affiliate manager ID must be a valid MongoDB ObjectId"),
    body("cryptoWallets.ethereum")
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (!Array.isArray(value)) {
          throw new Error("Ethereum wallets must be an array");
        }
        const validAddresses = value.filter(
          (addr) => addr && addr.trim() !== ""
        );
        if (validAddresses.some((addr) => !/^0x[a-fA-F0-9]{40}$/.test(addr))) {
          throw new Error("Invalid Ethereum wallet address format");
        }
        return true;
      }),
    body("cryptoWallets.bitcoin")
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (!Array.isArray(value)) {
          throw new Error("Bitcoin wallets must be an array");
        }
        const validAddresses = value.filter(
          (addr) => addr && addr.trim() !== ""
        );
        if (
          validAddresses.some(
            (addr) =>
              !/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(
                addr
              )
          )
        ) {
          throw new Error("Invalid Bitcoin wallet address format");
        }
        return true;
      }),
    body("cryptoWallets.tron")
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (!Array.isArray(value)) {
          throw new Error("TRON wallets must be an array");
        }
        const validAddresses = value.filter(
          (addr) => addr && addr.trim() !== ""
        );
        if (validAddresses.some((addr) => !/^T[A-Za-z1-9]{33}$/.test(addr))) {
          throw new Error("Invalid TRON wallet address format");
        }
        return true;
      }),
  ],
  createOurNetwork
);

router.put(
  "/:id",
  [
    protect,
    isAdmin,
    // Require 2FA verification for updating networks (wallets may be changed)
    requireSensitiveActionVerification("WALLET_UPDATE", {
      targetResourceType: "network",
    }),
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
    body("assignedAffiliateManager")
      .optional()
      .isMongoId()
      .withMessage("Affiliate manager ID must be a valid MongoDB ObjectId"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    body("cryptoWallets.ethereum")
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (!Array.isArray(value)) {
          throw new Error("Ethereum wallets must be an array");
        }
        const validAddresses = value.filter(
          (addr) => addr && addr.trim() !== ""
        );
        if (validAddresses.some((addr) => !/^0x[a-fA-F0-9]{40}$/.test(addr))) {
          throw new Error("Invalid Ethereum wallet address format");
        }
        return true;
      }),
    body("cryptoWallets.bitcoin")
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (!Array.isArray(value)) {
          throw new Error("Bitcoin wallets must be an array");
        }
        const validAddresses = value.filter(
          (addr) => addr && addr.trim() !== ""
        );
        if (
          validAddresses.some(
            (addr) =>
              !/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(
                addr
              )
          )
        ) {
          throw new Error("Invalid Bitcoin wallet address format");
        }
        return true;
      }),
    body("cryptoWallets.tron")
      .optional()
      .custom((value) => {
        if (!value) return true;
        if (!Array.isArray(value)) {
          throw new Error("TRON wallets must be an array");
        }
        const validAddresses = value.filter(
          (addr) => addr && addr.trim() !== ""
        );
        if (validAddresses.some((addr) => !/^T[A-Za-z1-9]{33}$/.test(addr))) {
          throw new Error("Invalid TRON wallet address format");
        }
        return true;
      }),
  ],
  updateOurNetwork
);

router.delete(
  "/:id",
  [
    protect,
    isAdmin,
    // Require 2FA verification for deleting networks (contains wallets)
    requireSensitiveActionVerification("WALLET_DELETE", {
      targetResourceType: "network",
    }),
  ],
  deleteOurNetwork
);

// Audit log routes
router.get("/audit-logs/all", [protect, isAdmin], getAllAuditLogs);

router.get(
  "/:id/audit-logs",
  [protect, authorize("admin", "affiliate_manager")],
  getNetworkAuditLogs
);

module.exports = router;
