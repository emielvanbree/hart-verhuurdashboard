const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { get, run } = require('../db');
const { requireAuth, auditLog } = require('../auth');

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' });
    const user = await get('SELECT * FROM users WHERE email=? AND active=1', [email.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: 'Ongeldige inloggegevens' });

    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({ error: `Account geblokkeerd. Probeer over ${mins} minuten opnieuw.` });
    }
    if (user.locked_until) await run('UPDATE users SET failed_login_attempts=0,locked_until=NULL WHERE id=?', [user.id]);

    if (!bcrypt.compareSync(password, user.password_hash)) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= LOCKOUT_THRESHOLD) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        await run('UPDATE users SET failed_login_attempts=?,locked_until=? WHERE id=?', [attempts, lockUntil, user.id]);
        return res.status(429).json({ error: `Te veel pogingen. Account geblokkeerd voor ${LOCKOUT_MINUTES} minuten.` });
      }
      await run('UPDATE users SET failed_login_attempts=? WHERE id=?', [attempts, user.id]);
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }

    await run('UPDATE users SET failed_login_attempts=0,locked_until=NULL,last_login_at=? WHERE id=?', [new Date().toISOString(), user.id]);
    req.session.userId = user.id;
    req.session.userRole = user.role;
    await auditLog(user.id, 'LOGIN', 'USER', user.id, { email: user.email });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, must_reset_password: user.must_reset_password === 1 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/logout', async (req, res) => {
  if (req.session?.userId) await auditLog(req.session.userId, 'LOGOUT', 'USER', req.session.userId, null);
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, must_reset_password: req.user.must_reset_password === 1 });
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Wachtwoord moet minimaal 8 tekens zijn' });
    const user = await get('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (user.must_reset_password !== 1) {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash))
        return res.status(401).json({ error: 'Huidig wachtwoord is onjuist' });
    }
    await run('UPDATE users SET password_hash=?,must_reset_password=0 WHERE id=?', [bcrypt.hashSync(newPassword, 10), req.user.id]);
    await auditLog(req.user.id, 'CHANGE_PASSWORD', 'USER', req.user.id, null);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
