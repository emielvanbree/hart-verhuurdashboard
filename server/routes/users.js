// users.js
const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const bcrypt = require('bcryptjs');
const { requireAdmin, auditLog } = require('../auth');

router.get('/', requireAdmin, async (req, res) => {
  try { res.json(await all('SELECT id,name,email,role,must_reset_password,active,last_login_at,created_at FROM users ORDER BY name')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name||!email||!password) return res.status(400).json({ error: 'Naam, email en wachtwoord zijn verplicht' });
    if (!['ASSISTANT','ADMIN'].includes(role)) return res.status(400).json({ error: 'Ongeldige rol' });
    const existing = await get('SELECT id FROM users WHERE email=?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Emailadres al in gebruik' });
    const r = await run('INSERT INTO users (name,email,password_hash,role,must_reset_password,active) VALUES (?,?,?,?,1,1)',
      [name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password,10), role||'ASSISTANT']);
    await auditLog(req.user.id,'CREATE_USER','USER',r.lastInsertRowid,{name,email,role});
    res.status(201).json(await get('SELECT id,name,email,role,must_reset_password,active FROM users WHERE id=?',[r.lastInsertRowid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (parseInt(req.params.id)===req.user.id && req.body.active===false) return res.status(400).json({ error: 'Je kunt je eigen account niet deactiveren' });
    const { name, email, role, active, password } = req.body;
    const hash = password ? bcrypt.hashSync(password,10) : user.password_hash;
    await run('UPDATE users SET name=?,email=?,role=?,active=?,password_hash=? WHERE id=?',
      [name||user.name, email?email.toLowerCase():user.email, role||user.role, active!==undefined?(active?1:0):user.active, hash, req.params.id]);
    await auditLog(req.user.id,'UPDATE_USER','USER',req.params.id,{role,active});
    res.json(await get('SELECT id,name,email,role,must_reset_password,active FROM users WHERE id=?',[req.params.id]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;
