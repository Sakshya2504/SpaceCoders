import mongoose from 'mongoose';

const USER_ROLES = [
  'triage_nurse',
  'charge_nurse',
  'clinical_admin',
  'system_admin'
];

// User records store only the bcrypt password hash. Plain-text passwords
// are never persisted or returned through the API.
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'triage_nurse'
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('User', userSchema);
