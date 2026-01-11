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
const userRoutes = require("./routes/users");
const landingRoutes = require("./routes/landing");
const agentRoutes = require("./routes/agents");
const clientNetworkRoutes = require("./routes/clientNetworks");
const ourNetworkRoutes = require("./routes/ourNetworks");
const clientBrokerRoutes = require("./routes/clientBrokers");
const campaignRoutes = require("./routes/campaigns");
const testRoutes = require("./routes/test");

const guiBrowserRoutes = require("./routes/gui-browser");
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
const notificationRoutes = require("./routes/notifications");
const simCardRoutes = require("./routes/simCards");
const accountManagementRoutes = require("./routes/accountManagement");
const gatewayDeviceRoutes = require("./routes/gatewayDevices");
const agentScheduleRoutes = require("./routes/agentSchedule");
const agentCallAppointmentRoutes = require("./routes/agentCallAppointments");
const callChangeRequestRoutes = require("./routes/callChangeRequests");
const videoRoutes = require("./routes/video");
const announcementRoutes = require("./routes/announcements");
const amTargetRoutes = require("./routes/amTargets");
const depositCallsRoutes = require("./routes/depositCalls");
const securityAuditRoutes = require("./routes/securityAudit");
const activityLogRoutes = require("./routes/activityLogs");
const deviceDetectionRoutes = require("./routes/deviceDetection");
const userActivityRoutes = require("./routes/userActivity");
const globalSearchRoutes = require("./routes/globalSearch");
const errorHandler = require("./middleware/errorHandler");
const { changeTracker } = require("./middleware/changeTracker");
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
    useTempFiles: false,
    abortOnLimit: true,
    responseOnLimit: "File size limit has been reached",
    debug: false,
  })
);
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

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error - no token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

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

  // Handle typing indicators with debouncing
  let typingTimeouts = new Map();

  socket.on("typing", async (data) => {
    try {
      const { conversationId } = data;

      // Verify user is participant in the conversation
      const Conversation = require("./models/Conversation");
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        console.warn(
          `⚠️ User ${socket.userId} tried to send typing indicator for non-existent conversation ${conversationId}`
        );
        return;
      }

      if (!conversation.isParticipant(socket.userId)) {
        console.warn(
          `⚠️ User ${socket.userId} tried to send typing indicator for conversation ${conversationId} they are not in`
        );
        return;
      }

      // Clear existing timeout for this conversation
      if (typingTimeouts.has(conversationId)) {
        clearTimeout(typingTimeouts.get(conversationId));
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
        typingTimeouts.delete(conversationId);
      }, 5000);

      typingTimeouts.set(conversationId, timeout);
    } catch (error) {
      console.error(`❌ Error handling typing indicator:`, error);
    }
  });

  socket.on("stop_typing", async (data) => {
    try {
      const { conversationId } = data;

      // Clear timeout if exists
      if (typingTimeouts.has(conversationId)) {
        clearTimeout(typingTimeouts.get(conversationId));
        typingTimeouts.delete(conversationId);
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

    // Clear all typing timeouts for this user
    typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    typingTimeouts.clear();
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
// This must come BEFORE device detection so previousState is available
app.use(changeTracker);

// Device Detection Middleware - Calls get_info service for comprehensive device detection
// Logs all POST, PUT, PATCH, DELETE operations with detailed device/security information
// Replaces the old activityLogger with enhanced detection capabilities:
// - Anti-detect browser detection (Dolphin Anty, Multilogin, etc.)
// - Proxy/VPN detection
// - Device system information (hostname, username, specs)
// - Geolocation data
// - Security risk scoring
app.use(deviceDetectionMiddleware());

// Define routes AFTER Socket.IO setup so req.io is available
app.use("/api/auth", authRoutes);
app.use("/api/two-factor", twoFactorRoutes);
app.use("/api/qr-auth", qrAuthRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/landing", landingRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/client-networks", clientNetworkRoutes);
app.use("/api/our-networks", ourNetworkRoutes);
app.use("/api/client-brokers", clientBrokerRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/test", testRoutes);

app.use("/api/gui-browser", guiBrowserRoutes);
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
app.use("/api/notifications", notificationRoutes);
app.use("/api/simcards", simCardRoutes);
app.use("/api/account-management", accountManagementRoutes);
app.use("/api/gateway-devices", gatewayDeviceRoutes);
app.use("/api/agent-schedule", agentScheduleRoutes);
app.use("/api/agent-call-appointments", agentCallAppointmentRoutes);
app.use("/api/call-change-requests", callChangeRequestRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/am-targets", amTargetRoutes);
app.use("/api/deposit-calls", depositCallsRoutes);
app.use("/api/sticky-notes", require("./routes/stickyNotes"));

app.use("/api/system-config", systemConfigurationRoutes);
app.use("/api/security-audit", securityAuditRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/device-detection", deviceDetectionRoutes);
app.use("/api/user-activity", userActivityRoutes);
app.use("/api/global-search", globalSearchRoutes);
const healthRoutes = require("./routes/health");
app.use("/api/health", healthRoutes);
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

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");

  // Stop scheduler jobs
  try {
    schedulerService.stopAll();
    console.log("✅ Scheduler service stopped");
  } catch (error) {
    console.error("❌ Error stopping scheduler service:", error);
  }

  server.close(() => {
    console.log("Process terminated");
    mongoose.connection.close();
  });
});

module.exports = app;
