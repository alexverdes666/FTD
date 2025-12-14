/**
 * Test script to verify CORS and connectivity to get_info service
 * Run this from the main backend to test the connection
 */

const axios = require("axios");

const GET_INFO_URL =
  process.env.GET_INFO_URL || "http://localhost:3000/api/detect";

console.log("🔍 Testing get_info service connection...");
console.log(`📡 Target URL: ${GET_INFO_URL}\n`);

async function testConnection() {
  try {
    console.log("1️⃣ Testing basic GET request...");
    const response = await axios.get(GET_INFO_URL, {
      timeout: 5000,
      headers: {
        "user-agent": "FTD-Backend-Test/1.0",
        accept: "application/json",
      },
    });

    console.log("✅ Connection successful!");
    console.log(`📊 Status: ${response.status}`);
    console.log(`📦 Response keys:`, Object.keys(response.data));
    console.log(`🌐 IP detected: ${response.data.ip?.clientIp || "unknown"}`);
    console.log(`💻 Device: ${response.data.device?.hostname || "unknown"}`);
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ Connection failed!");

    if (error.response) {
      console.error(
        `📛 Status: ${error.response.status} ${error.response.statusText}`
      );
      console.error(
        `📄 Response:`,
        JSON.stringify(error.response.data, null, 2)
      );
      console.error(
        `🔐 Headers:`,
        JSON.stringify(error.response.headers, null, 2)
      );

      if (error.response.status === 403) {
        console.error("\n🚨 403 Forbidden Error Detected!");
        console.error("Possible causes:");
        console.error("  - CORS configuration issue");
        console.error("  - Render service blocking cross-service requests");
        console.error("  - Service requires authentication");
        console.error("  - IP whitelist restriction");
        console.error("\nSolutions to try:");
        console.error("  1. Check CORS settings in get_info/src/server.js");
        console.error("  2. Verify both services are deployed on Render");
        console.error("  3. Use Render's internal networking if available");
        console.error("  4. Add API key authentication between services");
      }
    } else if (error.request) {
      console.error("📭 No response received from server");
      console.error("Possible causes:");
      console.error("  - Service is down");
      console.error("  - Network connectivity issue");
      console.error("  - Timeout (5 seconds)");
    } else {
      console.error(`⚠️ Error: ${error.message}`);
    }

    console.error("\n🔧 Request details:");
    console.error(`   URL: ${GET_INFO_URL}`);
    console.error(`   Method: GET`);
    console.error(`   Timeout: 5000ms`);

    return false;
  }
}

async function testWithHeaders() {
  try {
    console.log(
      "2️⃣ Testing with forwarded headers (simulating real request)..."
    );
    const response = await axios.get(GET_INFO_URL, {
      timeout: 5000,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "x-forwarded-for": "94.101.205.231",
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "sec-ch-ua": '"Chromium";v="143"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
      },
    });

    console.log("✅ Request with headers successful!");
    console.log(`📊 Status: ${response.status}`);
    console.log(`🌐 IP detected: ${response.data.ip?.clientIp || "unknown"}`);
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ Request with headers failed!");
    console.error(`⚠️ Error: ${error.message}`);
    if (error.response) {
      console.error(`📛 Status: ${error.response.status}`);
    }
    console.log("");
    return false;
  }
}

async function testHealth() {
  try {
    console.log("3️⃣ Testing health endpoint...");
    const healthUrl = GET_INFO_URL.replace("/api/detect", "/health");
    const response = await axios.get(healthUrl, { timeout: 3000 });

    console.log("✅ Health check successful!");
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ Health check failed!");
    console.error(`⚠️ Error: ${error.message}`);
    if (error.response) {
      console.error(`📛 Status: ${error.response.status}`);
    }
    console.log("");
    return false;
  }
}

async function runTests() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  GET_INFO SERVICE CONNECTION TEST");
  console.log("═══════════════════════════════════════════════════════\n");

  const results = {
    basicConnection: await testConnection(),
    withHeaders: false,
    health: false,
  };

  if (results.basicConnection) {
    results.withHeaders = await testWithHeaders();
    results.health = await testHealth();
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════");
  console.log(
    `  Basic Connection: ${results.basicConnection ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(
    `  With Headers:     ${results.withHeaders ? "✅ PASS" : "⏭️  SKIP"}`
  );
  console.log(`  Health Check:     ${results.health ? "✅ PASS" : "⏭️  SKIP"}`);
  console.log("═══════════════════════════════════════════════════════\n");

  if (results.basicConnection && results.withHeaders && results.health) {
    console.log(
      "🎉 All tests passed! The get_info service is working correctly."
    );
  } else {
    console.log("⚠️  Some tests failed. Review the error messages above.");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
