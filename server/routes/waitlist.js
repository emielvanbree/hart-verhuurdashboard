const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { requireAuth, auditLog } = require('../auth');

router.get('/', requireAuth, async (req, res) => {
  try { res.json(await all(`SELECT w.*, c.name as client_name, c.client_number, c.email, c.due_date FROM waitlist w JOIN clients c ON c.id=w.client_id WHERE w.resolved=0 ORDER BY w.requested_at ASC`)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/', requireAuth, async (req, res) => {
  try {
    const { client_id, article_type, notes } = req.body;
    if (!client_id) return res.status(400).json({ error: 'Klant is verplicht' });
    const r = await run('INSERT INTO waitlist (client_id,article_type,notes) VALUES (?,?,?)', [client_id,article_type||null,notes||null]);
    await auditLog(req.user.id,'ADD_WAITLIST','WAITLIST',r.lastInsertRowid,{client_id,article_type});
    res.status(201).json(await get(`SELECT w.*, c.name as client_name, c.client_number FROM waitlist w JOIN clients c ON c.id=w.client_id WHERE w.id=?`,[r.lastInsertRowid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.patch('/:id/resolve', requireAuth, async (req, res) => {
  try {
    await run("UPDATE waitlist SET resolved=1,resolved_at=datetime('now') WHERE id=?", [req.params.id]);
    await auditLog(req.user.id,'RESOLVE_WAITLIST','WAITLIST',req.params.id,null);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', requireAuth, async (req, res) => {
  try { await run('DELETE FROM waitlist WHERE id=?',[req.params.id]); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;
