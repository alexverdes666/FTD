const UAParser = require("ua-parser-js");
const geoip = require("geoip-lite");
const os = require("os");

// Known anti-detect browser signatures and patterns
const ANTIDETECT_SIGNATURES = {
  // Dolphin Anty specific patterns
  dolphinAnty: {
    patterns: [/dolphin/i, /anty/i],
    headerIndicators: ["x-dolphin", "dolphin-profile"],
    jsIndicators: ["navigator.dolphin", "window.__dolphin"],
  },
  // Multilogin patterns
  multilogin: {
    patterns: [/multilogin/i, /mimic/i, /stealthfox/i],
    headerIndicators: ["x-multilogin"],
    jsIndicators: ["navigator.multilogin"],
  },
  // GoLogin patterns
  gologin: {
    patterns: [/gologin/i, /orbita/i],
    headerIndicators: ["x-gologin"],
    jsIndicators: [],
  },
  // Incogniton
  incogniton: {
    patterns: [/incogniton/i],
    headerIndicators: [],
    jsIndicators: [],
  },
  // Ghost Browser
  ghostBrowser: {
    patterns: [/ghost/i],
    headerIndicators: [],
    jsIndicators: [],
  },
  // VMLogin
  vmlogin: {
    patterns: [/vmlogin/i],
    headerIndicators: [],
    jsIndicators: [],
  },
  // Linken Sphere
  linkenSphere: {
    patterns: [/linken/i, /sphere/i],
    headerIndicators: [],
    jsIndicators: [],
  },
  // Kameleo
  kameleo: {
    patterns: [/kameleo/i],
    headerIndicators: [],
    jsIndicators: [],
  },
};

// Common proxy/VPN header indicators
const PROXY_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-server",
  "x-proxy-id",
  "via",
  "forwarded",
  "x-originating-ip",
  "x-remote-ip",
  "x-remote-addr",
  "x-client-ip",
  "client-ip",
  "x-host",
  "x-proxyuser-ip",
  "cf-connecting-ip", // Cloudflare
  "true-client-ip", // Akamai
  "x-cluster-client-ip",
  "fastly-client-ip", // Fastly
  "x-azure-clientip", // Azure
];

class UserDetector {
  constructor(req) {
    this.req = req;
    this.headers = req.headers || {};
    this.parser = new UAParser(this.headers["user-agent"]);
  }

  // Get all detected information
  getFullDetection() {
    return {
      ip: this.getIPInfo(),
      userAgent: this.getUserAgentInfo(),
      device: this.getDeviceInfo(),
      antidetect: this.detectAntidetectBrowser(),
      proxy: this.detectProxy(),
      connection: this.getConnectionInfo(),
      clientHints: this.getClientHints(),
      securityHeaders: this.getSecurityHeaders(),
      geo: this.getGeoInfo(),
      fingerprint: this.getFingerprintIndicators(),
      rawHeaders: this.headers,
      timestamp: new Date().toISOString(),
    };
  }

