const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const VALID_TRANSITIONS = {
  Pending:   ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready'],
  Ready:     ['Picked'],
  Picked:    ['Delivered'],
  Delivered: [],
  Cancelled: []
};

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    default: () => 'ORD-' + uuidv4().split('-')[0].toUpperCase(),
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name:       { type: String, required: true },
    quantity:   { type: Number, required: true, min: 1 },
    price:      { type: Number, required: true, min: 0 },
    total:      { type: Number, required: true, min: 0 }
  }],
  subtotal:       { type: Number, required: true, min: 0 },
  deliveryCharge: { type: Number, default: 0, min: 0 },
  surgeCharge:    { type: Number, default: 0, min: 0 },
  totalAmount:    { type: Number, required: true, min: 0 },
  paymentMethod: {
    type: String,
    enum: ['COD', 'UPI', 'Online'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  deliveryAddress: {
    block:      { type: String, required: true, enum: ['A','B','C','D','E','F','G','H'] },
    floor:      { type: String, required: true },
    roomNumber: { type: String, required: true },
    landmark:   { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Picked', 'Delivered', 'Cancelled'],
    default: 'Pending',
    index: true
  },
  timeline: [{
    status:    { type: String, enum: Object.keys(VALID_TRANSITIONS) },
    timestamp: { type: Date, default: Date.now },
    note:      String
  }],
  deliveryBoyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  specialInstructions: {
    type: String,
    maxlength: [200, 'Instructions cannot exceed 200 characters']
  },
  customerRating:   { type: Number, min: 0, max: 5, default: null },
  customerFeedback: { type: String, maxlength: [500, 'Feedback cannot exceed 500 characters'] },
  deliveredAt:      { type: Date, default: null },
  cancelledAt:      { type: Date, default: null },
  cancelReason:     { type: String, default: null }
}, {
  timestamps: true
});

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ vendorId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: 1 });
orderSchema.index({ deliveryBoyId: 1, status: 1 });

orderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.isNew) {
    this.timeline.push({ status: 'Pending', timestamp: new Date(), note: 'Order placed' });
  } else if (this.isModified('status') && !this.timeline[this.timeline.length - 1]?.note?.includes('Order ' + this.status)) {
    this.timeline.push({ status: this.status, timestamp: new Date(), note: 'Order ' + this.status });
  }
  next();
});

orderSchema.methods.transitionTo = function(newStatus, note = '') {
  const allowed = VALID_TRANSITIONS[this.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }
  this.status = newStatus;
  this.timeline.push({ status: newStatus, timestamp: new Date(), note: note || ('Order ' + newStatus) });
  if (newStatus === 'Delivered') this.deliveredAt = new Date();
  if (newStatus === 'Cancelled') {
    this.cancelledAt = new Date();
    if (note) this.cancelReason = note;
  }
  return this.save();
};

orderSchema.statics.getOrdersByStatus = function(vendorId, status) {
  const query = { vendorId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

orderSchema.statics.getCustomerOrders = function(customerId, limit = 10) {
  return this.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('vendorId', 'shopName shopImage hostelBlock')
    .populate('items.menuItemId', 'name price image');
};

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;