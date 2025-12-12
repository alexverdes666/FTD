const mongoose = require("mongoose");
const fingerprintSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    deviceType: {
      type: String,
      enum: ["windows", "android", "ios", "mac"],
      required: true,
      index: true
    },
    browser: {
      name: {
        type: String,
        enum: ["chrome", "firefox", "safari", "edge"],
        default: "chrome"
      },
      version: {
        type: String,
        required: true
      }
    },
    screen: {
      width: {
        type: Number,
        required: true
      },
      height: {
        type: Number,
        required: true
      },
      availWidth: {
        type: Number,
        required: true
      },
      availHeight: {
        type: Number,
        required: true
      },
      colorDepth: {
        type: Number,
        default: 24
      },
      pixelDepth: {
        type: Number,
        default: 24
      },
      devicePixelRatio: {
        type: Number,
        default: 1
      }
    },
    navigator: {
      userAgent: {
        type: String,
        required: true
      },
      platform: {
        type: String,
        required: true
      },
      language: {
        type: String,
        default: "en-US"
      },
      languages: [{
        type: String
      }],
      vendor: {
        type: String,
        default: ""
      },
      product: {
        type: String,
        default: "Gecko"
      },
      hardwareConcurrency: {
        type: Number,
        default: 4
      },
      deviceMemory: {
        type: Number,
        default: 8
      },
      maxTouchPoints: {
        type: Number,
        default: 0
      }
    },
    webgl: {
      vendor: {
        type: String,
        default: ""
      },
      renderer: {
        type: String,
        default: ""
      },
      version: {
        type: String,
        default: ""
      },
      shadingLanguageVersion: {
        type: String,
        default: ""
      }
    },
    canvasFingerprint: {
      type: String,
      default: ""
    },
    audioFingerprint: {
      type: String,
      default: ""
    },
    timezone: {
      type: String,
      default: "America/New_York"
    },
    plugins: [{
      name: String,
      filename: String,
      description: String,
      version: String
    }],
    mobile: {
      isMobile: {
        type: Boolean,
        default: false
      },
      isTablet: {
        type: Boolean,
        default: false
      },
      orientation: {
        type: String,
        enum: ["portrait", "landscape"],
        default: "portrait"
      }
    },
    additional: {
      cookieEnabled: {
        type: Boolean,
        default: true
      },
      doNotTrack: {
        type: String,
        default: null
      },
      localStorage: {
        type: Boolean,
        default: true
      },
      sessionStorage: {
        type: Boolean,
        default: true
      },
      indexedDB: {
        type: Boolean,
        default: true
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      unique: true,
      sparse: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);
fingerprintSchema.index({ deviceType: 1, isActive: 1 });
fingerprintSchema.index({ leadId: 1 }, { sparse: true });
fingerprintSchema.index({ createdBy: 1 });
fingerprintSchema.index({ lastUsedAt: -1 });
fingerprintSchema.virtual("deviceDescription").get(function () {
  const screen = `${this.screen.width}x${this.screen.height}`;
  const browser = `${this.browser.name} ${this.browser.version}`;
  return `${this.deviceType} - ${screen} - ${browser}`;
});
fingerprintSchema.statics.generateFingerprint = function(deviceType, createdBy) {
  const deviceConfigs = {
    windows: {
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, devicePixelRatio: 1 },
      navigator: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        platform: "Win32",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 0
      },
      mobile: { isMobile: false, isTablet: false },
      browser: { name: "chrome", version: "120.0.0.0" }
    },
    android: {
      screen: { width: 428, height: 926, availWidth: 428, availHeight: 926, devicePixelRatio: 3 },
      navigator: {
        userAgent: "Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        platform: "Linux armv8l",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 10
      },
      mobile: { isMobile: true, isTablet: false },
      browser: { name: "chrome", version: "120.0.0.0" }
    },
    ios: {
      screen: { width: 428, height: 926, availWidth: 428, availHeight: 926, devicePixelRatio: 3 },
      navigator: {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        platform: "iPhone",
        hardwareConcurrency: 6,
        deviceMemory: 6,
        maxTouchPoints: 5
      },
      mobile: { isMobile: true, isTablet: false },
      browser: { name: "safari", version: "17.0" }
    },
    mac: {
      screen: { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, devicePixelRatio: 2 },
      navigator: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        platform: "MacIntel",
        hardwareConcurrency: 8,
        deviceMemory: 16,
        maxTouchPoints: 0
      },
      mobile: { isMobile: false, isTablet: false },
      browser: { name: "chrome", version: "120.0.0.0" }
    }
  };
  const config = deviceConfigs[deviceType] || deviceConfigs.windows;
  const deviceId = `${deviceType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const variations = {
    screenWidth: [0, 1, -1, 2, -2],
    screenHeight: [0, 1, -1, 2, -2],
    hardwareConcurrency: deviceType === 'android' || deviceType === 'ios' ? [6, 8, 4] : [4, 6, 8, 12, 16],
    deviceMemory: deviceType === 'android' || deviceType === 'ios' ? [4, 6, 8] : [8, 16, 32]
  };
  const randomVariation = (base, variations) => {
    const variation = variations[Math.floor(Math.random() * variations.length)];
    return Math.max(1, base + variation);
  };
  return {
    deviceId,
    deviceType,
    browser: config.browser,
    screen: {
      ...config.screen,
      width: randomVariation(config.screen.width, variations.screenWidth),
      height: randomVariation(config.screen.height, variations.screenHeight),
      availWidth: randomVariation(config.screen.availWidth, variations.screenWidth),
      availHeight: randomVariation(config.screen.availHeight, variations.screenHeight)
    },
    navigator: {
      ...config.navigator,
      language: "en-US",
      languages: ["en-US", "en"],
      vendor: config.browser.name === "chrome" ? "Google Inc." : "",
      hardwareConcurrency: randomVariation(config.navigator.hardwareConcurrency, variations.hardwareConcurrency),
      deviceMemory: randomVariation(config.navigator.deviceMemory, variations.deviceMemory)
    },
    webgl: {
      vendor: "WebKit",
      renderer: `WebKit WebGL`,
      version: "WebGL 1.0",
      shadingLanguageVersion: "WebGL GLSL ES 1.0"
    },
    canvasFingerprint: Math.random().toString(36).substr(2, 16),
    audioFingerprint: Math.random().toString(36).substr(2, 16),
    timezone: "America/New_York",
    plugins: deviceType === 'windows' || deviceType === 'mac' ? [
      {
        name: "Chrome PDF Plugin",
        filename: "internal-pdf-viewer",
        description: "Portable Document Format",
        version: "1.0"
      }
    ] : [],
    mobile: config.mobile,
    additional: {
      cookieEnabled: true,
      doNotTrack: null,
      localStorage: true,
      sessionStorage: true,
      indexedDB: true
    },
    createdBy,
    lastUsedAt: new Date()
  };
};
fingerprintSchema.statics.createForLead = async function(leadId, deviceType, createdBy) {
  if (!leadId) {
    throw new Error("leadId is required");
  }
  if (!deviceType) {
    throw new Error("deviceType is required");
  }
  if (!createdBy) {
    throw new Error("createdBy is required");
  }
  const validDeviceTypes = ["windows", "android", "ios", "mac"];
  if (!validDeviceTypes.includes(deviceType)) {
    throw new Error(`Invalid deviceType: ${deviceType}. Must be one of: ${validDeviceTypes.join(", ")}`);
  }
  const existing = await this.findOne({ leadId });
  if (existing) {
    throw new Error("Fingerprint already exists for this lead");
  }
  const fingerprintData = this.generateFingerprint(deviceType, createdBy);
  fingerprintData.leadId = leadId;
  return this.create(fingerprintData);
};
fingerprintSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};
module.exports = mongoose.model("Fingerprint", fingerprintSchema);