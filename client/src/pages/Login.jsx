import { ArrowRight, HeartPulse, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

// Keep the demo account convenient for local evaluation, while still allowing
// the user to replace the credentials with their own account.
const INITIAL_FORM = {
  email: 'charge@patienttriage.demo',
  password: 'demo123'
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const updateField = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const response = await api.post('/auth/login', form);
      const { token, user } = response.data.data;

      localStorage.setItem('pt_token', token);
      localStorage.setItem('pt_user', JSON.stringify(user));
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual" aria-hidden="true">
        <div className="auth-visual-overlay" />
        <div className="auth-visual-content">
          <div className="auth-logo">
            <HeartPulse size={20} />
            PatientTriage<span>.ai</span>
          </div>

          <div className="auth-visual-copy">
            <div className="auth-kicker">
              <Sparkles size={14} />
              CLINICAL INTELLIGENCE
            </div>
            <h1>Clearer triage.<br />Faster decisions.</h1>
            <p>
              Bring patient context, acuity signals, red flags and queue risk into one safety-first workspace.
            </p>
          </div>

          <div className="auth-feature-row">
            <div><ShieldCheck size={16} /><span>Human-in-the-loop</span></div>
            <div><HeartPulse size={16} /><span>Realtime monitoring</span></div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-form-wrap">
          <div className="mobile-brand">
            <HeartPulse size={18} />
            PatientTriage<span>.ai</span>
          </div>

          <div className="auth-eyebrow">SECURE ACCESS</div>
          <h2>Welcome back</h2>
          <p className="auth-intro">
            Sign in to access the emergency care command centre.
          </p>

          <form onSubmit={submit} className="form-stack auth-form">
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={event => updateField('email', event.target.value)}
                placeholder="name@hospital.org"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={event => updateField('password', event.target.value)}
                placeholder="Enter your password"
              />
            </label>

            {error && <div className="error-banner" role="alert">{error}</div>}

            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="auth-demo-card">
            <div>
              <strong>Demo access</strong>
              <span>Charge nurse workspace</span>
            </div>
            <code>charge@patienttriage.demo</code>
            <code>demo123</code>
          </div>

          <p className="auth-footer">
            New to the platform? <Link to="/signup">Create an account</Link>
          </p>
          <p className="auth-safety">
            Synthetic data environment · Decision support only · Clinician remains responsible.
          </p>
        </div>
      </div>
    </div>
  );
}
