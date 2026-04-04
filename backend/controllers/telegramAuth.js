const TelegramAuthSession = require("../models/TelegramAuthSession");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Helper function to get client IP
const getClientIP = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return realIP.trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
};

// Helper function to send Telegram message
const sendTelegramMessage = async (chatId, text, options = {}) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN not configured");
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...options,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error("Telegram sendMessage error:", data);
    throw new Error(`Telegram API error: ${data.description}`);
  }
  return data;
};

// Helper function to edit Telegram message
const editTelegramMessage = async (chatId, messageId, text) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error("Telegram editMessage error:", data);
    }
    return data;
  } catch (err) {
    console.error("Failed to edit Telegram message:", err);
  }
};

// Helper function to answer callback query
const answerCallbackQuery = async (callbackQueryId, text) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  const body = {
    callback_query_id: callbackQueryId,
    text,
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Failed to answer callback query:", err);
  }
};

/**
 * Webhook handler for Telegram bot
 * Handles both text messages (for linking) and callback queries (for approve/reject)
 * POST /api/telegram-auth/webhook
 */
exports.webhook = async (req, res) => {
  // Always respond 200 to Telegram immediately
  res.status(200).json({ ok: true });

  try {
    const update = req.body;

    if (!update || typeof update !== "object") {
      console.error("Telegram Auth: Webhook received empty or invalid body");
      return;
    }

    // Handle callback_query (approve/reject button presses)
    if (update.callback_query) {
      console.log(
        `Telegram Auth: Callback query received - action: ${update.callback_query.data}, from: ${update.callback_query.from?.id}`
      );
      await handleCallbackQuery(update.callback_query);
      return;
    }

    // Handle text messages (linking codes)
    if (update.message && update.message.text) {
      console.log(
        `Telegram Auth: Message received - from: ${update.message.from?.id}, text: ${update.message.text.substring(0, 20)}...`
      );
      await handleTextMessage(update.message);
      return;
    }
  } catch (error) {
    console.error("Error processing Telegram webhook:", error);
  }
};

/**
 * Handle text messages from Telegram (for linking)
 */
async function handleTextMessage(message) {
  const chatId = message.chat.id.toString();
  const text = message.text.trim();
  const telegramUsername = message.from?.username || null;

  // Check if this user is already linked to any account
  const knownUser = await User.findOne({ telegramChatId: chatId });

  // Handle /start command - only show help, no sensitive info
  if (text === "/start") {
    if (knownUser) {
      await sendTelegramMessage(
        chatId,
        `<b>FTD Authentication Bot</b>\n\nLinked to: <b>${knownUser.email}</b>\n\nYou'll receive login approval requests here.`
      );
    } else {
      await sendTelegramMessage(
        chatId,
        "<b>FTD Authentication Bot</b>\n\nSend a <code>LINK_xxx</code> code from your FTD profile to get started."
      );
    }
    return;
  }

  // Check if this is a link code
  if (text.startsWith("LINK_")) {
    const linkCode = text;

    // Find user with this link code
    const user = await User.findOne({
      telegramLinkCode: linkCode,
      telegramLinkExpiry: { $gt: new Date() },
    }).select("+telegramLinkCode");

    if (!user) {
      await sendTelegramMessage(
        chatId,
        "Invalid or expired link code. Please generate a new one from your Profile page."
      );
      return;
    }

    // Link the Telegram account
    user.telegramChatId = chatId;
    user.telegramUsername = telegramUsername;
    user.telegramAuthEnabled = true;
    user.telegramLinkedAt = new Date();
    user.telegramLinkCode = null;
    user.telegramLinkExpiry = null;
    // Disable other auth methods
    user.twoFactorEnabled = false;
    user.qrAuthEnabled = false;
    await user.save();

    console.log(
      `Telegram Auth: Account linked for ${user.email} (chatId: ${chatId})`
    );

    await sendTelegramMessage(
      chatId,
      `Account linked successfully!\n\n` +
        `<b>Account:</b> ${user.email}\n` +
        `<b>Name:</b> ${user.fullName}\n\n` +
        `You will now receive login approval requests here.`
    );
    return;
  }

  // Unknown message - don't respond to strangers, only respond to linked users
  if (knownUser) {
    await sendTelegramMessage(chatId, "Type /start for info.");
  }
}

/**
 * Handle callback queries (approve/reject button presses)
 */
