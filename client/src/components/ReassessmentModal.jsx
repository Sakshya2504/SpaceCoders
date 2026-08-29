import { Activity, ClipboardList, HeartPulse, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import Modal from './Modal';

function valueOrEmpty(value) {
  return value === undefined || value === null ? '' : value;
}

/**
 * Reassessment is intentionally a data-entry step. The clinician can update
 * what has changed at bedside before the model is run again.
 */
export default function ReassessmentModal({
  open,
  patient,
  busy,
  error,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState({
    chiefComplaint: '',
    mentalStatus: '',
    heartRate: '',
    respiratoryRate: '',
    systolicBP: '',
    diastolicBP: '',
    temperature: '',
    spo2: '',
    painScore: '',
    gcsTotal: '',
    news2Score: ''
  });

  useEffect(() => {
    if (!patient || !open) return;

    setForm({
      chiefComplaint: valueOrEmpty(patient.chiefComplaint),
      mentalStatus: valueOrEmpty(patient.mentalStatus),
      heartRate: valueOrEmpty(patient.vitals?.heartRate),
      respiratoryRate: valueOrEmpty(patient.vitals?.respiratoryRate),
      systolicBP: valueOrEmpty(patient.vitals?.systolicBP),
      diastolicBP: valueOrEmpty(patient.vitals?.diastolicBP),
      temperature: valueOrEmpty(patient.vitals?.temperature),
      spo2: valueOrEmpty(patient.vitals?.spo2),
      painScore: valueOrEmpty(patient.vitals?.painScore),
      gcsTotal: valueOrEmpty(patient.modelFeatures?.gcs_total),
      news2Score: valueOrEmpty(patient.modelFeatures?.news2_score)
    });
  }, [open, patient]);

  const updateField = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = event => {
    event.preventDefault();

    const numericVitals = {
      heartRate: Number(form.heartRate),
      respiratoryRate: Number(form.respiratoryRate),
      systolicBP: Number(form.systolicBP),
      diastolicBP: Number(form.diastolicBP),
      temperature: Number(form.temperature),
      spo2: Number(form.spo2),
      painScore: Number(form.painScore)
    };

    onSubmit({
      chiefComplaint: form.chiefComplaint.trim(),
      mentalStatus: form.mentalStatus,
      vitals: numericVitals,
      modelFeatures: {
        gcs_total: Number(form.gcsTotal),
        news2_score: Number(form.news2Score)
      }
    });
  };

  return (
    <Modal open={open} title="Clinical reassessment" onClose={busy ? () => {} : onClose}>
      <form className="reassessment-form" onSubmit={handleSubmit}>
        <div className="reassessment-intro">
          <HeartPulse size={18} aria-hidden="true" />
          <div>
            <strong>Update the latest bedside observations</strong>
            <span>
              Existing values are pre-filled. Change only what has been re-checked.
            </span>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        <div className="reassessment-section">
          <div className="reassessment-section-title">
            <ClipboardList size={14} />
            <span>Clinical presentation</span>
          </div>

          <label>
            Chief complaint / new symptoms
            <textarea
              rows="3"
              value={form.chiefComplaint}
              onChange={event => updateField('chiefComplaint', event.target.value)}
              placeholder="What has changed since the previous assessment?"
            />
          </label>

          <label>
            Mental status
            <select
              value={form.mentalStatus}
              onChange={event => updateField('mentalStatus', event.target.value)}
            >
              <option value="alert">Alert</option>
              <option value="drowsy">Drowsy</option>
              <option value="confused">Confused</option>
              <option value="agitated">Agitated</option>
              <option value="unresponsive">Unresponsive</option>
            </select>
          </label>
        </div>

        <div className="reassessment-section">
          <div className="reassessment-section-title">
            <Activity size={14} />
            <span>Repeat observations</span>
          </div>

          <div className="form-grid reassessment-grid">
            <label>Heart rate<input type="number" step="0.1" value={form.heartRate} onChange={event => updateField('heartRate', event.target.value)} required /></label>
            <label>Respiratory rate<input type="number" step="0.1" value={form.respiratoryRate} onChange={event => updateField('respiratoryRate', event.target.value)} required /></label>
            <label>Systolic BP<input type="number" step="0.1" value={form.systolicBP} onChange={event => updateField('systolicBP', event.target.value)} required /></label>
            <label>Diastolic BP<input type="number" step="0.1" value={form.diastolicBP} onChange={event => updateField('diastolicBP', event.target.value)} required /></label>
            <label>Temperature °C<input type="number" step="0.1" value={form.temperature} onChange={event => updateField('temperature', event.target.value)} required /></label>
            <label>SpO₂ %<input type="number" step="0.1" value={form.spo2} onChange={event => updateField('spo2', event.target.value)} required /></label>
            <label>Pain score<input type="number" min="0" max="10" value={form.painScore} onChange={event => updateField('painScore', event.target.value)} required /></label>
            <label>GCS total<input type="number" min="3" max="15" value={form.gcsTotal} onChange={event => updateField('gcsTotal', event.target.value)} required /></label>
            <label>NEWS2 score<input type="number" min="0" max="17" value={form.news2Score} onChange={event => updateField('news2Score', event.target.value)} required /></label>
          </div>
        </div>

        <div className="reassessment-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            <RefreshCcw size={15} className={busy ? 'spin' : ''} />
            {busy ? 'Running assessment…' : 'Run reassessment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
