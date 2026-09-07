const crypto = require('crypto');
const { getRedis } = require('../config/redis');

class SecurityService {
  constructor() {
    this.BLACKLIST_KEY = 'ip_blacklist';
    this.SUSPICIOUS_THRESHOLD = 20;
  }

  async blacklistIp(ip, reason = 'suspicious activity', durationSeconds = 3600) {
    if (!ip) return;
    const redis = getRedis();
    await redis.setex(`${this.BLACKLIST_KEY}:${ip}`, durationSeconds, reason);
  }

  async isIpBlacklisted(ip) {
    if (!ip) return false;
    const redis = getRedis();
    return !!(await redis.get(`${this.BLACKLIST_KEY}:${ip}`));
  }

  async recordRequest(ip, path) {
    const redis = getRedis();
    const key = `suspicious:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > this.SUSPICIOUS_THRESHOLD) {
      await this.blacklistIp(ip, 'too many requests', 1800);
      return { suspicious: true, count };
    }
    return { suspicious: false, count };
  }

  generateDeviceFingerprint(req) {
    const ua = req.headers['user-agent'] || '';
    const lang = req.headers['accept-language'] || '';
    const enc = req.headers['accept-encoding'] || '';
    return crypto.createHash('sha256').update(`${ua}|${lang}|${enc}`).digest('hex');
  }

  generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  validateCsrf(cookieToken, headerToken) {
    if (!cookieToken || !headerToken) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
    } catch {
      return false;
    }
  }

  generateRequestSignature(payload, timestamp) {
    const secret = process.env.REQUEST_SIGNING_SECRET || 'fallback';
    return crypto.createHmac('sha256', secret)
      .update(`${timestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`)
      .digest('hex');
  }

  verifyRequestSignature(payload, timestamp, signature, maxAgeSeconds = 300) {
    if (!signature || !timestamp) return false;
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return false;
    const age = Math.abs(Date.now() / 1000 - ts);
    if (age > maxAgeSeconds) return false;
    const expected = this.generateRequestSignature(payload, timestamp);
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  containsSqlInjection(input) {
    if (typeof input !== 'string') return false;
    const patterns = [
      /\b(union\s+select)\b/i,
      /\b(drop\s+table)\b/i,
      /\b(insert\s+into)\b/i,
      /\b(delete\s+from)\b/i,
      /--\s/,
      /;\s*drop/i,
      /'\s*or\s*'1'='1/i
    ];
    return patterns.some(p => p.test(input));
  }

  sanitizeValue(value, depth = 0) {
    if (depth > 5) return value;
    if (typeof value === 'string') {
      return value.replace(/[<>$`]/g, '').trim().slice(0, 1000);
    }
    if (Array.isArray(value)) return value.map(v => this.sanitizeValue(v, depth + 1));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.sanitizeValue(v, depth + 1)])
      );
    }
    return value;
  }

  async sendSecurityAlert(message, details = {}) {
    console.warn('SECURITY ALERT:', message, details);
  }
}

module.exports = new SecurityService();