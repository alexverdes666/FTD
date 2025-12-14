#!/usr/bin/env node

/**
 * Startup script for get_info service
 * Performs health checks and logs environment info
 */

const os = require("os");
const dns = require("dns").promises;

console.log("");
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║                                                            ║");
console.log("║   🔍 USER DETECTION API - STARTING                         ║");
console.log("║                                                            ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("");

// Log environment info
console.log("📊 Environment Information:");
console.log(`   Node Version: ${process.version}`);
console.log(`   Platform: ${os.platform()} ${os.release()}`);
console.log(`   Architecture: ${os.arch()}`);
console.log(`   CPUs: ${os.cpus().length}`);
console.log(`   Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`   Hostname: ${os.hostname()}`);
console.log(`   Port: ${process.env.PORT || 3000}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log("");

// Check network connectivity
async function checkNetworkConnectivity() {
  console.log("🌐 Network Connectivity Check:");

  try {
    const addresses = await dns.resolve4("google.com");
    console.log(`   ✅ Internet connectivity: OK (${addresses[0]})`);
  } catch (error) {
    console.log(`   ⚠️  Internet connectivity: FAILED (${error.message})`);
  }

  try {
    const hostname = os.hostname();
    const addresses = await dns.resolve4(hostname).catch(() => null);
    if (addresses) {
      console.log(
        `   ✅ Hostname resolution: OK (${hostname} -> ${addresses[0]})`
      );
    } else {
      console.log(`   ⚠️  Hostname resolution: Not available (${hostname})`);
    }
  } catch (error) {
    console.log(`   ⚠️  Hostname resolution: ${error.message}`);
  }

  console.log("");
}

// Check environment variables
function checkEnvironmentVariables() {
  console.log("🔐 Environment Variables:");

  const requiredVars = {
    PORT: process.env.PORT || "3000 (default)",
    NODE_ENV: process.env.NODE_ENV || "development (default)",
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    const status = value.includes("(default)") ? "⚠️ " : "✅";
    console.log(`   ${status} ${key}: ${value}`);
  }

  console.log("");
}

// Check required modules
function checkModules() {
  console.log("📦 Required Modules:");
  
  const modules = ["express", "cors", "ua-parser-js"];
  let allModulesOk = true;
  
  for (const module of modules) {
    try {
      // First try to require the module itself
      require(module);
      // Then get its version
      const pkg = require(`${module}/package.json`);
      console.log(`   ✅ ${module}: v${pkg.version}`);
    } catch (error) {
      console.log(`   ❌ ${module}: NOT FOUND - ${error.message}`);
      allModulesOk = false;
    }
  }
  
  console.log("");
  
  if (!allModulesOk) {
    console.error("⚠️  MISSING DEPENDENCIES DETECTED!");
    console.error("This may cause the service to fail.");
    console.error("Render should have installed all dependencies from package.json");
    console.error("");
  }
  
  return allModulesOk;
}

// Main startup
async function startup() {
  try {
    checkEnvironmentVariables();
    const modulesOk = checkModules();
    await checkNetworkConnectivity();

    if (!modulesOk) {
      console.warn("⚠️  Warning: Some modules are missing. Service may not work correctly.");
      console.warn("Attempting to start anyway...");
      console.warn("");
    }

    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "║   ✅ PRE-FLIGHT CHECKS COMPLETE                            ║"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "║   Starting Express server...                               ║"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝"
    );
    console.log("");

    // Start the actual server
    require("./src/server");
  } catch (error) {
    console.error("");
    console.error(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.error(
      "║                                                            ║"
    );
    console.error(
      "║   ❌ STARTUP FAILED                                        ║"
    );
    console.error(
      "║                                                            ║"
    );
    console.error(
      "╚════════════════════════════════════════════════════════════╝"
    );
    console.error("");
    console.error("Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("");
  console.error("💥 UNCAUGHT EXCEPTION:");
  console.error(error);
  console.error("");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("");
  console.error("💥 UNHANDLED REJECTION:");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  console.error("");
  process.exit(1);
});

// Start
startup();
