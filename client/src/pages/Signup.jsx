import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, HeartPulse, ShieldCheck } from 'lucide-react';
import api from '../api';

const initial = { name: '', email: '', password: '', confirmPassword: '' };

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm(old => ({ ...old, [key]: value }));

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
        email: form.email.trim(),
        password: form.password,
        role: 'triage_nurse'
      });
      localStorage.setItem('pt_token', response.data.data.token);
      localStorage.setItem('pt_user', JSON.stringify(response.data.data.user));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual auth-visual-signup">
        <div className="auth-visual-overlay" />
        <div className="auth-visual-content">
          <div className="auth-logo"><HeartPulse size={20} /> PatientTriage<span>.ai</span></div>
          <div className="auth-visual-copy">
            <div className="auth-kicker"><ShieldCheck size={14} /> CLINICAL WORKSPACE</div>
            <h1>A safer workspace<br />starts here.</h1>
            <p>Create an account for the triage workspace. Your role and access remain controlled by the platform.</p>
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
          <div className="mobile-brand"><HeartPulse size={18} /> PatientTriage<span>.ai</span></div>
          <div className="auth-eyebrow">GET STARTED</div>
          <h2>Create your account</h2>
          <p className="auth-intro">Set up your access to the emergency care command centre.</p>

          <form onSubmit={submit} className="form-stack auth-form">
            <label>Full name
              <input required minLength="2" autoComplete="name" value={form.name} onChange={event => set('name', event.target.value)} placeholder="Enter your full name" />
            </label>
            <label>Email address
              <input required type="email" autoComplete="email" value={form.email} onChange={event => set('email', event.target.value)} placeholder="name@hospital.org" />
            </label>
            <div className="form-grid two auth-password-grid">
              <label>Password
                <input required minLength="6" type="password" autoComplete="new-password" value={form.password} onChange={event => set('password', event.target.value)} placeholder="At least 6 characters" />
              </label>
              <label>Confirm password
                <input required minLength="6" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={event => set('confirmPassword', event.target.value)} placeholder="Repeat password" />
              </label>
            </div>
            {error && <div className="error-banner">{error}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></p>
          <p className="auth-safety">Synthetic data environment · Decision support only · Clinician remains responsible.</p>
        </div>
      </div>
    </div>
  );
}
