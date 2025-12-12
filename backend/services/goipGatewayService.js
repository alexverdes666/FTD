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
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      }
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
    try {
      const response = await this.client.get('/goip_get_status.html', {
        params: {
          username: this.gatewayUsername,
          password: this.gatewayPassword
        },
        timeout: 10000
      });
      
      return {
        success: true,
        message: 'Connection successful',
        gatewayId: this.gatewayId,
        gatewayName: this.gatewayName,
        host: this.gatewayHost,
        port: this.gatewayPort,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Gateway connection test failed for ${this.gatewayName}:`, error.message);
      return {
        success: false,
        message: 'Connection failed',
        gatewayId: this.gatewayId,
        gatewayName: this.gatewayName,
        host: this.gatewayHost,
        port: this.gatewayPort,
        error: error.message,
        timestamp: new Date()
      };
    }
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
      const payload = {
        type: 'send-sms',
        task_num: smsData.tasks.length,
        tasks: smsData.tasks,
        ...smsData.options
      };

      const response = await this.client.post('/goip_post_sms.html', payload, {
        params: {
          version: '1.1',
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
      const payload = taskIds ? { tids: taskIds } : {};
      const response = await this.client.post('/goip_pause_sms.html', payload, {
        params: {
          version: '1.1',
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
      const payload = taskIds ? { tids: taskIds } : {};
      const response = await this.client.post('/goip_resume_sms.html', payload, {
        params: {
          version: '1.1',
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
      const payload = taskIds ? { tids: taskIds } : {};
      const response = await this.client.post('/goip_remove_sms.html', payload, {
        params: {
          version: '1.1',
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
      const params = {
        version: '1.1',
        username: this.gatewayUsername,
        password: this.gatewayPassword,
        port: options.port || 1,
        pos: options.pos || 0,
        num: options.num || 10,
        has_content: options.hasContent ? 1 : 0
      };

      const response = await this.client.get('/goip_get_tasks.html', { params });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error querying SMS tasks:', error.message);
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

      const response = await this.client.get('/goip_get_sms.html', { params });
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
