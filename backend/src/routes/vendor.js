const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const orderService = require('../services/orderService');
const { authenticate, authorize } = require('../middleware/auth');
const { vendorSchema, menuItemSchema, orderStatusSchema } = require('../utils/validators');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

router.use(authenticate);
router.use(authorize('vendor', 'admin'));

const getVendorForUser = async (userId) => {
  const vendor = await Vendor.findOne({ userId });
  if (!vendor) throw new Error('Vendor profile not found');
  return vendor;
};

router.get('/profile', asyncHandler(async (req, res) => {
  try {
    const vendor = await getVendorForUser(req.user._id);
    return successResponse(res, { vendor });
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
}));

router.put('/profile', asyncHandler(async (req, res) => {
  try {
    const { error, value } = vendorSchema.validate(req.body);
    if (error) return errorResponse(res, 'Validation failed', 400, error.details.map(d => d.message));
    const vendor = await getVendorForUser(req.user._id);
    Object.assign(vendor, value);
    await vendor.save();
    return successResponse(res, { vendor }, 'Profile updated');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.put('/toggle-open', asyncHandler(async (req, res) => {
  try {
    const vendor = await getVendorForUser(req.user._id);
    vendor.isOpen = !vendor.isOpen;
    await vendor.save();
    return successResponse(res, { vendor }, 'Shop status updated');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.get('/menu', asyncHandler(async (req, res) => {
  try {
    const vendor = await getVendorForUser(req.user._id);
    const items = await MenuItem.find({ vendorId: vendor._id }).sort({ category: 1 });
    return successResponse(res, { items });
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
}));

router.post('/menu', asyncHandler(async (req, res) => {
  try {
    const vendor = await getVendorForUser(req.user._id);
    const { error, value } = menuItemSchema.validate(req.body);
    if (error) return errorResponse(res, 'Validation failed', 400, error.details.map(d => d.message));
    const item = await MenuItem.create({ ...value, vendorId: vendor._id });
    return successResponse(res, { item }, 'Item added', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.put('/menu/:id', asyncHandler(async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
    const vendor = await getVendorForUser(req.user._id);
    const item = await MenuItem.findOne({ _id: req.params.id, vendorId: vendor._id });
    if (!item) return errorResponse(res, 'Item not found', 404);
    const { error, value } = menuItemSchema.validate(req.body);
    if (error) return errorResponse(res, 'Validation failed', 400, error.details.map(d => d.message));
    Object.assign(item, value);
    await item.save();
    return successResponse(res, { item }, 'Item updated');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.delete('/menu/:id', asyncHandler(async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
    const vendor = await getVendorForUser(req.user._id);
    const item = await MenuItem.findOneAndDelete({ _id: req.params.id, vendorId: vendor._id });
    if (!item) return errorResponse(res, 'Item not found', 404);
    return successResponse(res, {}, 'Item deleted');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.get('/orders', asyncHandler(async (req, res) => {
  try {
    const vendor = await getVendorForUser(req.user._id);
    const { status } = req.query;
    const orders = await Order.getOrdersByStatus(vendor._id, status);
    return successResponse(res, { orders });
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
}));

router.put('/orders/:id/status', asyncHandler(async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, 'Invalid id', 400);
    const { error, value } = orderStatusSchema.validate(req.body);
    if (error) return errorResponse(res, 'Validation failed', 400, error.details.map(d => d.message));

    const order = await orderService.transitionOrder(req.params.id, value.status, req.user, value.note);

    const io = req.app.get('io');
    if (io) {
      io.to(`customer:${order.customerId}`).emit(`order${value.status}`, { order });
      if (order.deliveryBoyId) io.to(`delivery:${order.deliveryBoyId}`).emit(`order${value.status}`, { order });
    }
    return successResponse(res, { order }, 'Order status updated');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}));

router.get('/earnings', asyncHandler(async (req, res) => {
  try {
    const vendor = await getVendorForUser(req.user._id);
    const days = parseInt(req.query.days, 10) || 30;
    const stats = await orderService.getVendorEarnings(vendor._id, days);
    return successResponse(res, { stats });
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  try {
    const vendor = await getVendorForUser(req.user._id);
    const [pending, confirmed, preparing, ready, delivered] = await Promise.all([
      Order.countDocuments({ vendorId: vendor._id, status: 'Pending' }),
      Order.countDocuments({ vendorId: vendor._id, status: 'Confirmed' }),
      Order.countDocuments({ vendorId: vendor._id, status: 'Preparing' }),
      Order.countDocuments({ vendorId: vendor._id, status: 'Ready' }),
      Order.countDocuments({ vendorId: vendor._id, status: 'Delivered', deliveredAt: { $gte: new Date(Date.now() - 86400000) } })
    ]);
    const stats = await orderService.getVendorEarnings(vendor._id, 7);
    const recent = await Order.find({ vendorId: vendor._id }).sort({ createdAt: -1 }).limit(10);
    return successResponse(res, { counts: { pending, confirmed, preparing, ready, delivered }, stats, recent });
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
}));

module.exports = router;