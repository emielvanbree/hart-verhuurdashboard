import React, { useState, useEffect } from 'react';
import { articles as articlesApi } from '../api.js';
import { StatusBadge, PageHeader, Alert, Modal, ConfirmDialog, EmptyState, Spinner } from '../components/UI.jsx';

const EMPTY_FORM = { name: '', description: '', price: '145.00', deposit_amount: '77.50', dimensions: '', article_type: 'NORMAAL', status: 'AVAILABLE' };

export default function Articles() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deactivateItem, setDeactivateItem] = useState(null);
  const [processing, setProcessing] = useState(false);

  const load = () => {
    setLoading(true);
    articlesApi.list().then(setItems).finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({ name: item.name, description: item.description || '', price: String(item.price), deposit_amount: String(item.deposit_amount), dimensions: item.dimensions || '', article_type: item.article_type || 'NORMAAL', status: item.status });
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    setProcessing(true); setError('');
    try {
      if (editItem) { await articlesApi.update(editItem.id, form); setSuccess('Artikel bijgewerkt'); }
      else { await articlesApi.create(form); setSuccess('Artikel aangemaakt'); }
      setModalOpen(false); load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  async function handleDeactivate() {
    setProcessing(true);
    try {
      await articlesApi.deactivate(deactivateItem.id);
      setDeactivateItem(null); setSuccess('Artikel gedeactiveerd'); load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div>
      <PageHeader title="Bad beheer" subtitle="Beheer van de bevallingsbadsetten"
        actions={<button className="btn-primary" onClick={openCreate} data-testid="btn-new-article">+ Nieuw bad toevoegen</button>}
      />
      <Alert type="error" message={error} />
      <Alert type="success" message={success} />

      {loading ? <Spinner /> : items.length === 0
        ? <EmptyState icon="🛁" title="Nog geen badsetten" description="Voeg een badset toe om te starten." />
        : (
          <div className="hp-card" style={{ overflowX: "auto" }}>
            <table className="hp-table" style={{ minWidth: 700 }} data-testid="articles-table">
              <thead><tr><th>Naam</th><th>Type</th><th>Maten</th><th>Huurprijs</th><th>Borg</th><th>Uitleningen</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id} data-testid="article-row">
                    <td><strong>{a.name}</strong>{a.description && <><br /><small className="text-muted">{a.description.slice(0, 60)}</small></>}</td>
                    <td><StatusBadge status={a.article_type} /></td>
                    <td className="text-sm text-muted">{a.dimensions || '—'}</td>
                    <td>€{parseFloat(a.price).toFixed(2)}</td>
                    <td>€{parseFloat(a.deposit_amount).toFixed(2)}</td>
                    <td>
                      <span style={{ color: a.usage_count >= 40 ? '#e74c3c' : a.usage_count >= 30 ? '#f39c12' : '#237062', fontWeight: 700 }}>{a.usage_count}</span>
                      {a.usage_count >= 40 && <span className="text-sm text-danger" style={{ marginLeft: 4 }}>⚠ Vervangen</span>}
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                        <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: 11, whiteSpace: "nowrap" }} onClick={() => openEdit(a)} data-testid="btn-edit-article">Bewerken</button>
                        {a.status !== "INACTIVE" && <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: 11, color: "#e74c3c", whiteSpace: "nowrap" }} onClick={() => setDeactivateItem(a)} data-testid="btn-deactivate-article">Deactiveren</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Bad bewerken' : 'Nieuw bad toevoegen'}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={handleSave} disabled={processing} data-testid="btn-save-article">{processing ? 'Opslaan…' : 'Opslaan'}</button>
          </div>
        }
      >
        <Alert type="error" message={error} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, overflow: 'hidden' }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Naam *</label>
            <input className="form-control" value={form.name} onChange={f('name')} data-testid="article-name-input" placeholder="Bad 1 (MINI)" />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-control" value={form.article_type} onChange={f('article_type')} data-testid="article-type-select">
              <option value="MINI">Mini (1-persoons, 480L)</option>
              <option value="NORMAAL">Normaal (met partner, 650L)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.status} onChange={f('status')}>
              <option value="AVAILABLE">Beschikbaar</option>
              <option value="INACTIVE">Inactief</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Huurprijs (€)</label>
            <input className="form-control" type="number" step="0.01" value={form.price} onChange={f('price')} data-testid="article-price-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Borg (€)</label>
            <input className="form-control" type="number" step="0.01" value={form.deposit_amount} onChange={f('deposit_amount')} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Maten</label>
            <input className="form-control" value={form.dimensions} onChange={f('dimensions')} placeholder="Buiten: 165×145×71cm | Binnen: 114×94×66cm" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Omschrijving</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={f('description')} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deactivateItem} onClose={() => setDeactivateItem(null)} onConfirm={handleDeactivate}
        title="Bad deactiveren" message={`Weet je zeker dat je "${deactivateItem?.name}" wil deactiveren? Het bad wordt niet meer aangeboden.`}
        confirmLabel="Deactiveren" danger />
    </div>
  );
}
