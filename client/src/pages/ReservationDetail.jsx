import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { reservations, rentals, documents } from '../api.js';
import { StatusBadge, Spinner, Alert, PageHeader, Modal, ConfirmDialog } from '../components/UI.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('nl-NL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function ReservationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('pin');
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split('T')[0]);
  const [processing, setProcessing] = useState(false);
  const [emailModal, setEmailModal] = useState(null); // { docId, to, cc }
  const [emailSuccess, setEmailSuccess] = useState('');

  const load = () => {
    setLoading(true);
    reservations.get(id).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  async function handleCancel() {
    setProcessing(true);
    try {
      await reservations.cancel(id);
      setCancelOpen(false);
      setSuccess('Reservering geannuleerd');
      load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  async function handlePickup() {
    setProcessing(true); setError('');
    try {
      const { rentals: rentalsApi } = await import(/* @vite-ignore */ '../api.js');
      const articleIds = data.items.map(i => i.article_id);
      const rental = await rentalsApi.create({
        reservation_id: data.id, client_id: data.client_id, article_ids: articleIds,
        payment_method: paymentMethod, pickup_date: pickupDate
      });
      await rentalsApi.generateInvoice(rental.id, false).catch(() => {});
      setPickupOpen(false);
      setSuccess('Ophalen verwerkt! Factuur aangemaakt.');
      navigate(`/rentals/${rental.id}`);
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  async function handleGenerateAgreement() {
    setProcessing(true); setError('');
    try {
      await reservations.generateAgreement(id, true);
      setSuccess('Overeenkomst gegenereerd en verstuurd');
      load();
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  }

  if (loading) return <Spinner />;
  if (!data) return <div className="error-msg">{error || 'Niet gevonden'}</div>;

  const canCancel = data.status !== 'CANCELLED' && !data.rental;
  const canPickup = (data.status === 'PENDING_SIGNATURE' || data.status === 'CONFIRMED') && !data.rental;
  const isUnsigned = data.status === 'PENDING_SIGNATURE';

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
      <PageHeader title={`Reservering #${data.id}`}
        subtitle={`${data.client_name} · aangemaakt ${formatDateTime(data.created_at)}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {canCancel && <button className="btn-secondary" onClick={() => setCancelOpen(true)} data-testid="btn-cancel">Annuleren</button>}
            {canPickup && <button className="btn-primary" onClick={() => setPickupOpen(true)} data-testid="btn-pickup">📦 Ophalen verwerken</button>}
          </div>
        }
      />

      <Alert type="error" message={error} />
      <Alert type="success" message={success} />
      <Alert type="success" message={emailSuccess} />

      {isUnsigned && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ Overeenkomst nog niet ondertekend door cliënt.</span>
          <button className="btn-secondary" onClick={handleGenerateAgreement} disabled={processing} style={{ fontSize: 12 }}>Opnieuw sturen</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Client info */}
        <div className="hp-card">
          <div style={{ marginBottom: 12, fontWeight: 700, color: '#237062', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em' }}>Cliëntgegevens</div>
          <div className="form-group"><span className="form-label">Naam</span><strong>{data.client_name}</strong></div>
          <div className="form-group"><span className="form-label">Cliëntnummer</span><span>{data.client_number || '—'}</span></div>
          <div className="form-group"><span className="form-label">E-mail</span><span>{data.client_email}</span></div>
          <div className="form-group"><span className="form-label">Uitgerekend</span><strong>{formatDate(data.due_date)}</strong></div>
        </div>

        {/* Reservation info */}
        <div className="hp-card">
          <div style={{ marginBottom: 12, fontWeight: 700, color: '#237062', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em' }}>Reservering</div>
          <div className="form-group"><span className="form-label">Status</span><StatusBadge status={data.status} /></div>
          <div className="form-group"><span className="form-label">Aangemaakt door</span><span>{data.created_by_name}</span></div>
          <div className="form-group"><span className="form-label">Aangemaakt op</span><span>{formatDateTime(data.created_at)}</span></div>
          {data.cancelled_at && <div className="form-group"><span className="form-label">Geannuleerd op</span><span>{formatDateTime(data.cancelled_at)}</span></div>}
        </div>
      </div>

      {/* Articles */}
      <div className="hp-card" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12, fontWeight: 700, color: '#237062', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em' }}>Geleend materiaal</div>
        <table className="hp-table">
          <thead><tr><th>Artikel</th><th>Type</th><th>Huurprijs</th><th>Borg</th><th>Status</th></tr></thead>
          <tbody>
            {data.items.map(item => (
              <tr key={item.id}>
                <td><strong>{item.article_name}</strong></td>
                <td><StatusBadge status={item.article_type} /></td>
                <td>€{parseFloat(item.price).toFixed(2)}</td>
                <td>€{parseFloat(item.deposit_amount).toFixed(2)}</td>
                <td><StatusBadge status={item.article_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Documents */}
      {data.documents.length > 0 && (
        <div className="hp-card" style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 12, fontWeight: 700, color: '#237062', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em' }}>Documenten</div>
          {data.documents.map(doc => (
            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>
                📄 <strong>{doc.type === 'AGREEMENT' ? 'Uitleenovereenkomst' : doc.type === 'INVOICE' ? 'Factuur' : doc.type}</strong>
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
          ))}
        </div>
      )}

      {/* Audit trail */}
      {data.audit && data.audit.length > 0 && (
        <div className="hp-card" style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 12, fontWeight: 700, color: '#237062', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.08em' }}>Audittrail</div>
          {data.audit.map(entry => (
            <div key={entry.id} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
              <span className="text-muted" style={{ minWidth: 130 }}>{formatDateTime(entry.timestamp)}</span>
              <span className="text-muted">{entry.user_name}</span>
              <span>{entry.action}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rental link */}
      {data.rental && (
        <div className="hp-card" style={{ marginTop: 20, background: '#e9f7f2' }}>
          <strong>✓ Bad uitgeleend</strong> — <Link to={`/rentals/${data.rental.id}`} className="btn-primary" style={{ marginLeft: 8, padding: '4px 12px', fontSize: 12 }}>Open verhuur dossier</Link>
        </div>
      )}

      {/* Cancel confirm */}
      <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={handleCancel}
        title="Reservering annuleren" message={`Weet je zeker dat je reservering #${data.id} voor ${data.client_name} wil annuleren? De badsetten worden direct vrijgegeven.`}
        confirmLabel="Ja, annuleren" danger />

      {/* Pickup modal */}
      <Modal open={pickupOpen} onClose={() => setPickupOpen(false)} title="Ophalen verwerken"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => setPickupOpen(false)}>Annuleren</button>
            <button className="btn-primary" onClick={handlePickup} disabled={processing} data-testid="btn-confirm-pickup">
              {processing ? 'Bezig…' : '✓ Ophalen bevestigen'}
            </button>
          </div>
        }
      >
        {isUnsigned && <div style={{ background: '#fff3cd', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>⚠️ Let op: de overeenkomst is nog niet ondertekend. Je kunt doorgaan, maar dit wordt gelogd.</div>}
        <div className="form-group">
          <label className="form-label">Betaalmethode</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['pin', 'cash'].map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="payment" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} data-testid={`payment-${m}`} />
                {m === 'pin' ? '💳 Pin' : '💵 Contant'}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Uitleen datum</label>
          <input className="form-control" type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} data-testid="pickup-date-input" />
        </div>
        <Alert type="error" message={error} />
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
