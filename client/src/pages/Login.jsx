import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, HeartPulse, ShieldCheck, Sparkles } from 'lucide-react';
import api from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'charge@patienttriage.demo', password: 'demo123' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await api.post('/auth/login', form);
      localStorage.setItem('pt_token', response.data.data.token);
      localStorage.setItem('pt_user', JSON.stringify(response.data.data.user));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-overlay" />
        <div className="auth-visual-content">
          <div className="auth-logo"><HeartPulse size={20} /> PatientTriage<span>.ai</span></div>
          <div className="auth-visual-copy">
            <div className="auth-kicker"><Sparkles size={14} /> CLINICAL INTELLIGENCE</div>
            <h1>Clearer triage.<br />Faster decisions.</h1>
            <p>Bring patient context, acuity signals, red flags and queue risk into one safety-first workspace.</p>
          </div>
          <div className="auth-feature-row">
            <div><ShieldCheck size={16} /><span>Human-in-the-loop</span></div>
            <div><HeartPulse size={16} /><span>Realtime monitoring</span></div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-form-wrap">
          <div className="mobile-brand"><HeartPulse size={18} /> PatientTriage<span>.ai</span></div>
          <div className="auth-eyebrow">SECURE ACCESS</div>
          <h2>Welcome back</h2>
          <p className="auth-intro">Sign in to access the emergency care command centre.</p>

          <form onSubmit={submit} className="form-stack auth-form">
            <label>Email address
              <input type="email" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="name@hospital.org" />
            </label>
            <label>Password
              <input type="password" autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Enter your password" />
            </label>
            {error && <div className="error-banner">{error}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="auth-demo-card">
            <div><strong>Demo access</strong><span>Charge nurse workspace</span></div>
            <code>charge@patienttriage.demo</code>
            <code>demo123</code>
          </div>

          <p className="auth-footer">New to the platform? <Link to="/signup">Create an account</Link></p>
          <p className="auth-safety">Synthetic data environment · Decision support only · Clinician remains responsible.</p>
        </div>
      </div>
    </div>
  );
}
