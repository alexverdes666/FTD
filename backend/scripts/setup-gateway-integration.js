/**
 * GoIP Gateway Integration Setup Script
 * 
 * This script helps you configure the GoIP Gateway to send status updates to your server.
 * Run this after starting your server to enable live updates.
 */

const axios = require('axios');
require('dotenv').config();

const GATEWAY_HOST = process.env.GOIP_GATEWAY_HOST || '188.126.10.151';
const GATEWAY_PORT = process.env.GOIP_GATEWAY_PORT || '4064';
const GATEWAY_USERNAME = process.env.GOIP_GATEWAY_USERNAME || 'root';
const GATEWAY_PASSWORD = process.env.GOIP_GATEWAY_PASSWORD || 'Greedisgood10!';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function setupGatewayIntegration() {
  console.log('🔧 GoIP Gateway Integration Setup');
  console.log('================================\n');

  const callbackUrl = `${SERVER_URL}/api/simcards/gateway/webhook/status`;
  const smsCallbackUrl = `${SERVER_URL}/api/simcards/gateway/webhook/sms`;

  console.log(`Gateway: ${GATEWAY_HOST}:${GATEWAY_PORT}`);
  console.log(`Callback URL: ${callbackUrl}`);
  console.log(`SMS Callback URL: ${smsCallbackUrl}\n`);

  try {
    // Configure status notifications
    console.log('📡 Configuring status notifications...');
    const statusResponse = await axios.get(
      `http://${GATEWAY_HOST}:${GATEWAY_PORT}/goip_get_status.html`,
      {
        params: {
          url: callbackUrl,
          period: 60, // Send updates every 60 seconds
          all_sims: 1, // Get status for all SIM slots
          username: GATEWAY_USERNAME,
          password: GATEWAY_PASSWORD
        },
        timeout: 10000
      }
    );

    console.log('✅ Status notifications configured successfully!');
    console.log('   - Updates will be sent every 60 seconds');
    console.log('   - All SIM slots will be monitored\n');

    // Test connection
    console.log('🔍 Testing gateway connection...');
    const testResponse = await axios.get(
      `http://${GATEWAY_HOST}:${GATEWAY_PORT}/goip_get_status.html`,
      {
        params: {
          username: GATEWAY_USERNAME,
          password: GATEWAY_PASSWORD
        },
        timeout: 10000
      }
    );

    console.log('✅ Gateway connection successful!\n');

    console.log('📋 Next Steps:');
    console.log('   1. Ensure your server is accessible from the gateway');
    console.log('   2. Enable gateway integration for your SIM cards via API or UI');
    console.log('   3. Monitor the console logs for incoming status updates\n');

    console.log('💡 Tips:');
    console.log('   - Check firewall allows traffic from gateway IP');
    console.log('   - Use ngrok or similar if testing locally');
    console.log('   - View logs with: tail -f logs/gateway.log\n');

    console.log('✨ Setup complete! Gateway integration is ready.\n');

  } catch (error) {
    console.error('❌ Error setting up gateway integration:\n');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   Cannot connect to gateway. Please check:');
      console.error('   - Gateway IP and port are correct');
      console.error('   - Gateway is powered on and accessible');
      console.error('   - Network connectivity to gateway\n');
    } else if (error.response) {
      console.error(`   Gateway returned error: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}\n`);
    } else {
      console.error(`   ${error.message}\n`);
    }

    console.error('Please verify your configuration in .env file:');
    console.error(`   GOIP_GATEWAY_HOST=${GATEWAY_HOST}`);
    console.error(`   GOIP_GATEWAY_PORT=${GATEWAY_PORT}`);
    console.error(`   GOIP_GATEWAY_USERNAME=${GATEWAY_USERNAME}`);
    console.error(`   GOIP_GATEWAY_PASSWORD=********`);
    console.error(`   SERVER_URL=${SERVER_URL}\n`);
    
    process.exit(1);
  }
}

// Run the setup
setupGatewayIntegration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
