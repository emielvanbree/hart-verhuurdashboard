import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { articles, clients, reservations } from '../api.js';
import { StatusBadge, Alert, PageHeader, Spinner } from '../components/UI.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function getWeekNumber(d) {
  const date = new Date(d);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDays = (date - startOfYear) / 86400000;
  return Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
}

export default function ReservationNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=client, 2=articles, 3=confirm
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Client form
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClient, setNewClient] = useState({ name: '', email: '', due_date: '' });
  const [isNewClient, setIsNewClient] = useState(false);

  // Articles
  const [availableArticles, setAvailableArticles] = useState([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Search clients
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    clients.list(clientSearch).then(setClientResults).catch(() => {});
  }, [clientSearch]);

  // Load available articles when due_date known
  const dueDate = selectedClient?.due_date || newClient.due_date;
  useEffect(() => {
    if (!dueDate || step < 2) return;
    setLoadingArticles(true);
    articles.available(dueDate).then(setAvailableArticles).finally(() => setLoadingArticles(false));
  }, [dueDate, step]);

  async function handleNext() {
    setError('');
    if (step === 1) {
      if (!selectedClient && (!newClient.name || !newClient.email || !newClient.due_date)) {
        return setError('Vul alle klantgegevens in');
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedArticleIds.length === 0) return setError('Selecteer minimaal één bad');
      setStep(3);
    } else if (step === 3) {
      await handleSubmit();
    }
  }

  async function handleSubmit() {
    setLoading(true); setError('');
    try {
      let clientId = selectedClient?.id;
      if (!clientId) {
        const created = await clients.create(newClient);
        clientId = created.id;
      }
      const reservation = await reservations.create({ client_id: clientId, article_ids: selectedArticleIds });
      // Generate agreement and send email
      await reservations.generateAgreement(reservation.id, true).catch(() => {});
      navigate(`/reservations/${reservation.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const weekFrom = dueDate ? getWeekNumber(new Date(dueDate).setDate(new Date(dueDate).getDate() - 28)) : null;
  const weekTo = dueDate ? getWeekNumber(new Date(dueDate).setDate(new Date(dueDate).getDate() + 21)) : null;

  return (
    <div>
      <PageHeader title="Nieuwe reservering" subtitle={`Stap ${step} van 3`} />

      {/* Step indicator */}
      <div className="toggle" style={{ marginBottom: 20 }}>
        {['Cliënt', 'Bad selecteren', 'Bevestigen'].map((label, i) => (
          <button key={i} className={`toggle-btn${step === i+1 ? ' active' : ''}`}
            onClick={() => step > i+1 && setStep(i+1)} disabled={step <= i}>
            {i+1}. {label}
          </button>
        ))}
      </div>

      <Alert type="error" message={error} />

      {/* Step 1: Client */}
      {step === 1 && (
        <div className="hp-card" data-testid="step-client">
          <h3 style={{ marginBottom: 16 }}>Cliëntgegevens</h3>
          <div className="form-group">
            <label className="form-label">Zoek bestaande cliënt</label>
            <input className="form-control" placeholder="Zoek op naam of cliëntnummer…"
              value={clientSearch} onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); setIsNewClient(false); }}
              data-testid="client-search" />
          </div>
          {clientResults.length > 0 && !selectedClient && (
            <div className="client-results" style={{ marginBottom: 16 }}>
              {clientResults.map(c => (
                <div key={c.id} className="client-result-item" onClick={() => { setSelectedClient(c); setClientSearch(''); setIsNewClient(false); }}
                  data-testid="client-result-item" style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #eee', borderRadius: 6, marginBottom: 4, background: '#fafafa' }}>
                  <strong>{c.name}</strong> <span className="text-muted">· {c.client_number} · uitgerekend {formatDate(c.due_date)}</span>
                </div>
              ))}
            </div>
          )}
          {selectedClient && (
            <div style={{ padding: '12px 16px', background: '#e9f7f2', border: '2px solid #237062', borderRadius: 8, marginBottom: 16 }}>
              <strong>✓ {selectedClient.name}</strong> <span className="text-muted">· nr. {selectedClient.client_number} · uitgerekend {formatDate(selectedClient.due_date)}</span>
              <button className="btn-secondary" style={{ marginLeft: 12, padding: '2px 8px', fontSize: 12 }} onClick={() => setSelectedClient(null)}>Wijzigen</button>
            </div>
          )}
          <button className="btn-secondary" style={{ marginBottom: 16 }} onClick={() => { setIsNewClient(!isNewClient); setSelectedClient(null); }} data-testid="btn-new-client">
            {isNewClient ? '▲ Verberg nieuw cliënt formulier' : '+ Nieuwe cliënt aanmaken'}
          </button>
          {isNewClient && (
            <div style={{ padding: '16px', background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee' }} data-testid="new-client-form">
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Naam *</label>
                  <input className="form-control" value={newClient.name} onChange={e => setNewClient(p => ({...p, name: e.target.value}))} data-testid="new-client-name" placeholder="Voor- en achternaam" />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mailadres *</label>
                  <input className="form-control" type="email" value={newClient.email} onChange={e => setNewClient(p => ({...p, email: e.target.value}))} data-testid="new-client-email" />
                </div>
                <div className="form-group">
                  <label className="form-label">Uitgerekende datum *</label>
                  <input className="form-control" type="date" value={newClient.due_date} onChange={e => setNewClient(p => ({...p, due_date: e.target.value}))} data-testid="new-client-due-date" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select articles */}
      {step === 2 && (
        <div className="hp-card" data-testid="step-articles">
          <h3 style={{ marginBottom: 4 }}>Bad selecteren</h3>
          {dueDate && <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Beschikbare badsetten voor uitgerekende datum {formatDate(dueDate)} (week {weekFrom}–{weekTo})</p>}
          {loadingArticles ? <Spinner /> : availableArticles.length === 0
            ? <div className="error-msg" data-testid="no-articles-msg">Geen badsetten beschikbaar in dit venster. Voeg cliënt toe aan wachtlijst.</div>
            : (
              <div style={{ display: 'grid', gap: 10 }} data-testid="article-list">
                {availableArticles.map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    border: `2px solid ${selectedArticleIds.includes(a.id) ? '#237062' : '#eee'}`,
                    borderRadius: 8, cursor: 'pointer', background: selectedArticleIds.includes(a.id) ? '#e9f7f2' : '#fff' }}>
                    <input type="checkbox" checked={selectedArticleIds.includes(a.id)}
                      onChange={e => setSelectedArticleIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))}
                      data-testid={`article-checkbox-${a.id}`} style={{ marginTop: 3 }} />
                    <div>
                      <strong>{a.name}</strong> <StatusBadge status={a.article_type} />
                      <div className="text-muted text-sm">{a.description}</div>
                      <div className="text-sm" style={{ marginTop: 4 }}>Huurprijs: <strong>€{parseFloat(a.price).toFixed(2)}</strong> · Borg: <strong>€{parseFloat(a.deposit_amount).toFixed(2)}</strong></div>
                    </div>
                  </label>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="hp-card" data-testid="step-confirm">
          <h3 style={{ marginBottom: 16 }}>Controleer en bevestig</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
            <div>
              <div className="text-muted text-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Cliënt</div>
              <strong>{selectedClient?.name || newClient.name}</strong>
              <div className="text-muted">{selectedClient?.email || newClient.email}</div>
              <div className="text-muted">Uitgerekend: {formatDate(selectedClient?.due_date || newClient.due_date)}</div>
            </div>
            <div>
              <div className="text-muted text-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Geselecteerde badsetten</div>
              {availableArticles.filter(a => selectedArticleIds.includes(a.id)).map(a => (
                <div key={a.id} style={{ marginBottom: 4 }}><strong>{a.name}</strong> <StatusBadge status={a.article_type} /></div>
              ))}
            </div>
          </div>
          <div style={{ background: '#f0f7f5', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#237062' }}>
            ✉️ De uitleenovereenkomst wordt direct per e-mail verstuurd naar de cliënt.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
        <button className="btn-secondary" onClick={() => step > 1 ? setStep(s => s-1) : navigate('/reservations')} data-testid="btn-back">
          {step === 1 ? '← Annuleren' : '← Vorige'}
        </button>
        <button className="btn-primary" onClick={handleNext} disabled={loading} data-testid="btn-next">
          {loading ? 'Bezig…' : step === 3 ? '✓ Reservering aanmaken' : 'Volgende →'}
        </button>
      </div>
    </div>
  );
}
