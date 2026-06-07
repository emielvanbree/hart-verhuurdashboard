import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { reservations } from '../api.js';
import { StatusBadge, Spinner, EmptyState, PageHeader } from '../components/UI.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day:'2-digit', month:'2-digit', year:'numeric' });
}

export default function Reservations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatusFilter(s);
  }, []);

  useEffect(() => {
    setLoading(true);
    reservations.list({ q, status: statusFilter }).then(setItems).finally(() => setLoading(false));
  }, [q, statusFilter]);

  return (
    <div>
      <PageHeader title="Reserveringen"
        actions={<Link to="/reservations/new" className="btn-primary" data-testid="btn-new-reservation">+ Nieuwe reservering</Link>}
      />

      {/* Filters */}
      <div className="hp-card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-control" style={{ maxWidth: 260 }} placeholder="Zoek op naam of cliëntnummer…"
            value={q} onChange={e => setQ(e.target.value)} data-testid="search-input" />
          <select className="form-control" style={{ maxWidth: 200 }} value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)} data-testid="status-filter">
            <option value="">Alle statussen</option>
            <option value="PENDING_SIGNATURE">Wacht op overeenkomst</option>
            <option value="CONFIRMED">Bevestigd</option>
            <option value="CANCELLED">Geannuleerd</option>
          </select>
          {(q || statusFilter) && <button className="btn-secondary" onClick={() => { setQ(''); setStatusFilter(''); }}>✕ Wissen</button>}
        </div>
      </div>

      {loading ? <Spinner /> : items.length === 0
        ? <EmptyState icon="📋" title="Geen reserveringen gevonden" description="Maak een nieuwe reservering aan." />
        : (
          <div className="hp-card">
            <table className="hp-table" data-testid="reservations-table">
              <thead><tr>
                <th>Cliënt</th><th>Cliëntnr.</th><th>Uitgerekend</th><th>Artikelen</th><th>Status</th><th>Aangemaakt</th><th></th>
              </tr></thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} data-testid="reservation-row">
                    <td><strong>{r.client_name}</strong><br /><small className="text-muted">{r.client_email}</small></td>
                    <td>{r.client_number || '—'}</td>
                    <td>{formatDate(r.due_date)}</td>
                    <td><span className="badge badge-planned">{r.article_count} bad{r.article_count !== 1 ? 'den' : ''}</span></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{formatDate(r.created_at)}</td>
                    <td><Link to={`/reservations/${r.id}`} className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} data-testid="btn-open-reservation">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}
