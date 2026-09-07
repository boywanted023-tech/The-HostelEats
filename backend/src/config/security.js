const crypto = require('crypto');

const ENCRYPTION_KEY = (process.env.DB_ENCRYPTION_KEY || '').padEnd(32, '0').slice(0, 32);
const ENABLED = String(process.env.ENABLE_FIELD_LEVEL_ENCRYPTION).toLowerCase() === 'true';

const encryptField = (plain) => {
  if (!ENABLED || plain == null) return plain;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let enc = cipher.update(String(plain), 'utf8', 'hex');
    enc += cipher.final('hex');
    return iv.toString('hex') + ':' + enc;
  } catch (err) {
    console.error('encryptField error:', err.message);
    return plain;
  }
};

const decryptField = (cipherText) => {
  if (!ENABLED || cipherText == null) return cipherText;
  try {
    if (!cipherText.includes(':')) return cipherText;
    const [ivHex, enc] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (err) {
    return cipherText;
  }
};

const generateRequestSignature = (payload, timestamp) => {
  const secret = process.env.REQUEST_SIGNING_SECRET || 'fallback-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`)
    .digest('hex');
};

const verifyRequestSignature = (payload, timestamp, signature) => {
  const expected = generateRequestSignature(payload, timestamp);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
  } catch {
    return false;
  }
};

module.exports = {
  encryptField,
  decryptField,
  generateRequestSignature,
  verifyRequestSignature,
  encryptionEnabled: ENABLED
};