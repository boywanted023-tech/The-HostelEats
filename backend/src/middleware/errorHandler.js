const { errorResponse } = require('../utils/helpers');

const errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation error';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate ${field}`;
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  } else if (err.message && err.message.includes('CORS')) {
    status = 403;
    message = 'CORS policy violation';
  }

  if (status >= 500) {
    console.error(`[${req.requestId || 'no-req-id'}]`, err);
  }

  return errorResponse(res, message, status, process.env.NODE_ENV !== 'production' ? err.stack : null);
};

const notFoundHandler = (req, res) => {
  return res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, notFoundHandler, asyncHandler };