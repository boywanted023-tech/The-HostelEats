const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const MenuItem = require('../models/MenuItem');
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats', asyncHandler(async (req, res) => {
  const [users, vendors, customers, deliveryBoys, orders, totalRevenue] = await Promise.all([
    User.countDocuments(),
    Vendor.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'delivery' }),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { status: 'Delivered' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ])
  ]);

  const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10)
    .populate('customerId', 'name email')
    .populate('vendorId', 'shopName');

  return successResponse(res, {
    stats: {
      users, vendors, customers, deliveryBoys, orders,
      revenue: totalRevenue[0]?.total || 0
    },
    recentOrders
  });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const { role } = req.query;
  const query = role ? { role } : {};
  const users = await User.find(query).sort({ createdAt: -1 }).limit(100);
  return successResponse(res, { users });
}));

router.put('/users/:id/activate', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  const user = await User.findById(req.params.id);
  if (!user) return errorResponse(res, 'User not found', 404);
  user.isActive = !!req.body.isActive;
  await user.save();
  return successResponse(res, { user }, 'User updated');
}));

router.get('/vendors', asyncHandler(async (req, res) => {
  const { approved } = req.query;
  const query = approved === undefined ? {} : { isApproved: approved === 'true' };
  const vendors = await Vendor.find(query)
    .populate('userId', 'name email phone')
    .sort({ createdAt: -1 });
  return successResponse(res, { vendors });
}));

router.put('/vendors/:id/approve', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return errorResponse(res, 'Vendor not found', 404);
  vendor.isApproved = !!req.body.isApproved;
  await vendor.save();
  return successResponse(res, { vendor }, 'Vendor approval updated');
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const { status, vendorId, customerId } = req.query;
  const query = {};
  if (status) query.status = status;
  if (vendorId) query.vendorId = vendorId;
  if (customerId) query.customerId = customerId;
  const orders = await Order.find(query)
    .populate('customerId', 'name email')
    .populate('vendorId', 'shopName')
    .sort({ createdAt: -1 })
    .limit(100);
  return successResponse(res, { orders });
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const { action, userId, limit = 100 } = req.query;
  const query = {};
  if (action) query.action = action;
  if (userId) query.userId = userId;
  const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
  return successResponse(res, { logs });
}));

router.get('/security-events', asyncHandler(async (req, res) => {
  const events = await AuditLog.find({
    $or: [
      { action: 'SUSPICIOUS_ACTIVITY' },
      { action: 'IP_BLOCKED' },
      { action: 'LOGIN_FAILURE' }
    ]
  }).sort({ createdAt: -1 }).limit(50);
  return successResponse(res, { events });
}));

router.post('/blacklist/ip', asyncHandler(async (req, res) => {
  const { ip, reason, durationSeconds } = req.body;
  if (!ip) return errorResponse(res, 'IP required', 400);
  const { getRedis } = require('../config/redis');
  const redis = getRedis();
  await redis.setex(`ip_blacklist:${ip}`, durationSeconds || 3600, reason || 'blocked by admin');
  return successResponse(res, {}, 'IP blacklisted');
}));

router.delete('/blacklist/ip/:ip', asyncHandler(async (req, res) => {
  const { getRedis } = require('../config/redis');
  const redis = getRedis();
  await redis.del(`ip_blacklist:${req.params.ip}`);
  return successResponse(res, {}, 'IP removed from blacklist');
}));

module.exports = router;