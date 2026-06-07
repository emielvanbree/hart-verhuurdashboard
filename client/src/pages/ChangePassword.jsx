import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi } from '../api.js';
import { useAuth } from '../App.jsx';
import { Alert, PageHeader } from '../components/UI.jsx';

export default function ChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setError('Wachtwoorden komen niet overeen');
    if (form.newPassword.length < 8) return setError('Wachtwoord moet minimaal 8 tekens zijn');
    setLoading(true); setError('');
    try {
      await authApi.changePassword(form.currentPassword, form.newPassword);
      setUser(prev => ({ ...prev, must_reset_password: false }));
      navigate('/');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <PageHeader title="Wachtwoord wijzigen" subtitle={user?.must_reset_password ? 'Je moet je tijdelijke wachtwoord wijzigen om door te gaan.' : ''} />
      <div className="hp-card" style={{ marginTop: 20 }}>
        <form onSubmit={handleSubmit}>
          <Alert type="error" message={error} />
          {!user?.must_reset_password && (
            <div className="form-group">
              <label className="form-label">Huidig wachtwoord</label>
              <input className="form-control" type="password" value={form.currentPassword} onChange={e => setForm(p => ({...p, currentPassword: e.target.value}))} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Nieuw wachtwoord</label>
            <input className="form-control" type="password" value={form.newPassword} onChange={e => setForm(p => ({...p, newPassword: e.target.value}))} data-testid="new-password-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Bevestig nieuw wachtwoord</label>
            <input className="form-control" type="password" value={form.confirm} onChange={e => setForm(p => ({...p, confirm: e.target.value}))} data-testid="confirm-password-input" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading} data-testid="btn-change-password">{loading ? 'Bezig…' : 'Wachtwoord opslaan'}</button>
        </form>
      </div>
    </div>
  );
}
