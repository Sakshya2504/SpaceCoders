import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../api';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const loadAuditTrail = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/audit');
      setLogs(response.data.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to load the audit trail.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditTrail();
  }, []);

  const verifyChain = async () => {
    setVerifying(true);
    setError('');

    try {
      const response = await api.get('/audit/verify');
      setVerification(response.data.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to verify the audit chain.'
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="audit-page">
      <section className="hero-small">
        <div>
          <div className="eyebrow">GOVERNANCE & TRACEABILITY</div>
          <h2>Audit trail</h2>
          <p>
            Every recommendation, reassessment and override is linked with SHA-256.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={verifyChain}
          disabled={verifying}
        >
          <ShieldCheck size={15} />
          {verifying ? 'Verifying…' : 'Verify chain'}
        </button>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {verification && (
        <div
          className={`verify-card ${verification.valid ? 'valid' : 'invalid'}`}
          role="status"
        >
          {verification.valid ? <CheckCircle2 /> : <XCircle />}
          <div>
            <strong>
              {verification.valid ? 'CHAIN VALID' : 'CHAIN INVALID'}
            </strong>
            <p>
              {verification.valid
                ? `${verification.events} events verified from GENESIS.`
                : verification.reason}
            </p>
          </div>
        </div>
      )}

      <section className="panel table-panel">
        {loading ? (
          <div className="page-loading">Loading audit events…</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Patient</th>
                  <th>Actor</th>
                  <th>Hash</th>
                  <th>Previous</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(event => (
                  <tr key={event.eventId}>
                    <td>{new Date(event.timestamp).toLocaleString()}</td>
                    <td>
                      <span className="event-pill">
                        {event.eventType.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>{event.patientId || 'SYSTEM'}</td>
                    <td>{event.actorRole}</td>
                    <td>
                      <code>{event.hash?.slice(0, 16) || '—'}…</code>
                    </td>
                    <td>
                      <code>{event.previousHash?.slice(0, 16) || '—'}…</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !logs.length && (
          <div className="empty-state">No audit events have been recorded.</div>
        )}
      </section>
    </div>
  );
}
