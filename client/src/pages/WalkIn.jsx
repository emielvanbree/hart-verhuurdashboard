import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { articles, clients, rentals } from '../api.js';
import { StatusBadge, Alert, PageHeader, Spinner } from '../components/UI.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day:'2-digit', month:'2-digit', year:'numeric' });
}

export default function WalkIn() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClient, setNewClient] = useState({ name: '', email: '', due_date: '' });
  const [isNewClient, setIsNewClient] = useState(false);

  const [allArticles, setAllArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('pin');
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split('T')[0]);
  const [birthDate, setBirthDate] = useState('');

  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    clients.list(clientSearch).then(setClientResults).catch(() => {});
  }, [clientSearch]);

  useEffect(() => {
    if (step !== 2) return;
    setLoadingArticles(true);
    articles.list().then(arts => setAllArticles(arts.filter(a => a.status === 'AVAILABLE'))).finally(() => setLoadingArticles(false));
  }, [step]);

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
      const rental = await rentals.create({
        client_id: clientId, article_ids: selectedArticleIds,
        payment_method: paymentMethod, pickup_date: pickupDate,
        birth_date: birthDate || undefined
      });
      await rentals.generateInvoice(rental.id, false).catch(() => {});
      navigate(`/rentals/${rental.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Direct uitleen" subtitle="Uitleen zonder voorafgaande reservering" />

      <div className="toggle" style={{ marginBottom: 20 }}>
        {['Cliënt', 'Bad & betaling', 'Bevestigen'].map((label, i) => (
          <button key={i} className={`toggle-btn${step === i+1 ? ' active' : ''}`}
            onClick={() => step > i+1 && setStep(i+1)} disabled={step <= i}>
            {i+1}. {label}
          </button>
        ))}
      </div>

      <Alert type="error" message={error} />

      {step === 1 && (
        <div className="hp-card" data-testid="walkin-step-client">
          <h3 style={{ marginBottom: 16 }}>Cliëntgegevens</h3>
          <div className="form-group">
            <label className="form-label">Zoek bestaande cliënt</label>
            <input className="form-control" placeholder="Naam of cliëntnummer…" value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); setIsNewClient(false); }}
              data-testid="walkin-client-search" />
          </div>
          {clientResults.length > 0 && !selectedClient && (
            <div style={{ marginBottom: 16 }}>
              {clientResults.map(c => (
                <div key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(''); setIsNewClient(false); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', border: '1px solid #eee', borderRadius: 6, marginBottom: 4, background: '#fafafa' }}
                  data-testid="walkin-client-result">
                  <strong>{c.name}</strong> <span className="text-muted">· {c.client_number} · uitgerekend {formatDate(c.due_date)}</span>
                </div>
              ))}
            </div>
          )}
          {selectedClient && (
            <div style={{ padding: '12px 16px', background: '#e9f7f2', border: '2px solid #237062', borderRadius: 8, marginBottom: 16 }}>
              <strong>✓ {selectedClient.name}</strong> <span className="text-muted">· {selectedClient.client_number} · uitgerekend {formatDate(selectedClient.due_date)}</span>
              <button className="btn-secondary" style={{ marginLeft: 12, padding: '2px 8px', fontSize: 12 }} onClick={() => setSelectedClient(null)}>Wijzigen</button>
            </div>
          )}
          <button className="btn-secondary" style={{ marginBottom: 16 }} onClick={() => { setIsNewClient(!isNewClient); setSelectedClient(null); }}>
            {isNewClient ? '▲ Verberg formulier' : '+ Nieuwe cliënt'}
          </button>
          {isNewClient && (
            <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Naam *</label>
                  <input className="form-control" value={newClient.name} onChange={e => setNewClient(p => ({...p, name: e.target.value}))} data-testid="walkin-new-name" />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail *</label>
                  <input className="form-control" type="email" value={newClient.email} onChange={e => setNewClient(p => ({...p, email: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Uitgerekende datum *</label>
                  <input className="form-control" type="date" value={newClient.due_date} onChange={e => setNewClient(p => ({...p, due_date: e.target.value}))} data-testid="walkin-new-due-date" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="hp-card" data-testid="walkin-step-articles">
          <h3 style={{ marginBottom: 16 }}>Bad & betaling</h3>
          {loadingArticles ? <Spinner /> : allArticles.length === 0
            ? <div className="error-msg">Geen badsetten beschikbaar.</div>
            : (
              <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                {allArticles.map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                    border: `2px solid ${selectedArticleIds.includes(a.id) ? '#237062' : '#eee'}`,
                    borderRadius: 8, cursor: 'pointer', background: selectedArticleIds.includes(a.id) ? '#e9f7f2' : '#fff' }}>
                    <input type="checkbox" checked={selectedArticleIds.includes(a.id)}
                      onChange={e => setSelectedArticleIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))}
                      data-testid={`walkin-article-${a.id}`} style={{ marginTop: 3 }} />
                    <div>
                      <strong>{a.name}</strong> <StatusBadge status={a.article_type} />
                      <div className="text-sm text-muted">{a.description}</div>
                      <div className="text-sm" style={{ marginTop: 4 }}>€{parseFloat(a.price).toFixed(2)} huur + €{parseFloat(a.deposit_amount).toFixed(2)} borg</div>
                    </div>
                  </label>
                ))}
              </div>
            )
          }
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Betaalmethode</label>
              <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} data-testid="walkin-payment">
                <option value="pin">Pin</option>
                <option value="cash">Contant</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Uitleen datum</label>
              <input className="form-control" type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Bevallingsdatum (optioneel)</label>
              <input className="form-control" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="hp-card" data-testid="walkin-step-confirm">
          <h3 style={{ marginBottom: 16 }}>Controleer en bevestig</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div className="text-muted text-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Cliënt</div>
              <strong>{selectedClient?.name || newClient.name}</strong>
              <div className="text-muted">{selectedClient?.email || newClient.email}</div>
            </div>
            <div>
              <div className="text-muted text-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Uitleen</div>
              <div>Bad: <strong>{allArticles.filter(a => selectedArticleIds.includes(a.id)).map(a => a.name).join(', ')}</strong></div>
              <div>Betaling: <strong>{paymentMethod === 'pin' ? 'Pin' : 'Contant'}</strong></div>
              <div>Datum: <strong>{formatDate(pickupDate)}</strong></div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
        <button className="btn-secondary" onClick={() => step > 1 ? setStep(s => s-1) : navigate('/')}>
          {step === 1 ? '← Terug' : '← Vorige'}
        </button>
        <button className="btn-primary" onClick={handleNext} disabled={loading} data-testid="walkin-btn-next">
          {loading ? 'Bezig…' : step === 3 ? '⚡ Uitleen bevestigen' : 'Volgende →'}
        </button>
      </div>
    </div>
  );
}