async function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat?.id?.toString();
  const fromId = callbackQuery.from?.id?.toString();
  const messageId = callbackQuery.message?.message_id;

  if (!data || !chatId) return;

  // Verify the person clicking is the chat owner (prevents forwarded message abuse)
  if (fromId !== chatId) {
    await answerCallbackQuery(callbackQuery.id, "Not authorized");
    return;
  }

  // Parse callback data: "approve:{sessionToken}" or "reject:{sessionToken}"
  const [action, sessionToken] = data.split(":");

  if (!sessionToken || !["approve", "reject"].includes(action)) {
    await answerCallbackQuery(callbackQuery.id, "Invalid action");
    return;
  }

  // Find the session
  const session = await TelegramAuthSession.findValidSession(sessionToken);

  if (!session) {
    await answerCallbackQuery(callbackQuery.id, "Session expired or not found");
    await editTelegramMessage(
      chatId,
      messageId,
      "This session has expired or was already processed."
    );
    return;
  }

  // Verify the chatId matches the user's linked Telegram
  const user = await User.findById(session.userId);
  if (!user || user.telegramChatId !== chatId) {
    await answerCallbackQuery(
      callbackQuery.id,
      "Not authorized for this session"
    );
    return;
  }

  if (action === "approve") {
    await session.approve();

    await answerCallbackQuery(callbackQuery.id, "Login approved!");

    if (session.type === "sensitive") {
      await editTelegramMessage(
        chatId,
        messageId,
        `<b>Sensitive Action Approved</b>\n\n` +
          `<b>Action:</b> ${session.actionType || "Sensitive Action"}\n` +
          `<b>Account:</b> ${user.email}\n` +
          `<b>Time:</b> ${new Date().toUTCString()}\n\n` +
          `Status: APPROVED`
      );
    } else {
      await editTelegramMessage(
        chatId,
        messageId,
        `<b>Login Approved</b>\n\n` +
          `<b>Account:</b> ${user.email}\n` +
          `<b>IP:</b> ${session.loginIP || "Unknown"}\n` +
          `<b>Time:</b> ${new Date().toUTCString()}\n\n` +
          `Status: APPROVED`
      );
    }

    console.log(
      `Telegram Auth: Session ${session.type} approved for ${user.email}`
    );
  } else if (action === "reject") {
    await session.reject("User rejected from Telegram");

    await answerCallbackQuery(callbackQuery.id, "Login rejected");

    if (session.type === "sensitive") {
      await editTelegramMessage(
        chatId,
        messageId,
        `<b>Sensitive Action Rejected</b>\n\n` +
          `<b>Action:</b> ${session.actionType || "Sensitive Action"}\n` +
          `<b>Account:</b> ${user.email}\n` +
          `<b>Time:</b> ${new Date().toUTCString()}\n\n` +
          `Status: REJECTED`
      );
    } else {
      await editTelegramMessage(
        chatId,
        messageId,
        `<b>Login Rejected</b>\n\n` +
          `<b>Account:</b> ${user.email}\n` +
          `<b>IP:</b> ${session.loginIP || "Unknown"}\n` +
          `<b>Time:</b> ${new Date().toUTCString()}\n\n` +
          `Status: REJECTED`
      );
    }

    console.log(
      `Telegram Auth: Session ${session.type} rejected for ${user.email}`
    );
  }
}

/**
 * Create a new Telegram login session
 * Called when user has telegramAuthEnabled and enters credentials
 * POST /api/telegram-auth/create-session
 */
