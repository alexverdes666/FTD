/**
 * Device Fingerprint Utility
 *
 * Generates and persists a unique device identifier for security auditing.
 * This helps identify individual devices even when:
 * - Multiple users share credentials
 * - Users are behind NAT (same public IP)
 * - Users have similar devices (same user agent)
 *
 * The device ID is stored in multiple locations for persistence:
 * - localStorage
 * - sessionStorage
 * - IndexedDB
 * - Cookie (if available)
 *
 * Note: Anti-detect browsers like Dolphin Anty create isolated storage per profile,
 * so each profile will have its own device ID (which is actually what we want!)
 */

const DEVICE_ID_KEY = "ftd_device_id";
const DEVICE_INFO_KEY = "ftd_device_info";
const LOCAL_IPS_KEY = "ftd_local_ips";

/**
 * Check if an IP is a private/internal address (RFC 1918 + link-local).
 */
const isPrivateIP = (ip) => {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") || ip.startsWith("172.17.") || ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") || ip.startsWith("172.20.") || ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") || ip.startsWith("172.23.") || ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") || ip.startsWith("172.26.") || ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") || ip.startsWith("172.29.") || ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    ip === "127.0.0.1"
  );
};

/**
 * Run a single WebRTC probe to discover IPs from ICE candidates.
 * @param {Array} iceServers - ICE server config (empty = no STUN, local candidates only)
 */
const probeWebRTC = (iceServers) => {
  return new Promise((resolve) => {
    const ips = new Set();
    let pc;

    const finish = () => {
      try { pc.close(); } catch (e) { /* ignore */ }
      resolve([...ips]);
    };

    const timeout = setTimeout(finish, 2000);

    try {
      if (!window.RTCPeerConnection) {
        clearTimeout(timeout);
        resolve([]);
        return;
      }

      pc = new RTCPeerConnection({ iceServers });
      pc.createDataChannel("");

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timeout);
          finish();
          return;
        }

        const candidate = event.candidate.candidate;

        // Extract IPv4 addresses
        const ipMatch = candidate.match(/(?:[\d]{1,3}\.){3}[\d]{1,3}/);
        if (ipMatch && ipMatch[0] !== "0.0.0.0") {
          ips.add(ipMatch[0]);
        }

        // Extract IPv6 addresses
        const ipv6Match = candidate.match(/([a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/i);
        if (ipv6Match) {
          ips.add(ipv6Match[0]);
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          finish();
        });
    } catch (e) {
      clearTimeout(timeout);
      resolve([]);
    }
  });
};

/**
 * Detect client's local/internal IPs using WebRTC ICE candidates.
 *
 * Strategy:
 * 1. First probe WITHOUT STUN server → gets "host" candidates (local IPs)
 *    Modern Chrome uses mDNS for these, so they may not contain real IPs.
 * 2. Then probe WITH STUN server → gets "srflx" candidates (public IP)
 * 3. Filter: only keep private/internal IPs (192.168.x.x, 10.x.x.x, etc.)
 *    Discard any public IPs since those are already detected via HTTP headers.
 *
 * Note: Modern Chrome (76+) hides local IPs with mDNS obfuscation.
 * This will only return real local IPs if the browser allows it.
 */
const getLocalIPs = async () => {
  try {
    if (!window.RTCPeerConnection) return [];

    // Probe 1: No STUN — gets host candidates (best chance for local IPs)
    const noStunIPs = await probeWebRTC([]);

    // Probe 2: With STUN — gets additional candidates
    const stunIPs = await probeWebRTC([
      { urls: "stun:stun.l.google.com:19302" },
    ]);

    // Merge all discovered IPs
    const allIPs = new Set([...noStunIPs, ...stunIPs]);

    // Only keep private/internal IPs — public IPs are already detected via headers
    const privateIPs = [...allIPs].filter(isPrivateIP);

    return privateIPs;
  } catch (e) {
    return [];
  }
};

// Local agent port — must match local-agent.js
const LOCAL_AGENT_PORT = 9876;
const LOCAL_AGENT_URL = `http://localhost:${LOCAL_AGENT_PORT}`;

// Track local agent access state
let localAgentAccessDenied = false;
let localAgentRetryCallback = null;

/**
 * Try to fetch local network info from the FTD Local Agent.
 * The agent is a tiny Node.js server running on the user's machine
 * that exposes hostname, username, and local IPs.
 * Returns null if the agent is not running or access is denied.
 */
