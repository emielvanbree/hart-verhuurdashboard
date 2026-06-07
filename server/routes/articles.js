const express = require('express');
const router = express.Router();
const { get, all, run, getAvailableArticles } = require('../db');
const { requireAuth, requireAdmin, auditLog } = require('../auth');

// Period-overlap availability
router.get('/available', requireAuth, async (req, res) => {
  try {
    const { due_date } = req.query;
    if (!due_date) return res.status(400).json({ error: 'due_date is verplicht' });
    const windowStart = new Date(due_date);
    windowStart.setDate(windowStart.getDate() - 28);
    const windowEnd = new Date(due_date);
    windowEnd.setDate(windowEnd.getDate() + 21);
    const articles = await getAvailableArticles(windowStart.toISOString().split('T')[0], windowEnd.toISOString().split('T')[0]);
    res.json(articles);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const articles = await all(isAdmin ? 'SELECT * FROM articles ORDER BY name' : "SELECT * FROM articles WHERE status!='INACTIVE' ORDER BY name");
    res.json(articles);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, price, deposit_amount, dimensions, article_type } = req.body;
    if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
    const r = await run("INSERT INTO articles (name,description,price,deposit_amount,dimensions,article_type,status) VALUES (?,?,?,?,?,?,'AVAILABLE')",
      [name, description||null, parseFloat(price)||145, parseFloat(deposit_amount)||77.5, dimensions||null, article_type||'NORMAAL']);
    await auditLog(req.user.id, 'CREATE_ARTICLE', 'ARTICLE', r.lastInsertRowid, { name });
    res.status(201).json(await get('SELECT * FROM articles WHERE id=?', [r.lastInsertRowid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const article = await get('SELECT * FROM articles WHERE id=?', [req.params.id]);
    if (!article) return res.status(404).json({ error: 'Artikel niet gevonden' });
    const { name, description, price, deposit_amount, dimensions, article_type, status } = req.body;
    const validStatuses = ['AVAILABLE','RESERVED','CHECKED_OUT','INACTIVE'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Ongeldige status' });
    await run("UPDATE articles SET name=?,description=?,price=?,deposit_amount=?,dimensions=?,article_type=?,status=?,updated_at=datetime('now') WHERE id=?",
      [name||article.name, description!==undefined?description:article.description, price!==undefined?parseFloat(price):article.price,
       deposit_amount!==undefined?parseFloat(deposit_amount):article.deposit_amount, dimensions!==undefined?dimensions:article.dimensions,
       article_type||article.article_type, status||article.status, req.params.id]);
    await auditLog(req.user.id, 'UPDATE_ARTICLE', 'ARTICLE', req.params.id, { status });
    res.json(await get('SELECT * FROM articles WHERE id=?', [req.params.id]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const article = await get('SELECT * FROM articles WHERE id=?', [req.params.id]);
    if (!article) return res.status(404).json({ error: 'Artikel niet gevonden' });
    if (['RESERVED','CHECKED_OUT'].includes(article.status)) return res.status(409).json({ error: 'Artikel is momenteel verhuurd of gereserveerd' });
    await run("UPDATE articles SET status='INACTIVE',updated_at=datetime('now') WHERE id=?", [req.params.id]);
    await auditLog(req.user.id, 'DEACTIVATE_ARTICLE', 'ARTICLE', req.params.id, null);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
