import mongoose from 'mongoose';

// Audit records form a linked sequence using previousHash + hash. The model
// intentionally keeps the payload flexible because different events carry
// different operational details.
const auditSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    patientId: {
      type: String,
      default: null,
      index: true
    },
    actorId: {
      type: String,
      default: 'SYSTEM'
    },
    actorRole: {
      type: String,
      default: 'SYSTEM'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    previousHash: {
      type: String,
      default: 'GENESIS'
    },
    hash: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    versionKey: false
  }
);

auditSchema.index({ timestamp: -1 });

export default mongoose.model('AuditLog', auditSchema);
