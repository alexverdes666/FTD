const crypto = require('crypto');
const mongoose = require('mongoose');
class SessionSecurity {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.saltLength = 32;
    this.masterKey = this.getMasterKey();
    this.validationRules = {
      maxSessionAge: 30 * 24 * 60 * 60 * 1000,
      maxCookieSize: 4096,
      maxStorageItemSize: 1024 * 1024,
      maxTotalCookies: 100,
      maxStorageItems: 50,
      requiredFields: ['sessionId', 'createdAt', 'cookies'],
      sensitiveFields: ['cookies', 'localStorage', 'sessionStorage']
    };
    this.accessLog = [];
    this.maxLogEntries = 1000;
    this.suspiciousActivityThreshold = 10;
  }
  getMasterKey() {
    const envKey = process.env.SESSION_ENCRYPTION_KEY;
    if (envKey) {
      if (envKey.length !== 64) {
        console.warn('⚠️ SESSION_ENCRYPTION_KEY should be 64 hex characters (32 bytes)');
      }
      return Buffer.from(envKey.substring(0, 64), 'hex');
    } else {
      console.warn('⚠️ No SESSION_ENCRYPTION_KEY found in environment. Using default key.');
      console.warn('⚠️ Please set SESSION_ENCRYPTION_KEY for production use.');
      const seed = 'ftd-session-encryption-default-key-2024';
      return crypto.pbkdf2Sync(seed, 'salt', 100000, 32, 'sha256');
    }
  }
  deriveKey(salt) {
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.keyLength, 'sha256');
  }
  encryptSessionData(sessionData) {
    try {
      console.log('🔐 Encrypting session data...');
      if (!sessionData || typeof sessionData !== 'object') {
        throw new Error('Session data must be a valid object');
      }
      const dataToEncrypt = JSON.parse(JSON.stringify(sessionData));
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      const key = this.deriveKey(salt);
      const encryptedData = { ...dataToEncrypt };
      for (const field of this.validationRules.sensitiveFields) {
        if (dataToEncrypt[field]) {
          const plaintext = JSON.stringify(dataToEncrypt[field]);
          const fieldIv = crypto.randomBytes(this.ivLength);
          const fieldCipher = crypto.createCipheriv('aes-256-cbc', key, fieldIv);
          let encrypted = fieldCipher.update(plaintext, 'utf8', 'hex');
          encrypted += fieldCipher.final('hex');
          encryptedData[field] = {
            encrypted: encrypted,
            iv: fieldIv.toString('hex'),
            _encrypted: true
          };
        }
      }
      encryptedData._encryption = {
        algorithm: this.algorithm,
        salt: salt.toString('hex'),
        encryptedAt: new Date(),
        version: '1.0'
      };
      console.log('✅ Session data encrypted successfully');
      return encryptedData;
    } catch (error) {
      console.error('❌ Error encrypting session data:', error);
      throw new Error(`Failed to encrypt session data: ${error.message}`);
    }
  }
  decryptSessionData(encryptedSessionData) {
    try {
      console.log('🔓 Decrypting session data...');
      if (!encryptedSessionData || typeof encryptedSessionData !== 'object') {
        throw new Error('Encrypted session data must be a valid object');
      }
      if (!encryptedSessionData._encryption) {
        console.log('ℹ️ Session data is not encrypted, returning as-is');
        return encryptedSessionData;
      }
      const dataToDecrypt = JSON.parse(JSON.stringify(encryptedSessionData));
      const { salt, algorithm, version } = dataToDecrypt._encryption;
      if (algorithm !== this.algorithm) {
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }
      const key = this.deriveKey(Buffer.from(salt, 'hex'));
      const decryptedData = { ...dataToDecrypt };
      for (const field of this.validationRules.sensitiveFields) {
        if (dataToDecrypt[field] && dataToDecrypt[field]._encrypted) {
          const fieldData = dataToDecrypt[field];
          const iv = Buffer.from(fieldData.iv, 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
          let decrypted = decipher.update(fieldData.encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          decryptedData[field] = JSON.parse(decrypted);
        }
      }
      delete decryptedData._encryption;
      console.log('✅ Session data decrypted successfully');
      return decryptedData;
    } catch (error) {
      console.error('❌ Error decrypting session data:', error);
      throw new Error(`Failed to decrypt session data: ${error.message}`);
    }
  }
  logSessionAccess(accessInfo) {
    try {
      const logEntry = {
        timestamp: new Date(),
        sessionId: accessInfo.sessionId,
        leadId: accessInfo.leadId,
        userId: accessInfo.userId,
        userRole: accessInfo.userRole,
        action: accessInfo.action,
        ipAddress: accessInfo.ipAddress,
        userAgent: accessInfo.userAgent,
        success: accessInfo.success !== false,
        errorMessage: accessInfo.errorMessage,
        metadata: accessInfo.metadata || {}
      };
      this.accessLog.push(logEntry);
      if (this.accessLog.length > this.maxLogEntries) {
        this.accessLog = this.accessLog.slice(-this.maxLogEntries);
      }
      const logLevel = logEntry.success ? 'info' : 'warn';
      console.log(`📋 Session access logged [${logLevel.toUpperCase()}]:`, {
        action: logEntry.action,
        sessionId: logEntry.sessionId?.substring(0, 12) + '...',
        userId: logEntry.userId,
        success: logEntry.success,
        timestamp: logEntry.timestamp.toISOString()
      });
      this.detectSuspiciousActivity(logEntry);
    } catch (error) {
      console.error('❌ Error logging session access:', error);
    }
  }
  detectSuspiciousActivity(logEntry) {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const recentAttempts = this.accessLog.filter(entry =>
        entry.userId === logEntry.userId &&
        entry.timestamp > oneMinuteAgo &&
        entry.action === 'access'
      );
      if (recentAttempts.length > this.suspiciousActivityThreshold) {
        console.warn('🚨 SUSPICIOUS ACTIVITY DETECTED:', {
          userId: logEntry.userId,
          attempts: recentAttempts.length,
          timeWindow: '1 minute',
          lastAttempt: logEntry.timestamp.toISOString()
        });
        this.triggerSecurityAlert('rapid_session_access', {
          userId: logEntry.userId,
          attempts: recentAttempts.length,
          ipAddress: logEntry.ipAddress
        });
      }
      const recentFailures = this.accessLog.filter(entry =>
        entry.userId === logEntry.userId &&
        entry.timestamp > oneMinuteAgo &&
        !entry.success
      );
      if (recentFailures.length > 5) {
        console.warn('🚨 MULTIPLE FAILED ACCESS ATTEMPTS:', {
          userId: logEntry.userId,
          failures: recentFailures.length,
          timeWindow: '1 minute'
        });
        this.triggerSecurityAlert('multiple_access_failures', {
          userId: logEntry.userId,
          failures: recentFailures.length,
          ipAddress: logEntry.ipAddress
        });
      }
    } catch (error) {
      console.error('❌ Error detecting suspicious activity:', error);
    }
  }
  triggerSecurityAlert(alertType, alertData) {
    console.warn(`🚨 SECURITY ALERT [${alertType.toUpperCase()}]:`, alertData);
  }
  validateSessionIntegrity(sessionData) {
    const errors = [];
    const warnings = [];
    try {
      if (!sessionData || typeof sessionData !== 'object') {
        errors.push('Session data must be a valid object');
        return { isValid: false, errors, warnings };
      }
      for (const field of this.validationRules.requiredFields) {
        if (!sessionData[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }
      if (sessionData.sessionId && !sessionData.sessionId.match(/^session_\d+_[a-f0-9]+$/)) {
        errors.push('Invalid session ID format');
      }
      if (sessionData.createdAt) {
        const sessionAge = Date.now() - new Date(sessionData.createdAt).getTime();
        if (sessionAge > this.validationRules.maxSessionAge) {
          errors.push(`Session expired (${Math.floor(sessionAge / (24 * 60 * 60 * 1000))} days old)`);
        }
      }
      if (sessionData.cookies) {
        if (!Array.isArray(sessionData.cookies)) {
          errors.push('Cookies must be an array');
        } else {
          if (sessionData.cookies.length > this.validationRules.maxTotalCookies) {
            warnings.push(`Too many cookies (${sessionData.cookies.length}), consider cleanup`);
          }
          sessionData.cookies.forEach((cookie, index) => {
            if (!cookie.name || !cookie.value) {
              errors.push(`Cookie at index ${index} missing name or value`);
            }
            if (cookie.value && cookie.value.length > this.validationRules.maxCookieSize) {
              warnings.push(`Cookie '${cookie.name}' is very large (${cookie.value.length} bytes)`);
            }
          });
        }
      }
      ['localStorage', 'sessionStorage'].forEach(storageType => {
        if (sessionData[storageType] && typeof sessionData[storageType] === 'object') {
          const items = Object.keys(sessionData[storageType]);
          if (items.length > this.validationRules.maxStorageItems) {
            warnings.push(`Too many ${storageType} items (${items.length})`);
          }
          items.forEach(key => {
            const value = sessionData[storageType][key];
            if (typeof value === 'string' && value.length > this.validationRules.maxStorageItemSize) {
              warnings.push(`${storageType} item '${key}' is very large (${value.length} bytes)`);
            }
          });
        }
      });
      if (sessionData._encryption && sessionData._encryption.version) {
        const { salt, algorithm, encryptedAt } = sessionData._encryption;
        if (!salt || !algorithm || !encryptedAt) {
          errors.push('Incomplete encryption metadata - possible tampering');
        }
      }
      if (sessionData.viewport) {
        const { width, height } = sessionData.viewport;
        if (typeof width !== 'number' || typeof height !== 'number') {
          errors.push('Invalid viewport dimensions');
        }
        if (width < 100 || height < 100 || width > 4000 || height > 4000) {
          warnings.push('Unusual viewport dimensions');
        }
      }
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasWarnings: warnings.length > 0,
      isExpired: errors.some(error => error.includes('expired')),
      isTampered: errors.some(error => error.includes('tampering'))
    };
  }
  generateSessionHash(sessionData) {
    try {
      const normalizedData = {
        sessionId: sessionData.sessionId,
        createdAt: sessionData.createdAt,
        cookieCount: sessionData.cookies ? sessionData.cookies.length : 0,
        localStorageKeys: sessionData.localStorage ? Object.keys(sessionData.localStorage).sort() : [],
        sessionStorageKeys: sessionData.sessionStorage ? Object.keys(sessionData.sessionStorage).sort() : [],
        userAgent: sessionData.userAgent,
        domain: sessionData.metadata?.domain
      };
      const dataString = JSON.stringify(normalizedData);
      return crypto.createHash('sha256').update(dataString).digest('hex');
    } catch (error) {
      console.error('❌ Error generating session hash:', error);
      return null;
    }
  }
  getAccessStatistics(filters = {}) {
    try {
      const { userId, sessionId, timeRange, action } = filters;
      let filteredLogs = this.accessLog;
      if (userId) {
        filteredLogs = filteredLogs.filter(entry => entry.userId === userId);
      }
      if (sessionId) {
        filteredLogs = filteredLogs.filter(entry => entry.sessionId === sessionId);
      }
      if (action) {
        filteredLogs = filteredLogs.filter(entry => entry.action === action);
      }
      if (timeRange) {
        const cutoff = new Date(Date.now() - timeRange);
        filteredLogs = filteredLogs.filter(entry => entry.timestamp > cutoff);
      }
      const stats = {
        totalAccesses: filteredLogs.length,
        successfulAccesses: filteredLogs.filter(entry => entry.success).length,
        failedAccesses: filteredLogs.filter(entry => !entry.success).length,
        uniqueUsers: new Set(filteredLogs.map(entry => entry.userId)).size,
        uniqueSessions: new Set(filteredLogs.map(entry => entry.sessionId)).size,
        actionBreakdown: {},
        userBreakdown: {},
        timeRange: {
          earliest: filteredLogs.length > 0 ? Math.min(...filteredLogs.map(e => e.timestamp)) : null,
          latest: filteredLogs.length > 0 ? Math.max(...filteredLogs.map(e => e.timestamp)) : null
        }
      };
      filteredLogs.forEach(entry => {
        stats.actionBreakdown[entry.action] = (stats.actionBreakdown[entry.action] || 0) + 1;
      });
      filteredLogs.forEach(entry => {
        if (!stats.userBreakdown[entry.userId]) {
          stats.userBreakdown[entry.userId] = { total: 0, successful: 0, failed: 0 };
        }
        stats.userBreakdown[entry.userId].total++;
        if (entry.success) {
          stats.userBreakdown[entry.userId].successful++;
        } else {
          stats.userBreakdown[entry.userId].failed++;
        }
      });
      return stats;
    } catch (error) {
      console.error('❌ Error getting access statistics:', error);
      return null;
    }
  }
  cleanupAccessLogs(maxAge = 7 * 24 * 60 * 60 * 1000) {
    try {
      const cutoff = new Date(Date.now() - maxAge);
      const initialLength = this.accessLog.length;
      this.accessLog = this.accessLog.filter(entry => entry.timestamp > cutoff);
      const removedCount = initialLength - this.accessLog.length;
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} old access log entries`);
      }
      return removedCount;
    } catch (error) {
      console.error('❌ Error cleaning up access logs:', error);
      return 0;
    }
  }
  generateSecurityReport() {
    try {
      const now = new Date();
      const last24Hours = 24 * 60 * 60 * 1000;
      const last7Days = 7 * 24 * 60 * 60 * 1000;
      return {
        reportGeneratedAt: now,
        accessStatistics: {
          last24Hours: this.getAccessStatistics({ timeRange: last24Hours }),
          last7Days: this.getAccessStatistics({ timeRange: last7Days }),
          overall: this.getAccessStatistics()
        },
        securityMetrics: {
          totalLogEntries: this.accessLog.length,
          encryptionStatus: {
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            hasEnvironmentKey: !!process.env.SESSION_ENCRYPTION_KEY
          },
          validationRules: this.validationRules,
          suspiciousActivityThreshold: this.suspiciousActivityThreshold
        },
        recommendations: this.generateSecurityRecommendations()
      };
    } catch (error) {
      console.error('❌ Error generating security report:', error);
      return null;
    }
  }
  generateSecurityRecommendations() {
    const recommendations = [];
    if (!process.env.SESSION_ENCRYPTION_KEY) {
      recommendations.push({
        priority: 'HIGH',
        category: 'encryption',
        message: 'Set SESSION_ENCRYPTION_KEY environment variable for production security',
        action: 'Generate a secure 64-character hex key and set it as SESSION_ENCRYPTION_KEY'
      });
    }
    if (this.accessLog.length > this.maxLogEntries * 0.8) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'logging',
        message: 'Access log is approaching maximum size',
        action: 'Consider implementing persistent logging or increasing cleanup frequency'
      });
    }
    const recentFailures = this.accessLog.filter(entry =>
      !entry.success &&
      entry.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    if (recentFailures.length > 10) {
      recommendations.push({
        priority: 'HIGH',
        category: 'security',
        message: `High number of failed access attempts (${recentFailures.length}) in last 24 hours`,
        action: 'Review failed access patterns and consider implementing additional security measures'
      });
    }
    return recommendations;
  }
}
module.exports = new SessionSecurity();