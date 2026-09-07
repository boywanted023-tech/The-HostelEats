const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const securityMiddleware = require('../middleware/security');
const { validate } = require('../middleware/validation');
const { registerSchema, loginSchema } = require('../utils/validators');
const User = require('../models/User');
const { auditLogger } = require('../middleware/security');

// Register
router.post('/register',
  securityMiddleware.sanitizeInput,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { name, email, password, phone, role } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }
      const user = await User.create({
        name,
        email,
        password,
        phone,
        role: role || 'customer'
      });
      await auditLogger('USER_REGISTER', user._id, 'auth', user._id, {
        email,
        role: user.role
      });
      const tokens = await authService.completeLogin(
        user,
        req.ip || req.connection.remoteAddress,
        req.headers['user-agent'],
        req.deviceFingerprint || 'unknown'
      );
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: tokens.user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post('/login',
  securityMiddleware.sanitizeInput,
  securityMiddleware.checkBlacklist,
  securityMiddleware.detectSuspicious,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const deviceFingerprint = req.deviceFingerprint || 'unknown';

      const result = await authService.login(email, password, ip, userAgent, deviceFingerprint);

      if (result.requiresTwoFactor) {
        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          userId: result.userId,
          message: 'Two-factor authentication required'
        });
      }

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      res.cookie('deviceFingerprint', deviceFingerprint, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Verify 2FA
router.post('/verify-2fa',
  async (req, res, next) => {
    try {
      const { userId, token } = req.body;
      const verified = await authService.verify2FA(userId, token);
      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid 2FA code'
        });
      }
      const user = await User.findById(userId);
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const deviceFingerprint = req.deviceFingerprint || 'unknown';

      const result = await authService.completeLogin(user, ip, userAgent, deviceFingerprint);

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      await auditLogger('TWO_FACTOR_VERIFIED', user._id, 'auth', null, {
        email: user.email
      });

      res.json({
        success: true,
        message: '2FA verification successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Setup 2FA
router.post('/setup-2fa',
  securityMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const result = await authService.generate2FA(req.user._id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Enable 2FA
router.post('/enable-2fa',
  securityMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const { token } = req.body;
      const result = await authService.enable2FA(req.user._id, token);
      res.json({
        success: true,
        message: '2FA enabled successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token
router.post('/refresh',
  async (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token required'
        });
      }
      const result = await authService.refreshToken(
        refreshToken,
        req.ip || req.connection.remoteAddress,
        req.headers['user-agent']
      );
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
router.post('/logout',
  securityMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      const accessToken = req.cookies.accessToken;
      await authService.logout(req.user._id, refreshToken, accessToken);
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.clearCookie('deviceFingerprint');
      res.clearCookie('csrfToken');
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get('/me',
  securityMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id)
        .populate('vendorProfile')
        .populate('deliveryProfile');
      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: user.isVerified,
            trustScore: user.trustScore,
            twoFactorEnabled: user.twoFactorEnabled,
            vendorProfile: user.vendorProfile,
            deliveryProfile: user.deliveryProfile,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update profile (name/phone)
router.put('/me',
  securityMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const { name, phone } = req.body;
      const updates = {};
      if (name && typeof name === 'string') updates.name = name.trim();
      if (phone && /^[0-9]{10}$/.test(phone)) updates.phone = phone;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields to update' });
      }
      const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
      await auditLogger('PROFILE_UPDATED', user._id, 'auth', user._id, { email: user.email });
      res.json({
        success: true,
        message: 'Profile updated',
        data: {
          user: {
            id: user._id, name: user.name, email: user.email,
            phone: user.phone, role: user.role, isVerified: user.isVerified,
            trustScore: user.trustScore, twoFactorEnabled: user.twoFactorEnabled
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// CSRF token endpoint
router.get('/csrf', (req, res) => {
  const token = require('crypto').randomBytes(32).toString('hex');
  res.cookie('csrfToken', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000
  });
  res.json({ success: true, csrfToken: token });
});

// Change password
router.put('/change-password',
  securityMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select('+password');
      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      user.password = newPassword;
      await user.save();
      await auditLogger('PASSWORD_CHANGED', user._id, 'auth', user._id, {
        email: user.email
      });
      await authService.logout(user._id, user.refreshToken);
      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;