exports.createSession = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Verify user exists and has Telegram auth enabled
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.telegramAuthEnabled || !user.telegramChatId) {
      return res.status(400).json({
        success: false,
        message: "Telegram authentication is not enabled for this user",
      });
    }

    // Create a new session
    const loginIP = getClientIP(req);
    const loginUserAgent = req.headers["user-agent"] || "Unknown";

    const session = await TelegramAuthSession.createSession(
      userId,
      "login",
      loginIP,
      loginUserAgent
    );

    // Send Telegram message with inline keyboard
    const messageText =
      `<b>Login Request</b>\n\n` +
      `<b>Account:</b> ${user.email}\n` +
      `<b>Name:</b> ${user.fullName}\n` +
      `<b>IP:</b> ${loginIP}\n` +
      `<b>Time:</b> ${new Date().toUTCString()}\n\n` +
      `Do you approve this login?`;

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "\u274c",
              callback_data: `reject:${session.sessionToken}`,
            },
            {
              text: "\u2705",
              callback_data: `approve:${session.sessionToken}`,
            },
          ],
        ],
      },
    };

    const telegramResult = await sendTelegramMessage(
      user.telegramChatId,
      messageText,
      inlineKeyboard
    );

    // Store the message ID for later editing
    if (telegramResult?.result?.message_id) {
      session.telegramMessageId = telegramResult.result.message_id;
      session.telegramChatId = user.telegramChatId;
      await session.save();
    }

    res.status(200).json({
      success: true,
      data: {
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error creating Telegram session:", error);
    next(error);
  }
};

/**
 * Check session status (polling endpoint)
 * GET /api/telegram-auth/session-status/:sessionToken
 */
exports.checkSessionStatus = async (req, res, next) => {
  try {
    const { sessionToken } = req.params;

    const session = await TelegramAuthSession.findOne({ sessionToken });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      return res.status(200).json({
        success: true,
        data: {
          status: "expired",
          message: "Session has expired",
        },
      });
    }

    if (session.status === "approved") {
      if (session.type === "login") {
        // Generate the actual login token
        const token = generateToken(session.userId);

        // Get user data
        const user = await User.findById(session.userId);

        return res.status(200).json({
          success: true,
          data: {
            status: "approved",
            token,
            user,
            message: "Login approved",
          },
        });
      } else if (session.type === "sensitive") {
        return res.status(200).json({
          success: true,
          data: {
            status: "approved",
            verificationToken: session.verificationToken,
            message: "Action approved",
          },
        });
      }
    }

    if (session.status === "rejected") {
      return res.status(200).json({
        success: true,
        data: {
          status: "rejected",
          message:
            session.type === "sensitive"
              ? "Action was rejected"
              : "Login was rejected",
        },
      });
    }

    // Still pending
    res.status(200).json({
      success: true,
      data: {
        status: "pending",
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error checking Telegram session status:", error);
    next(error);
  }
};

/**
 * Generate a link code for connecting Telegram account
 * POST /api/telegram-auth/generate-link-code
 * Protected route (requires authentication)
 */
exports.generateLinkCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Telegram authentication is only available for admin accounts",
      });
    }

    // Generate a unique link code
    const linkCode = "LINK_" + crypto.randomBytes(16).toString("hex");
    const linkExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(userId, {
      telegramLinkCode: linkCode,
      telegramLinkExpiry: linkExpiry,
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "ftd_auth_bot";

    res.status(200).json({
      success: true,
      data: {
        linkCode,
        botUsername,
        botUrl: `https://t.me/${botUsername}`,
        expiresAt: linkExpiry,
      },
    });
  } catch (error) {
    console.error("Error generating Telegram link code:", error);
    next(error);
  }
};

/**
 * Get Telegram auth status for current user
 * GET /api/telegram-auth/status
 * Protected route
 */
exports.getStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        telegramAuthEnabled: user.telegramAuthEnabled || false,
        telegramUsername: user.telegramUsername || null,
        telegramLinkedAt: user.telegramLinkedAt || null,
        isAdmin: user.role === "admin",
      },
    });
  } catch (error) {
    console.error("Error getting Telegram auth status:", error);
    next(error);
  }
};

/**
 * Disable Telegram auth
 * POST /api/telegram-auth/disable
 * Protected route
 */
exports.disableTelegramAuth = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await User.findByIdAndUpdate(userId, {
      telegramAuthEnabled: false,
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
      telegramLinkCode: null,
      telegramLinkExpiry: null,
    });

    res.status(200).json({
      success: true,
      message: "Telegram authentication has been disabled",
    });
  } catch (error) {
    console.error("Error disabling Telegram auth:", error);
    next(error);
  }
};

/**
 * Create a Telegram session for sensitive action verification
 * POST /api/telegram-auth/create-sensitive-action-session
 */
