#!/usr/bin/env node

/**
 * FTD Local Agent
 *
 * Runs on the user's machine and periodically sends local device info
 * (hostname, username, local IPs, MACs) to the FTD backend.
 *
 * The agent "phones home" — it POSTs to the backend, so the browser
 * never needs to access localhost (no Chrome Private Network Access issues).
 *
 * Usage:
 *   node local-agent.js
 *
 * Environment variables:
 *   FTD_BACKEND_URL - Backend API base URL (default: https://ftd-backend.onrender.com/api)
 *
 * Setup as Windows auto-start:
 *   Use the included install-agent.bat script.
 *
 * Setup as macOS/Linux auto-start:
 *   Add to crontab: @reboot node /path/to/local-agent.js
 */

const https = require("https");
const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");

// --- Configuration ---
// Try to read config from a file next to the agent, or use env var, or default
const CONFIG_PATH = path.join(__dirname, "agent-config.json");
let config = {};
try {
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  }
} catch (e) { /* ignore */ }

const BACKEND_URL =
  config.backendUrl ||
  process.env.FTD_BACKEND_URL ||
  "https://ftd-backend.onrender.com/api";

const CHECKIN_INTERVAL = (config.intervalMinutes || 5) * 60 * 1000; // default 5 minutes
const AGENT_VERSION = "1.0.0";

// --- Collect device info ---
const collectDeviceInfo = () => {
  const interfaces = os.networkInterfaces();
  const ips = { ipv4: [], ipv6: [] };

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.internal) continue;
      const entry = {
        address: addr.address,
        interface: name,
        netmask: addr.netmask,
        mac: addr.mac,
      };
      if (addr.family === "IPv4") {
        ips.ipv4.push(entry);
      } else {
        ips.ipv6.push({ ...entry, scopeid: addr.scopeid });
      }
    }
  }

  const userInfo = os.userInfo();

  return {
    hostname: os.hostname(),
    username: userInfo.username,
    platform: os.platform(),
    ips,
    agentVersion: AGENT_VERSION,
  };
};

// --- Phone home: POST device info to the backend ---
const checkin = () => {
  const data = collectDeviceInfo();
  const body = JSON.stringify(data);

  const url = new URL(`${BACKEND_URL}/agent-checkin`);
  const isHTTPS = url.protocol === "https:";
  const transport = isHTTPS ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHTTPS ? 443 : 80),
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const req = transport.request(options, (res) => {
    let responseData = "";
    res.on("data", (chunk) => (responseData += chunk));
    res.on("end", () => {
      if (res.statusCode === 200) {
        console.log(
          `[${new Date().toLocaleTimeString()}] Checkin OK — ${data.hostname} (${
            data.ips.ipv4.map((i) => i.address).join(", ") || "no IPv4"
          })`
        );
      } else {
        console.log(
          `[${new Date().toLocaleTimeString()}] Checkin failed: HTTP ${res.statusCode} — ${responseData}`
        );
      }
    });
  });

  req.on("error", (err) => {
    console.log(
      `[${new Date().toLocaleTimeString()}] Checkin error: ${err.message}`
    );
  });

  req.setTimeout(10000, () => {
    req.destroy();
    console.log(`[${new Date().toLocaleTimeString()}] Checkin timed out`);
  });

  req.write(body);
  req.end();
};

// --- Start ---
console.log("=== FTD Local Agent ===");
console.log(`Backend: ${BACKEND_URL}`);
console.log(`Interval: ${CHECKIN_INTERVAL / 1000}s`);
console.log(`Hostname: ${os.hostname()}`);
console.log(`Username: ${os.userInfo().username}`);
console.log("");

// Initial checkin
checkin();

// Periodic checkin
setInterval(checkin, CHECKIN_INTERVAL);

console.log("Agent running. Press Ctrl+C to stop.");
