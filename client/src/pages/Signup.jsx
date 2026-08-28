import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

const initial = {
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
};

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
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      const response = await api.post('/auth/signup', {
        name: form.name,
        email: form.email,
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
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">✚</div>
          <div>
            <strong>PatientTriage<span>.ai</span></strong>
            <small>ED decision-support layer</small>
          </div>
        </div>

        <div className="login-kicker">ACCENTURE INNOVATION CHALLENGE 2026 · ROUND 2</div>
        <h1>Create account</h1>
        <p className="muted">
          Create a demo triage-nurse account to access the ED command centre.
        </p>

        <form onSubmit={submit} className="form-stack">
          <label>
            Full name
            <input
              required
              minLength="2"
              value={form.name}
              onChange={event => set('name', event.target.value)}
              placeholder="Enter your full name"
            />
          </label>

          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={event => set('email', event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              required
              minLength="6"
              type="password"
              value={form.password}
              onChange={event => set('password', event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          <label>
            Confirm password
            <input
              required
              minLength="6"
              type="password"
              value={form.confirmPassword}
              onChange={event => set('confirmPassword', event.target.value)}
              placeholder="Re-enter your password"
            />
          </label>

          {error && <div className="error-banner">{error}</div>}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="demo-login">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
