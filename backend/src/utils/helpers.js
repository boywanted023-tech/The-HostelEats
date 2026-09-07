const crypto = require('crypto');

const generateOrderId = () =>
  'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();

const sanitizeString = (str, max = 500) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, max);
};

const sanitizeObject = (obj) => {
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeObject(v)])
    );
  }
  if (typeof obj === 'string') return sanitizeString(obj);
  return obj;
};

const generateDeviceFingerprint = (req) => {
  const ua = req.headers['user-agent'] || '';
  const lang = req.headers['accept-language'] || '';
  const enc = req.headers['accept-encoding'] || '';
  return crypto.createHash('sha256')
    .update(`${ua}|${lang}|${enc}`)
    .digest('hex');
};

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '0.0.0.0';
};

const isSurgeTime = (date = new Date(), { START_HOUR, END_HOUR }) => {
  const h = date.getHours();
  return h >= START_HOUR && h < END_HOUR;
};

const calculateOrderTotals = (items, deliveryCharge = 0, surgeCharge = 0) => {
  const subtotal = items.reduce((sum, i) => sum + (i.total || (i.price * i.quantity)), 0);
  const total = subtotal + deliveryCharge + surgeCharge;
  return { subtotal, total };
};

const generateRequestId = () => crypto.randomUUID();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const successResponse = (res, data = {}, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, ...data });

const errorResponse = (res, message = 'Error', status = 400, error = null) => {
  const body = { success: false, message };
  if (process.env.NODE_ENV !== 'production' && error) body.error = error;
  return res.status(status).json(body);
};

const isValidObjectId = (id) =>
  typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

module.exports = {
  generateOrderId,
  sanitizeString,
  sanitizeObject,
  generateDeviceFingerprint,
  generateCsrfToken,
  getClientIp,
  isSurgeTime,
  calculateOrderTotals,
  generateRequestId,
  asyncHandler,
  successResponse,
  errorResponse,
  isValidObjectId,
  formatTime,
  daysAgo
};