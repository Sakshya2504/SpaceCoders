import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  RefreshCcw
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { ActionBadge, EsiBadge, FlagBadge } from '../components/Badge';

/*
 * Patient Review is the point where model evidence becomes a clinician decision.
 * The page therefore treats API actions as real state transitions, not cosmetic
 * button clicks: each request has loading, success, and failure feedback.
 */
export default function PatientDetail() {
  const { id } = useParams();

  const [patient, setPatient] = useState(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [isReassessOpen, setIsReassessOpen] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [overrideForm, setOverrideForm] = useState({
    targetEsi: '',
    reason: 'Clinical judgement',
    note: ''
  });

  // Reassessment represents a new bedside observation. The form starts with
  // the latest values so the clinician can change only what has changed.
  const [reassessmentForm, setReassessmentForm] = useState({
    chiefComplaint: '',
    mentalStatus: 'Alert and oriented',
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

  const loadPatient = useCallback(async () => {
    const response = await api.get(`/patients/${id}`);
    setPatient(response.data.data);
    return response.data.data;
  }, [id]);

  useEffect(() => {
    loadPatient().catch(requestError => {
      setError(
        requestError.response?.data?.message ||
          'Unable to load this patient record.'
      );
    });
  }, [loadPatient]);

  const getErrorMessage = requestError =>
    requestError.response?.data?.message ||
    requestError.response?.data?.error?.details ||
    requestError.message ||
    'The request could not be completed.';

  const runAction = async (actionName, request, successMessage) => {
    setBusyAction(actionName);
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

  const acceptRecommendation = () =>
    runAction(
      'accept',
      () => api.post(`/patients/${id}/accept`),
      'Recommendation accepted and recorded.'
    );

  const openReassessment = () => {
    const vitals = patient?.vitals || {};
    const modelFeatures = patient?.modelFeatures || {};

    setError('');
    setMessage('');
    setReassessmentForm({
      chiefComplaint: patient?.chiefComplaint || '',
      mentalStatus: patient?.mentalStatus || 'Alert and oriented',
      heartRate: vitals.heartRate ?? '',
      respiratoryRate: vitals.respiratoryRate ?? '',
      systolicBP: vitals.systolicBP ?? '',
      diastolicBP: vitals.diastolicBP ?? '',
      temperature: vitals.temperature ?? '',
      spo2: vitals.spo2 ?? '',
      painScore: vitals.painScore ?? '',
      gcsTotal: modelFeatures.gcs_total ?? 15,
      news2Score: modelFeatures.news2_score ?? 0
    });
    setIsReassessOpen(true);
  };

  const updateReassessmentField = (field, value) => {
    setReassessmentForm(current => ({
      ...current,
      [field]: value
    }));
  };

  const toNumberOrNull = value => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const confirmReassessment = () => {
    const numericValues = [
      reassessmentForm.heartRate,
      reassessmentForm.respiratoryRate,
      reassessmentForm.systolicBP,
      reassessmentForm.diastolicBP,
      reassessmentForm.temperature,
      reassessmentForm.spo2,
      reassessmentForm.painScore,
      reassessmentForm.gcsTotal,
      reassessmentForm.news2Score
    ];

    if (numericValues.some(value => toNumberOrNull(value) === null)) {
      setError('Please complete all reassessment measurements before continuing.');
      return;
    }

    const gcsTotal = toNumberOrNull(reassessmentForm.gcsTotal);
    const painScore = toNumberOrNull(reassessmentForm.painScore);
    const news2Score = toNumberOrNull(reassessmentForm.news2Score);

    if (gcsTotal < 3 || gcsTotal > 15) {
      setError('GCS must be between 3 and 15.');
      return;
    }

    if (painScore < 0 || painScore > 10) {
      setError('Pain score must be between 0 and 10.');
      return;
    }

    if (news2Score < 0 || news2Score > 17) {
      setError('NEWS2 score must be between 0 and 17.');
      return;
    }

    // Send the updated observations back through the same server-side scoring
    // contract used for the initial triage assessment.
    runAction(
      'reassess',
      () =>
        api.post(`/patients/${id}/reassess`, {
          chiefComplaint: reassessmentForm.chiefComplaint.trim(),
          mentalStatus: reassessmentForm.mentalStatus,
          vitals: {
            heartRate: toNumberOrNull(reassessmentForm.heartRate),
            respiratoryRate: toNumberOrNull(reassessmentForm.respiratoryRate),
            systolicBP: toNumberOrNull(reassessmentForm.systolicBP),
            diastolicBP: toNumberOrNull(reassessmentForm.diastolicBP),
            temperature: toNumberOrNull(reassessmentForm.temperature),
            spo2: toNumberOrNull(reassessmentForm.spo2),
            painScore
          },
          modelFeatures: {
            ...patient.modelFeatures,
            gcs_total: gcsTotal,
            news2_score: news2Score,
            mental_status_triage: reassessmentForm.mentalStatus
          }
        }),
      'Patient reassessed successfully.'
    ).then(success => {
      // Only close the form after the server has confirmed the new assessment.
      if (success) {
        setIsReassessOpen(false);
      }
    });
  };

  const confirmOverride = async () => {
    if (!overrideForm.targetEsi) {
      setError('Select a target ESI before confirming the override.');
      return;
    }

    setBusyAction('override');
    setError('');
    setMessage('');

    try {
      await api.post(`/patients/${id}/override`, {
        ...overrideForm,
        targetEsi: Number(overrideForm.targetEsi)
      });

      await loadPatient();
      setIsOverrideOpen(false);
      setOverrideForm({
        targetEsi: '',
        reason: 'Clinical judgement',
        note: ''
      });
      setMessage('Clinician override recorded.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction('');
    }
  };

  if (!patient) {
    return <div className="page-loading">Loading patient…</div>;
  }

  const triage = patient.triage || {};
  const flags = triage.redFlags || {};
  const isDecisionRecorded = ['ACCEPTED', 'OVERRIDDEN'].includes(
    patient.clinicianDecision
  );

  return (
    <div className="patient-detail-page">
      <div className="back-row">
        <Link to="/queue">
          <ChevronLeft size={16} />
          Back to queue
        </Link>
        <span className="synthetic-tag">SYNTHETIC</span>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="success-banner" role="status">
          <CheckCircle2 size={15} />
          {message}
        </div>
      )}

      <div className="patient-header">
        <div>
          <div className="eyebrow">PATIENT REVIEW · {patient.patientId}</div>
          <h2>
            {patient.firstName} {patient.lastName}
          </h2>
          <p>
            {patient.age} years · {patient.sex} · arrived{' '}
            {new Date(patient.arrivalTime).toLocaleString()}
          </p>
        </div>

        <div className="header-esi">
          <span>Final priority</span>
          <EsiBadge esi={patient.finalEsi || triage.esi} />
          {patient.clinicianDecision && patient.clinicianDecision !== 'PENDING' && (
            <small className="decision-state">
              {patient.clinicianDecision === 'ACCEPTED'
                ? 'Clinician accepted'
                : 'Clinician override'}
            </small>
          )}
        </div>
      </div>

      <div className="review-grid-main">
        <section
          className={`recommendation ${
            triage.action === 'IMMEDIATE_ESCALATION' ? 'critical' : ''
          }`}
        >
          <div className="rec-top">
            <div>
              <div className="eyebrow">AI RECOMMENDATION</div>

              <div className="rec-esi">
                <EsiBadge esi={triage.esi} />
                <ActionBadge action={triage.action} />
              </div>
            </div>

            <div className="confidence">
              <strong>{triage.confidence || 0}%</strong>
              <span>{triage.confidenceBand} CONFIDENCE</span>
            </div>
          </div>

          <div className="rec-reason">
            <AlertTriangle size={17} />
            <div>
              <strong>Why this recommendation?</strong>
              {(triage.reasons || []).map(reason => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          </div>

          <div className="explain-row">
            <div>
              <span>Age band</span>
              <strong>{triage.ageBand || '—'}</strong>
            </div>
            <div>
              <span>Completeness</span>
              <strong>{Math.round((triage.dataCompleteness || 0) * 100)}%</strong>
            </div>
            <div>
              <span>History</span>
              <strong>
                {triage.hasHistory ? 'Available' : 'Zero-history'}
              </strong>
            </div>
            <div>
              <span>Model</span>
              <strong>{triage.modelVersion || 'Fallback scorer'}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Parallel red flags</h3>
              <p>Independent prototype detectors</p>
            </div>
          </div>

          <div className="flags-grid">
            {[
              ['sepsis', 'Sepsis'],
              ['mi', 'MI'],
              ['stroke', 'Stroke'],
              ['respiratoryFailure', 'Respiratory Failure']
            ].map(([key, label]) => (
              <div
                className={`flag-card ${
                  flags[key]?.positive ? 'positive' : ''
                }`}
                key={key}
              >
                <FlagBadge
                  positive={Boolean(flags[key]?.positive)}
                  label={label}
                />
                <strong>{flags[key]?.score || 0}</strong>
                <p>
                  {flags[key]?.reasons?.[0] || 'No trigger detected.'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="content-grid two-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Clinical context</h3>
              <p>Complaint signals and current vitals</p>
            </div>
          </div>

          <p className="muted">“{patient.chiefComplaint}”</p>

          <div className="signal-chips">
            {(patient.extractedSymptoms || []).map(signal => (
              <span key={signal}>{signal}</span>
            ))}
          </div>

          <div className="vitals-grid">
            {Object.entries(patient.vitals || {}).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Feature contributions</h3>
              <p>Model evidence and safety signals</p>
            </div>
          </div>

          {(triage.featureContributions || []).length ? (
            (triage.featureContributions || []).map((contribution, index) => (
              <div
                className="contrib-item"
                key={`${contribution.feature}-${index}`}
              >
                <div>
                  <strong>{contribution.feature}</strong>
                  <small>{String(contribution.value)}</small>
                </div>
                <span className="up">
                  +{Math.round(contribution.impact || 0)}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">
              No feature-level explanation was returned for this assessment.
            </p>
          )}
        </section>
      </div>

      <section className="panel action-panel">
        <div>
          <strong>Human-in-the-loop decision</strong>
          <p className="muted">
            AI is advisory. Clinician acceptance or override is recorded.
          </p>

          {isDecisionRecorded && (
            <div className="decision-state-card" role="status">
              <CheckCircle2 size={16} />
              <div>
                <strong>
                  {patient.clinicianDecision === 'ACCEPTED'
                    ? 'Recommendation accepted'
                    : 'Clinician override recorded'}
                </strong>
                <span>
                  {patient.clinicianDecisionAt
                    ? new Date(patient.clinicianDecisionAt).toLocaleString()
                    : 'Decision timestamp unavailable'}
                </span>
              </div>
            </div>
          )}

          {patient.lastReassessmentAt && (
            <div className="reassessment-meta">
              Last reassessment:{' '}
              {new Date(patient.lastReassessmentAt).toLocaleString()}
            </div>
          )}

          <div className="action-buttons">
            <button
              type="button"
              className="primary-button"
              onClick={acceptRecommendation}
              disabled={Boolean(busyAction) || patient.clinicianDecision === 'ACCEPTED'}
            >
              <CheckCircle2 size={15} />
              {busyAction === 'accept' ? 'Accepting…' : 'Accept'}
            </button>

            <button
              type="button"
              className="warning-button"
              onClick={() => {
                setError('');
                setMessage('');
                setIsOverrideOpen(true);
              }}
              disabled={Boolean(busyAction)}
            >
              Override
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openReassessment}
              disabled={Boolean(busyAction)}
            >
              <RefreshCcw
                size={15}
                className={busyAction === 'reassess' ? 'spin' : ''}
              />
              {busyAction === 'reassess' ? 'Reassessing…' : 'Reassess'}
            </button>
          </div>
        </div>
      </section>

      {/* Reassessment captures new bedside observations before scoring again. */}
      <Modal
        open={isReassessOpen}
        title="Clinical reassessment"
        onClose={() => {
          if (!busyAction) setIsReassessOpen(false);
        }}
      >
        <div className="reassess-intro">
          Enter the patient's latest observed values. The system will run the
          triage model again using these updated observations and compare the
          result with the previous assessment.
        </div>

        <div className="form-stack reassess-form">
          <label>
            Current chief complaint
            <textarea
              rows="3"
              value={reassessmentForm.chiefComplaint}
              onChange={event =>
                updateReassessmentField('chiefComplaint', event.target.value)
              }
              placeholder="Describe any change since the last assessment…"
            />
          </label>

          <label>
            Mental status
            <select
              value={reassessmentForm.mentalStatus}
              onChange={event =>
                updateReassessmentField('mentalStatus', event.target.value)
              }
            >
              <option>Alert and oriented</option>
              <option>Alert</option>
              <option>Confused</option>
              <option>Drowsy</option>
              <option>Agitated</option>
              <option>Unresponsive</option>
            </select>
          </label>

          <div className="form-grid two">
            <label>
              Heart rate
              <input
                type="number"
                step="0.1"
                value={reassessmentForm.heartRate}
                onChange={event =>
                  updateReassessmentField('heartRate', event.target.value)
                }
              />
            </label>

            <label>
              Respiratory rate
              <input
                type="number"
                step="0.1"
                value={reassessmentForm.respiratoryRate}
                onChange={event =>
                  updateReassessmentField('respiratoryRate', event.target.value)
                }
              />
            </label>

            <label>
              Systolic BP
              <input
                type="number"
                step="0.1"
                value={reassessmentForm.systolicBP}
                onChange={event =>
                  updateReassessmentField('systolicBP', event.target.value)
                }
              />
            </label>

            <label>
              Diastolic BP
              <input
                type="number"
                step="0.1"
                value={reassessmentForm.diastolicBP}
                onChange={event =>
                  updateReassessmentField('diastolicBP', event.target.value)
                }
              />
            </label>

            <label>
              Temperature °C
              <input
                type="number"
                step="0.1"
                value={reassessmentForm.temperature}
                onChange={event =>
                  updateReassessmentField('temperature', event.target.value)
                }
              />
            </label>

            <label>
              SpO₂ %
              <input
                type="number"
                step="0.1"
                value={reassessmentForm.spo2}
                onChange={event =>
                  updateReassessmentField('spo2', event.target.value)
                }
              />
            </label>

            <label>
              Pain score
              <input
                type="number"
                min="0"
                max="10"
                value={reassessmentForm.painScore}
                onChange={event =>
                  updateReassessmentField('painScore', event.target.value)
                }
              />
            </label>

            <label>
              GCS total
              <input
                type="number"
                min="3"
                max="15"
                value={reassessmentForm.gcsTotal}
                onChange={event =>
                  updateReassessmentField('gcsTotal', event.target.value)
                }
              />
            </label>

            <label>
              NEWS2 score
              <input
                type="number"
                min="0"
                max="17"
                value={reassessmentForm.news2Score}
                onChange={event =>
                  updateReassessmentField('news2Score', event.target.value)
                }
              />
            </label>
          </div>

          <div className="reassess-note">
            <RefreshCcw size={14} />
            <span>
              These values are stored as a new assessment. A worsening result
              can trigger deterioration handling and a queue re-rank.
            </span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={confirmReassessment}
            disabled={busyAction === 'reassess'}
          >
            <RefreshCcw
              size={15}
              className={busyAction === 'reassess' ? 'spin' : ''}
            />
            {busyAction === 'reassess'
              ? 'Running reassessment…'
              : 'Run reassessment'}
          </button>
        </div>
      </Modal>

      <Modal
        open={isOverrideOpen}
        title="Override AI recommendation"
        onClose={() => {
          if (!busyAction) setIsOverrideOpen(false);
        }}
      >
        <div className="form-stack">
          <label>
            Target ESI
            <select
              value={overrideForm.targetEsi}
              onChange={event =>
                setOverrideForm(current => ({
                  ...current,
                  targetEsi: event.target.value
                }))
              }
            >
              <option value="">Select</option>
              {[1, 2, 3, 4, 5].map(value => (
                <option key={value} value={value}>
                  ESI {value}
                </option>
              ))}
            </select>
          </label>

          <label>
            Reason
            <select
              value={overrideForm.reason}
              onChange={event =>
                setOverrideForm(current => ({
                  ...current,
                  reason: event.target.value
                }))
              }
            >
              <option>Clinical judgement</option>
              <option>Additional history</option>
              <option>New vital signs</option>
              <option>Patient distress not captured</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Note
            <textarea
              rows="4"
              value={overrideForm.note}
              onChange={event =>
                setOverrideForm(current => ({
                  ...current,
                  note: event.target.value
                }))
              }
              placeholder="Add context for the override…"
            />
          </label>

          <button
            type="button"
            className="primary-button"
            onClick={confirmOverride}
            disabled={busyAction === 'override'}
          >
            {busyAction === 'override'
              ? 'Recording override…'
              : 'Confirm override'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
