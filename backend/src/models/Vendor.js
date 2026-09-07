const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  shopName: {
    type: String,
    required: [true, 'Shop name is required'],
    trim: true,
    minlength: [2, 'Shop name must be at least 2 characters'],
    maxlength: [50, 'Shop name cannot exceed 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  hostelBlock: {
    type: String,
    required: [true, 'Hostel block is required'],
    enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  },
  shopImage: {
    type: String,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  openingTime: {
    type: String,
    required: [true, 'Opening time is required'],
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter valid time (HH:MM)']
  },
  closingTime: {
    type: String,
    required: [true, 'Closing time is required'],
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter valid time (HH:MM)']
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  commission: {
    type: Number,
    default: 15,
    min: 0,
    max: 30
  },
  isApproved: {
    type: Boolean,
    default: false
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

vendorSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

vendorSchema.methods.isCurrentlyOpen = function() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const current = `${hh}:${mm}`;
  if (this.openingTime <= this.closingTime) {
    return current >= this.openingTime && current <= this.closingTime;
  }
  return current >= this.openingTime || current <= this.closingTime;
};

vendorSchema.statics.getOpenVendors = function() {
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return this.find({
    isApproved: true,
    isOpen: true
  });
};

vendorSchema.index({ hostelBlock: 1, isApproved: 1 });

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;