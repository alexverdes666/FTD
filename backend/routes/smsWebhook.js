const express = require("express");
const { handleSmsWebhook } = require("../controllers/smsWebhook");

const router = express.Router();

// GoIP gateway SMS forward webhook
// Handles both GET and POST (GoIP supports HTTP-GET and HTTP-POST forward protocols)
router.get("/:webhookSlug", handleSmsWebhook);
router.post("/:webhookSlug", handleSmsWebhook);

module.exports = router;
