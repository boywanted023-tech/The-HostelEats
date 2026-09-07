const mongoose = require('mongoose');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Vendor = require('../models/Vendor');
const DeliveryBoy = require('../models/DeliveryBoy');
const { SURGE } = require('../utils/constants');
const { calculateOrderTotals, isSurgeTime } = require('../utils/helpers');

class OrderService {
  async placeOrder(customerId, payload) {
    const { vendorId, items, deliveryAddress, paymentMethod, specialInstructions } = payload;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) throw new Error('Vendor not found');
    if (!vendor.isApproved) throw new Error('Vendor not approved');
    if (!vendor.isOpen) throw new Error('Vendor is currently closed');

    const itemIds = items.map(i => i.menuItemId);
    const menuItems = await MenuItem.find({ _id: { $in: itemIds }, vendorId, isAvailable: true });
    if (menuItems.length !== itemIds.length) throw new Error('Some items are unavailable');

    const detailedItems = items.map(req => {
      const menu = menuItems.find(m => m._id.toString() === req.menuItemId);
      const price = menu.price;
      return {
        menuItemId: menu._id,
        name: menu.name,
        quantity: req.quantity,
        price,
        total: price * req.quantity
      };
    });

    const subtotal = detailedItems.reduce((s, i) => s + i.total, 0);
    const deliveryCharge = subtotal >= 200 ? 0 : 20;
    const surgeCharge = isSurgeTime(new Date(), SURGE) ? SURGE.CHARGE : 0;
    const totalAmount = subtotal + deliveryCharge + surgeCharge;

    const order = await Order.create({
      customerId,
      vendorId,
      items: detailedItems,
      subtotal,
      deliveryCharge,
      surgeCharge,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
      deliveryAddress,
      specialInstructions,
      status: 'Pending'
    });

    vendor.totalOrders += 1;
    await vendor.save();

    return order;
  }

  async transitionOrder(orderId, newStatus, actor, note = '') {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (actor.role === 'vendor') {
      const vendor = await Vendor.findOne({ userId: actor.id });
      if (!vendor || order.vendorId.toString() !== vendor._id.toString()) {
        throw new Error('Not authorized to modify this order');
      }
    } else if (actor.role === 'delivery') {
      if (!['Picked', 'Delivered'].includes(newStatus)) {
        throw new Error('Delivery can only pick or deliver orders');
      }
    } else if (actor.role === 'customer') {
      if (newStatus !== 'Cancelled' || order.customerId.toString() !== actor.id) {
        throw new Error('Customers can only cancel their own orders');
      }
    }

    return order.transitionTo(newStatus, note);
  }

  async assignDeliveryBoy(orderId, deliveryBoyId) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (!['Confirmed', 'Preparing', 'Ready'].includes(order.status)) {
      throw new Error('Order not ready for delivery assignment');
    }
    order.deliveryBoyId = deliveryBoyId;
    await order.save();
    const deliveryBoy = await DeliveryBoy.findOne({ userId: deliveryBoyId });
    if (deliveryBoy) await deliveryBoy.assignOrder(order._id);
    return order;
  }

  async rateOrder(orderId, customerId, rating, feedback) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.customerId.toString() !== customerId.toString()) throw new Error('Not authorized');
    if (order.status !== 'Delivered') throw new Error('Only delivered orders can be rated');

    order.customerRating = rating;
    order.customerFeedback = feedback;
    await order.save();

    const vendor = await Vendor.findById(order.vendorId);
    if (vendor) {
      const total = vendor.totalOrders || 1;
      vendor.rating = ((vendor.rating * (total - 1)) + rating) / total;
      await vendor.save();
    }
    return order;
  }

  async getVendorEarnings(vendorId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orders = await Order.find({
      vendorId,
      status: 'Delivered',
      deliveredAt: { $gte: since }
    });
    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalOrders = orders.length;
    const vendor = await Vendor.findById(vendorId);
    const commission = vendor ? (vendor.commission / 100) * totalRevenue : 0;
    return { totalRevenue, totalOrders, commission, netEarnings: totalRevenue - commission };
  }
}

module.exports = new OrderService();