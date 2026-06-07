import React, { useState, useEffect } from 'react';
import { waitlist as waitlistApi, clients } from '../api.js';
import { PageHeader, Alert, Modal, EmptyState, Spinner, ConfirmDialog } from '../components/UI.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Waitlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ client_id: '', article_type: '', notes: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [resolveItem, setResolveItem] = useState(null);

  const load = () => { setLoading(true); waitlistApi.list().then(setItems).finally(() => setLoading(false)); };
  useEffect(load, []);

  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    clients.list(clientSearch).then(setClientResults).catch(() => {});
  }, [clientSearch]);

  async function handleAdd() {
    if (!selectedClient) return setError('Selecteer een cliënt');
    setProcessing(true); setError('');
    try {
      await waitlistApi.add({ client_id: selectedClient.id, article_type: form.article_type || null, notes: form.notes || null });
      setModalOpen(false); setSelectedClient(null); setClientSearch(''); setForm({ client_id: '', article_type: '', notes: '' });
      load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  async function handleResolve() {
    await waitlistApi.resolve(resolveItem.id);
    setResolveItem(null); load();
  }

  return (
    <div>
      <PageHeader title="Wachtlijst" subtitle="Cliënten die wachten op een beschikbaar bad"
        actions={<button className="btn-primary" onClick={() => setModalOpen(true)} data-testid="btn-add-waitlist">+ Toevoegen</button>}
      />
      <Alert type="error" message={error} />

      {loading ? <Spinner /> : items.length === 0
        ? <EmptyState icon="✅" title="Wachtlijst is leeg" description="Geen cliënten op de wachtlijst." />
        : (
          <div className="hp-card">
            <table className="hp-table" data-testid="waitlist-table">
              <thead><tr><th>Cliënt</th><th>Cliëntnr.</th><th>Uitgerekend</th><th>Badtype voorkeur</th><th>Aangemeld</th><th>Notities</th><th></th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.client_name}</strong></td>
                    <td>{item.client_number || '—'}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td>{item.article_type || 'Geen voorkeur'}</td>
                    <td>{formatDate(item.requested_at)}</td>
                    <td className="text-muted text-sm">{item.notes || '—'}</td>
                    <td>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12, color: '#237062' }}
                        onClick={() => setResolveItem(item)} data-testid="btn-resolve-waitlist">✓ Afgerond</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Cliënt toevoegen aan wachtlijst"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={handleAdd} disabled={processing}>Toevoegen</button>
          </div>
        }
      >
        <Alert type="error" message={error} />
        <div className="form-group">
          <label className="form-label">Cliënt zoeken *</label>
          <input className="form-control" placeholder="Naam of cliëntnummer…" value={clientSearch}
            onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); }} />
          {clientResults.length > 0 && !selectedClient && (
            <div style={{ border: '1px solid #eee', borderRadius: 6, marginTop: 4 }}>
              {clientResults.map(c => (
                <div key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(c.name); setClientResults([]); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>
                  <strong>{c.name}</strong> <span className="text-muted">· {c.client_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Voorkeur badtype</label>
          <select className="form-control" value={form.article_type} onChange={e => setForm(p => ({...p, article_type: e.target.value}))}>
            <option value="">Geen voorkeur</option>
            <option value="MINI">Mini</option>
            <option value="NORMAAL">Normaal</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Notities</label>
          <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} />
        </div>
      </Modal>

      <ConfirmDialog open={!!resolveItem} onClose={() => setResolveItem(null)} onConfirm={handleResolve}
        title="Van wachtlijst halen" message={`Weet je zeker dat je ${resolveItem?.client_name} van de wachtlijst wil halen?`}
        confirmLabel="Ja, afgerond" />
    </div>
  );
}
