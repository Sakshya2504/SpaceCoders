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
  modelSource: String,
  modelConfidence: Number,
  modelProbabilities: mongoose.Schema.Types.Mixed,
  trigger: String
});

/*
 * The patient document separates clinician-friendly information from the exact
 * feature payload used by the inference service. That gives the ML layer a
 * stable contract while keeping the UI readable.
 */
const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 120 },
    sex: { type: String, enum: ['Female', 'Male', 'Other'] },
    arrivalTime: { type: Date, default: Date.now },

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

    // Exact dataset-style fields are retained so the same patient can be
    // reproduced for a later reassessment or model audit.
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
      modelSource: String,
      modelConfidence: Number,
      modelProbabilities: mongoose.Schema.Types.Mixed,
      generatedAt: Date
    },

    assessments: { type: [assessmentSchema], default: [] },

    // A fresh model recommendation starts as PENDING. Accept and Override move
    // this into an explicit clinician-owned state for traceability.
    manualEsi: { type: Number, min: 1, max: 5, default: null },
    finalEsi: { type: Number, min: 1, max: 5, default: null },
    clinicianDecision: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'OVERRIDDEN'],
      default: 'PENDING'
    },
    clinicianDecisionAt: Date,
    clinicianDecisionBy: String,

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

    // Completion marks the end of the active ED service workflow. Completed
    // records remain searchable in Past Patients rather than being deleted.
    serviceCompletedAt: Date,
    serviceCompletedBy: String,
    completionNote: { type: String, default: '' },

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

// The queue query is frequent, so keep its main sort/filter path indexed.
patientSchema.index({ queueStatus: 1, 'triage.esi': 1, arrivalTime: 1 });
patientSchema.index({ queueStatus: 1, serviceCompletedAt: -1 });

export default mongoose.model('Patient', patientSchema);
