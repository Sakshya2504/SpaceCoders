import { ArrowRight, Check, HeartPulse, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

// New accounts are created with the least-privileged clinical role used by the demo.
const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
};

export default function Signup() {
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

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const response = await api.post('/auth/signup', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: 'triage_nurse'
      });

      const { token, user } = response.data.data;
      localStorage.setItem('pt_token', token);
      localStorage.setItem('pt_user', JSON.stringify(user));
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual auth-visual-signup" aria-hidden="true">
        <div className="auth-visual-overlay" />
        <div className="auth-visual-content">
          <div className="auth-logo">
            <HeartPulse size={20} />
            PatientTriage<span>.ai</span>
          </div>

          <div className="auth-visual-copy">
            <div className="auth-kicker">
              <ShieldCheck size={14} />
              CLINICAL WORKSPACE
            </div>
            <h1>A safer workspace<br />starts here.</h1>
            <p>
              Create an account for the triage workspace. Your role and access remain controlled by the platform.
            </p>
          </div>

          <div className="auth-feature-stack">
            <div><span className="feature-check"><Check size={13} /></span><span>Structured patient intake</span></div>
            <div><span className="feature-check"><Check size={13} /></span><span>Explainable recommendations</span></div>
            <div><span className="feature-check"><Check size={13} /></span><span>Continuous queue awareness</span></div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-form-wrap wide">
          <div className="mobile-brand">
            <HeartPulse size={18} />
            PatientTriage<span>.ai</span>
          </div>

          <div className="auth-eyebrow">GET STARTED</div>
          <h2>Create your account</h2>
          <p className="auth-intro">
            Set up your access to the emergency care command centre.
          </p>

          <form onSubmit={submit} className="form-stack auth-form">
            <label>
              Full name
              <input
                required
                minLength="2"
                autoComplete="name"
                value={form.name}
                onChange={event => updateField('name', event.target.value)}
                placeholder="Enter your full name"
              />
            </label>

            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={event => updateField('email', event.target.value)}
                placeholder="name@hospital.org"
              />
            </label>

            <div className="form-grid two auth-password-grid">
              <label>
                Password
                <input
                  required
                  minLength="6"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={event => updateField('password', event.target.value)}
                  placeholder="At least 6 characters"
                />
              </label>

              <label>
                Confirm password
                <input
                  required
                  minLength="6"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={event => updateField('confirmPassword', event.target.value)}
                  placeholder="Repeat password"
                />
              </label>
            </div>

            {error && <div className="error-banner" role="alert">{error}</div>}

            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="auth-safety">
            Synthetic data environment · Decision support only · Clinician remains responsible.
          </p>
        </div>
      </div>
    </div>
  );
}
