const mongoose = require("mongoose");
const proxySchema = new mongoose.Schema(
  {
    proxyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    config: {
      server: {
        type: String,
        required: true,
      },
      username: {
        type: String,
        required: true,
      },
      password: {
        type: String,
        required: true,
      },
      host: {
        type: String,
        required: true,
      },
      port: {
        type: Number,
        required: true,
      },
    },
    country: {
      type: String,
      required: true,
      index: true,
    },
    countryCode: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "failed", "testing"],
      default: "testing",
      index: true,
    },
    usage: {
      totalConnections: {
        type: Number,
        default: 0,
      },
      activeConnections: {
        type: Number,
        default: 0,
      },
      maxConcurrentConnections: {
        type: Number,
        default: 5,
      },
      lastUsedAt: {
        type: Date,
        default: Date.now,
      },
      firstUsedAt: {
        type: Date,
        default: Date.now,
      },
    },
    health: {
      isHealthy: {
        type: Boolean,
        default: true,
        index: true,
      },
      lastHealthCheck: {
        type: Date,
        default: Date.now,
      },
      healthCheckInterval: {
        type: Number,
        default: 300000,
      },
      failedHealthChecks: {
        type: Number,
        default: 0,
      },
      maxFailedChecks: {
        type: Number,
        default: 3,
      },
      responseTime: {
        type: Number,
        default: 0,
      },
      lastError: {
        type: String,
        default: null,
      },
    },
    assignedLead: {
      leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
        sparse: true,
        index: true,
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        sparse: true,
      },
      assignedAt: {
        type: Date,
      },
      status: {
        type: String,
        enum: ["active", "completed", "failed"],
        default: "active",
      },
      completedAt: {
        type: Date,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionInfo: {
      sessionId: {
        type: String,
        required: true,
      },
      originalUsername: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
proxySchema.index({ country: 1, status: 1 });
proxySchema.index({ countryCode: 1, status: 1 });
proxySchema.index({ "health.isHealthy": 1, "health.lastHealthCheck": 1 });
proxySchema.index({ "assignedLead.leadId": 1 });
proxySchema.index({ "assignedLead.orderId": 1 });
proxySchema.index({ createdBy: 1 });
proxySchema.virtual("description").get(function () {
  return `${this.country} (${this.countryCode}) - ${this.config.host}:${this.config.port}`;
});
proxySchema.virtual("isAvailable").get(function () {
  return (
    this.status === "active" &&
    this.health.isHealthy &&
    !this.assignedLead.leadId
  );
});
proxySchema.virtual("canAcceptFTD").get(function () {
  return (
    this.isAvailable &&
    this.usage.activeConnections < this.usage.maxConcurrentConnections
  );
});
proxySchema.statics.createFromConfig = async function (
  country,
  countryCode,
  createdBy
) {
  const { generateProxyConfig } = require("../utils/proxyManager");
  try {
    const proxyConfig = await generateProxyConfig(country, countryCode);
    if (!proxyConfig) {
      throw new Error(`Failed to generate proxy config for ${country}`);
    }
    const proxyId = `${countryCode}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const proxyData = {
      proxyId,
      config: proxyConfig.config,
      country,
      countryCode,
      status: "testing",
      sessionInfo: {
        sessionId: proxyConfig.sessionId,
        originalUsername: proxyConfig.originalUsername,
      },
      createdBy,
    };
    const proxy = await this.create(proxyData);
    try {
      const isHealthy = await proxy.testConnection();
      if (isHealthy) {
        proxy.status = "active";
        console.log(`✅ Proxy created and verified for ${country}`);
      } else {
        proxy.status = "active";
        console.warn(
          `⚠️ Proxy health check failed for ${country}, but proxy created as active`
        );
      }
    } catch (healthError) {
      proxy.status = "active";
      console.warn(
        `⚠️ Proxy health check error for ${country}, but proxy created as active:`,
        healthError.message
      );
    }
    await proxy.save();
    return proxy;
  } catch (error) {
    console.error(`Error creating proxy for ${country}:`, error);
    throw error;
  }
};
proxySchema.methods.testConnection = async function () {
  const startTime = Date.now();
  try {
    console.log(
      `[PROXY-DEBUG] Testing proxy for ${this.country}: ${this.config.host}:${this.config.port}`
    );
    console.log(`[PROXY-DEBUG] Username: ${this.config.username}`);
    const { testProxyConnection } = require("../utils/proxyManager");
    const testResult = await testProxyConnection(this.config);
    const responseTime = Date.now() - startTime;
    if (testResult && testResult.success) {
      this.health.isHealthy = true;
      this.health.lastHealthCheck = new Date();
      this.health.failedHealthChecks = 0;
      this.health.responseTime = responseTime;
      this.health.lastError = null;
      console.log(
        `✅ Proxy health check passed for ${this.country}: ${
          testResult.ip || "unknown"
        } (${responseTime}ms)`
      );
      return true;
    } else {
      throw new Error(testResult?.error || "Proxy test failed");
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    this.health.isHealthy = false;
    this.health.lastHealthCheck = new Date();
    this.health.failedHealthChecks += 1;
    this.health.responseTime = responseTime;
    this.health.lastError = error.message;
    if (this.health.failedHealthChecks >= this.health.maxFailedChecks) {
      this.status = "failed";
    }
    console.error(
      `❌ Proxy health check failed for ${this.country}:`,
      error.message
    );
    return false;
  }
};
proxySchema.methods.assignLead = function (
  leadId,
  orderId,
  leadType = "non-ftd"
) {
  if (this.assignedLead.leadId) {
    return false;
  }
  this.assignedLead = {
    leadId,
    orderId,
    assignedAt: new Date(),
    status: "active",
  };
  this.usage.activeConnections = 1;
  this.usage.totalConnections += 1;
  this.usage.lastUsedAt = new Date();
  return true;
};
proxySchema.methods.unassignLead = function (leadId, status = "completed") {
  if (
    !this.assignedLead.leadId ||
    this.assignedLead.leadId.toString() !== leadId.toString()
  ) {
    return false;
  }
  this.assignedLead.status = status;
  this.assignedLead.completedAt = new Date();
  this.usage.activeConnections = 0;
  return true;
};
proxySchema.statics.findAvailableProxy = async function (
  country,
  countryCode,
  leadType = "non-ftd"
) {
  const query = {
    country,
    status: "active",
    "health.isHealthy": true,
    "assignedLead.leadId": { $exists: false },
  };
  return this.findOne(query).sort({ createdAt: 1 });
};
proxySchema.statics.findOrCreateProxy = async function (
  country,
  countryCode,
  createdBy,
  leadType = "non-ftd"
) {
  try {
    const proxy = await this.createFromConfig(country, countryCode, createdBy);
    return proxy;
  } catch (error) {
    console.error(`Failed to create proxy for ${country}:`, error);
    throw error;
  }
};
proxySchema.statics.cleanupFailedProxies = async function () {
  const failedProxies = await this.find({
    status: "failed",
  });
  for (const proxy of failedProxies) {
    if (proxy.usage.activeConnections === 0) {
      await proxy.deleteOne();
      console.log(`Cleaned up failed proxy: ${proxy.description}`);
    }
  }
  return failedProxies.length;
};
proxySchema.pre("save", function (next) {
  if (this.usage.activeConnections < 0) {
    this.usage.activeConnections = 0;
  }
  next();
});
module.exports = mongoose.model("Proxy", proxySchema);