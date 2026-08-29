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

/*
 * Patient Review is intentionally defensive. Records created by older versions
 * of the app may not contain every optional field, so the screen should render
 * a useful review page rather than fail with a blank browser window.
 */
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
  'ed_volume_last_2h', 'shock_index', 'pulse_pressure', 'mean_arterial_pressure',
  'rox_index', 'bsa', 'bmi', 'hr_dev', 'sys_bp_dev', 'temp_dev', 'spo2_deficit',
  'composite_vital_deviation', 'sirs_score', 'age_shock_risk', 'age_sirs_risk',
  'flag_hypoxia', 'flag_tachycardia', 'flag_hypotension', 'flag_fever',
  'total_red_flags', 'hour_sin', 'hour_cos'
];

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.details ||
    error?.message ||
    'The request could not be completed.'
  );
}

function buildDatasetRecord(patient) {
  if (!patient) return {};

  const features = patient.modelFeatures || {};
  const vitals = patient.vitals || {};
  const arrival = patient.arrivalTime ? new Date(patient.arrivalTime) : null;
  const validArrival = arrival && !Number.isNaN(arrival.getTime()) ? arrival : null;

  return {
    patient_id: patient.patientId,
    site_id: features.site_id,
    triage_nurse_id: features.triage_nurse_id,
    arrival_mode: features.arrival_mode,
    arrival_hour: features.arrival_hour ?? validArrival?.getHours(),
    arrival_day: features.arrival_day,
    arrival_month: features.arrival_month ?? (validArrival ? validArrival.getMonth() + 1 : null),
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
    triage_acuity: patient.finalEsi ?? patient.triage?.esi
  };
}

function buildAiSummary(triage) {
  switch (triage.action) {
    case 'IMMEDIATE_ESCALATION':
      return 'Immediate clinician review is required because the safety layer or the acuity model identified a high-risk presentation.';
    case 'ABSTAIN_AND_ESCALATE':
      return 'The system is uncertain. Treat the recommendation as an escalation prompt and verify the current clinical picture.';
    case 'FAIL_OPEN':
      return 'The model was unavailable. The application has failed open and requires manual triage.';
    default:
      return 'The model recommendation is decision support only. Confirm it against the latest bedside assessment before accepting it.';
  }
}

function SafeMessage({ message, type }) {
  if (!message) return null;
  return (
    <div className={`${type}-banner`} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'success' && <CheckCircle2 size={15} />}
      {message}
    </div>
  );
}

