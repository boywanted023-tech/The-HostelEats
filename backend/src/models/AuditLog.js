const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource: {
    type: String,
    required: true
  },
  resourceId: {
    type: String,
    default: null
  },
  ip: {
    type: String,
    default: '0.0.0.0'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'blocked'],
    default: 'success'
  },
  error: {
    type: String,
    default: null
  },
  requestId: {
    type: String,
    default: null,
    index: true
  },
  sessionId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

auditLogSchema.statics.log = async function(entry) {
  try {
    return await this.create({
      ...entry,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;