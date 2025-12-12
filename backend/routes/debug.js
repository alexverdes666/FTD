const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatImage = require('../models/ChatImage');
const { imageAuth } = require('../middleware/imageAuth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Test JWT token verification
router.post('/test-jwt', async (req, res) => {
  const { token } = req.body;
  
  console.log('🔍 JWT Debug Test Started');
  console.log('📝 Request body:', req.body);
  console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('🔑 JWT_SECRET value:', process.env.JWT_SECRET);
  console.log('🎫 Token received:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

  if (!token) {
    return res.json({
      success: false,
      error: 'No token provided',
      debug: {
        jwtSecretExists: !!process.env.JWT_SECRET,
        tokenProvided: false
      }
    });
  }

  try {
    // Try to decode without verification first
    const decoded = jwt.decode(token);
    console.log('📋 Token payload (decoded):', decoded);

    // Now try to verify
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verification SUCCESS:', verified);

    // Try to find user
    const user = await User.findById(verified.id).select('-password');
    console.log('👤 User found:', user ? { id: user._id, email: user.email, isActive: user.isActive } : 'NOT FOUND');

    res.json({
      success: true,
      debug: {
        jwtSecretExists: !!process.env.JWT_SECRET,
        tokenDecoded: decoded,
        tokenVerified: verified,
        userFound: !!user,
        userActive: user?.isActive,
        userId: user?._id,
        userEmail: user?.email
      }
    });

  } catch (error) {
    console.log('❌ JWT Debug FAILED:', error.message);
    res.json({
      success: false,
      error: error.message,
      debug: {
        jwtSecretExists: !!process.env.JWT_SECRET,
        tokenProvided: true,
        errorType: error.name,
        errorMessage: error.message
      }
    });
  }
});

// Test image authentication flow
router.get('/test-image-auth', imageAuth, (req, res) => {
  console.log('✅ Image auth test PASSED');
  res.json({
    success: true,
    message: 'Image authentication successful',
    user: {
      id: req.user._id,
      email: req.user.email,
      isActive: req.user.isActive
    }
  });
});

// Test regular auth flow
router.get('/test-regular-auth', protect, (req, res) => {
  console.log('✅ Regular auth test PASSED');
  res.json({
    success: true,
    message: 'Regular authentication successful',
    user: {
      id: req.user._id,
      email: req.user.email,
      isActive: req.user.isActive
    }
  });
});

// Get image info for debugging
router.get('/image-info/:imageId', protect, async (req, res) => {
  try {
    const { imageId } = req.params;
    console.log('🖼️ Image info debug for:', imageId);

    const image = await ChatImage.findById(imageId);
    if (!image) {
      return res.json({
        success: false,
        error: 'Image not found',
        imageId
      });
    }

    res.json({
      success: true,
      image: {
        id: image._id,
        originalName: image.originalName,
        mimetype: image.mimetype,
        uploadedBy: image.uploadedBy,
        createdAt: image.createdAt,
        chunkCount: image.chunkCount
      },
      debug: {
        userCanAccess: image.uploadedBy.toString() === req.user._id.toString(),
        currentUserId: req.user._id,
        imageOwner: image.uploadedBy
      }
    });

  } catch (error) {
    console.error('❌ Image info debug failed:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test environment variables
router.get('/test-env', (req, res) => {
  res.json({
    success: true,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET_EXISTS: !!process.env.JWT_SECRET,
      JWT_SECRET_LENGTH: process.env.JWT_SECRET?.length || 0,
      PORT: process.env.PORT,
      MONGODB_URI_EXISTS: !!process.env.MONGODB_URI
    }
  });
});

module.exports = router; 