exports.createSensitiveActionSession = async (req, res, next) => {
  try {
    const { userId, actionType } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Verify user exists and has Telegram auth enabled
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.telegramAuthEnabled || !user.telegramChatId) {
      return res.status(400).json({
        success: false,
        message: "Telegram authentication is not enabled for this user",
      });
    }

    // Create a new sensitive action session
    const loginIP = getClientIP(req);
    const loginUserAgent = req.headers["user-agent"] || "Unknown";

    const session = await TelegramAuthSession.createSession(
      userId,
      "sensitive",
      loginIP,
      loginUserAgent,
      actionType || "Sensitive Action"
    );

    // Send Telegram message with inline keyboard
    const messageText =
      `<b>Sensitive Action Verification</b>\n\n` +
      `<b>Action:</b> ${actionType || "Sensitive Action"}\n` +
      `<b>Account:</b> ${user.email}\n` +
      `<b>IP:</b> ${loginIP}\n` +
      `<b>Time:</b> ${new Date().toUTCString()}\n\n` +
      `Do you approve this action?`;

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "\u274c",
              callback_data: `reject:${session.sessionToken}`,
            },
            {
              text: "\u2705",
              callback_data: `approve:${session.sessionToken}`,
            },
          ],
        ],
      },
    };

    const telegramResult = await sendTelegramMessage(
      user.telegramChatId,
      messageText,
      inlineKeyboard
    );

    // Store the message ID for later editing
    if (telegramResult?.result?.message_id) {
      session.telegramMessageId = telegramResult.result.message_id;
      session.telegramChatId = user.telegramChatId;
      await session.save();
    }

    res.status(200).json({
      success: true,
      data: {
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error creating Telegram sensitive action session:", error);
    next(error);
  }
};

/**
 * Set up the Telegram webhook
 * POST /api/telegram-auth/set-webhook
 */
exports.setWebhook = async (req, res, next) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const backendUrl = process.env.BACKEND_URL;

    if (!botToken || !backendUrl) {
      return res.status(400).json({
        success: false,
        message: "TELEGRAM_BOT_TOKEN and BACKEND_URL must be configured",
      });
    }

    const webhookUrl = `${backendUrl}/api/telegram-auth/webhook`;
    const url = `https://api.telegram.org/bot${botToken}/setWebhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`Telegram Auth: Webhook set to ${webhookUrl}`);
      res.status(200).json({
        success: true,
        message: `Webhook set to ${webhookUrl}`,
        data,
      });
    } else {
      console.error("Failed to set Telegram webhook:", data);
      res.status(500).json({
        success: false,
        message: "Failed to set webhook",
        data,
      });
    }
  } catch (error) {
    console.error("Error setting Telegram webhook:", error);
    next(error);
  }
};

/**
 * Get current webhook info from Telegram (for diagnostics)
 * GET /api/telegram-auth/webhook-info
 */
exports.getWebhookInfo = async (req, res, next) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({
        success: false,
        message: "TELEGRAM_BOT_TOKEN not configured",
      });
    }

    const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
    const response = await fetch(url);
    const data = await response.json();

    // Also show what the webhook SHOULD be
    const backendUrl = process.env.BACKEND_URL;
    const expectedWebhookUrl = backendUrl
      ? `${backendUrl}/api/telegram-auth/webhook`
      : "BACKEND_URL not configured";

    res.status(200).json({
      success: true,
      data: {
        ...data.result,
        expectedWebhookUrl,
        urlMatch: data.result?.url === expectedWebhookUrl,
      },
    });
  } catch (error) {
    console.error("Error getting webhook info:", error);
    next(error);
  }
};

/**
 * Auto-setup webhook on server start
 */
exports.setupWebhookOnStart = async () => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const backendUrl = process.env.BACKEND_URL;

    if (!botToken || !backendUrl) {
      console.log(
        "Telegram Auth: Skipping webhook setup - TELEGRAM_BOT_TOKEN or BACKEND_URL not configured"
      );
      return;
    }

    const webhookUrl = `${backendUrl}/api/telegram-auth/webhook`;
    const url = `https://api.telegram.org/bot${botToken}/setWebhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`Telegram Auth: Webhook set to ${webhookUrl}`);
    } else {
      console.error("Telegram Auth: Failed to set webhook:", data);
    }
  } catch (error) {
    console.error("Telegram Auth: Error setting webhook on start:", error);
  }
};

/**
 * Validate a Telegram verification token (used by sensitive action middleware)
 * This is an internal function, not an API endpoint
 */
exports.validateTelegramVerificationToken = async (token, userId) => {
  try {
    const session = await TelegramAuthSession.findOne({
      verificationToken: token,
      userId: userId,
      type: "sensitive",
      status: "approved",
    });

    if (!session) {
      return { valid: false, reason: "Token not found or not approved" };
    }

    // Check if token has expired (verification tokens are valid for 5 minutes after approval)
    const tokenExpiresAt = new Date(
      session.resolvedAt.getTime() + 5 * 60 * 1000
    );
    if (tokenExpiresAt < new Date()) {
      return { valid: false, reason: "Verification token has expired" };
    }

    // Check if token has already been used
    if (session.tokenUsed) {
      return {
        valid: false,
        reason: "Verification token has already been used",
      };
    }

    // Mark token as used
    session.tokenUsed = true;
    await session.save();

    return { valid: true, session };
  } catch (error) {
    console.error("Error validating Telegram verification token:", error);
    return { valid: false, reason: "Validation error" };
  }
};
