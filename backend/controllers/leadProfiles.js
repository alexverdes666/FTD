const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const User = require("../models/User");
const Lead = require("../models/Lead");
const LeadProfileCredential = require("../models/LeadProfileCredential");
const { validationResult } = require("express-validator");

const JWT_SECRET = process.env.JWT_SECRET;

// Helper: redact sensitive fields from a profile document
const redactProfile = (profile) => {
  const obj = profile.toObject ? profile.toObject() : { ...profile };
  const hasTwoFactor = !!obj.twoFactorSecret;
  const recoveryCodesCount = Array.isArray(obj.recoveryCodes)
    ? obj.recoveryCodes.length
    : 0;

  delete obj.password;
  delete obj.twoFactorSecret;
  delete obj.recoveryCodes;

  obj.hasTwoFactor = hasTwoFactor;
  obj.recoveryCodesCount = recoveryCodesCount;
  obj.hasPassword = !!profile.password;

  return obj;
};

// Helper: verify the unlock token from request headers
const verifyUnlockToken = (req) => {
  const token = req.headers["x-unlock-token"];
  if (!token) {
    return { valid: false, error: "Unlock token is required" };
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== "lead-profile-unlock") {
      return { valid: false, error: "Invalid token purpose" };
    }
    if (decoded.userId !== req.user.id) {
      return { valid: false, error: "Token does not match current user" };
    }
    return { valid: true, decoded };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return { valid: false, error: "Unlock token has expired" };
    }
    return { valid: false, error: "Invalid unlock token" };
  }
};

// @desc    Verify user password and return unlock token
// @route   POST /api/lead-profiles/verify-password
// @access  Private (admin, affiliate_manager, lead_manager)
exports.verifyPasswordForProfiles = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { password } = req.body;

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });
    }

    // Generate short-lived unlock token (5 minutes)
    const unlockToken = jwt.sign(
      { userId: req.user.id, purpose: "lead-profile-unlock" },
      JWT_SECRET,
      { expiresIn: "5m" }
    );

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    res.status(200).json({
      success: true,
      data: { unlockToken, expiresAt },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all profile credentials for a lead (redacted)
// @route   GET /api/lead-profiles/lead/:leadId
// @access  Private (admin, affiliate_manager, lead_manager)
exports.getProfilesByLead = async (req, res, next) => {
  try {
    const { leadId } = req.params;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    const profiles = await LeadProfileCredential.find({ lead: leadId }).sort({
      createdAt: -1,
    });

    const redacted = profiles.map(redactProfile);

    res.status(200).json({ success: true, data: redacted });
  } catch (error) {
    next(error);
  }
};

// @desc    Get decrypted sensitive fields for a profile (requires unlock token)
// @route   GET /api/lead-profiles/:id/sensitive
// @access  Private (admin, affiliate_manager, lead_manager)
exports.getSensitiveFields = async (req, res, next) => {
  try {
    const tokenResult = verifyUnlockToken(req);
    if (!tokenResult.valid) {
      return res
        .status(401)
        .json({ success: false, message: tokenResult.error });
    }

    const profile = await LeadProfileCredential.findById(req.params.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile credential not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        password: profile.password || null,
        twoFactorSecret: profile.twoFactorSecret || null,
        recoveryCodes: profile.recoveryCodes || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current TOTP code for a profile (requires unlock token)
// @route   GET /api/lead-profiles/:id/totp
// @access  Private (admin, affiliate_manager, lead_manager)
exports.getProfileTOTP = async (req, res, next) => {
  try {
    const tokenResult = verifyUnlockToken(req);
    if (!tokenResult.valid) {
      return res
        .status(401)
        .json({ success: false, message: tokenResult.error });
    }

    const profile = await LeadProfileCredential.findById(req.params.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile credential not found" });
    }

    if (!profile.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "No 2FA secret configured for this profile",
      });
    }

    // Strip spaces and ensure lowercase for base32
    const cleanSecret = profile.twoFactorSecret
      .replace(/\s+/g, "")
      .toUpperCase();

    const code = speakeasy.totp({
      secret: cleanSecret,
      encoding: "base32",
    });

    const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

    res.status(200).json({
      success: true,
      data: { code, timeRemaining, period: 30 },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new profile credential
// @route   POST /api/lead-profiles
// @access  Private (admin, affiliate_manager, lead_manager)
exports.createProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { leadId, accountType, username, password, twoFactorSecret, recoveryCodes, notes } =
      req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    // Clean twoFactorSecret: strip spaces
    const cleanSecret = twoFactorSecret
      ? twoFactorSecret.replace(/\s+/g, "").toUpperCase()
      : undefined;

    const profile = await LeadProfileCredential.create({
      lead: leadId,
      accountType,
      username,
      password,
      twoFactorSecret: cleanSecret,
      recoveryCodes: recoveryCodes || [],
      notes,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: redactProfile(profile) });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a profile credential
// @route   PUT /api/lead-profiles/:id
// @access  Private (admin, affiliate_manager, lead_manager)
exports.updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const profile = await LeadProfileCredential.findById(req.params.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile credential not found" });
    }

    const { accountType, username, password, twoFactorSecret, recoveryCodes, notes } =
      req.body;

    if (accountType !== undefined) profile.accountType = accountType;
    if (username !== undefined) profile.username = username;
    if (password !== undefined) profile.password = password;
    if (twoFactorSecret !== undefined) {
      profile.twoFactorSecret = twoFactorSecret
        ? twoFactorSecret.replace(/\s+/g, "").toUpperCase()
        : twoFactorSecret;
    }
    if (recoveryCodes !== undefined) profile.recoveryCodes = recoveryCodes;
    if (notes !== undefined) profile.notes = notes;

    profile.updatedBy = req.user._id;
    await profile.save();

    res.status(200).json({ success: true, data: redactProfile(profile) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a profile credential
// @route   DELETE /api/lead-profiles/:id
// @access  Private (admin, affiliate_manager, lead_manager)
exports.deleteProfile = async (req, res, next) => {
  try {
    const profile = await LeadProfileCredential.findById(req.params.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile credential not found" });
    }

    await profile.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Profile credential deleted" });
  } catch (error) {
    next(error);
  }
};
