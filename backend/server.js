require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const fileUpload = require("express-fileupload");
const http = require("http");
const socketIo = require("socket.io");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const twoFactorRoutes = require("./routes/twoFactor");
const qrAuthRoutes = require("./routes/qrAuth");
const orderRoutes = require("./routes/orders");
const leadRoutes = require("./routes/leads");
const leadProfileRoutes = require("./routes/leadProfiles");
const deletedLeadsRoutes = require("./routes/deletedLeads");
const userRoutes = require("./routes/users");
const landingRoutes = require("./routes/landing");
const agentRoutes = require("./routes/agents");
const clientNetworkRoutes = require("./routes/clientNetworks");
const ourNetworkRoutes = require("./routes/ourNetworks");
const clientBrokerRoutes = require("./routes/clientBrokers");
const pspRoutes = require("./routes/psps");
const cardIssuerRoutes = require("./routes/cardIssuers");
const campaignRoutes = require("./routes/campaigns");

const agentBonusRoutes = require("./routes/agentBonuses");
const agentCallCountsRoutes = require("./routes/agentCallCounts");
const agentFineRoutes = require("./routes/agentFines");
const withdrawalRoutes = require("./routes/withdrawals");
const scraperRoutes = require("./routes/scraper");
const salaryConfigurationRoutes = require("./routes/salaryConfiguration");
const affiliateManagerMetricsRoutes = require("./routes/affiliateManagerMetrics");
const affiliateManagerTableRoutes = require("./routes/affiliateManagerTable");
const blockchainRoutes = require("./routes/blockchain");
const agentMonthlyHistoryRoutes = require("./routes/agentMonthlyHistory");
const chatRoutes = require("./routes/chat");
const verificationsRoutes = require("./routes/verifications");
const refundsRoutes = require("./routes/refunds");
const systemConfigurationRoutes = require("./routes/systemConfiguration");
const financialRoutes = require("./routes/financial");
const agentCommentRoutes = require("./routes/agentComments");
const ticketRoutes = require("./routes/tickets");
const ticketImageRoutes = require("./routes/ticketImages");
const fineImageRoutes = require("./routes/fineImages");
const notificationRoutes = require("./routes/notifications");
const simCardRoutes = require("./routes/simCards");
const smsRoutes = require("./routes/sms");
const accountManagementRoutes = require("./routes/accountManagement");
const gatewayDeviceRoutes = require("./routes/gatewayDevices");
const agentScheduleRoutes = require("./routes/agentSchedule");
const agentCallAppointmentRoutes = require("./routes/agentCallAppointments");
const callChangeRequestRoutes = require("./routes/callChangeRequests");
const videoRoutes = require("./routes/video");
const announcementRoutes = require("./routes/announcements");
const amTargetRoutes = require("./routes/amTargets");
const depositCallsRoutes = require("./routes/depositCalls");
const agentCallDeclarationRoutes = require("./routes/agentCallDeclarations");
const securityAuditRoutes = require("./routes/securityAudit");
const activityLogRoutes = require("./routes/activityLogs");
const deviceDetectionRoutes = require("./routes/deviceDetection");
const agentCheckinRoutes = require("./routes/agentCheckin");
const globalSearchRoutes = require("./routes/globalSearch");
const crmDealRoutes = require("./routes/crmDeals");
const amiAgentRoutes = require("./routes/amiAgents");
const errorHandler = require("./middleware/errorHandler");
const { changeTracker } = require("./middleware/changeTracker");
const { activityLogger } = require("./middleware/activityLogger");
const { deviceDetectionMiddleware } = require("./middleware/deviceDetection");
const SessionCleanupService = require("./services/sessionCleanupService");
const AgentScraperService = require("./services/agentScraperService");
const schedulerService = require("./services/scheduler");
const { createProxyMiddleware } = require("http-proxy-middleware");

// Connect to MongoDB
connectDB();

const app = express();