  // IP Address extraction
  getIPInfo() {
    const forwardedFor = this.headers["x-forwarded-for"];
    const realIp = this.headers["x-real-ip"];
    const cfConnectingIp = this.headers["cf-connecting-ip"];
    const socketIp =
      this.req.socket?.remoteAddress || this.req.connection?.remoteAddress;

    // Build IP chain
    let ipChain = [];
    if (forwardedFor) {
      ipChain = forwardedFor.split(",").map((ip) => ip.trim());
    }

    // Determine most likely real IP from headers/socket
    const detectedIp =
      cfConnectingIp || realIp || ipChain[0] || socketIp || "unknown";

    // Normalize IPs
    const normalizedDetectedIp = this.normalizeIP(detectedIp);
    const normalizedSocketIp = this.normalizeIP(socketIp);

    // Get local network IPs from server
    const localIPs = this.getLocalNetworkIPs();

    // Determine the actual client IP
    // If detected IP is loopback, use the primary local network IP instead
    let clientIp = normalizedDetectedIp;
    const ipType = this.classifyIP(normalizedDetectedIp);

    if (ipType === "loopback") {
      const primaryLocalIp = this.getPrimaryLocalIP(localIPs);
      if (primaryLocalIp) {
        clientIp = primaryLocalIp;
      }
    }

    // Check for IPv6 in the FINAL client IP
    const isIPv6 = clientIp?.includes(":") || false;

    return {
      clientIp: clientIp,
      socketIp: normalizedSocketIp,
      detectedIp: normalizedDetectedIp, // Original detected IP before local resolution
      forwardedFor: forwardedFor || null,
      realIp: realIp || null,
      cfConnectingIp: cfConnectingIp || null,
      ipChain: ipChain.length > 0 ? ipChain : null,
      isIPv6: isIPv6, // Reflects the final clientIp type
      localNetworkIPs: localIPs,
      ipType: this.classifyIP(clientIp), // Type of the final clientIp
      connectionType: ipType, // Type of the original connection (loopback, etc.)
    };
  }

  normalizeIP(ip) {
    if (!ip) return null;
    // Convert IPv6 localhost to readable format
    if (ip === "::1" || ip === "::ffff:127.0.0.1") return "127.0.0.1";
    // Remove IPv6 prefix if present
    if (ip.startsWith("::ffff:")) return ip.substring(7);
    return ip;
  }

  // Get all local network IPs of the server
  getLocalNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const ips = {
      ipv4: [],
      ipv6: [],
    };

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal/loopback addresses
        if (iface.internal) continue;