const fetchFromLocalAgent = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(LOCAL_AGENT_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();

    // Access was granted — clear denial state
    localAgentAccessDenied = false;
    return data;
  } catch (e) {
    // Check if this looks like a Private Network Access denial
    // (Chrome blocks the request entirely, resulting in a TypeError)
    if (e.name === "TypeError" || e.message?.includes("Failed to fetch")) {
      localAgentAccessDenied = true;
    }
    return null;
  }
};

/**
 * Check if local agent access was denied by the browser.
 */
export const isLocalAgentDenied = () => localAgentAccessDenied;

/**
 * Register a callback that fires when a retry of local agent access is needed.
 * The UI component (e.g., MainLayout) calls this to show a permission banner.
 */
export const onLocalAgentRetryNeeded = (callback) => {
  localAgentRetryCallback = callback;
};

/**
 * Retry fetching from local agent. Call this when the user clicks "Allow" or "Retry".
 * This triggers a new fetch which will prompt Chrome's Private Network Access dialog.
 */
export const retryLocalAgentAccess = async () => {
  // Clear cached data so it re-fetches
  cachedLocalIPs = null;
  cachedLocalAgentData = null;
  try {
    sessionStorage.removeItem(LOCAL_IPS_KEY);
    sessionStorage.removeItem("ftd_local_agent");
  } catch (e) { /* ignore */ }

  // Re-attempt detection
  const ips = await getClientLocalIPs();

  if (ips && ips.length > 0) {
    localAgentAccessDenied = false;
    return true; // Success
  }
  return false; // Still denied or agent not running
};

// Cache local IPs and agent data since detection is async
let cachedLocalIPs = null;
let cachedLocalAgentData = null;

/**
 * Get cached local IPs or detect them.
 *
 * Strategy:
 * 1. Try FTD Local Agent (most reliable — gives real local IPs + hostname)
 * 2. Fall back to WebRTC (blocked by modern Chrome mDNS obfuscation)
 * 3. Cache result in sessionStorage
 */
const getClientLocalIPs = async () => {
  if (cachedLocalIPs) return cachedLocalIPs;

  // Try from sessionStorage first
  try {
    const stored = sessionStorage.getItem(LOCAL_IPS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.length > 0) {
        cachedLocalIPs = parsed;
        return cachedLocalIPs;
      }
    }
  } catch (e) { /* ignore */ }

  // Strategy 1: Try local agent (gives real local IPs)
  const agentData = await fetchFromLocalAgent();
  if (agentData && agentData.ips) {
    cachedLocalAgentData = agentData;
    const ips = agentData.ips.ipv4?.map((i) => i.address) || [];
    if (ips.length > 0) {
      cachedLocalIPs = ips;
      try {
        sessionStorage.setItem(LOCAL_IPS_KEY, JSON.stringify(cachedLocalIPs));
        // Also store full agent data for the fingerprint
        sessionStorage.setItem("ftd_local_agent", JSON.stringify(agentData));
      } catch (e) { /* ignore */ }
      return cachedLocalIPs;
    }
  }

  // Strategy 2: Fall back to WebRTC (usually blocked by Chrome mDNS)
  cachedLocalIPs = await getLocalIPs();

  // Cache in sessionStorage
  try {
    sessionStorage.setItem(LOCAL_IPS_KEY, JSON.stringify(cachedLocalIPs));
  } catch (e) { /* ignore */ }

  // If we still have no local IPs and agent access was denied, notify UI
  if ((!cachedLocalIPs || cachedLocalIPs.length === 0) && localAgentAccessDenied && localAgentRetryCallback) {
    localAgentRetryCallback();
  }

  return cachedLocalIPs;
};

/**
 * Get full local agent data (hostname, username, platform, IPs).
 * Returns null if agent is not running.
 */
