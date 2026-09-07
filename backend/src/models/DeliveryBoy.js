const mongoose = require('mongoose');

const deliveryBoySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentLocation: {
    block:      { type: String, enum: ['A','B','C','D','E','F','G','H'], default: null },
    lat:        { type: Number, default: null },
    lng:        { type: Number, default: null },
    updatedAt:  { type: Date, default: null }
  },
  activeOrders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  totalDeliveries: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  vehicleType: {
    type: String,
    enum: ['Bicycle', 'Scooter', 'Walking'],
    default: 'Walking'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

deliveryBoySchema.methods.assignOrder = function(orderId) {
  if (!this.activeOrders.includes(orderId)) {
    this.activeOrders.push(orderId);
    this.isAvailable = this.activeOrders.length < 3;
    return this.save();
  }
};

deliveryBoySchema.methods.completeOrder = function(orderId) {
  this.activeOrders = this.activeOrders.filter(id => id.toString() !== orderId.toString());
  this.totalDeliveries += 1;
  this.isAvailable = true;
  return this.save();
};

const DeliveryBoy = mongoose.model('DeliveryBoy', deliveryBoySchema);
module.exports = DeliveryBoy;