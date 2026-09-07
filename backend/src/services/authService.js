const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const { auditLogger } = require('../middleware/security');
const { redis } = require('../config/redis');

class AuthService {
  constructor() {
    this.MAX_LOGIN_ATTEMPTS = 5;
    this.LOCK_TIME = 30 * 60 * 1000; // 30 minutes
    this.ACCESS_EXPIRY = '15m';
    this.REFRESH_EXPIRY = '7d';
  }

  generateTokens(userId) {
    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: this.ACCESS_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { id: userId },
      process.env.REFRESH_SECRET,
      { expiresIn: this.REFRESH_EXPIRY }
    );
    return { accessToken, refreshToken };
  }

  verifyToken(token, type = 'access') {
    try {
      const secret = type === 'access' ? process.env.JWT_SECRET : process.env.REFRESH_SECRET;
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }

  async login(email, password, ip, userAgent, deviceFingerprint) {
    try {
      const user = await User.findOne({ email }).select('+password +lockUntil +refreshToken +refreshTokenExpiry +twoFactorSecret +twoFactorEnabled');

      if (!user) {
        await auditLogger('LOGIN_FAILURE', null, 'auth', null, { email, reason: 'User not found' });
        throw new Error('Invalid credentials');
      }

      if (user.isLocked) {
        const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
        throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
      }

      const isValidPassword = await user.comparePassword(password);

      if (!isValidPassword) {
        await user.incrementLoginAttempts();
        await auditLogger('LOGIN_FAILURE', user._id, 'auth', null, { email, reason: 'Invalid password' });
        if (user.isLocked) {
          throw new Error('Account locked due to multiple failed attempts. Try again in 30 minutes');
        }
        throw new Error('Invalid credentials');
      }

      await user.resetLoginAttempts();

      if (user.twoFactorEnabled) {
        await auditLogger('TWO_FACTOR_REQUIRED', user._id, 'auth', null, { email });
        return { requiresTwoFactor: true, userId: user._id };
      }

      const tokens = await this.completeLogin(user, ip, userAgent, deviceFingerprint);
      await auditLogger('LOGIN_SUCCESS', user._id, 'auth', null, { email, ip, deviceFingerprint });
      return tokens;
    } catch (error) {
      throw error;
    }
  }

  async completeLogin(user, ip, userAgent, deviceFingerprint) {
    user.lastLoginIP = ip;
    user.lastLoginDevice = deviceFingerprint;
    await user.addKnownDevice(deviceFingerprint, userAgent, ip);

    const { accessToken, refreshToken } = this.generateTokens(user._id);

    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    await redis.setex(`refresh:${refreshToken}`, 7 * 24 * 60 * 60, user._id.toString());

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        trustScore: user.trustScore
      }
    };
  }

  async verify2FA(userId, token) {
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
      throw new Error('2FA not enabled for this user');
    }
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token
    });
    if (!verified) {
      throw new Error('Invalid 2FA code');
    }
    return true;
  }

  async generate2FA(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const secret = speakeasy.generateSecret({
      name: `HostelEats (${user.email})`,
      issuer: process.env.TWO_FACTOR_ISSUER || 'HostelEats'
    });
    user.twoFactorSecret = secret.base32;
    await user.save();
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrCode };
  }

  async enable2FA(userId, token) {
    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorEnabled');
    if (!user || !user.twoFactorSecret) {
      throw new Error('2FA not set up');
    }
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token
    });
    if (!verified) throw new Error('Invalid 2FA code');
    user.twoFactorEnabled = true;
    await user.save();
    await auditLogger('TWO_FACTOR_ENABLED', user._id, 'auth', null, { email: user.email });
    return { success: true };
  }

  async refreshToken(refreshToken, ip, userAgent) {
    const blacklisted = await redis.get(`blacklist:${refreshToken}`);
    if (blacklisted) throw new Error('Token has been revoked');

    const decoded = this.verifyToken(refreshToken, 'refresh');
    if (!decoded) throw new Error('Invalid refresh token');

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) throw new Error('Invalid refresh token');
    if (user.refreshTokenExpiry < Date.now()) throw new Error('Refresh token expired');

    await redis.setex(`blacklist:${refreshToken}`, 7 * 24 * 60 * 60, 'revoked');

    const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user._id);

    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    await redis.setex(`refresh:${newRefreshToken}`, 7 * 24 * 60 * 60, user._id.toString());

    await auditLogger('TOKEN_REFRESH', user._id, 'auth', null, { ip, userAgent });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId, refreshToken, accessToken) {
    try {
      if (refreshToken) {
        await redis.setex(`blacklist:${refreshToken}`, 7 * 24 * 60 * 60, 'revoked');
        await redis.del(`refresh:${refreshToken}`);
      }
      if (accessToken) {
        const decoded = this.verifyToken(accessToken, 'access');
        if (decoded) {
          const expiry = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiry > 0) await redis.setex(`blacklist:${accessToken}`, expiry, 'revoked');
        }
      }
      await User.findByIdAndUpdate(userId, {
        refreshToken: null,
        refreshTokenExpiry: null
      });
      await auditLogger('LOGOUT', userId, 'auth', null, {});
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  async validateRequest(req) {
    try {
      const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token provided');

      const blacklisted = await redis.get(`blacklist:${token}`);
      if (blacklisted) throw new Error('Token has been revoked');

      const decoded = this.verifyToken(token, 'access');
      if (!decoded) throw new Error('Invalid token');

      const user = await User.findById(decoded.id);
      if (!user) throw new Error('User not found');
      if (!user.isActive) throw new Error('User account is inactive');
      if (user.isPasswordChangedAfter(decoded.iat)) throw new Error('Password changed. Please login again.');

      const deviceFingerprint = req.headers['x-device-fingerprint'] || req.cookies.deviceFingerprint;
      if (deviceFingerprint && !user.isKnownDevice(deviceFingerprint)) {
        user.addSuspiciousActivity('Unknown device login attempt');
        throw new Error('Unknown device detected. Please verify your identity.');
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      if (user.lastLoginIP && user.lastLoginIP !== clientIP) {
        user.addSuspiciousActivity('IP address changed');
      }

      const userKey = `ratelimit:${user._id}`;
      const requests = await redis.incr(userKey);
      if (requests === 1) await redis.expire(userKey, 900);
      else if (requests > 100) throw new Error('Too many requests. Please slow down.');

      req.user = user;
      return true;
    } catch (error) {
      throw error;
    }
  }

  async checkSuspiciousPatterns(userId, action) {
    const user = await User.findById(userId);
    if (!user) return;
    const actionKey = `action:${userId}:${action}`;
    const count = await redis.incr(actionKey);
    if (count === 1) await redis.expire(actionKey, 60);
    else if (count > 10) {
      user.addSuspiciousActivity(`Rapid ${action} actions detected`);
      await auditLogger('SUSPICIOUS_ACTIVITY', userId, 'security', null, {
        action,
        count,
        message: 'Rapid actions detected'
      });
      if (user.trustScore < 50) {
        await this.sendSecurityAlert(user, `Suspicious activity: ${action}`, count);
      }
    }
  }

  async sendSecurityAlert(user, message, details) {
    console.log(`SECURITY ALERT: ${user.email} - ${message}`, details);
  }

  generateDeviceFingerprint(req) {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${userAgent}|${acceptLanguage}|${acceptEncoding}`)
      .digest('hex');
    return fingerprint;
  }

  validateCSRF(token, secret) {
    return token === secret;
  }
}

module.exports = new AuthService();