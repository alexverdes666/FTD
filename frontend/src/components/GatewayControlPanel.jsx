import React, { useState } from 'react';
import { useGatewayOperations, getStatusColor, getStatusDisplay } from '../hooks/useGatewayOperations';

/**
 * Gateway Control Panel Component
 * 
 * Provides UI controls for all gateway operations
 * 
 * @param {Object} props
 * @param {Object} props.simCard - SIM card object with gateway integration enabled
 * @param {Function} props.onUpdate - Callback when operation completes
 * 
 * @example
 * <GatewayControlPanel 
 *   simCard={simCardData} 
 *   onUpdate={() => refreshSimCardList()} 
 * />
 */
const GatewayControlPanel = ({ simCard, onUpdate }) => {
  const {
    loading,
    error,
    clearError,
    lockPort,
    unlockPort,
    switchSlot,
    resetPort,
    sendSMS
  } = useGatewayOperations();

  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(simCard?.gateway?.slot || 1);

  if (!simCard?.gateway?.enabled) {
    return (
      <div className="gateway-control-panel disabled">
        <p>Gateway integration not enabled for this SIM card.</p>
      </div>
    );
  }

  const handleLockPort = async () => {
    if (window.confirm('Are you sure you want to lock this port?')) {
      const result = await lockPort(simCard._id);
      if (result && onUpdate) onUpdate();
    }
  };

  const handleUnlockPort = async () => {
    const result = await unlockPort(simCard._id);
    if (result && onUpdate) onUpdate();
  };

  const handleSwitchSlot = async () => {
    if (window.confirm(`Switch to slot ${selectedSlot}?`)) {
      const result = await switchSlot(simCard._id, selectedSlot);
      if (result && onUpdate) onUpdate();
    }
  };

  const handleResetPort = async () => {
    if (window.confirm('Are you sure you want to reset this port? This may cause temporary disconnection.')) {
      const result = await resetPort(simCard._id);
      if (result && onUpdate) onUpdate();
    }
  };

  const handleSendSMS = async (e) => {
    e.preventDefault();
    const result = await sendSMS(simCard._id, smsRecipient, smsMessage);
    if (result) {
      setShowSMSModal(false);
      setSmsRecipient('');
      setSmsMessage('');
      alert('SMS sent successfully!');
    }
  };

  const statusColor = getStatusColor(simCard.gateway.deviceStatus);
  const statusDisplay = getStatusDisplay(simCard.gateway.deviceStatus);

  return (
    <div className="gateway-control-panel">
      <h3>Gateway Control Panel</h3>
      
      {error && (
        <div className="error-banner" style={{ background: '#fee', padding: '10px', marginBottom: '10px', borderRadius: '4px' }}>
          <span style={{ color: 'red' }}>{error}</span>
          <button onClick={clearError} style={{ float: 'right' }}>×</button>
        </div>
      )}

      {/* Status Section */}
      <div className="status-section" style={{ marginBottom: '20px' }}>
        <h4>Current Status</h4>
        <div className="status-info">
          <div className="status-item">
            <label>Port:</label>
            <span className="value">{simCard.gateway.port}</span>
          </div>
          <div className="status-item">
            <label>Slot:</label>
            <span className="value">{simCard.gateway.slot}</span>
          </div>
          <div className="status-item">
            <label>Status:</label>
            <span className="value" style={{ color: statusColor, fontWeight: 'bold' }}>
              {statusDisplay}
            </span>
          </div>
          <div className="status-item">
            <label>Balance:</label>
            <span className="value">${simCard.gateway.balance?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="status-item">
            <label>Locked:</label>
            <span className="value">{simCard.gateway.isLocked ? 'Yes' : 'No'}</span>
          </div>
          <div className="status-item">
            <label>IMEI:</label>
            <span className="value">{simCard.gateway.imei || 'N/A'}</span>
          </div>
          <div className="status-item">
            <label>Last Update:</label>
            <span className="value">
              {simCard.gateway.lastStatusUpdate 
                ? new Date(simCard.gateway.lastStatusUpdate).toLocaleString()
                : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Control Section */}
      <div className="control-section" style={{ marginBottom: '20px' }}>
        <h4>Port Controls</h4>
        <div className="button-group" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {simCard.gateway.isLocked ? (
            <button 
              onClick={handleUnlockPort} 
              disabled={loading}
              className="btn-unlock"
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {loading ? 'Processing...' : '🔓 Unlock Port'}
            </button>
          ) : (
            <button 
              onClick={handleLockPort} 
              disabled={loading}
              className="btn-lock"
              style={{ padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {loading ? 'Processing...' : '🔒 Lock Port'}
            </button>
          )}
          
          <button 
            onClick={handleResetPort} 
            disabled={loading}
            className="btn-reset"
            style={{ padding: '10px 20px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {loading ? 'Processing...' : '🔄 Reset Port'}
          </button>
          
          <button 
            onClick={() => setShowSMSModal(true)} 
            disabled={loading || simCard.gateway.isLocked}
            className="btn-sms"
            style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            📱 Send SMS
          </button>
        </div>
      </div>

      {/* Slot Switching Section */}
      <div className="slot-section" style={{ marginBottom: '20px' }}>
        <h4>Switch SIM Slot</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={selectedSlot} 
            onChange={(e) => setSelectedSlot(parseInt(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value={1}>Slot 1 (A)</option>
            <option value={2}>Slot 2 (B)</option>
            <option value={3}>Slot 3 (C)</option>
            <option value={4}>Slot 4 (D)</option>
          </select>
          <button 
            onClick={handleSwitchSlot} 
            disabled={loading || selectedSlot === simCard.gateway.slot}
            style={{ padding: '8px 16px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {loading ? 'Switching...' : 'Switch Slot'}
          </button>
        </div>
      </div>

      {/* SMS Statistics */}
      <div className="sms-stats-section">
        <h4>SMS Statistics</h4>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div className="stat-card" style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>Sent</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{simCard.smsStats?.sent || 0}</div>
          </div>
          <div className="stat-card" style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>Received</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{simCard.smsStats?.received || 0}</div>
          </div>
          <div className="stat-card" style={{ padding: '10px', background: '#d4edda', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#155724' }}>Sent OK</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#155724' }}>
              {simCard.smsStats?.sentOk || 0}
            </div>
          </div>
          <div className="stat-card" style={{ padding: '10px', background: '#f8d7da', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#721c24' }}>Failed</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#721c24' }}>
              {simCard.smsStats?.sentFailed || 0}
            </div>
          </div>
        </div>
      </div>

      {/* SMS Modal */}
      {showSMSModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3>Send SMS</h3>
            <form onSubmit={handleSendSMS}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Recipient:</label>
                <input
                  type="text"
                  value={smsRecipient}
                  onChange={(e) => setSmsRecipient(e.target.value)}
                  placeholder="Phone number"
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Message:</label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Enter your message"
                  required
                  rows={4}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowSMSModal(false)}
                  style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {loading ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GatewayControlPanel;