const getLocalAgentData = async () => {
  if (cachedLocalAgentData) return cachedLocalAgentData;

  try {
    const stored = sessionStorage.getItem("ftd_local_agent");
    if (stored) {
      cachedLocalAgentData = JSON.parse(stored);
      return cachedLocalAgentData;
    }
  } catch (e) { /* ignore */ }

  const data = await fetchFromLocalAgent();
  if (data) {
    cachedLocalAgentData = data;
    try {
      sessionStorage.setItem("ftd_local_agent", JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }
  return cachedLocalAgentData;
};

/**
 * Generate a unique device ID
 */
const generateDeviceId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `dev_${timestamp}_${randomPart}${randomPart2}`;
};

/**
 * Get or create device ID from localStorage
 */
const getFromLocalStorage = () => {
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch (e) {
    return null;
  }
};

/**
 * Save to localStorage
 */
const saveToLocalStorage = (deviceId) => {
  try {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch (e) {
    // Storage might be disabled
  }
};

/**
 * Get from sessionStorage
 */
const getFromSessionStorage = () => {
  try {
    return sessionStorage.getItem(DEVICE_ID_KEY);
  } catch (e) {
    return null;
  }
};

/**
 * Save to sessionStorage
 */
const saveToSessionStorage = (deviceId) => {
  try {
    sessionStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch (e) {
    // Storage might be disabled
  }
};

/**
 * Get from cookie
 */
const getFromCookie = () => {
  try {
    const match = document.cookie.match(new RegExp(`${DEVICE_ID_KEY}=([^;]+)`));
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
};

/**
 * Save to cookie (expires in 10 years)
 */
const saveToCookie = (deviceId) => {
  try {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 10);
    document.cookie = `${DEVICE_ID_KEY}=${deviceId}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  } catch (e) {
    // Cookies might be disabled
  }
};

/**
 * IndexedDB operations for persistent storage
 */
const DB_NAME = "FTDDeviceDB";
const DB_STORE = "deviceInfo";

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "key" });
      }
    };
  });
};

const getFromIndexedDB = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const request = store.get(DEVICE_ID_KEY);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result?.value || null);
    });
  } catch (e) {
    return null;
  }
};

const saveToIndexedDB = async (deviceId) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.put({ key: DEVICE_ID_KEY, value: deviceId });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // IndexedDB might not be available
  }
};

/**
 * Detect if this is likely a Mac/Apple device based on various signals
 */
const detectAppleDevice = () => {
  const nav = navigator || {};
  const ua = nav.userAgent || "";
  const platform = nav.platform || "";

  const isMac = platform.includes("Mac") || ua.includes("Macintosh");
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "MacIntel" && nav.maxTouchPoints > 1);
  const isSafari =
    ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium");

  // Apple Silicon detection (M1/M2/M3 chips show as "MacIntel" but behave differently)
  // These hints can help identify Apple Silicon vs Intel Macs
  const isAppleSilicon =
    isMac && nav.hardwareConcurrency >= 8 && nav.deviceMemory >= 8;

  return {
    isMac,
    isIOS,
    isSafari,
    isAppleSilicon,
    isAppleDevice: isMac || isIOS,
  };
};

/**
 * Collect device fingerprint data (what we can gather)
 * Even if spoofed, the combination might be unique
 */
const collectDeviceInfo = () => {
  const nav = navigator || {};
  const screen = window.screen || {};

  // Detect Apple devices
  const appleInfo = detectAppleDevice();

  // Collect what we can
  const info = {
    // Screen info
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenAvailWidth: screen.availWidth,
    screenAvailHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,

    // Navigator info
    language: nav.language,
    languages: nav.languages ? [...nav.languages] : [],
    platform: nav.platform,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints,
    vendor: nav.vendor,
    cookieEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack,
    pdfViewerEnabled: nav.pdfViewerEnabled,

    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),

    // Connection info (if available)
    connectionType: nav.connection?.effectiveType || null,
    connectionDownlink: nav.connection?.downlink || null,
    connectionRtt: nav.connection?.rtt || null,
    connectionSaveData: nav.connection?.saveData || null,

    // WebGL info (may be spoofed but still useful)
    webglVendor: null,
    webglRenderer: null,
    webglVersion: null,

    // Canvas fingerprint hash
    canvasHash: null,

    // Audio fingerprint hash
    audioHash: null,

    // Storage availability
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage,
    indexedDB: !!window.indexedDB,

    // Media capabilities
    webRTC: !!window.RTCPeerConnection,
    webGL: !!window.WebGLRenderingContext,
    webGL2: !!window.WebGL2RenderingContext,

    // Apple-specific detection
    ...appleInfo,

    // Screen orientation
    screenOrientation: screen.orientation?.type || null,

    // Other media queries
    colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    prefersContrast: window.matchMedia("(prefers-contrast: more)").matches
      ? "more"
      : "normal",

    // Font detection (rough check for common fonts)
    fontFingerprint: null,

    // Battery status (if available, deprecated but still works in some browsers)
    batteryCharging: null,
    batteryLevel: null,

    // Local IPs (populated async separately)
    localIPs: [],

    // Local agent data (hostname, username — populated async)
    localAgent: null,

    // Collected at
    collectedAt: new Date().toISOString(),
  };

  // Try to get WebGL info (very useful for GPU identification)
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        info.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        info.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
      info.webglVersion = gl.getParameter(gl.VERSION);

      // Get more WebGL parameters that can help identify the GPU
      info.webglMaxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      info.webglMaxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    }
  } catch (e) {
    // WebGL not available
  }

  // Generate canvas hash (simple version)
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("FTD Security", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("FTD Security", 4, 17);
    // Simple hash of the data URL
    const dataUrl = canvas.toDataURL();
    info.canvasHash = simpleHash(dataUrl);
  } catch (e) {
    // Canvas not available
  }

  // Generate audio fingerprint
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const analyser = audioCtx.createAnalyser();
      const gainNode = audioCtx.createGain();
      const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);

      gainNode.gain.value = 0; // Mute
      oscillator.type = "triangle";
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start(0);

      // Get frequency data
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(frequencyData);
      info.audioHash = simpleHash(frequencyData.slice(0, 100).join(","));

      oscillator.stop();
      audioCtx.close();
    }
  } catch (e) {
    // Audio fingerprinting not available
  }

  // Font detection (check for common Mac fonts)
  try {
    const testFonts = [
      "SF Pro", // macOS system font
      "Helvetica Neue", // macOS
      "Segoe UI", // Windows
      "Roboto", // Android/Chrome
      "Ubuntu", // Linux
    ];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const testString = "mmmmmmmmlli";
    const baseFont = "monospace";

    const getTextWidth = (font) => {
      ctx.font = `72px ${font}, ${baseFont}`;
      return ctx.measureText(testString).width;
    };

    const baseWidth = getTextWidth(baseFont);
    const detectedFonts = testFonts.filter((font) => {
      const width = getTextWidth(`"${font}"`);
      return width !== baseWidth;
    });

    info.fontFingerprint = detectedFonts.join(",") || "default";
  } catch (e) {
    // Font detection failed
  }

  // Battery API (deprecated but still works in Chromium)
  try {
    if (navigator.getBattery) {
      navigator.getBattery().then((battery) => {
        info.batteryCharging = battery.charging;
        info.batteryLevel = battery.level;
      });
    }
  } catch (e) {
    // Battery API not available
  }

  return info;
};

/**
 * Simple hash function for canvas fingerprint
 */
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

/**
 * Get the device ID (create if doesn't exist)
 * Checks multiple storage locations and syncs them
 */
export const getDeviceId = async () => {
  // Try all storage locations
  let deviceId =
    getFromLocalStorage() ||
    getFromSessionStorage() ||
    getFromCookie() ||
    (await getFromIndexedDB());

  // If no device ID found, generate one
  if (!deviceId) {
    deviceId = generateDeviceId();
  }

  // Sync to all storage locations
  saveToLocalStorage(deviceId);
  saveToSessionStorage(deviceId);
  saveToCookie(deviceId);
  await saveToIndexedDB(deviceId);

  return deviceId;
};

/**
 * Get full device fingerprint including ID and collected info
 */
export const getDeviceFingerprint = async () => {
  const deviceId = await getDeviceId();
  const deviceInfo = collectDeviceInfo();

  // Async: get local IPs (tries local agent first, then WebRTC)
  try {
    deviceInfo.localIPs = await getClientLocalIPs();
    deviceInfo.localAgent = await getLocalAgentData();
  } catch (e) {
    deviceInfo.localIPs = [];
    deviceInfo.localAgent = null;
  }

  return {
    deviceId,
    ...deviceInfo,
  };
};

/**
 * Get device fingerprint header for API requests
 * Returns a base64-encoded JSON string for the X-Device-Fingerprint header
 */
export const getDeviceFingerprintHeader = async () => {
  try {
    const fingerprint = await getDeviceFingerprint();
    return btoa(JSON.stringify(fingerprint));
  } catch (e) {
    // Fallback: just return device ID
    const deviceId = await getDeviceId();
    return btoa(JSON.stringify({ deviceId }));
  }
};

/**
 * Add device fingerprint to request headers
 * Use this in your API service/axios interceptor
 */
export const addDeviceFingerprintToHeaders = async (headers = {}) => {
  try {
    const deviceId = await getDeviceId();
    headers["X-Device-ID"] = deviceId;

    // Optionally include full fingerprint (larger payload)
    // const fingerprint = await getDeviceFingerprintHeader();
    // headers["X-Device-Fingerprint"] = fingerprint;
  } catch (e) {
    // Don't fail the request if fingerprinting fails
  }
  return headers;
};

export { getClientLocalIPs, getLocalAgentData };

export default {
  getDeviceId,
  getDeviceFingerprint,
  getDeviceFingerprintHeader,
  addDeviceFingerprintToHeaders,
  getClientLocalIPs,
  getLocalAgentData,
  isLocalAgentDenied,
  onLocalAgentRetryNeeded,
  retryLocalAgentAccess,
};
