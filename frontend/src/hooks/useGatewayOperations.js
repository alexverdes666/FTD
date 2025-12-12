import { useState } from 'react';
import { simCardService } from '../services/simCardService';

/**
 * Custom React Hook for GoIP Gateway Operations
 * 
 * Provides easy access to all gateway operations with loading states and error handling
 * 
 * @example
 * const GatewayControl = ({ simCard }) => {
 *   const { lockPort, unlockPort, sendSMS, loading, error } = useGatewayOperations();
 * 
 *   const handleLock = async () => {
 *     const result = await lockPort(simCard._id);
 *     if (result) {
 *       alert('Port locked successfully!');
 *     }
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleLock} disabled={loading}>
 *         {loading ? 'Loading...' : 'Lock Port'}
 *       </button>
 *       {error && <div className="error">{error}</div>}
 *     </div>
 *   );
 * };
 */
export const useGatewayOperations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Execute gateway operation with loading and error handling
   */
  const executeOperation = async (operation, ...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await operation(...args);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message || 'Operation failed');
      setLoading(false);
      return null;
    }
  };

  /**
   * Configure gateway notifications
   */
  const configureGateway = async (config) => {
    return executeOperation(simCardService.configureGatewayNotifications, config);
  };

  /**
   * Enable gateway integration for a SIM card
   */
  const enableGateway = async (simCardId, port, slot) => {
    return executeOperation(
      simCardService.enableGatewayIntegration,
      simCardId,
      { port, slot }
    );
  };

  /**
   * Disable gateway integration for a SIM card
   */
  const disableGateway = async (simCardId) => {
    return executeOperation(simCardService.disableGatewayIntegration, simCardId);
  };

  /**
   * Lock a SIM card port
   */
  const lockPort = async (simCardId) => {
    return executeOperation(simCardService.lockPort, simCardId);
  };

  /**
   * Unlock a SIM card port
   */
  const unlockPort = async (simCardId) => {
    return executeOperation(simCardService.unlockPort, simCardId);
  };

  /**
   * Switch SIM card slot
   */
  const switchSlot = async (simCardId, targetSlot) => {
    return executeOperation(simCardService.switchSlot, simCardId, targetSlot);
  };

  /**
   * Reset port/module
   */
  const resetPort = async (simCardId) => {
    return executeOperation(simCardService.resetPort, simCardId);
  };

  /**
   * Send SMS via gateway
   */
  const sendSMS = async (simCardId, recipients, message, options = {}) => {
    return executeOperation(
      simCardService.sendSMS,
      simCardId,
      { to: recipients, message, options }
    );
  };

  /**
   * Get SMS statistics from gateway
   */
  const getSMSStats = async (params = {}) => {
    return executeOperation(simCardService.getGatewaySMSStats, params);
  };

  /**
   * Get call statistics from gateway
   */
  const getCallStats = async (params = {}) => {
    return executeOperation(simCardService.getGatewayCallStats, params);
  };

  /**
   * Clear error
   */
  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    clearError,
    configureGateway,
    enableGateway,
    disableGateway,
    lockPort,
    unlockPort,
    switchSlot,
    resetPort,
    sendSMS,
    getSMSStats,
    getCallStats
  };
};

/**
 * Hook for monitoring SIM card status
 * Automatically fetches and updates SIM card status at regular intervals
 * 
 * @param {string} simCardId - ID of the SIM card to monitor
 * @param {number} interval - Polling interval in milliseconds (default: 30000)
 * 
 * @example
 * const StatusMonitor = ({ simCardId }) => {
 *   const { simCard, isOnline, lastUpdate } = useSimCardStatus(simCardId);
 * 
 *   return (
 *     <div>
 *       <span>Status: {simCard?.gateway?.deviceStatus}</span>
 *       <span>Online: {isOnline ? 'Yes' : 'No'}</span>
 *       <span>Last Update: {lastUpdate}</span>
 *     </div>
 *   );
 * };
 */
export const useSimCardStatus = (simCardId, interval = 30000) => {
  const [simCard, setSimCard] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await simCardService.getSimCardById(simCardId);
      if (response.success) {
        setSimCard(response.data);
        setLastUpdate(new Date());
        
        // Check if online (received update within last 2 minutes)
        if (response.data.gateway?.lastStatusUpdate) {
          const lastStatusTime = new Date(response.data.gateway.lastStatusUpdate);
          const timeDiff = Date.now() - lastStatusTime.getTime();
          setIsOnline(timeDiff < 120000); // 2 minutes
        }
      }
    } catch (err) {
      console.error('Error fetching SIM card status:', err);
    }
  };

  // Fetch on mount and set up polling
  useState(() => {
    fetchStatus();
    const intervalId = setInterval(fetchStatus, interval);
    return () => clearInterval(intervalId);
  }, [simCardId, interval]);

  return {
    simCard,
    lastUpdate,
    isOnline,
    refresh: fetchStatus
  };
};

/**
 * Device status badge color helper
 */
export const getStatusColor = (deviceStatus) => {
  const statusColors = {
    'registered': 'green',
    'idle': 'green',
    'registering': 'yellow',
    'call_connected': 'blue',
    'no_sim': 'red',
    'register_failed': 'red',
    'locked_device': 'orange',
    'locked_operator': 'orange',
    'no_balance': 'orange',
    'recognize_error': 'red',
    'card_detected': 'yellow',
    'user_locked': 'gray',
    'port_intercalling': 'blue',
    'intercalling_holding': 'blue'
  };
  return statusColors[deviceStatus] || 'gray';
};

/**
 * Device status display text helper
 */
export const getStatusDisplay = (deviceStatus) => {
  const statusDisplay = {
    'registered': 'Registered',
    'idle': 'Idle',
    'registering': 'Registering',
    'call_connected': 'In Call',
    'no_sim': 'No SIM',
    'register_failed': 'Registration Failed',
    'locked_device': 'Locked',
    'locked_operator': 'Operator Locked',
    'no_balance': 'No Balance',
    'recognize_error': 'Recognition Error',
    'card_detected': 'Card Detected',
    'user_locked': 'User Locked',
    'port_intercalling': 'Inter-calling',
    'intercalling_holding': 'Call Holding'
  };
  return statusDisplay[deviceStatus] || deviceStatus;
};
