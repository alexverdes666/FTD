const axios = require('axios');

/**
 * GoIP Gateway Service
 * Handles all communication with the GoIP SMS Gateway
 * Supports multiple gateway instances
 */
class GoIPGatewayService {
  constructor(config = null) {
    if (config) {
      // Use provided configuration (for specific gateway instance)
      this.gatewayHost = config.host;
      this.gatewayPort = config.port;
      this.gatewayUsername = config.username;
      this.gatewayPassword = config.password;
      this.gatewayId = config.gatewayId || config._id;
      this.gatewayName = config.name || 'Unknown';
    } else {
      // Fallback to environment variables (for backward compatibility)
      this.gatewayHost = process.env.GOIP_GATEWAY_HOST || '188.126.10.151';
      this.gatewayPort = process.env.GOIP_GATEWAY_PORT || '4064';
      this.gatewayUsername = process.env.GOIP_GATEWAY_USERNAME || 'root';
      this.gatewayPassword = process.env.GOIP_GATEWAY_PASSWORD || 'Greedisgood10!';
      this.gatewayId = null;
      this.gatewayName = 'Default';
    }
    
    this.baseURL = `http://${this.gatewayHost}:${this.gatewayPort}`;

    // Create axios instance
    // NOTE: Do NOT set Content-Type as a default header - GoIP devices have minimal HTTP servers
    // that may reject GET requests with application/json Content-Type.
    // Axios automatically sets Content-Type: application/json for POST requests with JSON body.
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000
    });
  }

  /**
   * Create a new gateway service instance for a specific gateway
   * @param {Object} gatewayConfig - Gateway configuration object
   * @returns {GoIPGatewayService} New gateway service instance
   */
  static createInstance(gatewayConfig) {
    return new GoIPGatewayService(gatewayConfig);
  }

  /**
   * Test connection to the gateway
   * @returns {Object} Test result with success status and details
   */
  async testConnection() {
    const endpoints = [
      '/goip_get_status.html',
      '/get_sms_config'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.client.get(endpoint, {
          params: {
            username: this.gatewayUsername,
            password: this.gatewayPassword
          },
          timeout: 15000
        });

        return {
          success: true,
          message: `Connection successful (${endpoint})`,
          gatewayId: this.gatewayId,
          gatewayName: this.gatewayName,
          host: this.gatewayHost,
          port: this.gatewayPort,
          timestamp: new Date()
        };
      } catch (error) {
        // If this is a response error (device responded but returned error), connection works
        if (error.response) {
          return {
            success: true,
            message: `Connection successful (device responded with ${error.response.status})`,
            gatewayId: this.gatewayId,
            gatewayName: this.gatewayName,
            host: this.gatewayHost,
            port: this.gatewayPort,
            timestamp: new Date()
          };
        }
        // Network/timeout error - try next endpoint
        console.error(`Gateway test endpoint ${endpoint} failed for ${this.gatewayName}:`, error.message);
        continue;
      }
    }

    return {
      success: false,
      message: 'Connection failed',
      gatewayId: this.gatewayId,
      gatewayName: this.gatewayName,
      host: this.gatewayHost,
      port: this.gatewayPort,
      error: `Could not reach gateway at ${this.baseURL}`,
      timestamp: new Date()
    };
  }

  /**
   * Configure gateway to send status updates to our server
   * @param {string} callbackUrl - URL where gateway should send status updates
   * @param {number} period - Status report period in seconds (min 60, 0 to disable)
   * @param {boolean} allSims - Get all card status (0 or 1)
   */
  async configureStatusNotification(callbackUrl, period = 60, allSims = 1) {
    try {
      const response = await this.client.get('/goip_get_status.html', {
        params: {
          url: callbackUrl,
          period: period,
          all_sims: allSims,
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error configuring status notification:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Send command to gateway (lock/unlock/switch/reset)
   * @param {Object} command - Command object
   */
  async sendCommand(command) {
    try {
      const response = await this.client.post('/goip_send_cmd.html', command, {
        params: {
          version: '1.1',
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error sending command:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Lock port(s)
   * @param {string|Array} ports - Port(s) to lock (e.g., "1A", ["1A", "2B"])
   */
  async lockPort(ports) {
    const portsStr = Array.isArray(ports) ? ports.join(',') : ports;
    return this.sendCommand({
      type: 'command',
      op: 'lock',
      ports: portsStr
    });
  }

  /**
   * Unlock port(s)
   * @param {string|Array} ports - Port(s) to unlock
   */
  async unlockPort(ports) {
    const portsStr = Array.isArray(ports) ? ports.join(',') : ports;
    return this.sendCommand({
      type: 'command',
      op: 'unlock',
      ports: portsStr
    });
  }

  /**
   * Switch SIM card slot
   * @param {string} port - Port to switch (e.g., "1A")
   */
  async switchSimSlot(port) {
    return this.sendCommand({
      type: 'command',
      op: 'switch',
      ports: port
    });
  }

  /**
   * Reset module/port
   * @param {string|Array} ports - Port(s) to reset
   */
  async resetPort(ports) {
    const portsStr = Array.isArray(ports) ? ports.join(',') : ports;
    return this.sendCommand({
      type: 'command',
      op: 'reset',
      ports: portsStr
    });
  }

  /**
   * Save device configuration
   */
  async saveConfiguration() {
    return this.sendCommand({
      type: 'command',
      op: 'save'
    });
  }

  /**
   * Reboot device
   */
  async rebootDevice() {
    return this.sendCommand({
      type: 'command',
      op: 'reboot'
    });
  }

  /**
   * Send SMS
   * @param {Object} smsData - SMS data object
   */
  async sendSMS(smsData) {
    try {
      const tasks = smsData.tasks.map(task => ({
        ...task,
        ...smsData.options
      }));

      const response = await this.client.post('/submit_sms_tasks', tasks, {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error sending SMS:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Pause SMS task(s)
   * @param {Array<number>} taskIds - Array of task IDs to pause
   */
  async pauseSMSTask(taskIds) {
    try {
      const payload = taskIds ? { ids: taskIds } : {};
      const response = await this.client.post('/pause_sms_tasks', payload, {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error pausing SMS task:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Resume SMS task(s)
   * @param {Array<number>} taskIds - Array of task IDs to resume
   */
  async resumeSMSTask(taskIds) {
    try {
      const payload = taskIds ? { ids: taskIds } : {};
      const response = await this.client.post('/resume_sms_tasks', payload, {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error resuming SMS task:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Delete SMS task(s)
   * @param {Array<number>} taskIds - Array of task IDs to delete
   */
  async deleteSMSTask(taskIds) {
    try {
      const payload = taskIds ? { ids: taskIds } : {};
      const response = await this.client.post('/remove_sms_tasks', payload, {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error deleting SMS task:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Query SMS tasks
   * @param {Object} options - Query options
   */
  async querySMSTasks(options = {}) {
    try {
      const body = {
        port: options.port || 1,
        index: options.index || 0,
        num: options.num || 10,
        need_content: options.needContent ? 1 : 0
      };

      const response = await this.client.get('/get_sms_tasks', {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        },
        data: body
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error querying SMS tasks:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get SMS configuration from gateway
   * @returns {Object} SMS config data
   */
  async getSMSConfig() {
    try {
      const response = await this.client.get('/get_sms_config', {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error getting SMS config:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Set SMS configuration on gateway
   * @param {Object} config - SMS configuration to set
   * @returns {Object} Result
   */
  async setSMSConfig(config) {
    try {
      const response = await this.client.post('/set_sms_config', config, {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error setting SMS config:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Query received SMS
   * @param {Object} options - Query options
   */
  async queryReceivedSMS(options = {}) {
    try {
      const params = {
        version: '1.1',
        username: this.gatewayUsername,
        password: this.gatewayPassword,
        sms_id: options.smsId || 1,
        sms_num: options.smsNum || 0,
        sms_del: options.smsDel ? 1 : 0
      };

      const response = await this.client.get('/goip_get_sms.html', { params, timeout: 60000 });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error querying received SMS:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Query SMS statistics
   * @param {Object} options - Query options
   */
  async querySMSStatistics(options = {}) {
    try {
      const params = {
        version: '1.1',
        username: this.gatewayUsername,
        password: this.gatewayPassword,
        ports: options.ports || 'all',
        slots: options.slots || undefined,
        type: options.type !== undefined ? options.type : 0 // 0: last hour, 1: last 2 hours, 2: today, 3: cumulative
      };

      const response = await this.client.get('/goip_get_sms_stat.html', { params });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error querying SMS statistics:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Query call statistics
   * @param {Object} options - Query options
   */
  async queryCallStatistics(options = {}) {
    try {
      const params = {
        version: '1.1',
        username: this.gatewayUsername,
        password: this.gatewayPassword,
        ports: options.ports || 'all',
        slots: options.slots || undefined,
        type: options.type !== undefined ? options.type : 0
      };

      const response = await this.client.get('/goip_get_call_stat.html', { params });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error querying call statistics:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Get phone numbers configured on each port.
   * Tries endpoints in order: /get_numbers (v3) -> /get_device_status (v3) -> /goip_get_status.html (legacy)
   * @returns {Object} { success, data: [{ port, slot, number }] }
   */
  async getNumbers() {
    const authParams = { username: this.gatewayUsername, password: this.gatewayPassword };

    // 1) Try eJoin v3 /get_numbers — returns [{ port, slot, number }]
    try {
      const response = await this.client.get('/get_numbers', {
        params: authParams, timeout: 15000
      });
      if (Array.isArray(response.data)) {
        return { success: true, data: response.data };
      }
    } catch (e) {
      // Fall through
    }

    // 2) Try eJoin v3 /get_device_status — returns { status: [{ port: "1.01", sn, ... }] }
    try {
      const response = await this.client.get('/get_device_status', {
        params: authParams, timeout: 15000
      });
      const raw = response.data;
      if (raw?.status && Array.isArray(raw.status)) {
        const results = [];
        for (const entry of raw.status) {
          const portSlot = entry.port?.toString() || '';
          let port, slot;
          if (portSlot.includes('.')) {
            const [p, s] = portSlot.split('.');
            port = parseInt(p);
            slot = parseInt(s);
          } else {
            port = parseInt(portSlot);
            slot = 1;
          }
          results.push({
            port,
            slot: slot || 1,
            number: entry.sn || '',
            imei: entry.imei || '',
            iccid: entry.iccid || '',
            imsi: entry.imsi || '',
            operator: entry.opr || '',
            status: entry.st,
            signal: entry.sig,
            balance: entry.bal,
          });
        }
        return { success: true, data: results };
      }
    } catch (e) {
      // Fall through
    }

    // 3) Fallback: legacy /goip_get_status.html
    try {
      const response = await this.client.get('/goip_get_status.html', {
        params: authParams, timeout: 15000
      });
      const raw = response.data;
      const results = [];

      if (typeof raw === 'string') {
        // Text format: lines like "port=1;sn=+44123;st=3 Registered;..."
        const lines = raw.split('\n').filter(Boolean);
        for (const line of lines) {
          const parts = {};
          line.split(';').forEach((seg) => {
            const idx = seg.indexOf('=');
            if (idx > 0) parts[seg.substring(0, idx).trim()] = seg.substring(idx + 1).trim();
          });
          if (parts.port) {
            results.push({
              port: parseInt(parts.port) || parts.port,
              slot: parseInt(parts.slot) || 1,
              number: parts.sn || '',
              imei: parts.imei || '',
              operator: parts.opr || '',
              status: parts.st,
            });
          }
        }
      } else if (Array.isArray(raw)) {
        for (const entry of raw) {
          results.push({
            port: entry.port,
            slot: entry.slot || 1,
            number: entry.sn || entry.number || '',
            imei: entry.imei || '',
            operator: entry.opr || '',
            status: entry.st,
          });
        }
      } else if (raw?.status && Array.isArray(raw.status)) {
        // Some firmware returns { status: [...] } on this endpoint too
        for (const entry of raw.status) {
          results.push({
            port: entry.port,
            slot: entry.slot || 1,
            number: entry.sn || '',
            imei: entry.imei || '',
            operator: entry.opr || '',
            status: entry.st,
          });
        }
      }

      return { success: true, data: results };
    } catch (error) {
      console.error('Error getting numbers:', error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Parse device status code to string
   * @param {number} statusCode - Status code from gateway
   */
  parseDeviceStatus(statusCode) {
    const statusMap = {
      0: 'no_sim',
      1: 'idle',
      2: 'registering',
      3: 'registered',
      4: 'call_connected',
      5: 'no_balance',
      6: 'register_failed',
      7: 'locked_device',
      8: 'locked_operator',
      9: 'recognize_error',
      11: 'card_detected',
      12: 'user_locked',
      13: 'port_intercalling',
      14: 'intercalling_holding'
    };
    return statusMap[statusCode] || 'no_sim';
  }

  /**
   * Parse port status message from gateway
   * @param {Object} portStatus - Port status object from gateway
   */
  parsePortStatus(portStatus) {
    const statusParts = portStatus.st ? portStatus.st.split(' ') : ['0', 'Unknown'];
    const statusCode = parseInt(statusParts[0]);
    const statusDetail = statusParts.slice(1).join(' ');

    return {
      port: portStatus.port,
      statusCode: statusCode,
      deviceStatus: this.parseDeviceStatus(statusCode),
      statusDetail: statusDetail,
      balance: parseFloat(portStatus.bal) || 0,
      operator: portStatus.opr || '',
      simNumber: portStatus.sn || '',
      imei: portStatus.imei || '',
      imsi: portStatus.imsi || '',
      iccid: portStatus.iccid || '',
      lastUpdate: new Date()
    };
  }

  /**
   * Handle error responses
   */
  _handleError(error) {
    if (error.response) {
      return {
        success: false,
        message: 'Gateway returned an error',
        status: error.response.status,
        data: error.response.data
      };
    } else if (error.request) {
      return {
        success: false,
        message: 'No response from gateway. Check if gateway is reachable.',
        error: error.message
      };
    } else {
      return {
        success: false,
        message: 'Error setting up request',
        error: error.message
      };
    }
  }
}

// Export both the class and a default instance for backward compatibility
module.exports = GoIPGatewayService;
module.exports.default = new GoIPGatewayService();
