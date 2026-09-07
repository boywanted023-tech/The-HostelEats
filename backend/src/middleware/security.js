const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const authService = require('../services/authService');
const { redis } = require('../config/redis');

// Audit logger
const auditLogger = async (action, userId, resource, resourceId, details = {}) => {
  try {
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      userId,
      action,
      resource,
      resourceId,
      ip: details.ip || '0.0.0.0',
      userAgent: details.userAgent || 'unknown',
      details,
      status: 'success',
      requestId: details.requestId || uuidv4()
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

// Security middleware
const securityMiddleware = {
  // Request ID
  requestId: (req, res, next) => {
    req.requestId = uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
  },

  // Security headers
  securityHeaders: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'wss:', 'https://api.hosteleats.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com']
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  // CORS
  corsConfig: cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',') :
        ['http://localhost:3000', 'http://localhost:3001'];

      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Device-Fingerprint', 'X-Request-Signature']
  }),

  // Rate limiter
  rateLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    handler: (req, res) => {
      auditLogger('RATE_LIMIT_EXCEEDED', null, 'security', null, {
        ip: req.ip,
        path: req.path,
        requestId: req.requestId
      });
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.'
      });
    }
  }),

  // Authentication
  authenticate: async (req, res, next) => {
    try {
      await authService.validateRequest(req);
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message || 'Authentication failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // Authorization
  authorize: (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }
      next();
    };
  },

  // CSRF Protection
  csrfProtection: (req, res, next) => {
    const csrfToken = req.headers['x-csrf-token'];
    const sessionToken = req.cookies.csrfToken;
    if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token'
      });
    }
    next();
  },

  // Generate CSRF token
  generateCSRFToken: (req, res, next) => {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrfToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });
    req.csrfToken = token;
    next();
  },

  // Device fingerprint
  deviceFingerprint: (req, res, next) => {
    const fingerprint = authService.generateDeviceFingerprint(req);
    req.deviceFingerprint = fingerprint;
    res.cookie('deviceFingerprint', fingerprint, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    next();
  },

  // Request signing
  requestSignature: (req, res, next) => {
    const signature = req.headers['x-request-signature'];
    const timestamp = req.headers['x-request-timestamp'];
    if (!signature || !timestamp) {
      return next();
    }
    const body = JSON.stringify(req.body);
    const payload = `${timestamp}.${body}`;
    const expected = crypto
      .createHmac('sha256', process.env.REQUEST_SIGNING_SECRET)
      .update(payload)
      .digest('hex');
    if (signature !== expected) {
      return res.status(403).json({
        success: false,
        message: 'Invalid request signature'
      });
    }
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return res.status(403).json({
        success: false,
        message: 'Request timestamp expired'
      });
    }
    next();
  },

  // IP Blacklist check
  checkBlacklist: async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    try {
      const blacklisted = await redis.get(`blacklist:ip:${ip}`);
      if (blacklisted) {
        return res.status(403).json({
          success: false,
          message: 'IP address is blacklisted'
        });
      }
      next();
    } catch (error) {
      next();
    }
  },

  // Suspicious activity detection
  detectSuspicious: async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const path = req.path;
    try {
      const key = `suspicious:${ip}:${path}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 60);
      } else if (count > 30) {
        await redis.setex(`blacklist:ip:${ip}`, 3600, 'Suspicious activity');
        await auditLogger('IP_BLACKLISTED', null, 'security', null, { ip, reason: 'Suspicious activity' });
        return res.status(403).json({
          success: false,
          message: 'Suspicious activity detected. IP blacklisted.'
        });
      }
      next();
    } catch (error) {
      next();
    }
  },

  // Input sanitization
  sanitizeInput: (req, res, next) => {
    const sanitize = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key]
            .replace(/<[^>]*>/g, '')
            .replace(/[&<>"']/g, function (m) {
              if (m === '&') return '&amp;';
              if (m === '<') return '&lt;';
              if (m === '>') return '&gt;';
              if (m === '"') return '&quot;';
              if (m === "'") return '&#x27;';
              return m;
            });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  }
};

module.exports = securityMiddleware;
module.exports.auditLogger = auditLogger;

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many login attempts. Try again later.' })
});

const orderRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Order limit reached. Try again later.' })
});

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  handler: (req, res) => res.status(429).json({ success: false, message: 'API rate limit exceeded.' })
});

module.exports.loginRateLimiter = loginRateLimiter;
module.exports.orderRateLimiter = orderRateLimiter;
module.exports.apiRateLimiter = apiRateLimiter;