export default function PatientDetailV2() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [reassessmentOpen, setReassessmentOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [engineeredOpen, setEngineeredOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [reassessment, setReassessment] = useState(null);
  const [override, setOverride] = useState({
    targetEsi: '',
    reason: 'Clinical judgement',
    note: ''
  });

  const loadPatient = useCallback(async () => {
    const response = await api.get(`/patients/${id}`);
    const record = response.data?.data;

    if (!record) {
      throw new Error('The API returned an empty patient record.');
    }

    setPatient(record);
    return record;
  }, [id]);

  useEffect(() => {
    loadPatient().catch(requestError => setError(getErrorMessage(requestError)));
  }, [loadPatient]);

  const runAction = async (name, request, successMessage) => {
    setBusyAction(name);
    setError('');
    setMessage('');

    try {
      await request();
      await loadPatient();
      setMessage(successMessage);
      return true;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      return false;
    } finally {
      setBusyAction('');
    }
  };

  const openReassessment = () => {
    const vitals = patient?.vitals || {};
    const features = patient?.modelFeatures || {};

    setError('');
    setReassessment({
      chiefComplaint: patient?.chiefComplaint || '',
      mentalStatus: features.mental_status_triage || patient?.mentalStatus || 'alert',
      heartRate: vitals.heartRate ?? features.heart_rate ?? '',
      respiratoryRate: vitals.respiratoryRate ?? features.respiratory_rate ?? '',
      systolicBP: vitals.systolicBP ?? features.systolic_bp ?? '',
      diastolicBP: vitals.diastolicBP ?? features.diastolic_bp ?? '',
      temperature: vitals.temperature ?? features.temperature_c ?? '',
      spo2: vitals.spo2 ?? features.spo2 ?? '',
      painScore: vitals.painScore ?? features.pain_score ?? '',
      gcsTotal: features.gcs_total ?? 15,
      news2Score: features.news2_score ?? 0
    });
    setReassessmentOpen(true);
  };

  const updateReassessment = (field, value) => {
    setReassessment(current => ({ ...current, [field]: value }));
  };

  const confirmReassessment = () => {
    if (!reassessment) return;

    const numericKeys = [
      'heartRate', 'respiratoryRate', 'systolicBP', 'diastolicBP',
      'temperature', 'spo2', 'painScore', 'gcsTotal', 'news2Score'
    ];
    const values = Object.fromEntries(numericKeys.map(key => [key, Number(reassessment[key])]));

    if (numericKeys.some(key => !Number.isFinite(values[key]))) {
      setError('Please complete every reassessment measurement.');
      return;
    }
    if (values.gcsTotal < 3 || values.gcsTotal > 15) {
      setError('GCS must be between 3 and 15.');
      return;
    }
    if (values.painScore < 0 || values.painScore > 10) {
      setError('Pain score must be between 0 and 10.');
      return;
    }
    if (values.news2Score < 0 || values.news2Score > 17) {
      setError('NEWS2 score must be between 0 and 17.');
      return;
    }

    runAction(
      'reassess',
      () => api.post(`/patients/${id}/reassess`, {
        chiefComplaint: reassessment.chiefComplaint.trim(),
        mentalStatus: reassessment.mentalStatus,
        vitals: {
          heartRate: values.heartRate,
          respiratoryRate: values.respiratoryRate,
          systolicBP: values.systolicBP,
          diastolicBP: values.diastolicBP,
          temperature: values.temperature,
          spo2: values.spo2,
          painScore: values.painScore
        },
        modelFeatures: {
          ...(patient.modelFeatures || {}),
          gcs_total: values.gcsTotal,
          news2_score: values.news2Score,
          mental_status_triage: reassessment.mentalStatus
        }
      }),
      'Reassessment completed. Review the new recommendation before accepting it.'
    ).then(success => {
      if (success) setReassessmentOpen(false);
    });
  };

  const acceptRecommendation = () =>
    runAction(
      'accept',
      () => api.post(`/patients/${id}/accept`),
      'Recommendation accepted and recorded.'
    );

  const confirmOverride = () => {
    const targetEsi = Number(override.targetEsi);

    if (!Number.isInteger(targetEsi) || targetEsi < 1 || targetEsi > 5) {
      setError('Select an ESI from 1 to 5.');
      return;
    }

    runAction(
      'override',
      () => api.post(`/patients/${id}/override`, {
        ...override,
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
      'Patient service completed. The encounter is now in Past Patients.'
    ).then(success => {
      if (success) {
        setCompletionOpen(false);
        setCompletionNote('');
      }
    });

  const datasetRecord = useMemo(() => buildDatasetRecord(patient), [patient]);
  const engineeredValues = useMemo(() => {
    const features = patient?.modelFeatures || {};
    return Object.fromEntries(
      ENGINEERED_COLUMNS.map(column => [column, features[column]])
    );
  }, [patient]);

  if (!patient) {
    return (
      <div className="page-loading">
        {error ? <SafeMessage type="error" message={error} /> : 'Loading patient…'}
      </div>
    );
  }

  const triage = patient.triage || {};
  const flags = triage.redFlags || {};
  const assessments = Array.isArray(patient.assessments)
    ? [...patient.assessments].reverse()
    : [];
  const probabilities = Object.entries(triage.modelProbabilities || {})
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort(([, a], [, b]) => Number(b) - Number(a));
  const isCompleted = patient.queueStatus === 'COMPLETED';
  const decisionRecorded = ['ACCEPTED', 'OVERRIDDEN'].includes(patient.clinicianDecision);

  return (
    <div className="patient-detail-page">
      <div className="back-row">
        <Link to={isCompleted ? '/past-patients' : '/queue'}>
          <ChevronLeft size={16} />
          {isCompleted ? 'Back to past patients' : 'Back to queue'}
        </Link>
        <span className="synthetic-tag">{isCompleted ? 'COMPLETED' : 'SYNTHETIC'}</span>
      </div>

      <SafeMessage type="error" message={error} />
      <SafeMessage type="success" message={message} />

      <header className="patient-header">
        <div>
          <div className="eyebrow">PATIENT REVIEW · {patient.patientId || 'UNASSIGNED'}</div>
          <h2>{patient.firstName || 'Unknown'} {patient.lastName || 'patient'}</h2>
          <p>
            {formatValue(patient.age)} years · {formatValue(patient.sex)} · arrived{' '}
            {patient.arrivalTime ? new Date(patient.arrivalTime).toLocaleString() : '—'}
          </p>
        </div>
        <div className="header-esi">
          <span>Final priority</span>
          <EsiBadge esi={patient.finalEsi ?? triage.esi} />
          {decisionRecorded && (
            <small className="decision-state">
              {patient.clinicianDecision === 'ACCEPTED' ? 'Clinician accepted' : 'Clinician override'}
            </small>
          )}
        </div>
      </header>

      <div className="review-grid-main">
        <section className={`recommendation ${triage.action === 'IMMEDIATE_ESCALATION' ? 'critical' : ''}`}>
          <div className="rec-top">
            <div>
              <div className="eyebrow">AI RECOMMENDATION</div>
              <div className="rec-esi">
                <EsiBadge esi={triage.esi} />
                <ActionBadge action={triage.action} />
              </div>
            </div>
            <div className="confidence">
              <strong>{formatValue(triage.confidence || 0)}%</strong>
              <span>{triage.confidenceBand || 'UNKNOWN'} CONFIDENCE</span>
            </div>
          </div>

          <div className="ai-suggestion-box">
            <strong>AI suggestion</strong>
            <p>{buildAiSummary(triage)}</p>
            {(triage.reasons || []).map(reason => <p key={reason}>{reason}</p>)}
          </div>

          {probabilities.length > 0 && (
            <div className="probability-panel">
              <div className="subsection-title">Model probability distribution</div>
              {probabilities.map(([label, value]) => {
                const percentage = Math.min(100, Math.max(0, Number(value) * 100));
                return (
                  <div className="probability-row" key={label}>
                    <span>{label}</span>
                    <div className="probability-track">
                      <div className="probability-fill" style={{ width: `${percentage}%` }} />
                    </div>
                    <strong>{Math.round(percentage)}%</strong>
                  </div>
                );
              })}
            </div>
          )}

          <div className="explain-row">
            <div><span>Age band</span><strong>{triage.ageBand || datasetRecord.age_group || '—'}</strong></div>
            <div><span>Completeness</span><strong>{formatValue(triage.dataCompleteness || 0)}%</strong></div>
            <div><span>History</span><strong>{triage.hasHistory ? 'Available' : 'Zero-history'}</strong></div>
            <div><span>Model</span><strong>{triage.modelVersion || triage.modelSource || '—'}</strong></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h3>Safety checks</h3><p>Independent high-recall prototype detectors</p></div>
          </div>
          <div className="flags-grid">
            {[
              ['sepsis', 'Sepsis'],
              ['mi', 'MI'],
              ['stroke', 'Stroke'],
              ['respiratoryFailure', 'Respiratory failure']
            ].map(([key, label]) => (
              <div className={`flag-card ${flags[key]?.positive ? 'positive' : ''}`} key={key}>
                <FlagBadge positive={Boolean(flags[key]?.positive)} label={label} />
                <strong>{formatValue(flags[key]?.score || 0)}</strong>
                <p>{flags[key]?.reasons?.[0] || 'No trigger detected.'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="content-grid two-col">
        <section className="panel">
          <div className="panel-head"><div><h3>Clinical context</h3><p>Current presentation and bedside observations</p></div></div>
          <p className="muted">“{patient.chiefComplaint || 'No complaint recorded.'}”</p>
          <div className="signal-chips">
            {(patient.extractedSymptoms || []).map(signal => <span key={signal}>{signal}</span>)}
          </div>
          <div className="vitals-grid">
            {Object.entries(patient.vitals || {}).map(([key, value]) => (
              <div key={key}><span>{key}</span><strong>{formatValue(value)}</strong></div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h3>Model evidence</h3><p>Returned explanation signals</p></div></div>
          {(triage.featureContributions || []).length > 0 ? (
            triage.featureContributions.map((item, index) => (
              <div className="contrib-item" key={`${item.feature}-${index}`}>
                <div><strong>{item.feature || 'Feature'}</strong><small>{formatValue(item.value)}</small></div>
                <span className={item.direction === 'INCREASES_RISK' ? 'up' : 'down'}>
                  {item.direction === 'INCREASES_RISK' ? '+' : ''}{Math.round(item.impact || 0)}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No feature-level explanation was returned by the current model artifact.</p>
          )}
        </section>
      </div>

      <section className="panel history-panel">
        <div className="panel-head">
          <div><h3>Reassessment history</h3><p>Each model run is retained for review.</p></div>
          <span className="history-count">{assessments.length}</span>
        </div>
        {assessments.length === 0 ? (
          <p className="muted">No assessment history is available.</p>
        ) : (
          <div className="assessment-timeline">
            {assessments.map((assessment, index) => (
              <article className="assessment-item" key={`${assessment.generatedAt || 'assessment'}-${index}`}>
                <div className="assessment-dot" />
                <div className="assessment-copy">
                  <div className="assessment-topline">
                    <strong>{String(assessment.trigger || 'ASSESSMENT').replaceAll('_', ' ')}</strong>
                    <span>{assessment.generatedAt ? new Date(assessment.generatedAt).toLocaleString() : '—'}</span>
                  </div>
                  <div className="assessment-summary">
                    <EsiBadge esi={assessment.esi} />
                    <ActionBadge action={assessment.action} />
                    <span>{formatValue(assessment.confidence || 0)}% confidence</span>
                    <span>{assessment.modelSource || '—'}</span>
                  </div>
                  <p>{assessment.reasons?.[0] || 'No explanation recorded.'}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel dataset-panel">
        <div className="panel-head">
          <div><h3>Dataset-aligned record</h3><p>All 40 train.csv columns are visible here.</p></div>
          <button type="button" className="secondary-button" onClick={() => setDatasetOpen(value => !value)}>
            {datasetOpen ? 'Hide fields' : 'Show all 40 columns'}
          </button>
        </div>
        {datasetOpen && (
          <div className="dataset-table-wrap">
            <table className="dataset-table">
              <thead><tr><th>Column</th><th>Value</th><th>Role</th></tr></thead>
              <tbody>
                {DATASET_COLUMNS.map(column => (
                  <tr key={column}>
                    <td><strong>{column}</strong></td>
                    <td>{formatValue(datasetRecord[column])}</td>
                    <td>{['disposition', 'ed_los_hours', 'triage_acuity'].includes(column) ? 'Outcome / label' : column === 'patient_id' ? 'Identifier' : 'Training feature'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel dataset-panel">
        <div className="panel-head">
          <div><h3>Engineered ensemble features</h3><p>Derived values used by the final inference pipeline.</p></div>
          <button type="button" className="secondary-button" onClick={() => setEngineeredOpen(value => !value)}>
            {engineeredOpen ? 'Hide engineered features' : 'Show engineered features'}
          </button>
        </div>
        {engineeredOpen && (
          <div className="engineered-grid">
            {ENGINEERED_COLUMNS.map(column => (
              <div className="engineered-item" key={column}>
                <span>{column}</span>
                <strong>{formatValue(engineeredValues[column])}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {!isCompleted ? (
        <section className="panel action-panel">
          <div>
            <strong>Human-in-the-loop decision</strong>
            <p className="muted">The model recommends; the clinician accepts, overrides, or reassesses.</p>
            {decisionRecorded && (
              <div className="decision-state-card" role="status">
                <CheckCircle2 size={16} />
                <div>
                  <strong>{patient.clinicianDecision === 'ACCEPTED' ? 'Recommendation accepted' : 'Clinician override recorded'}</strong>
                  <span>{patient.clinicianDecisionAt ? new Date(patient.clinicianDecisionAt).toLocaleString() : 'Timestamp unavailable'}</span>
                </div>
              </div>
            )}
            {patient.lastReassessmentAt && (
              <div className="reassessment-meta">Last reassessment: {new Date(patient.lastReassessmentAt).toLocaleString()}</div>
            )}
            <div className="action-buttons">
              <button type="button" className="primary-button" onClick={acceptRecommendation} disabled={Boolean(busyAction) || patient.clinicianDecision === 'ACCEPTED'}>
                <CheckCircle2 size={15} />{busyAction === 'accept' ? 'Accepting…' : 'Accept'}
              </button>
              <button type="button" className="warning-button" onClick={() => setOverrideOpen(true)} disabled={Boolean(busyAction)}>Override</button>
              <button type="button" className="secondary-button" onClick={openReassessment} disabled={Boolean(busyAction)}>
                <RefreshCcw size={15} />{busyAction === 'reassess' ? 'Reassessing…' : 'Reassess'}
              </button>
              <button type="button" className="complete-button" onClick={() => setCompletionOpen(true)} disabled={Boolean(busyAction)}>
                <CheckCircle2 size={15} />Mark service done
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="panel completed-banner">
          <CheckCircle2 size={18} />
          <div><strong>Service completed</strong><p>This encounter remains available in Past Patients.</p></div>
        </section>
      )}

      <Modal open={reassessmentOpen} title="Clinical reassessment" onClose={() => !busyAction && setReassessmentOpen(false)}>
        <div className="form-stack">
          <div className="reassess-note">
            <RefreshCcw size={14} />
            Enter the latest observed values. A new model assessment is stored alongside the previous history.
          </div>
          <label>Current complaint / change<textarea rows="3" value={reassessment?.chiefComplaint || ''} onChange={event => updateReassessment('chiefComplaint', event.target.value)} /></label>
          <label>Mental status<select value={reassessment?.mentalStatus || ''} onChange={event => updateReassessment('mentalStatus', event.target.value)}><option value="alert">Alert</option><option value="drowsy">Drowsy</option><option value="confused">Confused</option><option value="agitated">Agitated</option><option value="unresponsive">Unresponsive</option></select></label>
          <div className="form-grid two">
            {[
              ['heartRate', 'Heart rate'], ['respiratoryRate', 'Respiratory rate'],
              ['systolicBP', 'Systolic BP'], ['diastolicBP', 'Diastolic BP'],
              ['temperature', 'Temperature °C'], ['spo2', 'SpO₂ %'],
              ['painScore', 'Pain score'], ['gcsTotal', 'GCS total'], ['news2Score', 'NEWS2 score']
            ].map(([field, label]) => (
              <label key={field}>{label}<input type="number" step="0.1" value={reassessment?.[field] ?? ''} onChange={event => updateReassessment(field, event.target.value)} /></label>
            ))}
          </div>
          <button type="button" className="primary-button" onClick={confirmReassessment} disabled={busyAction === 'reassess'}>
            <RefreshCcw size={15} />{busyAction === 'reassess' ? 'Running reassessment…' : 'Run reassessment'}
          </button>
        </div>
      </Modal>

      <Modal open={overrideOpen} title="Override AI recommendation" onClose={() => !busyAction && setOverrideOpen(false)}>
        <div className="form-stack">
          <label>Target ESI<select value={override.targetEsi} onChange={event => setOverride(current => ({ ...current, targetEsi: event.target.value }))}><option value="">Select</option>{[1, 2, 3, 4, 5].map(esi => <option key={esi} value={esi}>ESI {esi}</option>)}</select></label>
          <label>Reason<select value={override.reason} onChange={event => setOverride(current => ({ ...current, reason: event.target.value }))}><option>Clinical judgement</option><option>Additional history</option><option>New vital signs</option><option>Patient distress not captured</option><option>Other</option></select></label>
          <label>Note<textarea rows="4" value={override.note} onChange={event => setOverride(current => ({ ...current, note: event.target.value }))} placeholder="Add clinical context…" /></label>
          <button type="button" className="primary-button" onClick={confirmOverride} disabled={busyAction === 'override'}>{busyAction === 'override' ? 'Recording override…' : 'Confirm override'}</button>
        </div>
      </Modal>

      <Modal open={completionOpen} title="Complete patient service" onClose={() => !busyAction && setCompletionOpen(false)}>
        <div className="form-stack">
          <div className="completion-dialog-copy"><AlertTriangle size={18} /><div><strong>Mark this encounter as completed?</strong><span>The record will leave the active queue and remain available in Past Patients.</span></div></div>
          <label>Completion note<textarea rows="4" value={completionNote} onChange={event => setCompletionNote(event.target.value)} placeholder="Optional service summary…" /></label>
          <button type="button" className="complete-button wide-button" onClick={confirmCompletion} disabled={busyAction === 'complete'}>
            {busyAction === 'complete' ? 'Completing service…' : 'Confirm completion'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
