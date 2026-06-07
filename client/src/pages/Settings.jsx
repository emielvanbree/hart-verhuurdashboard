import React, { useState, useEffect } from 'react';
import { settings as settingsApi } from '../api.js';
import { PageHeader, Alert, Spinner } from '../components/UI.jsx';

export default function Settings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('practice');

  useEffect(() => {
    settingsApi.get().then(setData).finally(() => setLoading(false));
  }, []);

  const update = (key) => (e) => setData(prev => ({ ...prev, [key]: e.target.value }));

  async function handleSave() {
    setSaving(true); setError(''); setSuccess('');
    try {
      await settingsApi.update(data);
      setSuccess('Instellingen opgeslagen');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleTestEmail() {
    setTesting(true); setError(''); setSuccess('');
    try {
      const result = await settingsApi.testEmail();
      setSuccess(result.message || 'Testmail verstuurd');
    } catch (e) { setError(e.message); }
    finally { setTesting(false); }
  }

  if (loading) return <Spinner />;
  if (!data) return <div className="error-msg">Instellingen konden niet worden geladen</div>;

  const tabs = [
    { key: 'practice', label: '🏥 Praktijk' },
    { key: 'email', label: '✉️ E-mail' },
    { key: 'templates', label: '📄 Documenten' },
    { key: 'rental', label: '⚙️ Verhuurregels' },
  ];

  return (
    <div>
      <PageHeader title="Instellingen" subtitle="Configuratie van de applicatie"
        actions={<button className="btn-primary" onClick={handleSave} disabled={saving} data-testid="btn-save-settings">{saving ? 'Opslaan…' : 'Wijzigingen opslaan'}</button>}
      />
      <Alert type="error" message={error} />
      <Alert type="success" message={success} />

      <div className="toggle" style={{ marginBottom: 20 }}>
        {tabs.map(tab => (
          <button key={tab.key} className={`toggle-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)} data-testid={`tab-${tab.key}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'practice' && (
        <div className="hp-card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Praktijkgegevens</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Praktijknaam *</label>
              <input className="form-control" value={data.practice_name || ''} onChange={update('practice_name')} data-testid="input-practice-name" />
            </div>
            <div className="form-group">
              <label className="form-label">E-mailadres (afzender) *</label>
              <input className="form-control" type="email" value={data.practice_email || ''} onChange={update('practice_email')} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefoonnummer</label>
              <input className="form-control" value={data.practice_phone || ''} onChange={update('practice_phone')} />
            </div>
            <div className="form-group">
              <label className="form-label">Adres</label>
              <input className="form-control" value={data.practice_address || ''} onChange={update('practice_address')} />
            </div>
            <div className="form-group">
              <label className="form-label">IBAN</label>
              <input className="form-control" value={data.practice_iban || ''} onChange={update('practice_iban')} placeholder="NL00 BANK 0000 0000 00" />
            </div>
            <div className="form-group">
              <label className="form-label">KvK-nummer</label>
              <input className="form-control" value={data.practice_kvk || ''} onChange={update('practice_kvk')} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div>
          <div className="hp-card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>E-mailmethode</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { value: 'dev', label: '🧪 Ontwikkelmodus', desc: 'E-mails worden opgeslagen als bestand (geen echte verzending)' },
                { value: 'smtp', label: '📮 SMTP', desc: 'Verstuur via eigen mailserver of Gmail/Outlook SMTP' },
                { value: 'graph', label: '🔷 Microsoft Graph API', desc: 'Verstuur via Microsoft 365 / Exchange Online' },
              ].map(opt => (
                <label key={opt.value} style={{ flex: 1, padding: '14px 16px', border: `2px solid ${data.email_method === opt.value ? '#9A1B85' : '#eee'}`,
                  borderRadius: 8, cursor: 'pointer', background: data.email_method === opt.value ? '#fdf0fb' : '#fff' }}>
                  <input type="radio" name="email_method" value={opt.value} checked={data.email_method === opt.value}
                    onChange={update('email_method')} data-testid={`email-method-${opt.value}`} style={{ marginRight: 6 }} />
                  <strong>{opt.label}</strong>
                  <div className="text-muted text-sm" style={{ marginTop: 4 }}>{opt.desc}</div>
                </label>
              ))}
            </div>

            {data.email_method === 'smtp' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">SMTP Host</label>
                  <input className="form-control" value={data.smtp_host || ''} onChange={update('smtp_host')} placeholder="smtp.example.com" data-testid="input-smtp-host" />
                </div>
                <div className="form-group">
                  <label className="form-label">SMTP Poort</label>
                  <input className="form-control" value={data.smtp_port || '587'} onChange={update('smtp_port')} placeholder="587" />
                </div>
                <div className="form-group">
                  <label className="form-label">Gebruikersnaam</label>
                  <input className="form-control" value={data.smtp_user || ''} onChange={update('smtp_user')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Wachtwoord</label>
                  <input className="form-control" type="password" value={data.smtp_pass || ''} onChange={update('smtp_pass')} autoComplete="new-password" />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={data.smtp_secure === 'true'} onChange={e => setData(p => ({...p, smtp_secure: e.target.checked ? 'true' : 'false'}))} />
                    SSL/TLS (poort 465)
                  </label>
                </div>
              </div>
            )}

            {data.email_method === 'graph' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <div style={{ background: '#f0f7ff', border: '1px solid #b3d4f5', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#1a5fa8', marginBottom: 12 }}>
                    ℹ️ Maak een App Registration aan in Azure AD met de <strong>Mail.Send</strong> toestemming. Gebruik <em>Application (client) credentials</em>.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tenant ID</label>
                  <input className="form-control" value={data.graph_tenant_id || ''} onChange={update('graph_tenant_id')} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" data-testid="input-graph-tenant" />
                </div>
                <div className="form-group">
                  <label className="form-label">Client ID (App ID)</label>
                  <input className="form-control" value={data.graph_client_id || ''} onChange={update('graph_client_id')} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Client Secret</label>
                  <input className="form-control" type="password" value={data.graph_client_secret || ''} onChange={update('graph_client_secret')} autoComplete="new-password" />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-secondary" onClick={handleTestEmail} disabled={testing} data-testid="btn-test-email">
              {testing ? 'Bezig…' : '🧪 Testmail versturen'}
            </button>
            <span className="text-muted text-sm">Verstuur een testmail naar je eigen e-mailadres.</span>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="hp-card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Documenttemplates</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Deze teksten verschijnen op de gegenereerde PDF-documenten.</p>
          {[
            { key: 'template_agreement_title', label: 'Overeenkomst — Documenttitel', rows: 1 },
            { key: 'template_agreement_intro', label: 'Overeenkomst — Inleidingstekst', rows: 3 },
            { key: 'template_agreement_conditions', label: 'Overeenkomst — Voorwaarden (één voorwaarde per regel)', rows: 8 },
            { key: 'template_invoice_intro', label: 'Factuur — Inleidingstekst', rows: 2 },
            { key: 'template_invoice_footer', label: 'Factuur — Voettekst', rows: 2 },
            { key: 'template_credit_note_intro', label: 'Creditnota — Inleidingstekst', rows: 2 },
            { key: 'template_footer', label: 'Alle documenten — Voettekst', rows: 1 },
          ].map(({ key, label, rows }) => (
            <div key={key} className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">{label}</label>
              {rows === 1
                ? <input className="form-control" value={data[key] || ''} onChange={update(key)} data-testid={`input-${key}`} />
                : <textarea className="form-control" rows={rows} value={data[key] || ''} onChange={update(key)} data-testid={`input-${key}`} style={{ fontFamily: 'inherit', resize: 'vertical' }} />
              }
            </div>
          ))}
        </div>
      )}

      {activeTab === 'rental' && (
        <div className="hp-card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Verhuurregels & tarieven</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Huurprijs (€)</label>
              <input className="form-control" type="number" step="0.01" value={data.rental_price || '145.00'} onChange={update('rental_price')} />
            </div>
            <div className="form-group">
              <label className="form-label">Borgbedrag disposables (€)</label>
              <input className="form-control" type="number" step="0.01" value={data.deposit_disposables_credit || '77.50'} onChange={update('deposit_disposables_credit')} />
            </div>
            <div className="form-group">
              <label className="form-label">Toeslag te laat (€)</label>
              <input className="form-control" type="number" step="0.01" value={data.deposit_late_fee || '30'} onChange={update('deposit_late_fee')} />
            </div>
            <div className="form-group">
              <label className="form-label">Toeslag vies (€)</label>
              <input className="form-control" type="number" step="0.01" value={data.deposit_dirty_fee || '30'} onChange={update('deposit_dirty_fee')} />
            </div>
            <div className="form-group">
              <label className="form-label">Retourdeadline zonder bevallingsdatum (dagen)</label>
              <input className="form-control" type="number" value={data.return_deadline_days || '14'} onChange={update('return_deadline_days')} />
            </div>
            <div className="form-group">
              <label className="form-label">Max. uitleningen vóór vervanging</label>
              <input className="form-control" type="number" value={data.max_usage_before_replacement || '40'} onChange={update('max_usage_before_replacement')} />
            </div>
            <div className="form-group">
              <label className="form-label">Min. zwangerschapsweek voor uitleen</label>
              <input className="form-control" type="number" value={data.min_gestation_weeks || '36'} onChange={update('min_gestation_weeks')} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" style={{ marginTop: 3 }}
                  checked={data.unsigned_agreement_blocks_pickup === 'true'}
                  onChange={e => setData(p => ({...p, unsigned_agreement_blocks_pickup: e.target.checked ? 'true' : 'false'}))} />
                <span><strong>Ondertekening verplicht voor ophalen</strong><br /><span className="text-muted text-sm">Als aangevinkt: ophalen geblokkeerd totdat overeenkomst ondertekend is.</span></span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
