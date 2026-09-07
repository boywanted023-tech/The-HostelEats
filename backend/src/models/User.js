const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  role: {
    type: String,
    enum: ['customer', 'vendor', 'delivery', 'admin'],
    default: 'customer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lastLoginIP: {
    type: String,
    default: null
  },
  lastLoginDevice: {
    type: String,
    default: null
  },
  refreshToken: {
    type: String,
    select: false,
    default: null
  },
  refreshTokenExpiry: {
    type: Date,
    select: false,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: null
  },
  twoFactorSecret: {
    type: String,
    select: false,
    default: null
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  trustScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  suspiciousActivities: [{
    activity: String,
    timestamp: { type: Date, default: Date.now },
    ip: String
  }],
  knownDevices: [{
    fingerprint: String,
    userAgent: String,
    ip: String,
    lastUsed: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.virtual('vendorProfile', {
  ref: 'Vendor',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

userSchema.virtual('deliveryProfile', {
  ref: 'DeliveryBoy',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isPasswordChangedAfter = function(jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.incrementLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.failedLoginAttempts = 1;
    this.lockUntil = null;
    this.isLocked = false;
    return this.save();
  }
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.isLocked = true;
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  return this.save();
};

userSchema.methods.resetLoginAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  this.isLocked = false;
  return this.save();
};

userSchema.methods.addKnownDevice = function(fingerprint, userAgent, ip) {
  const existing = this.knownDevices.find(d => d.fingerprint === fingerprint);
  if (existing) {
    existing.lastUsed = new Date();
    existing.userAgent = userAgent;
    existing.ip = ip;
  } else {
    this.knownDevices.push({ fingerprint, userAgent, ip });
  }
  return this.save();
};

userSchema.methods.isKnownDevice = function(fingerprint) {
  return this.knownDevices.some(d => d.fingerprint === fingerprint);
};

userSchema.methods.decreaseTrustScore = function(points = 10) {
  this.trustScore = Math.max(0, this.trustScore - points);
  return this.save();
};

userSchema.methods.addSuspiciousActivity = function(activity, ip = '') {
  this.suspiciousActivities.push({ activity, ip, timestamp: new Date() });
  this.decreaseTrustScore(5);
  return this.save();
};

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ trustScore: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;