// Trust proxy for correct IP detection behind reverse proxy (Render, etc.)
app.set("trust proxy", true);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
  if (process.env.NODE_ENV !== "test") {
    try {
      const sessionCleanupService = new SessionCleanupService();
      sessionCleanupService.initializeScheduledJobs();
      console.log("✅ Session cleanup service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize session cleanup service:", error);
    }

    try {
      const agentScraperService = AgentScraperService;
      agentScraperService.initializeScheduledScraping();
      console.log("✅ Agent scraper service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize agent scraper service:", error);
    }

    try {
      const BlockchainScraperService = require("./services/blockchainScraperService");
      const blockchainScraperService = BlockchainScraperService.getInstance();
      blockchainScraperService.initializeScheduledScraping();
      console.log("✅ Blockchain scraper service initialized");
    } catch (error) {
      console.error(
        "❌ Failed to initialize blockchain scraper service:",
        error
      );
    }

    try {
      const leadSearchCache = require("./services/leadSearchCache");
      leadSearchCache.warmUp();
      console.log("✅ Lead search cache warming up");
    } catch (error) {
      console.error("❌ Failed to warm up lead search cache:", error);
    }

    // Initialize AMI service after MongoDB is connected (needs User.find())
    try {
      const amiService = require("./services/amiService");
      amiService.initialize(io);
      console.log("✅ AMI service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize AMI service:", error);
    }
  }
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "*.onrender.com"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      origin.includes(".vercel.app") ||
      origin.includes("ftdm2.com")
    ) {
      return callback(null, true);
    }
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return callback(null, true);
    }
    const allowedOrigins = (process.env.CORS_ORIGIN || "")
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "X-2FA-Code", // For sensitive action 2FA verification
    "X-2FA-Backup-Code", // For sensitive action backup code verification
    "X-QR-Verification-Token", // For QR auth sensitive action verification
    "X-Device-ID", // For device fingerprinting/audit trail
    "X-Device-Fingerprint", // For full device fingerprint data
    "X-Client-Local-IPs", // For client internal IP detection (WebRTC)
    "X-Unlock-Token", // For lead profile credential unlock verification
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (req.method === "DELETE") {
    express.json({ limit: "10mb" })(req, res, next);
  } else {
    next();
  }
});
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: true,
    tempFileDir: require("os").tmpdir(),
    abortOnLimit: true,
    responseOnLimit: "File size limit has been reached",
    debug: false,
  })
);

// Serve uploaded files statically
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const PORT = process.env.PORT || 5000;

// Set request timeout (25 seconds to stay under Render's 30s limit)
const REQUEST_TIMEOUT = 25000;

// Create HTTP server
const server = http.createServer(app);

// Set server timeout
server.timeout = REQUEST_TIMEOUT;
server.keepAliveTimeout = REQUEST_TIMEOUT;
server.headersTimeout = REQUEST_TIMEOUT + 1000;

// Set up Socket.IO with optimized configuration for Render
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      // Use same CORS logic as Express
      if (
        !origin ||
        origin.includes(".vercel.app") ||
        origin.includes("ftd-omega.vercel.app") ||
        origin.includes("ftdm2.com") ||
        origin.includes(".onrender.com") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }
      const allowedOrigins = (process.env.CORS_ORIGIN || "")
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Optimized configuration for Render deployment
  transports: ["polling", "websocket"], // Start with polling, then upgrade
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  // Enable compression for better performance
  compression: true,
  httpCompression: true,
  // Production-specific settings
  connectionStateRecovery: false,
  cleanupEmptyChildNamespaces: true,
});

// Socket.IO authentication middleware
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const { LRUCache } = require("lru-cache");

// --- Socket auth cache (avoids DB hit on every reconnect) ---
const socketAuthCache = new LRUCache({
  max: 500,
  ttl: 60 * 1000, // 60-second TTL
});

// --- Global typing timeouts keyed by `userId:conversationId` ---
const globalTypingTimeouts = new Map();

// Safety net: evict orphaned typing timeouts every 30s (handles missed disconnects)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of globalTypingTimeouts) {
    // Typing timeouts should never last more than 10 seconds
    if (entry.createdAt && now - entry.createdAt > 10000) {
      clearTimeout(entry.timeout);
      globalTypingTimeouts.delete(key);
    }
  }
}, 30000);