        if (iface.family === "IPv4") {
          ips.ipv4.push({
            address: iface.address,
            interface: name,
            netmask: iface.netmask,
            mac: iface.mac,
          });
        } else if (iface.family === "IPv6") {
          ips.ipv6.push({
            address: iface.address,
            interface: name,
            netmask: iface.netmask,
            mac: iface.mac,
            scopeid: iface.scopeid,
          });
        }
      }
    }

    return ips;
  }

  // Get the primary local network IP
  // Prioritizes: Wi-Fi/Ethernet > VirtualBox > Hyper-V > Others
  getPrimaryLocalIP(localIPs) {
    if (!localIPs || !localIPs.ipv4 || localIPs.ipv4.length === 0) {
      return null;
    }

    // Priority scoring for different interface types
    const priorityScore = (iface) => {
      const name = iface.interface.toLowerCase();
      const address = iface.address;

      // Prioritize 192.168.x.x (most common home/office networks)
      if (address.startsWith("192.168.")) {
        // Wi-Fi interfaces get highest priority
        if (
          name.includes("wi-fi") ||
          name.includes("wifi") ||
          name.includes("wireless")
        ) {
          return 1000;
        }
        // Ethernet interfaces
        if (name.includes("ethernet") && !name.includes("vethernet")) {
          return 900;
        }
        // Other 192.168 interfaces
        return 800;
      }

      // 10.x.x.x networks (some corporate networks)
      if (address.startsWith("10.")) {
        if (name.includes("wi-fi") || name.includes("wifi")) {
          return 700;
        }
        if (name.includes("ethernet") && !name.includes("vethernet")) {
          return 600;
        }
        return 500;
      }

      // 172.16-31.x.x networks
      if (address.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        if (name.includes("wi-fi") || name.includes("wifi")) {
          return 400;
        }
        if (name.includes("ethernet") && !name.includes("vethernet")) {
          return 300;
        }
        return 200;
      }

      // VirtualBox, VMware, Hyper-V, etc. (lower priority)
      if (
        name.includes("virtualbox") ||
        name.includes("vmware") ||
        name.includes("vethernet") ||
        name.includes("hyper-v")
      ) {
        return 50;
      }

      // Default for any other interface
      return 100;
    };

    // Sort by priority and return the best one
    const sorted = localIPs.ipv4
      .map((iface) => ({
        ...iface,
        priority: priorityScore(iface),
      }))
      .sort((a, b) => b.priority - a.priority);

    return sorted.length > 0 ? sorted[0].address : null;
  }

  // Classify IP type
  classifyIP(ip) {
    if (!ip || ip === "unknown") return "unknown";

    // Loopback
    if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
      return "loopback";
    }

    // Private IPv4 ranges
    if (ip.match(/^10\./)) return "private-class-a"; // 10.0.0.0/8
    if (ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return "private-class-b"; // 172.16.0.0/12
    if (ip.match(/^192\.168\./)) return "private-class-c"; // 192.168.0.0/16

    // Link-local
    if (ip.match(/^169\.254\./)) return "link-local"; // 169.254.0.0/16

    // IPv6 special addresses
    if (ip.match(/^fe80:/i)) return "link-local-ipv6";
    if (ip.match(/^fc00:/i) || ip.match(/^fd00:/i)) return "unique-local-ipv6";

    // If it's not any of the above, it's likely public
    return "public";
  }

  // User Agent parsing
  getUserAgentInfo() {
    const result = this.parser.getResult();
    const ua = this.headers["user-agent"] || "";

    return {
      raw: ua,
      browser: {
        name: result.browser.name || "Unknown",
        version: result.browser.version || "Unknown",
        major: result.browser.major || null,
      },
      engine: {
        name: result.engine.name || "Unknown",
        version: result.engine.version || null,
      },
      os: {
        name: result.os.name || "Unknown",
        version: result.os.version || "Unknown",
      },
      device: {
        type: result.device.type || "desktop",
        vendor: result.device.vendor || null,
        model: result.device.model || null,
      },
      cpu: {
        architecture: result.cpu.architecture || null,
      },
      isBot: this.detectBot(ua),
      isMobile: result.device.type === "mobile",
      isTablet: result.device.type === "tablet",
    };
  }

  detectBot(ua) {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /googlebot/i,
      /bingbot/i,
      /yandex/i,
      /baidu/i,
      /facebook/i,
      /twitter/i,
      /linkedin/i,
      /headless/i,
      /phantom/i,
      /selenium/i,
      /puppeteer/i,
      /playwright/i,
    ];
    return botPatterns.some((pattern) => pattern.test(ua));
  }

  // Anti-detect browser detection
  detectAntidetectBrowser() {
    const ua = this.headers["user-agent"] || "";
    const detected = {
      isDetected: false,
      browserName: null,
      indicators: [],
      confidence: "none",
    };

    // Check user agent patterns
    for (const [name, signature] of Object.entries(ANTIDETECT_SIGNATURES)) {
      for (const pattern of signature.patterns) {
        if (pattern.test(ua)) {
          detected.isDetected = true;
          detected.browserName = name;
          detected.indicators.push(`UA pattern match: ${pattern}`);
        }
      }

      // Check header indicators
      for (const header of signature.headerIndicators) {
        if (this.headers[header]) {
          detected.isDetected = true;
          detected.browserName = name;
          detected.indicators.push(`Header found: ${header}`);
        }
      }
    }

    // Heuristic detection for anti-detect browsers
    const anomalies = this.detectAnomalies();
    if (anomalies.length > 0) {
      detected.indicators.push(...anomalies);
      if (anomalies.length >= 3) {
        detected.confidence = "high";
        detected.isDetected = true;
      } else if (anomalies.length >= 1) {
        detected.confidence = "medium";
      }
    }

    if (detected.isDetected && detected.confidence === "none") {
      detected.confidence = "high";
    }

    return detected;
  }

  detectAnomalies() {
    const anomalies = [];
    const ua = this.headers["user-agent"] || "";
    const secChUa = this.headers["sec-ch-ua"] || "";

    // Check for mismatched browser claims
    const browserFromUa = this.parser.getBrowser().name?.toLowerCase();
    if (secChUa && browserFromUa) {
      if (
        browserFromUa === "chrome" &&
        !secChUa.toLowerCase().includes("chrome")
      ) {
        anomalies.push(
          "Browser mismatch: UA claims Chrome but sec-ch-ua differs"
        );
      }
    }

    // Check for unusual header combinations
    const hasDNT = this.headers["dnt"] === "1";
    const hasGPC = this.headers["sec-gpc"] === "1";
    if (hasDNT && hasGPC) {
      anomalies.push("Privacy headers: Both DNT and GPC enabled");
    }

    // Check for missing expected headers in modern browsers
    if (ua.includes("Chrome") && !this.headers["sec-ch-ua"]) {
      anomalies.push("Missing sec-ch-ua header in Chrome browser");
    }

    // Check for WebDriver indicator in headers
    if (this.headers["sec-ch-ua-webdriver"]) {
      anomalies.push("WebDriver header detected");
    }

    return anomalies;
  }

  // Proxy detection
  detectProxy() {
    const detected = {
      isProxy: false,
      type: null,
      indicators: [],
      proxyHeaders: {},
    };

    // Check for proxy headers
    for (const header of PROXY_HEADERS) {
      if (this.headers[header]) {
        detected.isProxy = true;
        detected.proxyHeaders[header] = this.headers[header];
        detected.indicators.push(`Proxy header: ${header}`);
      }
    }

    // Analyze Via header for proxy type
    const via = this.headers["via"];
    if (via) {
      if (via.includes("1.1") || via.includes("1.0")) {
        detected.type = "HTTP Proxy";
      }
      detected.indicators.push(`Via: ${via}`);
    }

    // Check for Cloudflare
    if (this.headers["cf-ray"] || this.headers["cf-connecting-ip"]) {
      detected.type = "Cloudflare";
      detected.indicators.push("Cloudflare detected");
    }

    // Check IP chain length
    const ipInfo = this.getIPInfo();
    if (ipInfo.ipChain && ipInfo.ipChain.length > 1) {
      detected.isProxy = true;
      detected.indicators.push(`IP chain length: ${ipInfo.ipChain.length}`);
    }

    return detected;
  }

  // Connection information
  getConnectionInfo() {
    return {
      protocol: this.req.protocol || (this.req.secure ? "https" : "http"),
      httpVersion: this.req.httpVersion,
      host: this.headers["host"],
      origin: this.headers["origin"] || null,
      referer: this.headers["referer"] || null,
      connection: this.headers["connection"],
      keepAlive: this.headers["keep-alive"] || null,
      cacheControl: this.headers["cache-control"] || null,
    };
  }

  // Client Hints (modern browsers)
  getClientHints() {
    return {
      ua: this.headers["sec-ch-ua"] || null,
      uaMobile: this.headers["sec-ch-ua-mobile"] || null,
      uaPlatform: this.headers["sec-ch-ua-platform"] || null,
      uaPlatformVersion: this.headers["sec-ch-ua-platform-version"] || null,
      uaArch: this.headers["sec-ch-ua-arch"] || null,
      uaBitness: this.headers["sec-ch-ua-bitness"] || null,
      uaModel: this.headers["sec-ch-ua-model"] || null,
      uaFullVersion: this.headers["sec-ch-ua-full-version"] || null,
      uaFullVersionList: this.headers["sec-ch-ua-full-version-list"] || null,
      prefersColorScheme: this.headers["sec-ch-prefers-color-scheme"] || null,
      prefersReducedMotion:
        this.headers["sec-ch-prefers-reduced-motion"] || null,
      deviceMemory: this.headers["device-memory"] || null,
      dpr: this.headers["dpr"] || null,
      viewportWidth: this.headers["viewport-width"] || null,
      contentDpr: this.headers["content-dpr"] || null,
      ect: this.headers["ect"] || null, // Effective connection type
      rtt: this.headers["rtt"] || null, // Round trip time
      downlink: this.headers["downlink"] || null,
      saveData: this.headers["save-data"] || null,
    };
  }

  // Security-related headers
  getSecurityHeaders() {
    return {
      dnt: this.headers["dnt"] || null,
      gpc: this.headers["sec-gpc"] || null,
      secFetchSite: this.headers["sec-fetch-site"] || null,
      secFetchMode: this.headers["sec-fetch-mode"] || null,
      secFetchDest: this.headers["sec-fetch-dest"] || null,
      secFetchUser: this.headers["sec-fetch-user"] || null,
      upgradeInsecureRequests:
        this.headers["upgrade-insecure-requests"] || null,
    };
  }

  // Geo information
  getGeoInfo() {
    const ipInfo = this.getIPInfo();
    const ip = ipInfo.clientIp;

    if (!ip || ip === "127.0.0.1" || ip === "localhost" || ip === "unknown") {
      return {
        available: false,
        message: "Local or unknown IP - geo lookup not available",
      };
    }

    const geo = geoip.lookup(ip);
    if (!geo) {
      return {
        available: false,
        message: "Geo data not found for IP",
      };
    }

    return {
      available: true,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone,
      coordinates: geo.ll ? { lat: geo.ll[0], lng: geo.ll[1] } : null,
      eu: geo.eu === "1",
      metro: geo.metro || null,
      area: geo.area || null,
    };
  }

  // Additional fingerprint indicators
  getFingerprintIndicators() {
    return {
      acceptLanguage: this.headers["accept-language"] || null,
      acceptEncoding: this.headers["accept-encoding"] || null,
      accept: this.headers["accept"] || null,
      languages: this.parseAcceptLanguage(),
      encoding: this.parseAcceptEncoding(),
      contentType: this.headers["content-type"] || null,
    };
  }

  parseAcceptLanguage() {
    const acceptLang = this.headers["accept-language"];
    if (!acceptLang) return [];

    return acceptLang
      .split(",")
      .map((lang) => {
        const [code, q] = lang.trim().split(";q=");
        return {
          code: code.trim(),
          quality: q ? parseFloat(q) : 1,
        };
      })
      .sort((a, b) => b.quality - a.quality);
  }

  parseAcceptEncoding() {
    const encoding = this.headers["accept-encoding"];
    if (!encoding) return [];
    return encoding.split(",").map((e) => e.trim());
  }

  // Get device and system information
  getDeviceInfo() {
    const hostname = os.hostname();
    const userInfo = os.userInfo();
    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const uptime = os.uptime();

    // Get user home directory and extract username
    const homeDir = userInfo.homedir;
    let username = userInfo.username;

    // For Windows, extract user from path like C:\Users\dani0
    let userPath = null;
    if (platform === "win32" && homeDir) {
      userPath = homeDir;
      // Extract username from path (e.g., C:\Users\dani0 -> dani0)
      const pathParts = homeDir.split("\\");
      const usersIndex = pathParts.findIndex(
        (part) => part.toLowerCase() === "users"
      );
      if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
        username = pathParts[usersIndex + 1];
      }
    } else if (homeDir) {
      userPath = homeDir;
    }

    return {
      hostname: hostname,
      user: {
        username: username,
        uid: userInfo.uid,
        gid: userInfo.gid,
        shell: userInfo.shell || null,
        homedir: homeDir,
        userPath: userPath,
      },
      system: {
        platform: platform,
        platformName: this.getPlatformName(platform),
        release: release,
        architecture: arch,
        cpuCount: cpus.length,
        cpuModel: cpus.length > 0 ? cpus[0].model : null,
        cpuSpeed: cpus.length > 0 ? cpus[0].speed : null,
        totalMemoryGB: (totalMemory / 1024 ** 3).toFixed(2),
        freeMemoryGB: (freeMemory / 1024 ** 3).toFixed(2),
        usedMemoryGB: ((totalMemory - freeMemory) / 1024 ** 3).toFixed(2),
        memoryUsagePercent: (
          ((totalMemory - freeMemory) / totalMemory) *
          100
        ).toFixed(2),
        uptimeHours: (uptime / 3600).toFixed(2),
      },
      tempDir: os.tmpdir(),
      endianness: os.endianness(),
    };
  }

  // Get friendly platform name
  getPlatformName(platform) {
    const platformNames = {
      win32: "Windows",
      darwin: "macOS",
      linux: "Linux",
      freebsd: "FreeBSD",
      openbsd: "OpenBSD",
      sunos: "SunOS",
      aix: "AIX",
    };
    return platformNames[platform] || platform;
  }

  // Format data for database storage
  formatForDatabase(sessionId, responseStatus = null, responseTimeMs = null) {
    const detection = this.getFullDetection();
    const ip = detection.ip;
    const ua = detection.userAgent;
    const device = detection.device;
    const antidetect = detection.antidetect;
    const proxy = detection.proxy;
    const conn = detection.connection;
    const hints = detection.clientHints;
    const security = detection.securityHeaders;
    const geo = detection.geo;
    const fp = detection.fingerprint;

    return {
      session_id: sessionId,
      method: this.req.method,
      path: this.req.path || this.req.url,
      query_params: JSON.stringify(this.req.query || {}),
      body: this.req.body ? JSON.stringify(this.req.body) : null,

      ip_address: ip.clientIp,
      ip_forwarded: ip.forwardedFor,
      is_proxy_detected: proxy.isProxy ? 1 : 0,
      proxy_chain: ip.ipChain ? JSON.stringify(ip.ipChain) : null,

      user_agent_raw: ua.raw,
      browser_name: ua.browser.name,
      browser_version: ua.browser.version,
      browser_engine: ua.engine.name,
      os_name: ua.os.name,
      os_version: ua.os.version,
      device_type: ua.device.type,
      device_vendor: ua.device.vendor,
      device_model: ua.device.model,
      cpu_architecture: ua.cpu.architecture,

      device_hostname: device.hostname,
      device_username: device.user.username,
      device_user_path: device.user.userPath,
      device_platform: device.system.platformName,
      device_architecture: device.system.architecture,
      device_cpu_model: device.system.cpuModel,
      device_memory_gb: device.system.totalMemoryGB,

      is_antidetect_browser: antidetect.isDetected ? 1 : 0,
      antidetect_browser_name: antidetect.browserName,
      antidetect_indicators:
        antidetect.indicators.length > 0
          ? JSON.stringify(antidetect.indicators)
          : null,

      protocol: conn.protocol,
      host: conn.host,
      origin: conn.origin,
      referer: conn.referer,

      accept_language: fp.acceptLanguage,
      accept_encoding: fp.acceptEncoding,
      connection_type: conn.connection,
      dnt: security.dnt ? parseInt(security.dnt) : null,
      sec_ch_ua: hints.ua,
      sec_ch_ua_platform: hints.uaPlatform,
      sec_ch_ua_mobile: hints.uaMobile,
      sec_fetch_site: security.secFetchSite,
      sec_fetch_mode: security.secFetchMode,
      sec_fetch_dest: security.secFetchDest,

      geo_country: geo.available ? geo.country : null,
      geo_region: geo.available ? geo.region : null,
      geo_city: geo.available ? geo.city : null,
      geo_timezone: geo.available ? geo.timezone : null,
      geo_ll:
        geo.available && geo.coordinates
          ? `${geo.coordinates.lat},${geo.coordinates.lng}`
          : null,

      all_headers: JSON.stringify(detection.rawHeaders),
      response_status: responseStatus,
      response_time_ms: responseTimeMs,
    };
  }
}

module.exports = UserDetector;
