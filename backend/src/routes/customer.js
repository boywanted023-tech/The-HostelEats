const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const User = require('../models/User');
const orderService = require('../services/orderService');
const { authenticate, authorize } = require('../middleware/auth');
const { orderRateLimiter } = require('../middleware/security');
const { orderSchema, ratingSchema } = require('../utils/validators');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { CATEGORIES } = require('../utils/constants');

router.get('/vendors', asyncHandler(async (req, res) => {
  const { search, category, block } = req.query;
  const query = { isApproved: true };
  if (search) query.shopName = { $regex: search, $options: 'i' };
  if (block) query.hostelBlock = block;
  const vendors = await Vendor.find(query).sort({ rating: -1 });
  let filtered = vendors;
  if (category) {
    const vendorIds = await MenuItem.distinct('vendorId', { category, isAvailable: true });
    const idSet = new Set(vendorIds.map(id => id.toString()));
    filtered = vendors.filter(v => idSet.has(v._id.toString()));
  }
  return successResponse(res, { vendors: filtered });
}));

router.get('/vendors/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return errorResponse(res, 'Vendor not found', 404);
  const menu = await MenuItem.find({ vendorId: vendor._id, isAvailable: true }).sort({ category: 1 });
  return successResponse(res, { vendor, menu });
}));

router.get('/menu/:vendorId', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.vendorId)) return errorResponse(res, 'Invalid id', 400);
  const items = await MenuItem.find({ vendorId: req.params.vendorId, isAvailable: true }).sort({ category: 1 });
  return successResponse(res, { items });
}));

router.get('/categories', (req, res) => successResponse(res, { categories: CATEGORIES }));

router.use(authenticate);
router.use(authorize('customer'));

router.post('/orders', orderRateLimiter, asyncHandler(async (req, res) => {
  const { error, value } = orderSchema.validate(req.body, { abortEarly: false });
  if (error) return errorResponse(res, 'Validation failed', 400, error.details.map(d => d.message));

  const order = await orderService.placeOrder(req.user._id, value);
  const io = req.app.get('io');
  if (io) io.to(`vendor:${order.vendorId}`).emit('newOrder', { order });

  return successResponse(res, { order }, 'Order placed successfully', 201);
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await Order.getCustomerOrders(req.user._id, 50);
  return successResponse(res, { orders });
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  const order = await Order.findById(req.params.id)
    .populate('vendorId', 'shopName shopImage hostelBlock')
    .populate('items.menuItemId', 'name price image');
  if (!order) return errorResponse(res, 'Order not found', 404);
  if (order.customerId.toString() !== req.user._id.toString()) return errorResponse(res, 'Not authorized', 403);
  return successResponse(res, { order });
}));

router.post('/orders/:id/cancel', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  try {
    const order = await orderService.transitionOrder(req.params.id, 'Cancelled', req.user, req.body.reason || 'Cancelled by customer');
    const io = req.app.get('io');
    if (io) {
      io.to(`vendor:${order.vendorId}`).emit('orderCancelled', { order });
      if (order.deliveryBoyId) io.to(`delivery:${order.deliveryBoyId}`).emit('orderCancelled', { order });
    }
    return successResponse(res, { order }, 'Order cancelled');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.post('/orders/:id/rate', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  const { error, value } = ratingSchema.validate(req.body);
  if (error) return errorResponse(res, 'Validation failed', 400);
  const order = await orderService.rateOrder(req.params.id, req.user._id, value.rating, value.feedback);
  return successResponse(res, { order }, 'Rating submitted');
}));

router.get('/profile', (req, res) => successResponse(res, { user: req.user }));

module.exports = router;