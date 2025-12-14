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

export default {
  getDeviceId,
  getDeviceFingerprint,
  getDeviceFingerprintHeader,
  addDeviceFingerprintToHeaders,
};
