const express = require("express");
const { body, validationResult } = require("express-validator");
const { spawn } = require("child_process");
const path = require("path");
const Lead = require("../models/Lead");
const externalApiService = require("../services/externalApiService");
const router = express.Router();

// Configuration endpoint to get/set external API settings
router.get("/config", (req, res) => {
  try {
    // Get configuration from hardcoded values
    const config = {
      externalApi: {
        enabled: true,
        domain: 'weconvert.club',
        affc: 'AFF-WSWOA0B3TE',
        bxc: 'BX-T3L4UBJ7H5AKS',
        vtc: 'VT-HP8XSRMKVS6E7',
        apiKey: '154e56bc-3585-4d80-8847-f313c207bc01',
        funnel: 'WEConvert',
        lang: 'en',
        landingLang: 'en'
      },
      internal: {
        enabled: true,
      },
      submissionMode: 'external'
    };

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error getting configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get configuration'
    });
  }
});

// Configuration update endpoint (for admin use)
router.put("/config", (req, res) => {
  try {
    const { submissionMode, externalApi } = req.body;
    
    // In a real implementation, you'd want to validate the request
    // and potentially store these settings in a database
    
    // For now, we'll return the updated config
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      config: {
        submissionMode,
        externalApi,
        internal: {
          enabled: true
        }
      }
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration'
    });
  }
});

