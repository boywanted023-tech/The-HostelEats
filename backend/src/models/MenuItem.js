const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [80, 'Name cannot exceed 80 characters']
  },
  description: {
    type: String,
    maxlength: [300, 'Description cannot exceed 300 characters'],
    default: ''
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Snacks', 'Dinner', 'Beverages'],
    required: true,
    index: true
  },
  image: {
    type: String,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  preparationTime: {
    type: Number,
    required: [true, 'Preparation time is required'],
    min: [1, 'Preparation time must be at least 1 minute'],
    max: [120, 'Preparation time cannot exceed 120 minutes']
  },
  isVeg: {
    type: Boolean,
    default: true
  },
  spiceLevel: {
    type: String,
    enum: ['Mild', 'Medium', 'Hot'],
    default: 'Mild'
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

menuItemSchema.index({ vendorId: 1, category: 1 });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
module.exports = MenuItem;