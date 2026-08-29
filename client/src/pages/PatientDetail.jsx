import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  RefreshCcw
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { ActionBadge, EsiBadge, FlagBadge } from '../components/Badge';

const DATASET_COLUMNS = [
  'patient_id', 'site_id', 'triage_nurse_id', 'arrival_mode', 'arrival_hour',
  'arrival_day', 'arrival_month', 'arrival_season', 'shift', 'age', 'age_group',
  'sex', 'language', 'insurance_type', 'transport_origin', 'pain_location',
  'mental_status_triage', 'chief_complaint_system', 'num_prior_ed_visits_12m',
  'num_prior_admissions_12m', 'num_active_medications', 'num_comorbidities',
  'systolic_bp', 'diastolic_bp', 'mean_arterial_pressure', 'pulse_pressure',
  'heart_rate', 'respiratory_rate', 'temperature_c', 'spo2', 'gcs_total',
  'pain_score', 'weight_kg', 'height_cm', 'bmi', 'shock_index', 'news2_score',
  'disposition', 'ed_los_hours', 'triage_acuity'
];

const ENGINEERED_COLUMNS = [
  'ed_volume_last_2h', 'rox_index', 'bsa', 'hr_dev', 'sys_bp_dev', 'temp_dev',
  'spo2_deficit', 'composite_vital_deviation', 'sirs_score', 'age_shock_risk',
  'age_sirs_risk', 'flag_hypoxia', 'flag_tachycardia', 'flag_hypotension',
  'flag_fever', 'total_red_flags', 'hour_sin', 'hour_cos'
];

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function buildDatasetRecord(patient) {
  const features = patient.modelFeatures || {};
  const vitals = patient.vitals || {};
  const arrival = patient.arrivalTime ? new Date(patient.arrivalTime) : null;

  return {
    patient_id: patient.patientId,
    site_id: features.site_id,
    triage_nurse_id: features.triage_nurse_id,
    arrival_mode: features.arrival_mode,
    arrival_hour: features.arrival_hour ?? arrival?.getHours(),
    arrival_day: features.arrival_day,
    arrival_month: features.arrival_month ?? ((arrival?.getMonth() ?? -1) + 1),
    arrival_season: features.arrival_season,
    shift: features.shift,
    age: patient.age,
    age_group: features.age_group,
    sex: features.sex || patient.sex,
    language: features.language,
    insurance_type: features.insurance_type,
    transport_origin: features.transport_origin,
    pain_location: features.pain_location,
    mental_status_triage: features.mental_status_triage || patient.mentalStatus,
    chief_complaint_system: features.chief_complaint_system,
    num_prior_ed_visits_12m: features.num_prior_ed_visits_12m,
    num_prior_admissions_12m: features.num_prior_admissions_12m,
    num_active_medications: features.num_active_medications,
    num_comorbidities: features.num_comorbidities,
    systolic_bp: features.systolic_bp ?? vitals.systolicBP,
    diastolic_bp: features.diastolic_bp ?? vitals.diastolicBP,
    mean_arterial_pressure: features.mean_arterial_pressure,
    pulse_pressure: features.pulse_pressure,
    heart_rate: features.heart_rate ?? vitals.heartRate,
    respiratory_rate: features.respiratory_rate ?? vitals.respiratoryRate,
    temperature_c: features.temperature_c ?? vitals.temperature,
    spo2: features.spo2 ?? vitals.spo2,
    gcs_total: features.gcs_total,
    pain_score: features.pain_score ?? vitals.painScore,
    weight_kg: features.weight_kg,
    height_cm: features.height_cm,
    bmi: features.bmi,
    shock_index: features.shock_index,
    news2_score: features.news2_score,
    disposition: patient.queueStatus === 'COMPLETED' ? 'completed' : 'in_progress',
    ed_los_hours:
      patient.serviceCompletedAt && patient.arrivalTime
        ? (new Date(patient.serviceCompletedAt) - new Date(patient.arrivalTime)) / 3600000
        : null,
    triage_acuity: patient.finalEsi || patient.triage?.esi
  };
}