// --- Track active sockets per user (prevents zombie socket accumulation) ---
const userActiveSockets = new Map(); // userId -> Set<socketId>
const MAX_SOCKETS_PER_USER = 3;

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error - no token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userIdStr = String(decoded.id);

    // Check cache first to avoid DB hit during reconnection storms
    let user = socketAuthCache.get(userIdStr);
    if (!user) {
      user = await User.findById(decoded.id).select("-password");
      if (user) {
        socketAuthCache.set(userIdStr, user);
      }
    }

    if (!user || !user.isActive) {
      return next(new Error("Authentication error - invalid user"));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Authentication error - invalid token"));
  }
});

// Socket.IO connection handling with enhanced error handling
io.on("connection", (socket) => {
  console.log(
    `🔌 User ${socket.userId} connected via ${socket.conn.transport.name}`
  );

  // --- Per-user socket limit: disconnect oldest if over limit ---
  if (!userActiveSockets.has(socket.userId)) {
    userActiveSockets.set(socket.userId, new Set());
  }
  const userSockets = userActiveSockets.get(socket.userId);

  // If user already has too many sockets, disconnect the oldest ones
  if (userSockets.size >= MAX_SOCKETS_PER_USER) {
    const socketsToRemove = [...userSockets].slice(0, userSockets.size - MAX_SOCKETS_PER_USER + 1);
    for (const oldSocketId of socketsToRemove) {
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        console.log(`⚠️ Disconnecting stale socket ${oldSocketId} for user ${socket.userId} (limit: ${MAX_SOCKETS_PER_USER})`);
        oldSocket.disconnect(true);
      }
      userSockets.delete(oldSocketId);
    }
  }
  userSockets.add(socket.id);

  // Join user to their personal room for direct messaging
  socket.join(`user:${socket.userId}`);

  // Handle user going online
  socket.emit("connected", {
    message: "Connected to chat server",
    userId: socket.userId,
    transport: socket.conn.transport.name,
    timestamp: new Date().toISOString(),
  });

  // Handle transport upgrade
  socket.conn.on("upgrade", () => {
    console.log(
      `🔄 User ${socket.userId} upgraded to ${socket.conn.transport.name}`
    );
  });

  // Handle joining admin performance room (admin only)
  socket.on("join_room", (roomName, callback) => {
    try {
      // Only allow admin to join admin rooms
      if (roomName.startsWith('admin:') && socket.user.role !== 'admin') {
        console.warn(`⚠️ Non-admin user ${socket.userId} tried to join ${roomName}`);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Unauthorized' });
        }
        return;
      }
      
      socket.join(roomName);
      console.log(`👥 User ${socket.userId} joined room ${roomName}`);
      
      if (typeof callback === 'function') {
        callback({ success: true, room: roomName });
      }
    } catch (error) {
      console.error(`❌ Error joining room ${roomName}:`, error);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  // Handle leaving rooms
  socket.on("leave_room", (roomName, callback) => {
    try {
      socket.leave(roomName);
      console.log(`👋 User ${socket.userId} left room ${roomName}`);
      
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error(`❌ Error leaving room ${roomName}:`, error);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  // Handle joining conversation rooms
  socket.on("join_conversation", (conversationId, callback) => {
    try {
      socket.join(`conversation:${conversationId}`);
      console.log(
        `👥 User ${socket.userId} joined conversation ${conversationId}`
      );

      // Confirm room join with callback for reliability
      const confirmation = {
        conversationId,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      };

      socket.emit("room_joined", confirmation);

      // Use callback if provided (for acknowledgment)
      if (typeof callback === "function") {
        callback({ success: true, ...confirmation });
      }
    } catch (error) {
      console.error(`❌ Error joining conversation ${conversationId}:`, error);
      if (typeof callback === "function") {
        callback({ success: false, error: error.message });
      }
    }
  });

  // Handle leaving conversation rooms
  socket.on("leave_conversation", (conversationId, callback) => {
    try {
      socket.leave(`conversation:${conversationId}`);
      console.log(
        `👋 User ${socket.userId} left conversation ${conversationId}`
      );

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (error) {
      console.error(`❌ Error leaving conversation ${conversationId}:`, error);
      if (typeof callback === "function") {
        callback({ success: false, error: error.message });
      }
    }
  });

  // Handle typing indicators with debouncing (using global Map)
  socket.on("typing", async (data) => {
    try {
      const { conversationId } = data;
      const typingKey = `${socket.userId}:${conversationId}`;

      // Verify user is participant in the conversation
      const Conversation = require("./models/Conversation");
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return;
      }

      if (!conversation.isParticipant(socket.userId)) {
        return;
      }

      // Clear existing timeout for this user+conversation
      if (globalTypingTimeouts.has(typingKey)) {
        clearTimeout(globalTypingTimeouts.get(typingKey).timeout);
      }

      // Get other participants (exclude current user)
      const otherParticipants = conversation.participants.filter((p) => {
        const participantUserId = p.user._id
          ? p.user._id.toString()
          : p.user.toString();
        return participantUserId !== socket.userId.toString();
      });

      // Emit typing event to each participant's personal room
      otherParticipants.forEach((participant) => {
        const participantId = participant.user._id
          ? participant.user._id.toString()
          : participant.user.toString();
        io.to(`user:${participantId}`).emit("user_typing", {
          userId: socket.userId,
          userName: socket.user.fullName,
          conversationId,
          timestamp: new Date().toISOString(),
        });
      });

      // Auto-stop typing after 5 seconds
      const timeout = setTimeout(() => {
        otherParticipants.forEach((participant) => {
          const participantId = participant.user._id
            ? participant.user._id.toString()
            : participant.user.toString();
          io.to(`user:${participantId}`).emit("user_stop_typing", {
            userId: socket.userId,
            conversationId,
          });
        });
        globalTypingTimeouts.delete(typingKey);
      }, 5000);

      globalTypingTimeouts.set(typingKey, { timeout, createdAt: Date.now() });
    } catch (error) {
      console.error(`❌ Error handling typing indicator:`, error);
    }
  });

  socket.on("stop_typing", async (data) => {
    try {
      const { conversationId } = data;
      const typingKey = `${socket.userId}:${conversationId}`;

      // Clear timeout if exists
      if (globalTypingTimeouts.has(typingKey)) {
        clearTimeout(globalTypingTimeouts.get(typingKey).timeout);
        globalTypingTimeouts.delete(typingKey);
      }

      // Verify user is participant in the conversation
      const Conversation = require("./models/Conversation");
      const conversation = await Conversation.findById(conversationId);

      if (!conversation || !conversation.isParticipant(socket.userId)) {
        return;
      }

      // Get other participants (exclude current user)
      const otherParticipants = conversation.participants.filter((p) => {
        const participantUserId = p.user._id
          ? p.user._id.toString()
          : p.user.toString();
        return participantUserId !== socket.userId.toString();
      });

      // Emit stop typing event to each participant's personal room
      otherParticipants.forEach((participant) => {
        const participantId = participant.user._id
          ? participant.user._id.toString()
          : participant.user.toString();
        io.to(`user:${participantId}`).emit("user_stop_typing", {
          userId: socket.userId,
          conversationId,
        });
      });
    } catch (error) {
      console.error(`❌ Error handling stop typing:`, error);
    }
  });

  // Handle ping/pong for connection health monitoring
  socket.on("ping", (callback) => {
    if (typeof callback === "function") {
      callback({
        timestamp: new Date().toISOString(),
        userId: socket.userId,
      });
    }
  });

  // Handle disconnect with cleanup
  socket.on("disconnect", (reason) => {
    console.log(`🔌 User ${socket.userId} disconnected: ${reason}`);

    // Remove socket from per-user tracking
    const sockets = userActiveSockets.get(socket.userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userActiveSockets.delete(socket.userId);
      }
    }

    // Clear all typing timeouts for this user (global map, keyed by userId:conversationId)
    for (const [key, entry] of globalTypingTimeouts) {
      if (key.startsWith(`${socket.userId}:`)) {
        clearTimeout(entry.timeout);
        globalTypingTimeouts.delete(key);
      }
    }

  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.error(`❌ Socket error for user ${socket.userId}:`, error);
  });
});

// Make io available to routes - MUST be before route definitions
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Change Tracker - Fetches previous state before modifications
app.use(changeTracker);

// Activity Logger - Logs POST/PUT/PATCH/DELETE operations to ActivityLog collection
app.use(activityLogger({ saveToDatabase: true, consoleLog: process.env.NODE_ENV !== 'production' }));

// Device Detection - Calls get_info service for POST/PUT/PATCH/DELETE and logs to DeviceDetectionLog
app.use(deviceDetectionMiddleware());

// Define routes AFTER Socket.IO setup so req.io is available
app.use("/api/auth", authRoutes);
app.use("/api/two-factor", twoFactorRoutes);
app.use("/api/qr-auth", qrAuthRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/lead-profiles", leadProfileRoutes);
app.use("/api/deleted-leads", deletedLeadsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/landing", landingRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/client-networks", clientNetworkRoutes);
app.use("/api/our-networks", ourNetworkRoutes);
app.use("/api/client-brokers", clientBrokerRoutes);
app.use("/api/psps", pspRoutes);
app.use("/api/card-issuers", cardIssuerRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/agent-bonuses", agentBonusRoutes);
app.use("/api/agent-call-counts", agentCallCountsRoutes);
app.use("/api/agent-fines", agentFineRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/scraper", scraperRoutes);
app.use("/api/salary-configuration", salaryConfigurationRoutes);
app.use("/api/affiliate-manager-metrics", affiliateManagerMetricsRoutes);
app.use("/api/affiliate-manager-table", affiliateManagerTableRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/agent-monthly-history", agentMonthlyHistoryRoutes);
app.use("/api/debug", require("./routes/debug"));
app.use("/api/chat/images", require("./routes/chatImages"));
app.use("/api/chat/unread", require("./routes/chat-unread"));
app.use("/api/chat", chatRoutes);
app.use("/api/verifications", verificationsRoutes);
app.use("/api/refunds", refundsRoutes);
app.use("/api/financial", financialRoutes);
app.use("/api/agent-comments", agentCommentRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/ticket-images", ticketImageRoutes);
app.use("/api/fine-images", fineImageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/simcards", simCardRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/account-management", accountManagementRoutes);
app.use("/api/gateway-devices", gatewayDeviceRoutes);
app.use("/api/ami-agents", amiAgentRoutes);
app.use("/api/agent-schedule", agentScheduleRoutes);
app.use("/api/agent-call-appointments", agentCallAppointmentRoutes);
app.use("/api/call-change-requests", callChangeRequestRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/am-targets", amTargetRoutes);
app.use("/api/deposit-calls", depositCallsRoutes);
app.use("/api/call-declarations", agentCallDeclarationRoutes);
app.use("/api/sticky-notes", require("./routes/stickyNotes"));
app.use("/api/sheets", require("./routes/sheets"));

app.use("/api/system-config", systemConfigurationRoutes);
app.use("/api/security-audit", securityAuditRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/device-detection", deviceDetectionRoutes);
app.use("/api/agent-checkin", agentCheckinRoutes);
app.use("/api/global-search", globalSearchRoutes);
app.use("/api/crm-deals", crmDealRoutes);
const exportRoutes = require("./routes/export");
app.use("/api/export", exportRoutes);
const healthRoutes = require("./routes/health");
app.use("/api/health", healthRoutes);
const amExpensesRoutes = require("./routes/amExpenses");
app.use("/api/am-expenses", amExpensesRoutes);
app.use(errorHandler);
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

server.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT}`
  );

  // Initialize scheduler service after server starts
  // This ensures both database and socket.io are ready
  if (process.env.NODE_ENV !== "test") {
    try {
      schedulerService.initialize(io);
      schedulerService.startAll();
      console.log("✅ Scheduler service initialized and started");
    } catch (error) {
      console.error("❌ Failed to initialize scheduler service:", error);
    }

  }
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");

  // Stop scheduler jobs
  try {
    schedulerService.stopAll();
    console.log("✅ Scheduler service stopped");
  } catch (error) {
    console.error("❌ Error stopping scheduler service:", error);
  }

  // Shutdown AMI service
  try {
    const amiService = require("./services/amiService");
    amiService.shutdown();
    console.log("✅ AMI service stopped");
  } catch (error) {
    console.error("❌ Error stopping AMI service:", error);
  }

  server.close(() => {
    console.log("Process terminated");
    mongoose.connection.close();
  });
});

module.exports = app;
