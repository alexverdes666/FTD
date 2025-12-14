#!/usr/bin/env node

/**
 * Test script for get_info service
 * Usage: node test-service.js [url]
 * Example: node test-service.js https://ftd-device-detection.onrender.com
 */

const https = require("https");
const http = require("http");

const baseUrl =
  process.argv[2] || "https://ftd-device-detection.onrender.com";
const isHttps = baseUrl.startsWith("https");
const httpModule = isHttps ? https : http;

console.log("🔍 Testing get_info service...");
console.log(`📍 Base URL: ${baseUrl}\n`);

// Helper function to make requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}${path}`;
    const startTime = Date.now();

    const req = httpModule.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          duration: duration,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// Test endpoints
async function testEndpoints() {
  const tests = [
    { name: "Root Endpoint", path: "/" },
    { name: "Health Check", path: "/health" },
    { name: "Detection API", path: "/api/detect" },
  ];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name} (${test.path})`);
      const result = await makeRequest(test.path);

      const emoji =
        result.statusCode === 200
          ? "✅"
          : result.statusCode === 404
          ? "❌"
          : result.statusCode === 403
          ? "🚫"
          : "⚠️";

      console.log(`${emoji} Status: ${result.statusCode}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);

      // Try to parse JSON
      try {
        const json = JSON.parse(result.data);
        console.log(`📦 Response:`, JSON.stringify(json, null, 2));

        // Validate specific endpoints
        if (test.path === "/health" && result.statusCode === 200) {
          if (json.status === "ok") {
            console.log("✅ Health check passed!");
          } else {
            console.log("⚠️  Health check returned unexpected status");
          }
        }

        if (test.path === "/api/detect" && result.statusCode === 200) {
          const hasRequiredFields =
            json.ip && json.userAgent && json.device && json.antidetect;
          if (hasRequiredFields) {
            console.log("✅ Detection API response has all required fields!");
            console.log(`   - IP: ${json.ip?.clientIp || "N/A"}`);
            console.log(
              `   - User Agent: ${json.userAgent?.raw?.substring(0, 50) || "N/A"}...`
            );
            console.log(`   - Device: ${json.device?.hostname || "N/A"}`);
            console.log(
              `   - Anti-detect: ${json.antidetect?.isDetected ? "DETECTED" : "Not detected"}`
            );
          } else {
            console.log("⚠️  Detection API response missing required fields");
          }
        }
      } catch (e) {
        console.log(`📄 Response (not JSON):`, result.data.substring(0, 200));
      }

      console.log("");
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log("");
    }
  }
}

// Test invalid endpoint
async function testNotFound() {
  try {
    console.log("Testing: 404 Handler (/invalid)");
    const result = await makeRequest("/invalid");

    if (result.statusCode === 404) {
      console.log("✅ 404 handler working correctly");
    } else {
      console.log(`⚠️  Expected 404, got ${result.statusCode}`);
    }
    console.log("");
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log("");
  }
}

// Run tests
async function runTests() {
  console.log("═".repeat(60));
  console.log("  GET_INFO SERVICE TEST SUITE");
  console.log("═".repeat(60));
  console.log("");

  try {
    await testEndpoints();
    await testNotFound();

    console.log("═".repeat(60));
    console.log("  TEST SUMMARY");
    console.log("═".repeat(60));
    console.log("");
    console.log("If all tests passed (✅), the service is working correctly!");
    console.log("");
    console.log("Common issues:");
    console.log("  🚫 403 Forbidden - CORS or permissions issue");
    console.log("  ❌ 404 Not Found - Wrong URL or service not deployed");
    console.log("  ⚠️  Timeout - Service is sleeping (cold start)");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Update main backend .env with GET_INFO_URL");
    console.log("  2. Redeploy main backend");
    console.log("  3. Test a POST/PUT request to trigger device detection");
    console.log("");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

runTests();
