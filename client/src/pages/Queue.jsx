import { AlertTriangle, RefreshCw, Timer, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { ActionBadge, EsiBadge } from '../components/Badge';

function getWaitMinutes(arrivalTime) {
  const timestamp = new Date(arrivalTime).getTime();

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

function getPositiveFlags(patient) {
  return Object.values(patient.triage?.redFlags || {}).filter(
    flag => flag?.positive
  );
}

/**
 * The live queue is intentionally simple: clinicians should be able to scan
 * acuity, confidence, wait time, and active safety flags without opening every
 * patient record. Detailed evidence stays on Patient Review.
 */
export default function Queue() {
  const [patients, setPatients] = useState([]);
  const [surgeMode, setSurgeMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadQueue = async () => {
    try {
      const response = await api.get('/queue');
      const nextPatients = response.data?.data || [];

      setPatients(nextPatients);
      setSurgeMode(nextPatients.some(patient => patient.surgeMode));
      setError('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to load the live queue.'
      );
    }
  };

  useEffect(() => {
    loadQueue();

    // Refresh periodically because wait time changes even when no socket event
    // arrives. Realtime events can still update the UI faster when available.
    const timer = setInterval(loadQueue, 10000);

    return () => clearInterval(timer);
  }, []);

  const reassessNow = async () => {
    setLoading(true);
    setError('');

    try {
      await api.post('/queue/tick');
      await loadQueue();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Queue reassessment failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleSurge = async () => {
    setError('');

    try {
      await api.post('/queue/surge', { enabled: !surgeMode });
      await loadQueue();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to change operating mode.'
      );
    }
  };

  return (
    <div className="queue-page">
      <section className="hero-small">
        <div>
          <div className="eyebrow">CONTINUOUS MONITOR</div>
          <h2>Live ED queue</h2>
          <p>
            Priority is re-ranked by acuity, escalation, deterioration, and wait risk.
          </p>
        </div>

        <div className="queue-controls">
          <button
            className="secondary-button"
            type="button"
            onClick={reassessNow}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            {loading ? 'Reassessing…' : 'Reassess now'}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={toggleSurge}
          >
            <Zap size={15} />
            {surgeMode ? 'Disable surge' : 'Surge mode'}
          </button>
        </div>
      </section>

      <div className="disclaimer">
        <Timer size={13} aria-hidden="true" />
        Normal reassessment: 5 minutes · Surge: 1 minute · escalation is never silently suppressed.
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Patient</th>
                <th>ESI</th>
                <th>Confidence</th>
                <th>Wait</th>
                <th>Action</th>
                <th>Flags</th>
              </tr>
            </thead>

            <tbody>
              {patients.map(patient => {
                const flags = getPositiveFlags(patient);

                return (
                  <tr key={patient.patientId}>
                    <td>{patient.position || '—'}</td>

                    <td>
                      <Link
                        className="patient-link"
                        to={`/patients/${patient.patientId}`}
                      >
                        <strong>
                          {patient.firstName} {patient.lastName}
                        </strong>
                        <small>
                          {patient.patientId} · {patient.age}y ·{' '}
                          {patient.triage?.ageBand || 'Unknown'}
                        </small>
                      </Link>
                    </td>

                    <td>
                      <EsiBadge
                        esi={patient.finalEsi ?? patient.triage?.esi}
                      />
                    </td>

                    <td>
                      <strong>{patient.triage?.confidence || 0}%</strong>
                      <small>
                        {patient.triage?.confidenceBand || 'LOW'}
                      </small>
                    </td>

                    <td>{getWaitMinutes(patient.arrivalTime)}m</td>

                    <td>
                      <ActionBadge action={patient.triage?.action} />
                    </td>

                    <td>
                      {flags.length ? (
                        <span className="flag-count">
                          <AlertTriangle size={13} aria-hidden="true" />
                          {flags.length}
                        </span>
                      ) : (
                        <span className="muted">Clear</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!patients.length && (
          <div className="empty-state">
            No patients are currently waiting.
          </div>
        )}
      </section>
    </div>
  );
}
