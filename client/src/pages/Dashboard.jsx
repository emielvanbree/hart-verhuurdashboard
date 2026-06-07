import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboard } from '../api.js';
import { StatusBadge, Spinner, EmptyState, PageHeader } from '../components/UI.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function daysOverdue(expected) {
  if (!expected) return 0;
  return Math.floor((Date.now() - new Date(expected).getTime()) / 86400000);
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboard.get().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <div className="error-msg">Dashboard kon niet worden geladen.</div>;

  const { stats, overdue, needsReplacement, upcomingReservations } = data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overzicht verhuurdashboard 't Hart Verloskunde" />

      {/* Overdue alert — full width */}
      {overdue.length > 0 && (
        <div className="hp-card" style={{ marginBottom: 20, borderLeft: '4px solid #e74c3c' }}>
          <h3 style={{ color: '#e74c3c', marginBottom: 12, fontSize: 15 }}>
            ⚠️ {overdue.length} bad{overdue.length > 1 ? 'den' : ''} te laat terug
          </h3>
          <table className="hp-table" data-testid="overdue-table">
            <thead><tr>
              <th>Cliënt</th><th>Bad</th><th>Verwachte retour</th><th>Dagen te laat</th><th></th>
            </tr></thead>
            <tbody>
              {overdue.map(item => (
                <tr key={`${item.id}-${item.article_name}`}>
                  <td><strong>{item.client_name}</strong><br /><small className="text-muted">{item.client_number}</small></td>
                  <td>{item.article_name} <StatusBadge status={item.article_type} /></td>
                  <td>{formatDate(item.expected_return_date)}</td>
                  <td><span style={{ color: '#e74c3c', fontWeight: 700 }}>{daysOverdue(item.expected_return_date)} dagen</span></td>
                  <td><Link to={`/rentals/${item.id}`} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>Dossier</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Main 2-column grid — stats + content aligned */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* LEFT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Left stat cards: 2 per row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="stat-card" style={{ borderTop: '3px solid #237062' }} data-testid="stats-grid">
              <div className="stat-value">{stats.activeRentals}</div>
              <div className="stat-label">Actief uitgeleend</div>
            </div>
            <div className="stat-card" style={{ borderTop: `3px solid ${stats.overdueCount > 0 ? '#e74c3c' : '#27ae60'}` }}>
              <div className="stat-value" style={{ color: stats.overdueCount > 0 ? '#e74c3c' : 'inherit' }}>{stats.overdueCount}</div>
              <div className="stat-label">Te laat terug</div>
            </div>
          </div>

          {/* Aankomende uitleendagen */}
          <div className="hp-card" style={{ flex: 1 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, color: '#237062', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              📅 Aankomende uitleendagen
            </h3>
            {upcomingReservations.length === 0
              ? <EmptyState icon="📅" title="Geen aankomende reserveringen" />
              : <table className="hp-table">
                  <thead><tr><th>Cliënt</th><th>Uitgerekend</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {upcomingReservations.map(r => (
                      <tr key={r.id}>
                        <td>{r.client_name}<br /><small className="text-muted">{r.client_number}</small></td>
                        <td>{formatDate(r.due_date)}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td><Link to={`/reservations/${r.id}`} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Right stat cards: 2 per row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="stat-card" style={{ borderTop: '3px solid #9A1B85' }}>
              <div className="stat-value">{stats.openReservations}</div>
              <div className="stat-label">Open reserveringen</div>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #27ae60' }}>
              <div className="stat-value">{stats.availableArticles} / {stats.totalArticles}</div>
              <div className="stat-label">Beschikbaar</div>
              <div className="stat-sub">badsetten</div>
            </div>
          </div>

          {/* Vervanging aanbevolen */}
          <div className="hp-card" style={{ flex: 1 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, color: '#237062', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🔧 Vervanging aanbevolen
            </h3>
            {needsReplacement.length === 0
              ? <EmptyState icon="✅" title="Alle badsetten in orde" description="Geen badsetten die vervangen moeten worden." />
              : <table className="hp-table">
                  <thead><tr><th>Bad</th><th>Uitleningen</th><th>Status</th></tr></thead>
                  <tbody>
                    {needsReplacement.map(a => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td><span style={{ color: '#e74c3c', fontWeight: 700 }}>{a.usage_count}×</span></td>
                        <td><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Vervanging aanbevolen na 40 uitleningen.</p>
          </div>
        </div>
      </div>

      {/* Wachtlijst badge als er items zijn */}
      {stats.waitlistCount > 0 && (
        <div className="hp-card" style={{ marginBottom: 20, borderLeft: '4px solid #f39c12', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⏳ <strong>{stats.waitlistCount}</strong> cliënt{stats.waitlistCount > 1 ? 'en' : ''} op de wachtlijst</span>
          <Link to="/waitlist" className="btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }}>Bekijken</Link>
        </div>
      )}

      {/* Snelle acties */}
      <div className="hp-card">
        <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, color: '#237062', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Snelle acties
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/reservations/new" className="btn-primary" data-testid="btn-new-reservation">+ Nieuwe reservering</Link>
          <Link to="/walk-in" className="btn-secondary" data-testid="btn-walk-in">⚡ Direct uitleen</Link>
          <Link to="/reservations?status=CONFIRMED" className="btn-secondary">📦 Ophalen verwerken</Link>
        </div>
      </div>
    </div>
  );
}
