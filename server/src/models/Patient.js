import mongoose from 'mongoose';

// Red-flag results are embedded because every patient review needs the detector
// outcome immediately; they are small, immutable results for a single assessment.
const redFlagSchema = new mongoose.Schema(
  {
    positive: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    reasons: { type: [String], default: [] }
  },
  { _id: false }
);

const contributionSchema = new mongoose.Schema(
  {
    feature: String,
    value: mongoose.Schema.Types.Mixed,
    impact: Number,
    direction: String
  },
  { _id: false }
);

const assessmentSchema = new mongoose.Schema({
  generatedAt: Date,
  esi: Number,
  confidence: Number,
  confidenceBand: String,
  action: String,
  ageBand: String,
  redFlags: mongoose.Schema.Types.Mixed,
  reasons: [String],
  featureContributions: [contributionSchema],
  dataCompleteness: Number,
  hasHistory: Boolean,
  modelVersion: String,
  trigger: String
});

/*
 * `modelFeatures` stores the dataset-aligned feature vector used for ML work.
 * Keeping this separate from the clinician-facing fields gives us a clean
 * contract for the future XGBoost inference service without making the UI
 * depend on scikit-learn column names.
 */
const patientSchema = new mongoose.Schema(
  {
    // Synthetic identity used by the application. MongoDB `_id` remains internal.
    patientId: { type: String, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 120 },
    sex: { type: String, enum: ['Female', 'Male', 'Other'] },
    arrivalTime: { type: Date, default: Date.now },

    // Clinician-facing intake information.
    chiefComplaint: { type: String, required: true, trim: true },
    extractedSymptoms: { type: [String], default: [] },
    vitals: {
      heartRate: Number,
      respiratoryRate: Number,
      temperature: Number,
      systolicBP: Number,
      diastolicBP: Number,
      spo2: Number,
      painScore: Number
    },
    mentalStatus: { type: String, default: 'Alert and oriented' },
    hasHistory: { type: Boolean, default: false },
    historySummary: { type: String, default: '' },
    conditions: { type: [String], default: [] },
    medications: { type: [String], default: [] },
    allergies: { type: [String], default: [] },

    // Dataset-aligned vector. Derived values are calculated before inference.
    modelFeatures: { type: mongoose.Schema.Types.Mixed, default: {} },

    triage: {
      esi: Number,
      confidence: Number,
      confidenceBand: String,
      action: String,
      escalation: Boolean,
      ageBand: String,
      redFlags: mongoose.Schema.Types.Mixed,
      reasons: [String],
      featureContributions: [contributionSchema],
      dataCompleteness: Number,
      hasHistory: Boolean,
      modelVersion: String,
      generatedAt: Date
    },

    assessments: { type: [assessmentSchema], default: [] },

    // Human decision fields are distinct from the model recommendation.
    manualEsi: { type: Number, min: 1, max: 5, default: null },
    finalEsi: { type: Number, min: 1, max: 5, default: null },
    status: {
      type: String,
      enum: ['WAITING', 'SEEN', 'MANUAL_TRIAGE_REQUIRED'],
      default: 'WAITING'
    },

    // Queue-monitoring state.
    queueStatus: {
      type: String,
      enum: ['WAITING', 'CALLED', 'COMPLETED'],
      default: 'WAITING'
    },
    position: { type: Number, default: null },
    lastReassessmentAt: Date,
    nextReassessmentAt: Date,
    safeMaxWaitMinutes: { type: Number, default: 30 },
    deteriorationDetected: { type: Boolean, default: false },
    surgeMode: { type: Boolean, default: false },

    // Clinician override/audit references.
    overridden: { type: Boolean, default: false },
    overrideBy: String,
    overrideAt: Date,
    overrideReason: String,
    overrideNote: { type: String, default: '' },
    lastAuditHash: String
  },
  { timestamps: true }
);

// The queue query is the hottest patient-list query, so keep a compound index for it.
patientSchema.index({ queueStatus: 1, 'triage.esi': 1, arrivalTime: 1 });

export default mongoose.model('Patient', patientSchema);
