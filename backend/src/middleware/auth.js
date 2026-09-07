const authService = require('../services/authService');
const { errorResponse } = require('../utils/helpers');

const authenticate = async (req, res, next) => {
  try {
    const user = await authService.verifyRequest(req);
    req.user = user;
    next();
  } catch (err) {
    return errorResponse(res, err.message || 'Authentication failed', 401, err.message);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return errorResponse(res, 'Not authenticated', 401);
  if (!roles.includes(req.user.role)) {
    return errorResponse(res, 'Insufficient permissions', 403);
  }
  next();
};

const requireRole = authorize;

module.exports = { authenticate, authorize, requireRole };