// Helper function to get client IP
function getClientIp(req) {
  let clientIp = null;
  
  // Priority order for IP detection (most reliable first)
  const ipSources = [
    // Standard proxy headers
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.headers['x-client-ip'],
    req.headers['x-cluster-client-ip'],
    
    // CloudFlare headers
    req.headers['cf-connecting-ip'],
    req.headers['cf-pseudo-ipv4'],
    
    // Other common proxy headers
    req.headers['x-forwarded'],
    req.headers['forwarded-for'],
    req.headers['forwarded'],
    
    // Manual override header (for testing scenarios)
    req.headers['x-override-ip'],
    req.headers['x-proxy-ip'],
    
    // Socket-level IPs (least reliable for proxy scenarios)
    req.connection?.remoteAddress,
    req.socket?.remoteAddress,
    req.connection?.socket?.remoteAddress,
    
    // Fallback
    '127.0.0.1'
  ];

  // Find the first valid IP
  for (const source of ipSources) {
    if (source) {
      let ip = source;
      
      // Handle comma-separated IPs (take the first non-private one)
      if (ip.includes(',')) {
        const ips = ip.split(',').map(i => i.trim());
        for (const singleIp of ips) {
          if (isValidPublicIp(singleIp)) {
            ip = singleIp;
            break;
          }
        }
      }
      
      // Remove IPv6 prefix if present (::ffff:)
      if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }
      
      // If we found a valid public IP, use it
      if (isValidPublicIp(ip)) {
        clientIp = ip;
        console.log('🌐 Found valid public IP:', clientIp, 'from source:', Object.keys(req.headers).find(key => req.headers[key] === source) || 'socket');
        break;
      }
    }
  }

  // Handle localhost/private IPs
  if (!clientIp || clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === 'localhost' || !isValidPublicIp(clientIp)) {
    // Check if there's a manual IP override in query params (for testing scenarios)
    if (req.query.clientIp && isValidPublicIp(req.query.clientIp)) {
      clientIp = req.query.clientIp;
      console.log('🎯 Using manual IP override from query:', clientIp);
    } else if (req.body.clientIp && isValidPublicIp(req.body.clientIp)) {
      clientIp = req.body.clientIp;
      console.log('🎯 Using manual IP override from body:', clientIp);
    } else {
      // For development/testing, generate a random valid public IP to avoid rate limiting
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
        // Generate a random public IP in the 203.x.x.x range (unassigned/test range)
        const randomIp = `203.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        clientIp = randomIp;
        console.log('🧪 Development mode: Generated random IP for testing:', clientIp);
      } else {
        // For production localhost (should rarely happen), use a stable placeholder
        clientIp = '8.8.8.8';
        console.log('🏠 Production localhost detected, using placeholder IP');
      }
    }
  }

  console.log('🌐 Final client IP:', clientIp);
  return clientIp;
}

// Helper function to validate if IP is a valid public IP address
function isValidPublicIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }

  // Basic IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // Basic IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
    return false;
  }

  // Check for private/localhost ranges
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return false;
  }

  // Check for private IPv4 ranges
  const parts = ip.split('.');
  if (parts.length === 4) {
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (first === 10 || 
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)) {
      return false;
    }
  }

  return true;
}

// Helper function to get full request URL
function getRequestUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const originalUrl = req.originalUrl;
  return `${protocol}://${host}${originalUrl}`;
}



// Enhanced landing page form submission with external API support
router.post(
  "/",
  [
    body("firstName")
      .trim()
      .notEmpty()
      .withMessage("First name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("First name must be between 2 and 50 characters"),
    body("lastName")
      .trim()
      .notEmpty()
      .withMessage("Last name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Last name must be between 2 and 50 characters"),
    body("email")
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("prefix")
      .trim()
      .notEmpty()
      .withMessage("Country code is required")
      .matches(/^\+\d{1,4}$/)
      .withMessage("Country code must be in format +XX or +XXX"),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      .matches(/^[\d\s\-\(\)\+]*$/)
      .withMessage("Phone number contains invalid characters")
      .customSanitizer(value => {
        // Remove spaces, dashes, parentheses, and plus signs
        return value.replace(/[\s\-\(\)\+]/g, '');
      })
      .matches(/^\d{6,15}$/)
      .withMessage("Phone number must be between 6 and 15 digits"),
    body("submissionMode")
      .optional()
      .isIn(['internal', 'external', 'dual'])
      .withMessage("Invalid submission mode"),
  ],
  async (req, res) => {
    try {
      console.log('🔥 ENHANCED LANDING PAGE FORM SUBMITTED! 🔥');
      console.log('Form data received:', req.body);
      
      // Debug phone number validation
      if (req.body.phone) {
        console.log('📞 Phone validation debug:');
        console.log('  - Original phone:', req.body.phone);
        console.log('  - Phone length:', req.body.phone.length);
        console.log('  - Phone after trim:', req.body.phone.trim());
        console.log('  - Phone after sanitization:', req.body.phone.replace(/[\s\-\(\)\+]/g, ''));
        console.log('  - Phone digits only test:', /^\d+$/.test(req.body.phone.replace(/[\s\-\(\)\+]/g, '')));
      }
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        
        // Enhanced error message for phone validation
        const phoneErrors = errors.array().filter(error => error.path === 'phone');
        if (phoneErrors.length > 0) {
          console.log('📞 Phone validation failed:');
          phoneErrors.forEach(error => {
            console.log(`  - ${error.msg}: "${error.value}"`);
          });
        }
        
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { firstName, lastName, email, prefix, phone, submissionMode } = req.body;
      
      // Determine submission mode
      const mode = submissionMode || 
                  req.query.mode || 
                  'external';
      
      console.log('📡 Submission mode:', mode);

      // Get client info for external API
      const clientIp = getClientIp(req);
      const requestUrl = getRequestUrl(req);
      
      console.log('🌐 Client IP:', clientIp);
      console.log('🔗 Request URL:', requestUrl);

      // Prepare form data for external API service
      const formData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase(),
        prefix: prefix.trim(),
        phone: phone.trim()
      };

      // Handle different submission modes
      switch (mode) {
        case 'external':
          console.log('📤 External submission mode - EXTERNAL API ONLY');
          try {
            // Submit ONLY to external API - no database operations
            const result = await externalApiService.submitToExternalAPI(
              formData, 
              clientIp, 
              req.query, 
              requestUrl
            );
            
            console.log('✅ External API submission successful');
            
            res.status(201).json({
              success: true,
              message: result.message || "Registration successful! Redirecting...",
              submissionMode: mode,
              redirectUrl: result.redirectUrl,
              externalApiSuccess: true
            });
            
          } catch (error) {
            console.error('❌ External API submission failed:', error.message);
            
            // Get status code from error or default to 500
            const statusCode = error.statusCode || 500;
            
            // For client errors (4xx), return 400 to frontend
            // For server errors (5xx), return 500 to frontend
            const responseStatus = statusCode >= 400 && statusCode < 500 ? 400 : 500;
            
            res.status(responseStatus).json({
              success: false,
              message: error.message || "External API submission failed",
              submissionMode: mode,
              externalApiSuccess: false,
              errorType: statusCode >= 400 && statusCode < 500 ? 'client_error' : 'server_error'
            });
          }
          break;
          
        case 'dual':
          console.log('🔄 Dual submission mode - submitting to both APIs');
          try {
            // First check for existing lead in internal database
            const existingLead = await Lead.findOne({ newEmail: email.toLowerCase() });
            if (existingLead) {
              return res.status(409).json({
                success: false,
                message: "A lead with this email already exists",
                submissionMode: mode
              });
            }

            // Submit to external API first
            const externalResult = await externalApiService.submitToExternalAPI(
              formData, 
              clientIp, 
              req.query, 
              requestUrl
            );
            
            // If external API succeeds, save to internal database
            const savedLead = new Lead({
              leadType: "cold",
              firstName: formData.firstName,
              lastName: formData.lastName,
              newEmail: formData.email,
              prefix: formData.prefix,
              newPhone: formData.phone,
              country: "Unknown",
              source: "Landing Page - Dual Mode",
              status: "active",
              priority: "medium",
              submissionMode: mode,
              externalApiResult: externalResult
            });

            await savedLead.save();
            console.log('✅ Lead saved to internal database:', savedLead._id);
            
            res.status(201).json({
              success: true,
              message: externalResult.message || "Lead submitted successfully via dual mode",
              leadId: savedLead._id,
              submissionMode: mode,
              redirectUrl: externalResult.redirectUrl,
              externalApiSuccess: true
            });
            

            
          } catch (error) {
            console.error('❌ Dual submission failed:', error.message);
            
            // Check if it's a duplicate email error
            if (error.message.includes('email already exists') || error.message.includes('duplicate')) {
              return res.status(409).json({
                success: false,
                message: "A lead with this email already exists",
                submissionMode: mode
              });
            }
            
            // Get status code from error or default to 500
            const statusCode = error.statusCode || 500;
            
            // For client errors (4xx), return 400 to frontend
            // For server errors (5xx), return 500 to frontend
            const responseStatus = statusCode >= 400 && statusCode < 500 ? 400 : 500;
            
            res.status(responseStatus).json({
              success: false,
              message: error.message || "Dual submission failed",
              submissionMode: mode,
              externalApiSuccess: false,
              errorType: statusCode >= 400 && statusCode < 500 ? 'client_error' : 'server_error'
            });
          }
          break;
          
        case 'internal':
        default:
          console.log('🏠 Internal submission mode - INTERNAL DATABASE ONLY');
          
          // Check for existing lead
          const existingLead = await Lead.findOne({ newEmail: email.toLowerCase() });
          if (existingLead) {
            return res.status(409).json({
              success: false,
              message: "A lead with this email already exists",
              submissionMode: mode
            });
          }

          // Create new lead record
          const savedLead = new Lead({
            leadType: "cold",
            firstName: formData.firstName,
            lastName: formData.lastName,
            newEmail: formData.email,
            prefix: formData.prefix,
            newPhone: formData.phone,
            country: "Unknown",
            source: "Landing Page - Internal",
            status: "active",
            priority: "medium",
            submissionMode: mode,
          });

          await savedLead.save();
          console.log('✅ Lead saved to internal database:', savedLead._id);
          
          res.status(201).json({
            success: true,
            message: "Thank you for your submission! We'll be in touch soon.",
            leadId: savedLead._id,
            submissionMode: mode,
          });


          break;
      }

    } catch (error) {
      console.error('💥 Landing page submission error:', error);
      res.status(500).json({
        success: false,
        message: "Internal server error. Please try again later.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// Test endpoint to check IP detection (useful for debugging proxy setups)
router.get("/test-ip", (req, res) => {
  const clientIp = getClientIp(req);
  
  res.json({
    success: true,
    message: "IP Detection Test",
    detectedIp: clientIp,
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'x-client-ip': req.headers['x-client-ip'],
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
      'x-override-ip': req.headers['x-override-ip'],
      'x-proxy-ip': req.headers['x-proxy-ip']
    },
    queryParams: {
      clientIp: req.query.clientIp,
      proxyIp: req.query.proxyIp,
      ip: req.query.ip
    },
    socketAddress: req.connection?.remoteAddress,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Landing page API information endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Enhanced Landing Page API with External API Integration",
    description: "Submit your information using POST to this endpoint",
    submissionModes: {
      internal: "Submit to internal backend only",
      external: "Submit to external API via backend service",
      dual: "Submit to both internal and external APIs"
    },
    requiredFields: {
      firstName: "string (2-50 characters)",
      lastName: "string (2-50 characters)",
      email: "valid email address",
      prefix: "country code in format +XX",
      phone: "phone number (7-15 digits)"
    },
    optionalFields: {
      submissionMode: "string (internal|external|dual)"
    },
    endpoints: {
      config: "GET /api/landing/config - Get current configuration",
      configUpdate: "PUT /api/landing/config - Update configuration (admin only)",
      submit: "POST /api/landing - Submit lead form"
    },
    configuration: {
      defaultSubmissionMode: 'external',
      externalApiEnabled: true
    }
  });
});

module.exports = router;