import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { rentals, documents } from '../api.js';
import { StatusBadge, Spinner, Alert, PageHeader, Modal } from '../components/UI.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('nl-NL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function RentalDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [birthDateOpen, setBirthDateOpen] = useState(false);
  const [extraInvoiceOpen, setExtraInvoiceOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [emailModal, setEmailModal] = useState(null); // { docId, to, cc }
  const [emailSuccess, setEmailSuccess] = useState('');

  const [returnForm, setReturnForm] = useState({ is_complete_set: true, is_clean: true, disposables_unopened: false, return_date: new Date().toISOString().split('T')[0], birth_date: '' });
  const [birthDate, setBirthDate] = useState('');
  const [extraInvoice, setExtraInvoice] = useState({ description: 'Te late retour', amount: '30.00' });
  const [generatingReceipt, setGeneratingReceipt] = useState(false);

  const load = () => {
    setLoading(true);
    rentals.get(id).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const isOverdue = data?.expected_return_date && data?.status === 'CHECKED_OUT' && new Date() > new Date(data.expected_return_date);

  async function handleReturn() {
    setProcessing(true); setError('');
    try {
      const result = await rentals.processReturn(id, returnForm);
      if (result.settlement.extraCharge > 0 || result.settlement.creditNote > 0) {
        await rentals.generateSettlementDocs(id).catch(() => {});
      }
      setReturnOpen(false);
      setSuccess(`Retour verwerkt! ${result.settlement.reasons.join(' + ') || 'Geen extra kosten.'}`);
      load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  async function handleUpdateBirthDate() {
    setProcessing(true);
    try {
      const result = await rentals.updateBirthDate(id, birthDate);
      setBirthDateOpen(false);
      setSuccess(`Bevallingsdatum bijgewerkt. Nieuwe deadline: ${formatDate(result.expected_return_date)}`);
      load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  async function handleGenerateReceipt() {
    setGeneratingReceipt(true);
    try {
      await rentals.generateReturnReceipt(id);
      setSuccess('Ontvangstbevestiging aangemaakt');
      load();
    } catch (e) { setError(e.message); }
    finally { setGeneratingReceipt(false); }
  }

  async function handleGenerateInvoice() {
    setProcessing(true);
    try {
      await rentals.generateInvoice(id, false);
      setSuccess('Factuur aangemaakt');
      load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  if (loading) return <Spinner />;
  if (!data) return <div className="error-msg">{error || 'Niet gevonden'}</div>;

  function openEmailModal(docId) {
    // Pre-fill with client email from loaded data
    const clientEmail = data?.client_email || data?.email || '';
    setEmailModal({ docId, to: clientEmail, cc: '' });
  }

  async function handleSendEmail() {
    if (!emailModal) return;
    const sending = emailModal.docId;
    setEmailModal(prev => ({ ...prev, sending: true }));
    try {
      const result = await documents.email(sending, emailModal.to, emailModal.cc || undefined);
      setEmailModal(null);
      setEmailSuccess(result.message || 'Document verstuurd');
      setTimeout(() => setEmailSuccess(''), 5000);
    } catch(e) { setError(e.message); setEmailModal(prev => ({ ...prev, sending: false })); }
  }

  return (
    <div>
      <PageHeader title={`Verhuur dossier #${data.id}`}
        subtitle={`${data.client_name} · ${formatDate(data.pickup_date)}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {data.status === 'CHECKED_OUT' && <>
              <button className="btn-secondary" onClick={() => setBirthDateOpen(true)} data-testid="btn-birth-date">📅 Bevallingsdatum</button>
              <button className="btn-primary" onClick={() => setReturnOpen(true)} data-testid="btn-return">↩ Retour verwerken</button>
            </>}
          </div>
        }
      />

      <Alert type="error" message={error} />
      <Alert type="success" message={success} />
      <Alert type="success" message={emailSuccess} />

      {isOverdue && (
        <div style={{ background: '#fde8ea', border: '1px solid #e74c3c', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#9b1c2a' }}>
          ⚠️ <strong>Te laat:</strong> verwachte retour was {formatDate(data.expected_return_date)}.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="hp-card">
          <div style={{ marginBottom: 10, fontWeight: 700, color: '#237062', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cliënt</div>
          <div><strong>{data.client_name}</strong> <span className="text-muted">· {data.client_number}</span></div>
          <div className="text-muted">{data.client_email}</div>
          {data.phone && <div className="text-muted">{data.phone}</div>}
        </div>
        <div className="hp-card">
          <div style={{ marginBottom: 10, fontWeight: 700, color: '#237062', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Verhuur</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div><div className="text-muted text-sm">Status</div><StatusBadge status={data.status} /></div>
            <div><div className="text-muted text-sm">Betaalmethode</div><strong>{data.payment_method === 'pin' ? 'Pin' : 'Contant'}</strong></div>
            <div><div className="text-muted text-sm">Uitleen datum</div><strong>{formatDate(data.pickup_date)}</strong></div>
            <div><div className="text-muted text-sm">Verwachte retour</div><strong style={{ color: isOverdue ? '#e74c3c' : 'inherit' }}>{formatDate(data.expected_return_date)}</strong></div>
            {data.birth_date && <div><div className="text-muted text-sm">Bevallingsdatum</div><strong>{formatDate(data.birth_date)}</strong></div>}
            {data.return_date && <div><div className="text-muted text-sm">Werkelijke retour</div><strong>{formatDate(data.return_date)}</strong></div>}
          </div>
        </div>
      </div>

      {/* Articles */}
      <div className="hp-card" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 10, fontWeight: 700, color: '#237062', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Geleend materiaal</div>
        <table className="hp-table">
          <thead><tr><th>Artikel</th><th>Type</th><th>Huurprijs</th><th>Borg</th><th>Status</th></tr></thead>
          <tbody>
            {data.items.map(i => (
              <tr key={i.id}>
                <td><strong>{i.article_name}</strong></td>
                <td><StatusBadge status={i.article_type} /></td>
                <td>€{parseFloat(i.price).toFixed(2)}</td>
                <td>€{parseFloat(i.deposit_amount).toFixed(2)}</td>
                <td><StatusBadge status={i.article_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Return checklist result */}
      {data.status === 'RETURNED' && (
        <div className="hp-card" style={{ marginTop: 20, borderLeft: '4px solid #237062' }}>
          <div style={{ marginBottom: 10, fontWeight: 700, color: '#237062', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Retourchecklist</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><div className="text-muted text-sm">Set compleet</div><strong style={{ color: data.is_complete_set ? '#27ae60' : '#e74c3c' }}>{data.is_complete_set ? '✓ Ja' : '✗ Nee'}</strong></div>
            <div><div className="text-muted text-sm">Schoon</div><strong style={{ color: data.is_clean ? '#27ae60' : '#e74c3c' }}>{data.is_clean ? '✓ Ja' : '✗ Nee'}</strong></div>
            <div><div className="text-muted text-sm">Disposables ongeopend</div><strong style={{ color: data.disposables_unopened ? '#27ae60' : '#888' }}>{data.disposables_unopened ? '✓ Ja' : '✗ Nee'}</strong></div>
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="hp-card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: '#237062', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Documenten</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={handleGenerateInvoice} disabled={processing} style={{ fontSize: 12, padding: '4px 10px' }}>+ Factuur</button>
            {data.status === 'RETURNED' && <>
              <button className="btn-secondary" onClick={() => setExtraInvoiceOpen(true)} style={{ fontSize: 12, padding: '4px 10px' }}>+ Extra factuur</button>
              <button className="btn-primary" onClick={handleGenerateReceipt} disabled={generatingReceipt} style={{ fontSize: 12, padding: '4px 12px', background: '#237062' }}>
                {generatingReceipt ? 'Bezig…' : '📋 Ontvangstbevestiging'}
              </button>
            </>}
          </div>
        </div>
        {data.documents.length === 0
          ? <p className="text-muted text-sm">Nog geen documenten aangemaakt.</p>
          : data.documents.map(doc => (
            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>
                📄 <strong>{doc.type === 'INVOICE' ? 'Factuur' : doc.type === 'CREDIT_NOTE' ? 'Creditnota' : doc.type === 'EXTRA_INVOICE' ? 'Extra factuur' : doc.type === 'AGREEMENT' ? 'Overeenkomst' : doc.type === 'RETURN_RECEIPT' ? 'Ontvangstbevestiging' : doc.type}</strong>
                <span className="text-muted text-sm" style={{ marginLeft: 8 }}>· {formatDateTime(doc.created_at)}</span>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href={documents.viewUrl(doc.id)} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>👁 Bekijken</a>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEmailModal(doc.id)}>
                  ✉️ Mailen
                </button>
                <a href={documents.downloadUrl(doc.id)} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>↓ PDF</a>
              </div>
            </div>
          ))
        }
      </div>

      {/* Audit */}
      {data.audit && data.audit.length > 0 && (
        <div className="hp-card" style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 10, fontWeight: 700, color: '#237062', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audittrail</div>
          {data.audit.map(entry => (
            <div key={entry.id} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
              <span className="text-muted" style={{ minWidth: 130 }}>{formatDateTime(entry.timestamp)}</span>
              <span className="text-muted" style={{ minWidth: 120 }}>{entry.user_name}</span>
              <span>{entry.action}</span>
            </div>
          ))}
        </div>
      )}

      {/* Return modal */}
      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Retour verwerken"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setReturnOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={handleReturn} disabled={processing} data-testid="btn-confirm-return">
              {processing ? 'Bezig…' : '✓ Retour bevestigen'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Retour datum</label>
            <input className="form-control" type="date" value={returnForm.return_date} onChange={e => setReturnForm(p => ({...p, return_date: e.target.value}))} data-testid="return-date-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Bevallingsdatum (optioneel)</label>
            <input className="form-control" type="date" value={returnForm.birth_date} onChange={e => setReturnForm(p => ({...p, birth_date: e.target.value}))} />
          </div>
          {[
            { key: 'is_complete_set', label: 'Set compleet teruggebracht?' },
            { key: 'is_clean', label: 'Bad schoon teruggebracht?' },
            { key: 'disposables_unopened', label: 'Disposables ongeopend retour?' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9f9f9', borderRadius: 6 }}>
              <span>{label}</span>
              <div style={{ display: 'flex', gap: 12 }}>
                {['Ja', 'Nee'].map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="radio" name={key} checked={returnForm[key] === (opt === 'Ja')}
                      onChange={() => setReturnForm(p => ({...p, [key]: opt === 'Ja'}))}
                      data-testid={`return-${key}-${opt.toLowerCase()}`} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Alert type="error" message={error} />
      </Modal>

      {/* Birth date modal */}
      <Modal open={birthDateOpen} onClose={() => setBirthDateOpen(false)} title="Bevallingsdatum registreren"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setBirthDateOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={handleUpdateBirthDate} disabled={processing || !birthDate}>Opslaan</button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Datum van bevalling</label>
          <input className="form-control" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} data-testid="birth-date-input" />
        </div>
        <p className="text-muted text-sm" style={{ marginTop: 8 }}>De retourdeadline wordt herberekend op 3 werkdagen na de bevalling.</p>
      </Modal>

      {/* Extra invoice modal */}
      <Modal open={extraInvoiceOpen} onClose={() => setExtraInvoiceOpen(false)} title="Extra factuur aanmaken"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setExtraInvoiceOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={async () => { setProcessing(true); try { await rentals.createExtraInvoice(id, extraInvoice); setExtraInvoiceOpen(false); setSuccess('Extra factuur aangemaakt'); load(); } catch(e) { setError(e.message); } finally { setProcessing(false); } }} disabled={processing}>Aanmaken</button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Omschrijving</label>
          <select className="form-control" value={extraInvoice.description} onChange={e => setExtraInvoice(p => ({...p, description: e.target.value}))}>
            <option>Te late retour</option>
            <option>Vies teruggebracht</option>
            <option>Te late retour en vies teruggebracht</option>
            <option>Beschadiging / ontbrekend onderdeel</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Bedrag (€)</label>
          <input className="form-control" type="number" step="0.01" value={extraInvoice.amount} onChange={e => setExtraInvoice(p => ({...p, amount: e.target.value}))} />
        </div>
      </Modal>
      {/* Email modal */}
      <Modal open={!!emailModal} onClose={() => setEmailModal(null)} title="Document per e-mail versturen"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setEmailModal(null)}>Annuleren</button>
            <button className="btn-primary" onClick={handleSendEmail} disabled={emailModal?.sending || !emailModal?.to}
              data-testid="btn-send-email">
              {emailModal?.sending ? 'Versturen…' : '✉️ Versturen'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Aan (e-mailadres cliënt) *</label>
            <input className="form-control" type="email" value={emailModal?.to || ''} autoFocus
              onChange={e => setEmailModal(prev => ({ ...prev, to: e.target.value }))}
              data-testid="email-to-input" />
          </div>
          <div className="form-group">
            <label className="form-label">CC (optioneel)</label>
            <input className="form-control" type="email" value={emailModal?.cc || ''}
              onChange={e => setEmailModal(prev => ({ ...prev, cc: e.target.value }))}
              placeholder="bijv. praktijk@thart.nl" data-testid="email-cc-input" />
          </div>
          <p className="text-muted text-sm" style={{ marginTop: -8 }}>
            Het document wordt als bijlage verstuurd.
          </p>
        </div>
      </Modal>
    </div>
  );
}
