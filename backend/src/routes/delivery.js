const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const { authenticate, authorize } = require('../middleware/auth');
const orderService = require('../services/orderService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

router.use(authenticate);
router.use(authorize('delivery'));

router.get('/profile', asyncHandler(async (req, res) => {
  const profile = await DeliveryBoy.findOne({ userId: req.user._id });
  if (!profile) return errorResponse(res, 'Delivery profile not found', 404);
  return successResponse(res, { profile });
}));

router.put('/availability', asyncHandler(async (req, res) => {
  const profile = await DeliveryBoy.findOne({ userId: req.user._id });
  if (!profile) return errorResponse(res, 'Profile not found', 404);
  profile.isAvailable = !!req.body.isAvailable;
  await profile.save();
  return successResponse(res, { profile }, 'Availability updated');
}));

router.put('/location', asyncHandler(async (req, res) => {
  const profile = await DeliveryBoy.findOne({ userId: req.user._id });
  if (!profile) return errorResponse(res, 'Profile not found', 404);
  const { block, lat, lng } = req.body;
  profile.currentLocation = { block, lat, lng, updatedAt: new Date() };
  await profile.save();
  return successResponse(res, { profile }, 'Location updated');
}));

router.get('/orders/available', asyncHandler(async (req, res) => {
  const orders = await Order.find({
    status: 'Ready',
    deliveryBoyId: null
  }).sort({ createdAt: 1 }).limit(20);
  return successResponse(res, { orders });
}));

router.get('/orders/active', asyncHandler(async (req, res) => {
  const profile = await DeliveryBoy.findOne({ userId: req.user._id });
  if (!profile) return errorResponse(res, 'Profile not found', 404);
  const orders = await Order.find({
    _id: { $in: profile.activeOrders },
    status: { $in: ['Picked', 'Ready'] }
  }).populate('vendorId', 'shopName hostelBlock');
  return successResponse(res, { orders });
}));

router.post('/orders/:id/accept', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  try {
    const order = await orderService.assignDeliveryBoy(req.params.id, req.user._id);
    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${order.customerId}`).emit('deliveryAssigned', { order });
      io.to(`vendor:${order.vendorId}`).emit('deliveryAssigned', { order });
    }
    return successResponse(res, { order }, 'Order accepted');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.post('/orders/:id/pick', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  try {
    const order = await orderService.transitionOrder(req.params.id, 'Picked', req.user, 'Picked up by delivery');
    const profile = await DeliveryBoy.findOne({ userId: req.user._id });
    if (profile) await profile.assignOrder(order._id);

    const io = req.app.get('io');
    if (io) io.to(`customer:${order.customerId}`).emit('orderPicked', { order });
    return successResponse(res, { order }, 'Order picked');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.post('/orders/:id/deliver', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
  try {
    const order = await orderService.transitionOrder(req.params.id, 'Delivered', req.user, 'Delivered');
    const profile = await DeliveryBoy.findOne({ userId: req.user._id });
    if (profile) await profile.completeOrder(order._id);

    const io = req.app.get('io');
    if (io) io.to(`customer:${order.customerId}`).emit('orderDelivered', { order });
    return successResponse(res, { order }, 'Order delivered');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const profile = await DeliveryBoy.findOne({ userId: req.user._id });
  if (!profile) return errorResponse(res, 'Profile not found', 404);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const deliveredToday = await Order.countDocuments({
    deliveryBoyId: req.user._id,
    status: 'Delivered',
    deliveredAt: { $gte: today }
  });
  return successResponse(res, {
    profile,
    todayDeliveries: deliveredToday,
    activeOrdersCount: profile.activeOrders.length
  });
}));

module.exports = router;