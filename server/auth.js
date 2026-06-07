const { get, run } = require('./db');

async function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const user = await get('SELECT * FROM users WHERE id=? AND active=1', [req.session.userId]);
  if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Sessie verlopen' }); }
  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Niet ingelogd' });
  const user = await get('SELECT * FROM users WHERE id=? AND active=1', [req.session.userId]);
  if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Sessie verlopen' }); }
  if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Onvoldoende rechten' });
  req.user = user;
  next();
}

async function auditLog(userId, action, entityType, entityId, details) {
  try {
    await run('INSERT INTO audit_log (user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)',
      [userId, action, entityType, entityId || null, details ? JSON.stringify(details) : null]);
  } catch(e) { console.error('Audit log error:', e.message); }
}

module.exports = { requireAuth, requireAdmin, auditLog };
