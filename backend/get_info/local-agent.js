#!/usr/bin/env node

/**
 * FTD Local Agent
 *
 * A tiny HTTP server that runs on the user's machine and exposes
 * local network info (hostname, username, local IPs) to the FTD frontend.
 *
 * Usage:
 *   node local-agent.js
 *
 * The agent runs on http://localhost:9876 and responds with local device info.
 * The frontend fetches this on page load to capture the user's internal IP.
 *
 * Setup as Windows auto-start:
 *   1. Press Win+R, type "shell:startup", press Enter
 *   2. Create a shortcut: node "C:\path\to\local-agent.js"
 *   Or use the included install-agent.bat script.
 *
 * Setup as macOS/Linux auto-start:
 *   Add to crontab: @reboot node /path/to/local-agent.js
 */

const http = require("http");
const os = require("os");

const PORT = 9876;

// Allowed origins - add your frontend domains here
const ALLOWED_ORIGINS = [
  "https://ftdm2.com",
  "https://www.ftdm2.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.includes(".vercel.app")) return true;
  return false;
};

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "";

  // CORS + Private Network Access headers
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Chrome Private Network Access — required for https → http://localhost
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Content-Type", "application/json");

  // Handle preflight (Chrome sends OPTIONS with Access-Control-Request-Private-Network)
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // Collect local network info
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

  const data = {
    hostname: os.hostname(),
    username: userInfo.username,
    platform: os.platform(),
    ips,
    timestamp: new Date().toISOString(),
  };

  res.writeHead(200);
  res.end(JSON.stringify(data));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`FTD Local Agent running on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${PORT} already in use — agent may already be running.`);
  } else {
    console.error("Agent error:", err.message);
  }
});
