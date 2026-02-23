module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  // Increase timeout for mongodb-memory-server startup
  testTimeout: 30000,
};
