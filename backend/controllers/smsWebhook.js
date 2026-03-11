const IncomingSMS = require("../models/IncomingSMS");
const GatewayDevice = require("../models/GatewayDevice");
const SimCard = require("../models/SimCard");

/**
 * Handle incoming SMS from GoIP gateway HTTP-POST forward.
 * The gateway sends: username, password, sender, receiver, port, content, charset
 * URL pattern: /:webhookSlug (e.g., /gsm_canada1)
 */
exports.handleSmsWebhook = async (req, res, next) => {
  try {
    const { webhookSlug } = req.params;

    // Skip paths that are clearly not webhook slugs
    if (webhookSlug.startsWith("api") || webhookSlug.includes(".")) {
      return next();
    }

    // GoIP sends params as query params for GET, body for POST
    const data = { ...req.query, ...req.body };
    const { username, password, sender, content, port } = data;
    const receiver = data.receiver || data.recipient || "";

    // Find gateway by webhook slug
    const gateway = await GatewayDevice.findOne({
      "webhook.slug": webhookSlug,
      "webhook.enabled": true,
    });

    if (!gateway) {
      // Not a known webhook slug - pass to next route handler
      return next();
    }

    // Validate credentials
    if (
      gateway.webhook.username !== username ||
      gateway.webhook.password !== password
    ) {
      return res.status(401).send("Unauthorized");
    }

    if (!sender || !content) {
      return res.status(400).send("Missing sender or content");
    }

    // Parse port number (GoIP sends port as "1", "2", etc.)
    const portStr = port?.toString() || "";

    // Find matching SIM card by gateway + port
    let simCard = null;
    if (portStr) {
      simCard = await SimCard.findOne({
        "gateway.gatewayId": gateway._id,
        "gateway.enabled": true,
        "gateway.port": portStr,
      });
    }

    // Check for duplicate (same sender, content, gateway, within 1 minute)
    const now = new Date();
    const duplicate = await IncomingSMS.findOne({
      sender,
      content,
      gatewayDevice: gateway._id,
      timestamp: {
        $gte: new Date(now.getTime() - 60000),
        $lte: new Date(now.getTime() + 60000),
      },
    });

    if (duplicate) {
      return res.status(200).send("OK");
    }

    // Save the SMS
    await IncomingSMS.create({
      timestamp: now,
      sender,
      recipient: receiver || simCard?.simNumber || "",
      content,
      port: portStr,
      slot: "1",
      simCard: simCard?._id || null,
      gatewayDevice: gateway._id,
    });

    console.log(
      `[SMS Webhook] ${webhookSlug}: from=${sender} port=${portStr} content="${content.substring(0, 50)}"`
    );

    // GoIP expects a simple 200 response
    res.status(200).send("OK");
  } catch (error) {
    console.error("[SMS Webhook] Error:", error.message);
    res.status(500).send("Error");
  }
};
