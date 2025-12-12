const speakeasy = require('speakeasy');
const crypto = require('crypto');
const User = require('../models/User');
const { encrypt, decrypt } = require('../utils/encryption');

// Generate random backup codes
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

// Setup 2FA - Generate secret and QR code
exports.setup2FA = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '2FA is only available for admin users'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `LeadManagement (${user.email})`,
      issuer: 'Lead Management Platform'
    });

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    
    // Hash backup codes before storing
    const bcrypt = require('bcryptjs');
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (code) => {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(code, salt);
      })
    );

    // Encrypt and temporarily store the secret (not enabled yet)
    const encryptedSecret = encrypt(secret.base32);
    
    // Use findByIdAndUpdate to avoid version conflicts
    await User.findByIdAndUpdate(
      userId,
      {
        twoFactorSecret: encryptedSecret,
        twoFactorBackupCodes: hashedBackupCodes,
        twoFactorEnabled: false // Not enabled until verified
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: '2FA setup initiated. Please verify with your authenticator app.',
      data: {
        otpauthUrl: secret.otpauth_url, // Send the raw URL for QR code generation
        secret: secret.base32,
        backupCodes: backupCodes // Return plain text codes for user to save
      }
    });
  } catch (error) {
    console.error('Error in setup2FA:', error);
    next(error);
  }
};

// Verify 2FA setup and enable it
exports.verify2FASetup = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    const user = await User.findById(userId).select('+twoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: '2FA setup not initiated. Please start setup first.'
      });
    }

    // Decrypt the secret
    const decryptedSecret = decrypt(user.twoFactorSecret);

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps (60 seconds) tolerance
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.'
      });
    }

    // Enable 2FA using findByIdAndUpdate to avoid version conflicts
    await User.findByIdAndUpdate(
      userId,
      { twoFactorEnabled: true },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: '2FA has been successfully enabled for your account'
    });
  } catch (error) {
    console.error('Error in verify2FASetup:', error);
    next(error);
  }
};

// Verify 2FA during login
exports.verify2FALogin = async (req, res, next) => {
  try {
    const { userId, token, useBackupCode } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: 'User ID and token are required'
      });
    }

    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account'
      });
    }

    let verified = false;

    if (useBackupCode) {
      // Verify backup code
      const bcrypt = require('bcryptjs');
      let matchedCode = null;
      
      for (const hashedCode of user.twoFactorBackupCodes) {
        const isMatch = await bcrypt.compare(token, hashedCode);
        if (isMatch) {
          matchedCode = hashedCode;
          verified = true;
          break;
        }
      }
      
      if (matchedCode) {
        // Remove used backup code using findByIdAndUpdate
        const updatedCodes = user.twoFactorBackupCodes.filter(
          code => code !== matchedCode
        );
        await User.findByIdAndUpdate(
          userId,
          { twoFactorBackupCodes: updatedCodes },
          { new: true }
        );
      }
    } else {
      // Verify TOTP token
      const decryptedSecret = decrypt(user.twoFactorSecret);
      verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    res.status(200).json({
      success: true,
      message: '2FA verification successful',
      data: {
        verified: true
      }
    });
  } catch (error) {
    console.error('Error in verify2FALogin:', error);
    next(error);
  }
};

// Disable 2FA
exports.disable2FA = async (req, res, next) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to disable 2FA'
      });
    }

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Disable 2FA using findByIdAndUpdate to avoid version conflicts
    await User.findByIdAndUpdate(
      userId,
      {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: []
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: '2FA has been disabled for your account'
    });
  } catch (error) {
    console.error('Error in disable2FA:', error);
    next(error);
  }
};

// Regenerate backup codes
exports.regenerateBackupCodes = async (req, res, next) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to regenerate backup codes'
      });
    }

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);
    const bcrypt = require('bcryptjs');
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (code) => {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(code, salt);
      })
    );

    // Update backup codes using findByIdAndUpdate to avoid version conflicts
    await User.findByIdAndUpdate(
      userId,
      { twoFactorBackupCodes: hashedBackupCodes },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Backup codes have been regenerated',
      data: {
        backupCodes: backupCodes
      }
    });
  } catch (error) {
    console.error('Error in regenerateBackupCodes:', error);
    next(error);
  }
};

// Get 2FA status
exports.get2FAStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        isAdmin: user.role === 'admin'
      }
    });
  } catch (error) {
    console.error('Error in get2FAStatus:', error);
    next(error);
  }
};