function buildAiSummary(triage) {
  if (triage.action === 'IMMEDIATE_ESCALATION') {
    return 'Immediate clinician review is required because a safety signal or very high acuity was detected.';
  }

  if (triage.action === 'ABSTAIN_AND_ESCALATE') {
    return 'The system is uncertain. Review the available evidence and reassess before allowing the patient to wait.';
  }

  if (triage.action === 'FAIL_OPEN') {
    return 'Model inference was unavailable. Continue with the established manual triage process.';
  }

  return 'Use this recommendation as decision support alongside the current clinical picture.';
}

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reassessmentOpen, setReassessmentOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [engineeredOpen, setEngineeredOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [reassessmentForm, setReassessmentForm] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    targetEsi: '',
    reason: 'Clinical judgement',
    note: ''
  });

  const loadPatient = useCallback(async () => {
    const response = await api.get(`/patients/${id}`);
    const record = response.data.data;
    setPatient(record);
    return record;
  }, [id]);

  useEffect(() => {
    loadPatient().catch(requestError => {
      setError(requestError.response?.data?.message || 'Unable to load patient record.');
    });
  }, [loadPatient]);

  const getErrorMessage = requestError =>
    requestError.response?.data?.message ||
    requestError.response?.data?.error?.details ||
    requestError.message ||
    'The request could not be completed.';

  const runAction = async (name, request, success) => {
    setBusyAction(name);
    setError('');
    setMessage('');

    try {
      await request();
      await loadPatient();
      setMessage(success);
      return true;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      return false;
    } finally {
      setBusyAction('');
    }
  };

  const acceptRecommendation = () =>
    runAction('accept', () => api.post(`/patients/${id}/accept`), 'Recommendation accepted and recorded.');

  const openReassessment = () => {
    const vitals = patient.vitals || {};
    const features = patient.modelFeatures || {};

    setError('');
    setMessage('');
    setReassessmentForm({
      chiefComplaint: patient.chiefComplaint || '',
      mentalStatus: features.mental_status_triage || 'alert',
      heartRate: vitals.heartRate ?? '',
      respiratoryRate: vitals.respiratoryRate ?? '',
      systolicBP: vitals.systolicBP ?? '',
      diastolicBP: vitals.diastolicBP ?? '',
      temperature: vitals.temperature ?? '',
      spo2: vitals.spo2 ?? '',
      painScore: vitals.painScore ?? '',
      gcsTotal: features.gcs_total ?? 15,
      news2Score: features.news2_score ?? 0
    });
    setReassessmentOpen(true);
  };

  const updateReassessment = (field, value) => {
    setReassessmentForm(current => ({ ...current, [field]: value }));
  };

  const confirmReassessment = () => {
    if (!reassessmentForm?.chiefComplaint?.trim()) {
      setError('Please describe the current complaint or change in symptoms.');
      return;
    }

    const values = [
      reassessmentForm.heartRate,
      reassessmentForm.respiratoryRate,
      reassessmentForm.systolicBP,
      reassessmentForm.diastolicBP,
      reassessmentForm.temperature,
      reassessmentForm.spo2,
      reassessmentForm.painScore,
      reassessmentForm.gcsTotal,
      reassessmentForm.news2Score
    ].map(Number);

    if (values.some(value => !Number.isFinite(value))) {
      setError('Please complete every reassessment measurement.');
      return;
    }

    if (values[7] < 3 || values[7] > 15) {
      setError('GCS must be between 3 and 15.');
      return;
    }

    if (values[6] < 0 || values[6] > 10) {
      setError('Pain score must be between 0 and 10.');
      return;
    }

    if (values[8] < 0 || values[8] > 17) {
      setError('NEWS2 score must be between 0 and 17.');
      return;
    }

    runAction(
      'reassess',
      () => api.post(`/patients/${id}/reassess`, {
        chiefComplaint: reassessmentForm.chiefComplaint.trim(),
        mentalStatus: reassessmentForm.mentalStatus,
        vitals: {
          heartRate: values[0],
          respiratoryRate: values[1],
          systolicBP: values[2],
          diastolicBP: values[3],
          temperature: values[4],
          spo2: values[5],
          painScore: values[6]
        },
        modelFeatures: {
          ...(patient.modelFeatures || {}),
          gcs_total: values[7],
          news2_score: values[8],
          mental_status_triage: reassessmentForm.mentalStatus
        }
      }),
      'Reassessment completed. Review the new recommendation before accepting it.'
    ).then(success => {
      if (success) setReassessmentOpen(false);
    });
  };

  const confirmOverride = () => {
    const targetEsi = Number(overrideForm.targetEsi);

    if (!Number.isInteger(targetEsi) || targetEsi < 1 || targetEsi > 5) {
      setError('Select a valid target ESI before confirming the override.');
      return;
    }

    runAction(
      'override',
      () => api.post(`/patients/${id}/override`, {
        ...overrideForm,
        targetEsi
      }),
      'Clinician override recorded.'
    ).then(success => {
      if (success) setOverrideOpen(false);
    });
  };

  const confirmCompletion = () =>
    runAction(
      'complete',
      () => api.post(`/patients/${id}/complete`, { note: completionNote.trim() }),
      'Patient service marked as complete. The encounter is now in Past Patients.'
    ).then(success => {
      if (success) {
        setCompletionOpen(false);
        setCompletionNote('');
      }
    });

  const datasetRecord = useMemo(() => buildDatasetRecord(patient), [patient]);
  const engineeredValues = useMemo(
    () => Object.fromEntries(ENGINEERED_COLUMNS.map(column => [column, patient.modelFeatures?.[column]])),
    [patient]
  );

  if (!patient) return <div className="page-loading">Loading patient…</div>;

  const triage = patient.triage || {};
  const flags = triage.redFlags || {};
  const isCompleted = patient.queueStatus === 'COMPLETED';
  const decisionRecorded = ['ACCEPTED', 'OVERRIDDEN'].includes(patient.clinicianDecision);
  const assessments = [...(patient.assessments || [])].reverse();
  const probabilities = Object.entries(triage.modelProbabilities || {}).sort(([, a], [, b]) => Number(b) - Number(a));

  return (
    <div className="patient-detail-page">
      <div className="back-row">
        <Link to={isCompleted ? '/past-patients' : '/queue'}>
          <ChevronLeft size={16} />
          {isCompleted ? 'Back to past patients' : 'Back to queue'}
        </Link>
        <span className="synthetic-tag">{isCompleted ? 'COMPLETED' : 'SYNTHETIC'}</span>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status"><CheckCircle2 size={15} />{message}</div>}

      <header className="patient-header">
        <div>
          <div className="eyebrow">PATIENT REVIEW · {patient.patientId}</div>
          <h2>{patient.firstName} {patient.lastName}</h2>
          <p>{patient.age} years · {patient.sex} · arrived {new Date(patient.arrivalTime).toLocaleString()}</p>
        </div>
        <div className="header-esi">
          <span>Final priority</span>
          <EsiBadge esi={patient.finalEsi || triage.esi} />
          {decisionRecorded && <small className="decision-state">{patient.clinicianDecision === 'ACCEPTED' ? 'Clinician accepted' : 'Clinician override'}</small>}
        </div>
      </header>

      <div className="review-grid-main">
        <section className={`recommendation ${triage.action === 'IMMEDIATE_ESCALATION' ? 'critical' : ''}`}>
          <div className="rec-top">
            <div>
              <div className="eyebrow">AI RECOMMENDATION</div>
              <div className="rec-esi"><EsiBadge esi={triage.esi} /><ActionBadge action={triage.action} /></div>
            </div>
            <div className="confidence"><strong>{triage.confidence || 0}%</strong><span>{triage.confidenceBand || 'UNKNOWN'} CONFIDENCE</span></div>
          </div>

          <div className="ai-suggestion-box">
            <strong>AI suggestion</strong>
            <p>{buildAiSummary(triage)}</p>
            {(triage.reasons || []).map(reason => <p key={reason}>{reason}</p>)}
          </div>

          {probabilities.length > 0 && (
            <div className="probability-panel">
              <div className="subsection-title">Model probability distribution</div>
              {probabilities.map(([label, value]) => (
                <div className="probability-row" key={label}>
                  <span>{label}</span>
                  <div className="probability-track"><div className={`probability-fill esi-${label.replace('ESI ', '')}`} style={{ width: `${Math.min(100, Number(value) * 100)}%` }} /></div>
                  <strong>{Math.round(Number(value) * 100)}%</strong>
                </div>
              ))}
            </div>
          )}

          <div className="explain-row">
            <div><span>Age band</span><strong>{triage.ageBand || '—'}</strong></div>
            <div><span>Completeness</span><strong>{Math.round((triage.dataCompleteness || 0) * 100)}%</strong></div>
            <div><span>History</span><strong>{triage.hasHistory ? 'Available' : 'Zero-history'}</strong></div>
            <div><span>Model</span><strong>{triage.modelVersion || 'Fallback scorer'}</strong></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h3>Safety checks</h3><p>Independent high-recall prototype detectors</p></div></div>
          <div className="flags-grid">
            {[
              ['sepsis', 'Sepsis'], ['mi', 'MI'], ['stroke', 'Stroke'], ['respiratoryFailure', 'Respiratory failure']
            ].map(([key, label]) => (
              <div className={`flag-card ${flags[key]?.positive ? 'positive' : ''}`} key={key}>
                <FlagBadge positive={Boolean(flags[key]?.positive)} label={label} />
                <strong>{flags[key]?.score || 0}</strong>
                <p>{flags[key]?.reasons?.[0] || 'No trigger detected.'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="content-grid two-col">
        <section className="panel">
          <div className="panel-head"><div><h3>Clinical context</h3><p>Current presentation and bedside observations</p></div></div>
          <p className="muted">“{patient.chiefComplaint}”</p>
          <div className="signal-chips">{(patient.extractedSymptoms || []).map(signal => <span key={signal}>{signal}</span>)}</div>
          <div className="vitals-grid">{Object.entries(patient.vitals || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{formatValue(value)}</strong></div>)}</div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>Feature contributions</h3><p>Model evidence and safety signals</p></div></div>
          {(triage.featureContributions || []).length ? triage.featureContributions.map((item, index) => (
            <div className="contrib-item" key={`${item.feature}-${index}`}><div><strong>{item.feature}</strong><small>{String(item.value)}</small></div><span className={item.direction === 'INCREASES_RISK' ? 'up' : 'down'}>{item.direction === 'INCREASES_RISK' ? '+' : ''}{Math.round(item.impact || 0)}</span></div>
          )) : <p className="muted">No feature-level explanation was returned.</p>}
        </section>
      </div>

      <section className="panel history-panel">
        <div className="panel-head"><div><h3>Reassessment history</h3><p>Each assessment is preserved as a separate point in the patient timeline.</p></div><span className="history-count">{assessments.length}</span></div>
        {assessments.length ? (
          <div className="assessment-timeline">
            {assessments.map((assessment, index) => (
              <article className="assessment-item" key={`${assessment.generatedAt}-${index}`}>
                <div className="assessment-dot" />
                <div className="assessment-copy">
                  <div className="assessment-topline"><strong>{(assessment.trigger || 'ASSESSMENT').replaceAll('_', ' ')}</strong><span>{assessment.generatedAt ? new Date(assessment.generatedAt).toLocaleString() : 'Unknown time'}</span></div>
                  <div className="assessment-summary"><EsiBadge esi={assessment.esi} /><ActionBadge action={assessment.action} /><span>{assessment.confidence || 0}% confidence</span><span>{assessment.modelSource || 'PROTOTYPE'}</span></div>
                  <p>{assessment.reasons?.[0] || 'No explanation recorded.'}</p>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="muted">No prior assessments are available.</p>}
      </section>

      <section className="panel dataset-panel">
        <div className="panel-head"><div><h3>Dataset-aligned record</h3><p>All 40 train.csv columns are represented on the portal.</p></div><button className="secondary-button" type="button" onClick={() => setDatasetOpen(value => !value)}>{datasetOpen ? 'Hide fields' : 'Show all fields'}</button></div>
        {datasetOpen && <div className="dataset-table-wrap"><table className="dataset-table"><thead><tr><th>Column</th><th>Value</th><th>Role</th></tr></thead><tbody>{DATASET_COLUMNS.map(column => <tr key={column}><td><strong>{column}</strong></td><td>{formatValue(datasetRecord[column])}</td><td>{['disposition', 'ed_los_hours', 'triage_acuity'].includes(column) ? 'Outcome / label' : column === 'patient_id' ? 'Identifier' : 'Input feature'}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="panel dataset-panel">
        <div className="panel-head"><div><h3>Engineered model features</h3><p>Derived variables used by the supplied 52-feature ensemble.</p></div><button className="secondary-button" type="button" onClick={() => setEngineeredOpen(value => !value)}>{engineeredOpen ? 'Hide engineered features' : 'Show engineered features'}</button></div>
        {engineeredOpen && <div className="engineered-grid">{ENGINEERED_COLUMNS.map(column => <div className="engineered-item" key={column}><span>{column}</span><strong>{formatValue(engineeredValues[column])}</strong></div>)}</div>}
      </section>

      {!isCompleted && (
        <section className="panel action-panel">
          <div>
            <strong>Human-in-the-loop decision</strong>
            <p className="muted">AI is advisory. Every decision and reassessment is logged.</p>
            {decisionRecorded && <div className="decision-state-card" role="status"><CheckCircle2 size={16} /><div><strong>{patient.clinicianDecision === 'ACCEPTED' ? 'Recommendation accepted' : 'Clinician override recorded'}</strong><span>{patient.clinicianDecisionAt ? new Date(patient.clinicianDecisionAt).toLocaleString() : 'Timestamp unavailable'}</span></div></div>}
            {patient.lastReassessmentAt && <div className="reassessment-meta">Last reassessment: {new Date(patient.lastReassessmentAt).toLocaleString()}</div>}
            <div className="action-buttons">
              <button type="button" className="primary-button" onClick={acceptRecommendation} disabled={Boolean(busyAction) || patient.clinicianDecision === 'ACCEPTED'}><CheckCircle2 size={15} />{busyAction === 'accept' ? 'Accepting…' : 'Accept'}</button>
              <button type="button" className="warning-button" onClick={() => { setError(''); setMessage(''); setOverrideOpen(true); }} disabled={Boolean(busyAction)}>Override</button>
              <button type="button" className="secondary-button" onClick={openReassessment} disabled={Boolean(busyAction)}><RefreshCcw size={15} />Reassess</button>
              <button type="button" className="complete-button" onClick={() => { setError(''); setMessage(''); setCompletionOpen(true); }} disabled={Boolean(busyAction)}><CheckCircle2 size={15} />Mark service done</button>
            </div>
          </div>
        </section>
      )}

      {isCompleted && <section className="panel completed-banner"><CheckCircle2 size={18} /><div><strong>Service completed</strong><p>This encounter is preserved in Past Patients and remains available for retrospective review.</p></div></section>}

      <Modal open={overrideOpen} title="Override AI recommendation" onClose={() => !busyAction && setOverrideOpen(false)}>
        <div className="form-stack">
          <label>Target ESI<select value={overrideForm.targetEsi} onChange={event => setOverrideForm(current => ({ ...current, targetEsi: event.target.value }))}><option value="">Select</option>{[1, 2, 3, 4, 5].map(esi => <option key={esi} value={esi}>ESI {esi}</option>)}</select></label>
          <label>Reason<select value={overrideForm.reason} onChange={event => setOverrideForm(current => ({ ...current, reason: event.target.value }))}><option>Clinical judgement</option><option>Additional history</option><option>New vital signs</option><option>Patient distress not captured</option><option>Other</option></select></label>
          <label>Note<textarea rows="4" value={overrideForm.note} onChange={event => setOverrideForm(current => ({ ...current, note: event.target.value }))} placeholder="Add context for the override…" /></label>
          <button className="primary-button" type="button" onClick={confirmOverride} disabled={busyAction === 'override'}>{busyAction === 'override' ? 'Recording override…' : 'Confirm override'}</button>
        </div>
      </Modal>

      <Modal open={completionOpen} title="Complete patient service" onClose={() => !busyAction && setCompletionOpen(false)}>
        <div className="form-stack">
          <div className="completion-dialog-copy"><CheckCircle2 size={18} /><div><strong>Move this encounter to Past Patients?</strong><span>The record stays in MongoDB with every assessment and audit event.</span></div></div>
          <label>Completion note<textarea rows="4" value={completionNote} onChange={event => setCompletionNote(event.target.value)} placeholder="Optional service summary…" /></label>
          <button className="complete-button wide-button" type="button" onClick={confirmCompletion} disabled={busyAction === 'complete'}><CheckCircle2 size={15} />{busyAction === 'complete' ? 'Completing service…' : 'Confirm service completed'}</button>
        </div>
      </Modal>

      <Modal open={reassessmentOpen} title="Clinical reassessment" onClose={() => !busyAction && setReassessmentOpen(false)}>
        <div className="form-stack reassess-form">
          <div className="reassess-intro">
            <RefreshCcw size={16} />
            <span>Enter the latest bedside observations. The existing values are pre-filled so you only need to change what has changed.</span>
          </div>
          {error && <div className="error-banner" role="alert">{error}</div>}

          <label>Current chief complaint / new symptoms<textarea rows="3" value={reassessmentForm?.chiefComplaint || ''} onChange={event => updateReassessment('chiefComplaint', event.target.value)} placeholder="Describe any change since the previous assessment…" /></label>
          <label>Mental status<select value={reassessmentForm?.mentalStatus || 'alert'} onChange={event => updateReassessment('mentalStatus', event.target.value)}><option value="alert">Alert</option><option value="drowsy">Drowsy</option><option value="confused">Confused</option><option value="agitated">Agitated</option><option value="unresponsive">Unresponsive</option></select></label>

          <div className="form-grid two">
            <label>Heart rate<input type="number" step="0.1" value={reassessmentForm?.heartRate ?? ''} onChange={event => updateReassessment('heartRate', event.target.value)} /></label>
            <label>Respiratory rate<input type="number" step="0.1" value={reassessmentForm?.respiratoryRate ?? ''} onChange={event => updateReassessment('respiratoryRate', event.target.value)} /></label>
            <label>Systolic BP<input type="number" step="0.1" value={reassessmentForm?.systolicBP ?? ''} onChange={event => updateReassessment('systolicBP', event.target.value)} /></label>
            <label>Diastolic BP<input type="number" step="0.1" value={reassessmentForm?.diastolicBP ?? ''} onChange={event => updateReassessment('diastolicBP', event.target.value)} /></label>
            <label>Temperature °C<input type="number" step="0.1" value={reassessmentForm?.temperature ?? ''} onChange={event => updateReassessment('temperature', event.target.value)} /></label>
            <label>SpO₂ %<input type="number" step="0.1" value={reassessmentForm?.spo2 ?? ''} onChange={event => updateReassessment('spo2', event.target.value)} /></label>
            <label>Pain score<input type="number" min="0" max="10" value={reassessmentForm?.painScore ?? ''} onChange={event => updateReassessment('painScore', event.target.value)} /></label>
            <label>GCS total<input type="number" min="3" max="15" value={reassessmentForm?.gcsTotal ?? ''} onChange={event => updateReassessment('gcsTotal', event.target.value)} /></label>
            <label>NEWS2 score<input type="number" min="0" max="17" value={reassessmentForm?.news2Score ?? ''} onChange={event => updateReassessment('news2Score', event.target.value)} /></label>
          </div>

          <div className="reassess-note"><RefreshCcw size={14} /><span>A new assessment is appended to the patient timeline. Worsening results can trigger deterioration handling and a queue re-rank.</span></div>

          <div className="reassessment-actions">
            <button type="button" className="secondary-button" onClick={() => setReassessmentOpen(false)} disabled={busyAction === 'reassess'}>Cancel</button>
            <button type="button" className="primary-button" onClick={confirmReassessment} disabled={busyAction === 'reassess'}><RefreshCcw size={15} className={busyAction === 'reassess' ? 'spin' : ''} />{busyAction === 'reassess' ? 'Running reassessment…' : 'Run reassessment'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
