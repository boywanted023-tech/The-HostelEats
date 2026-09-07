const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  VENDOR:   'vendor',
  DELIVERY: 'delivery',
  ADMIN:    'admin'
});

const ORDER_STATUS = Object.freeze({
  PENDING:   'Pending',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY:     'Ready',
  PICKED:    'Picked',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled'
});

const PAYMENT_METHODS = Object.freeze(['COD', 'UPI', 'Online']);
const PAYMENT_STATUS  = Object.freeze(['Pending', 'Paid']);
const CATEGORIES      = Object.freeze(['Breakfast', 'Lunch', 'Snacks', 'Dinner', 'Beverages']);
const SPICE_LEVELS    = Object.freeze(['Mild', 'Medium', 'Hot']);
const VEHICLE_TYPES   = Object.freeze(['Bicycle', 'Scooter', 'Walking']);
const HOSTEL_BLOCKS   = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

const STATUS_FLOW = Object.freeze({
  Pending:   ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready'],
  Ready:     ['Picked'],
  Picked:    ['Delivered'],
  Delivered: [],
  Cancelled: []
});

const SECURITY = Object.freeze({
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_TIME_MS: 30 * 60 * 1000,
  ACCESS_EXPIRY: '15m',
  REFRESH_EXPIRY: '7d',
  REFRESH_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  BODY_LIMIT: '10kb',
  GLOBAL_RATE_WINDOW_MS: 15 * 60 * 1000,
  GLOBAL_RATE_MAX: 100,
  LOGIN_RATE_WINDOW_MS: 15 * 60 * 1000,
  LOGIN_RATE_MAX: 5,
  ORDER_RATE_WINDOW_MS: 60 * 60 * 1000,
  ORDER_RATE_MAX: 10,
  API_RATE_WINDOW_MS: 60 * 1000,
  API_RATE_MAX: 60
});

const SURGE = Object.freeze({
  START_HOUR: parseInt(process.env.SURGE_START_HOUR, 10) || 19,
  END_HOUR:   parseInt(process.env.SURGE_END_HOUR, 10)   || 21,
  CHARGE:     parseFloat(process.env.SURGE_CHARGE)       || 10
});

module.exports = {
  ROLES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  CATEGORIES,
  SPICE_LEVELS,
  VEHICLE_TYPES,
  HOSTEL_BLOCKS,
  STATUS_FLOW,
  SECURITY,
  SURGE
};