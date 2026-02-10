import axios from "axios";
import { store } from "../store/store";
import { logout } from "../store/slices/authSlice";
import {
  getDeviceId,
  getDeviceFingerprintHeader,
  getClientLocalIPs,
} from "../utils/deviceFingerprint";

// Cache the device ID, fingerprint, and local IPs to avoid async issues in interceptors
let cachedDeviceId = null;
let cachedFingerprint = null;
let cachedLocalIPs = null;

// Initialize device ID, fingerprint, and local IPs on module load
(async () => {
  try {
    cachedDeviceId = await getDeviceId();
    cachedFingerprint = await getDeviceFingerprintHeader();
    cachedLocalIPs = await getClientLocalIPs();
  } catch (e) {
    console.warn("Failed to get device fingerprint:", e);
  }
})();

const backendAPI = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
const externalAPI = axios.create({
  baseURL: "https://agent-report-1.onrender.com/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
backendAPI.interceptors.request.use(
  async (config) => {
    const state = store.getState();
    const token = state.auth.token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add device ID and fingerprint for audit trail
    // Use cached values or fetch if not available
    if (!cachedDeviceId) {
      try {
        cachedDeviceId = await getDeviceId();
      } catch (e) {
        // Ignore errors
      }
    }
    if (!cachedFingerprint) {
      try {
        cachedFingerprint = await getDeviceFingerprintHeader();
      } catch (e) {
        // Ignore errors
      }
    }

    if (cachedDeviceId) {
      config.headers["X-Device-ID"] = cachedDeviceId;
    }
    if (cachedFingerprint) {
      config.headers["X-Device-Fingerprint"] = cachedFingerprint;
    }
    if (cachedLocalIPs && cachedLocalIPs.length > 0) {
      config.headers["X-Client-Local-IPs"] = cachedLocalIPs.join(",");
    }

    return config;
  },
  (error) => {
    console.error("Backend API Request Error:", error);
    return Promise.reject(error);
  }
);
externalAPI.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error("External API Request Error:", error);
    return Promise.reject(error);
  }
);
backendAPI.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("Backend API Response Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });
    if (error.response?.status === 401) {
      store.dispatch(logout());
    }
    if (!error.response) {
      error.message = "Network error. Please check your connection.";
    }
    return Promise.reject(error);
  }
);
externalAPI.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("External API Response Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });
    if (!error.response) {
      error.message =
        "External API network error. Please check your connection.";
    }
    return Promise.reject(error);
  }
);
const api = {
  get: (url, config) => {
    if (
      url.startsWith("/mongodb/") ||
      url.startsWith("/bonus-report/") ||
      url.startsWith("/scrape-enhanced") ||
      url.startsWith("/results/") ||
      url.startsWith("/agent-calls/")
    ) {
      return externalAPI.get(url, config);
    }

    return backendAPI.get(url, config);
  },
  post: (url, data, config) => {
    if (
      url.startsWith("/mongodb/") ||
      url.startsWith("/bonus-report/") ||
      url.startsWith("/scrape-enhanced") ||
      url.startsWith("/results/") ||
      url.startsWith("/agent-calls/")
    ) {
      return externalAPI.post(url, data, config);
    }

    return backendAPI.post(url, data, config);
  },
  put: (url, data, config) => {
    if (
      url.startsWith("/mongodb/") ||
      url.startsWith("/bonus-report/") ||
      url.startsWith("/scrape-enhanced") ||
      url.startsWith("/results/") ||
      url.startsWith("/agent-calls/")
    ) {
      return externalAPI.put(url, data, config);
    }

    return backendAPI.put(url, data, config);
  },
  delete: (url, config) => {
    if (
      url.startsWith("/mongodb/") ||
      url.startsWith("/bonus-report/") ||
      url.startsWith("/scrape-enhanced") ||
      url.startsWith("/results/") ||
      url.startsWith("/agent-calls/")
    ) {
      return externalAPI.delete(url, config);
    }

    return backendAPI.delete(url, config);
  },
  patch: (url, data, config) => {
    if (
      url.startsWith("/mongodb/") ||
      url.startsWith("/bonus-report/") ||
      url.startsWith("/scrape-enhanced") ||
      url.startsWith("/results/") ||
      url.startsWith("/agent-calls/")
    ) {
      return externalAPI.patch(url, data, config);
    }

    return backendAPI.patch(url, data, config);
  },
};

export default api;
