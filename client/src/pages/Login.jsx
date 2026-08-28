import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
        <h1>ED Command Centre</h1>
        <p className="muted">
          Real-time triage recommendations with confidence, red-flag detection and explainable reasoning. The nurse remains in control.
        </p>

        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
          </label>

          {error && <div className="error-banner">{error}</div>}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Enter command centre'}
          </button>
        </form>

        <div className="demo-login">
          Demo: charge@patienttriage.demo / demo123
        </div>
        <div className="demo-login">
          New user? <Link to="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
