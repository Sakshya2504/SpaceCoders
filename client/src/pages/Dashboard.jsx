import { AlertTriangle, Activity, Clock3, HeartPulse, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const cards = [
  [Users, 'Patients today', 'patientsToday'],
  [Clock3, 'Waiting', 'waiting'],
  [AlertTriangle, 'Critical · ESI 1–2', 'critical'],
  [HeartPulse, 'High risk', 'highRisk'],
  [Activity, 'Reassessment due', 'reassessmentDue'],
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [summary, metricResponse] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/metrics')
      ]);
      setData(summary.data.data);
      setMetrics(metricResponse.data.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return <div className="page-loading"><Activity className="spin" size={20} /> Loading command centre…</div>;

  const total = data.patientsToday || 0;
  const activeAlerts = data.activeAlerts || 0;
  const confidence = data.avgConfidence || 0;

  return (
    <div className="dashboard-page">
      <section className={`operations-hero ${data.surgeMode ? 'surge' : ''}`}>
        <div>
          <div className="hero-status"><span className="live-dot" /> LIVE OPERATIONS</div>
          <h2>Emergency care at a glance</h2>
          <p>Monitor acuity, surface risk early, and keep every triage decision visible to the care team.</p>
        </div>
        <div className="hero-actions">
          <div className={`mode-pill ${data.surgeMode ? 'surge-pill' : ''}`}>
            <span className="mode-dot" /> {data.surgeMode ? 'High-volume mode' : 'Standard operations'}
          </div>
          <button className="secondary-button" onClick={load} disabled={refreshing}>
            <Activity size={15} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </section>

      <section className="kpi-grid">
        {cards.map(([Icon, label, key]) => (
          <div className={`kpi-card ${key === 'critical' && data[key] ? 'kpi-critical' : ''}`} key={key}>
            <div className="kpi-icon"><Icon size={18} /></div>
            <div className="kpi-copy">
              <span>{label}</span>
              <strong>{data[key] ?? 0}</strong>
            </div>
          </div>
        ))}
        <div className="kpi-card">
          <div className="kpi-icon"><ShieldCheck size={18} /></div>
          <div className="kpi-copy"><span>Average confidence</span><strong>{confidence}%</strong></div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div><span className="section-kicker">ACUITY OVERVIEW</span><h3>Current priority mix</h3><p>{total} patients across all acuity levels</p></div>
          </div>
          <div className="acuity-list">
            {(data.esi || []).map(item => {
              const share = total ? Math.round((item.value / total) * 100) : 0;
              return (
                <div className="acuity-row" key={item.name}>
                  <div className="acuity-label"><strong>{item.name}</strong><span>{item.value} patients</span></div>
                  <div className="acuity-track"><div className={`acuity-fill ${item.name.toLowerCase().replace(' ', '-')}`} style={{ width: `${share}%` }} /></div>
                  <strong className="acuity-share">{share}%</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel safety-panel">
          <div className="panel-head"><div><span className="section-kicker">SAFETY GUARDRAILS</span><h3>Decision handling</h3><p>Rules that keep uncertainty visible</p></div></div>
          <div className="guardrail critical"><span className="guardrail-icon"><AlertTriangle size={15} /></span><div><strong>Red flag → escalate</strong><p>Independent detectors can interrupt the normal ranking flow.</p></div></div>
          <div className="guardrail caution"><span className="guardrail-icon"><Activity size={15} /></span><div><strong>Low confidence → review</strong><p>Incomplete or conflicting data is routed to clinician review.</p></div></div>
          <div className="guardrail safe"><span className="guardrail-icon"><ShieldCheck size={15} /></span><div><strong>System failure → manual path</strong><p>Clinical workflow continues without waiting for the model.</p></div></div>
        </section>
      </div>

      <div className="dashboard-grid bottom-grid">
        <section className="panel">
          <div className="panel-head"><div><span className="section-kicker">ACTIVITY</span><h3>Recent events</h3><p>{metrics?.recent?.length || 0} latest events</p></div><Link className="secondary-button" to="/audit">View audit</Link></div>
          <div className="activity-list">
            {(metrics?.recent || []).slice(0, 6).map(event => (
              <div className="activity-item" key={event.eventId}>
                <span className="activity-line-dot" />
                <div><strong>{String(event.eventType || '').replaceAll('_', ' ')}</strong><small>{event.patientId || 'SYSTEM'} · {new Date(event.timestamp).toLocaleString()}</small></div>
              </div>
            ))}
            {!metrics?.recent?.length && <div className="empty-state">No recent events.</div>}
          </div>
        </section>

        <section className="panel action-panel">
          <div className="panel-head"><div><span className="section-kicker">QUICK ACTIONS</span><h3>Care team workspace</h3><p>Move from overview to action in one click.</p></div></div>
          <div className="action-grid">
            <Link className="action-card primary-action" to="/intake"><strong>New patient</strong><span>Capture intake and score acuity</span></Link>
            <Link className="action-card" to="/queue"><strong>Live queue</strong><span>Review rank, wait and alerts</span></Link>
            <Link className="action-card" to="/audit"><strong>Audit trail</strong><span>Trace every system decision</span></Link>
          </div>
          <div className="trust-strip"><ShieldCheck size={15} /><span>Clinician stays in control of the final priority.</span><strong>{activeAlerts} active alert{activeAlerts === 1 ? '' : 's'}</strong></div>
        </section>
      </div>
    </div>
  );
}
