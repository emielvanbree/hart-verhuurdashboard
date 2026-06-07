import React, { useState, useEffect } from 'react';
import { users as usersApi } from '../api.js';
import { PageHeader, Alert, Modal, Spinner, EmptyState } from '../components/UI.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'ASSISTANT', active: true };

export default function Users() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = () => { setLoading(true); usersApi.list().then(setItems).finally(() => setLoading(false)); };
  useEffect(load, []);

  function openCreate() { setEditItem(null); setForm(EMPTY); setError(''); setModalOpen(true); }
  function openEdit(u) { setEditItem(u); setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active === 1 }); setError(''); setModalOpen(true); }

  async function handleSave() {
    setProcessing(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (editItem) { await usersApi.update(editItem.id, payload); setSuccess('Gebruiker bijgewerkt'); }
      else { await usersApi.create(payload); setSuccess('Gebruiker aangemaakt'); }
      setModalOpen(false); load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  const f = key => e => setForm(p => ({ ...p, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function formatDate(d) {
    if (!d) return 'Nooit';
    return new Date(d).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div>
      <PageHeader title="Gebruikersbeheer" subtitle="Beheer van assistent- en beheerderaccounts"
        actions={<button className="btn-primary" onClick={openCreate} data-testid="btn-new-user">+ Gebruiker toevoegen</button>}
      />
      <Alert type="error" message={error} />
      <Alert type="success" message={success} />

      {loading ? <Spinner /> : items.length === 0
        ? <EmptyState icon="👥" title="Geen gebruikers" />
        : (
          <div className="hp-card">
            <table className="hp-table" data-testid="users-table">
              <thead><tr><th>Naam</th><th>E-mail</th><th>Rol</th><th>Status</th><th>Laatste login</th><th></th></tr></thead>
              <tbody>
                {items.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-cancelled' : 'badge-confirmed'}`}>{u.role === 'ADMIN' ? 'Beheerder' : 'Assistent'}</span></td>
                    <td><span className={`badge ${u.active ? 'badge-confirmed' : 'badge-planned'}`}>{u.active ? 'Actief' : 'Inactief'}</span></td>
                    <td className="text-sm text-muted">{formatDate(u.last_login_at)}</td>
                    <td><button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(u)} data-testid="btn-edit-user">Bewerken</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Gebruiker bewerken' : 'Nieuwe gebruiker'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={handleSave} disabled={processing}>{processing ? 'Opslaan…' : 'Opslaan'}</button>
          </div>
        }
      >
        <Alert type="error" message={error} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Naam *</label>
            <input className="form-control" value={form.name} onChange={f('name')} data-testid="user-name-input" /></div>
          <div className="form-group"><label className="form-label">E-mail *</label>
            <input className="form-control" type="email" value={form.email} onChange={f('email')} /></div>
          <div className="form-group"><label className="form-label">{editItem ? 'Nieuw wachtwoord (leeg = ongewijzigd)' : 'Wachtwoord *'}</label>
            <input className="form-control" type="password" value={form.password} onChange={f('password')} /></div>
          <div className="form-group"><label className="form-label">Rol</label>
            <select className="form-control" value={form.role} onChange={f('role')}>
              <option value="ASSISTANT">Assistent</option>
              <option value="ADMIN">Beheerder</option>
            </select>
          </div>
          {editItem && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="active-toggle" checked={form.active} onChange={f('active')} />
              <label htmlFor="active-toggle">Account actief</label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
