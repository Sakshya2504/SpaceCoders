import {
  Activity,
  AlertTriangle,
  Clock3,
  HeartPulse,
  ShieldCheck,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// The dashboard is intentionally an operational summary rather than a clinical record.
// Detailed patient information stays on the Patient Review screen.
const KPI_CARDS = [
  { Icon: Users, label: 'Patients today', key: 'patientsToday' },
  { Icon: Clock3, label: 'Waiting', key: 'waiting' },
  { Icon: AlertTriangle, label: 'Critical · ESI 1–2', key: 'critical' },
  { Icon: HeartPulse, label: 'High risk', key: 'highRisk' },
  { Icon: Activity, label: 'Reassessment due', key: 'reassessmentDue' }
];

function formatEventType(value) {
  return String(value || 'SYSTEM EVENT').replaceAll('_', ' ');
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setRefreshing(true);
    setError('');

    try {
      const [summaryResponse, metricsResponse] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/metrics')
      ]);

      setSummary(summaryResponse.data.data);
      setMetrics(metricsResponse.data.data);
    } catch (requestError) {
      // Keep the last successful dashboard visible when a refresh fails.
      // This is safer than replacing operational data with a blank screen.
      setError(requestError.response?.data?.message || 'Unable to refresh dashboard');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    // A 15-second refresh keeps the overview useful even when the user is not
    // actively navigating. Socket events provide faster updates for urgent alerts.
    const timer = setInterval(loadDashboard, 15000);
    return () => clearInterval(timer);
  }, []);

  if (!summary) {
    return (
      <div className="page-loading">
        <Activity className="spin" size={20} />
        Loading command centre…
      </div>
    );
  }

  const totalPatients = summary.patientsToday || 0;
  const activeAlerts = summary.activeAlerts || 0;
  const averageConfidence = summary.avgConfidence || 0;

  return (
    <div className="dashboard-page">
      <section className={`operations-hero ${summary.surgeMode ? 'surge' : ''}`}>
        <div>
          <div className="hero-status">
            <span className="live-dot" />
            LIVE OPERATIONS
          </div>
          <h2>Emergency care at a glance</h2>
          <p>
            Monitor acuity, surface risk early, and keep every triage decision visible to the care team.
          </p>
        </div>

        <div className="hero-actions">
          <div className={`mode-pill ${summary.surgeMode ? 'surge-pill' : ''}`}>
            <span className="mode-dot" />
            {summary.surgeMode ? 'High-volume mode' : 'Standard operations'}
          </div>
          <button className="secondary-button" onClick={loadDashboard} disabled={refreshing}>
            <Activity size={15} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="kpi-grid">
        {KPI_CARDS.map(({ Icon, label, key }) => (
          <div
            className={`kpi-card ${key === 'critical' && summary[key] ? 'kpi-critical' : ''}`}
            key={key}
          >
            <div className="kpi-icon"><Icon size={18} /></div>
            <div className="kpi-copy">
              <span>{label}</span>
              <strong>{summary[key] ?? 0}</strong>
            </div>
          </div>
        ))}

        <div className="kpi-card">
          <div className="kpi-icon"><ShieldCheck size={18} /></div>
          <div className="kpi-copy">
            <span>Average confidence</span>
            <strong>{averageConfidence}%</strong>
          </div>
        </div>

        <div className={`kpi-card ${activeAlerts ? 'kpi-critical' : ''}`}>
          <div className="kpi-icon"><AlertTriangle size={18} /></div>
          <div className="kpi-copy">
            <span>Active alerts</span>
            <strong>{activeAlerts}</strong>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">ACUITY OVERVIEW</span>
              <h3>Current priority mix</h3>
              <p>{totalPatients} patients across all acuity levels</p>
            </div>
          </div>

          <div className="acuity-list">
            {(summary.esi || []).map(item => {
              const share = totalPatients
                ? Math.round((item.value / totalPatients) * 100)
                : 0;

              return (
                <div className="acuity-row" key={item.name}>
                  <div className="acuity-label">
                    <strong>{item.name}</strong>
                    <span>{item.value} patients</span>
                  </div>
                  <div className="acuity-track">
                    <div
                      className={`acuity-fill ${String(item.name).toLowerCase().replace(' ', '-')}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <strong className="acuity-share">{share}%</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel safety-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">SAFETY GUARDRAILS</span>
              <h3>Decision handling</h3>
              <p>Rules that keep uncertainty visible</p>
            </div>
          </div>

          <div className="guardrail critical">
            <span className="guardrail-icon"><AlertTriangle size={15} /></span>
            <div>
              <strong>Red flag → escalate</strong>
              <p>Independent detectors can interrupt the normal ranking flow.</p>
            </div>
          </div>

          <div className="guardrail caution">
            <span className="guardrail-icon"><Activity size={15} /></span>
            <div>
              <strong>Low confidence → review</strong>
              <p>Incomplete or conflicting data is routed to clinician review.</p>
            </div>
          </div>

          <div className="guardrail safe">
            <span className="guardrail-icon"><ShieldCheck size={15} /></span>
            <div>
              <strong>System failure → manual path</strong>
              <p>Clinical workflow continues without waiting for the model.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="dashboard-grid bottom-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">ACTIVITY</span>
              <h3>Recent events</h3>
              <p>{metrics?.recent?.length || 0} latest events</p>
            </div>
            <Link className="secondary-button" to="/audit">View audit</Link>
          </div>

          <div className="activity-list">
            {(metrics?.recent || []).slice(0, 6).map(event => (
              <div className="activity-item" key={event.eventId}>
                <span className="activity-line-dot" />
                <div>
                  <strong>{formatEventType(event.eventType)}</strong>
                  <small>
                    {event.patientId || 'SYSTEM'} · {new Date(event.timestamp).toLocaleString()}
                  </small>
                </div>
              </div>
            ))}

            {!metrics?.recent?.length && (
              <div className="empty-state">No recent events.</div>
            )}
          </div>
        </section>

        <section className="panel action-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">QUICK ACTIONS</span>
              <h3>Care team workspace</h3>
              <p>Move from overview to action in one click.</p>
            </div>
          </div>

          <div className="action-grid">
            <Link className="action-card primary-action" to="/intake">
              <strong>New patient</strong>
              <span>Capture intake and score acuity</span>
            </Link>
            <Link className="action-card" to="/queue">
              <strong>Live queue</strong>
              <span>Review rank, wait and alerts</span>
            </Link>
            <Link className="action-card" to="/audit">
              <strong>Audit trail</strong>
              <span>Trace every system decision</span>
            </Link>
          </div>

          <div className="trust-strip">
            <ShieldCheck size={15} />
            <span>Clinician stays in control of the final priority.</span>
            <strong>{activeAlerts} active alert{activeAlerts === 1 ? '' : 's'}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}
