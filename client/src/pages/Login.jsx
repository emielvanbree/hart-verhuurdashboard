import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { auth } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await auth.login(email, password);
      setUser(user);
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Inloggen mislukt');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page" data-testid="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-wrap">
            <img src="/logo_small.jpg" alt="'t Hart Verloskunde" className="login-logo-img" />
          </div>
          <h1 className="login-title">'t Hart Verloskunde</h1>
          <p className="login-sub">Verhuurdashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-msg" data-testid="login-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">E-mailadres</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              data-testid="email-input"
              placeholder="naam@voorbeeld.nl"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Wachtwoord</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              data-testid="password-input"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading} data-testid="login-btn">
            {loading ? 'Bezig met inloggen…' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  );
}
