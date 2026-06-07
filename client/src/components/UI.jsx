// StatusBadge, Modal, TrafficLight, Spinner in one file for now
import React from 'react';

export function StatusBadge({ status }) {
  const map = {
    AVAILABLE: { label: 'Beschikbaar', cls: 'badge-confirmed' },
    RESERVED: { label: 'Gereserveerd', cls: 'badge-planned' },
    CHECKED_OUT: { label: 'Uitgeleend', cls: 'badge-cancelled' },
    INACTIVE: { label: 'Inactief', cls: 'badge-planned' },
    PENDING_SIGNATURE: { label: 'Wacht op overeenkomst', cls: 'badge-planned' },
    CONFIRMED: { label: 'Bevestigd', cls: 'badge-confirmed' },
    CANCELLED: { label: 'Geannuleerd', cls: 'badge-cancelled' },
    RETURNED: { label: 'Geretourneerd', cls: 'badge-confirmed' },
    CHECKED_OUT_OVERDUE: { label: 'Te laat', cls: 'badge-cancelled' },
    MINI: { label: 'Mini', cls: 'badge-planned' },
    NORMAAL: { label: 'Normaal', cls: 'badge-confirmed' },
  };
  const s = map[status] || { label: status, cls: 'badge-planned' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function TrafficLight({ status }) {
  const map = { green: 'green', ok: 'green', orange: 'orange', warn: 'orange', red: 'red', bad: 'red' };
  return <span className={`traffic-light ${map[status] || 'green'}`} />;
}

export function Spinner() {
  return <div className="spinner-wrap"><div className="spinner" /></div>;
}

export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} data-testid="modal-overlay">
      <div className="modal-box" data-testid="modal-box">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} data-testid="modal-close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Alert({ type = 'error', message }) {
  if (!message) return null;
  return <div className={type === 'error' ? 'error-msg' : 'success-msg'} data-testid="alert-msg">{message}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-muted" style={{ marginTop: 2 }}>{subtitle}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={color ? { borderTop: `3px solid ${color}` } : {}}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, description }) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Bevestigen', danger = false }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Annuleren</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} data-testid="confirm-btn">{confirmLabel}</button>
        </div>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
