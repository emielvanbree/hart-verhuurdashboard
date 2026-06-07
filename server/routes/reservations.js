const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { requireAuth, auditLog } = require('../auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, q } = req.query;
    let sql = `SELECT r.*, c.name as client_name, c.email as client_email, c.due_date, c.client_number,
      (SELECT COUNT(*) FROM reservation_items ri WHERE ri.reservation_id=r.id) as article_count
      FROM reservations r JOIN clients c ON c.id=r.client_id WHERE 1=1`;
    const args = [];
    if (status) { sql += ' AND r.status=?'; args.push(status); }
    if (q) { sql += ' AND (c.name LIKE ? OR c.client_number LIKE ?)'; args.push(`%${q}%`,`%${q}%`); }
    sql += ' ORDER BY r.created_at DESC LIMIT 200';
    res.json(await all(sql, args));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const reservation = await get(`SELECT r.*, c.name as client_name, c.email as client_email, c.due_date, c.client_number, u.name as created_by_name
      FROM reservations r JOIN clients c ON c.id=r.client_id JOIN users u ON u.id=r.created_by WHERE r.id=?`, [req.params.id]);
    if (!reservation) return res.status(404).json({ error: 'Reservering niet gevonden' });
    const items = await all(`SELECT ri.*, a.name as article_name, a.article_type, a.price, a.deposit_amount, a.status as article_status
      FROM reservation_items ri JOIN articles a ON a.id=ri.article_id WHERE ri.reservation_id=?`, [req.params.id]);
    const documents = await all('SELECT * FROM documents WHERE reservation_id=? ORDER BY created_at DESC', [req.params.id]);
    const rental = await get('SELECT * FROM rental_transactions WHERE reservation_id=?', [req.params.id]);
    const audit = await all(`SELECT al.*, u.name as user_name FROM audit_log al LEFT JOIN users u ON u.id=al.user_id
      WHERE al.entity_type='RESERVATION' AND al.entity_id=? ORDER BY al.timestamp DESC`, [req.params.id]);
    res.json({ ...reservation, items, documents, rental, audit });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { client_id, article_ids, notes, week_from, week_to } = req.body;
    if (!client_id || !article_ids?.length) return res.status(400).json({ error: 'Klant en minimaal één artikel zijn verplicht' });
    const client = await get('SELECT * FROM clients WHERE id=?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Klant niet gevonden' });

    // Compute rental window from due_date
    const dueDate = new Date(client.due_date);
    const windowStart = new Date(dueDate); windowStart.setDate(windowStart.getDate() - 28);
    const windowEnd = new Date(dueDate); windowEnd.setDate(windowEnd.getDate() + 21);

    for (const articleId of article_ids) {
      const article = await get('SELECT * FROM articles WHERE id=?', [articleId]);
      if (!article) return res.status(404).json({ error: `Artikel ${articleId} niet gevonden` });
      if (article.status !== 'AVAILABLE') return res.status(409).json({ error: `${article.name} is niet beschikbaar (status: ${article.status})` });
    }

    const r = await run(`INSERT INTO reservations (client_id,created_by,status,notes,week_from,week_to,rental_window_start,rental_window_end) VALUES (?,?,'PENDING_SIGNATURE',?,?,?,?,?)`,
      [client_id, req.user.id, notes||null, week_from||null, week_to||null, windowStart.toISOString().split('T')[0], windowEnd.toISOString().split('T')[0]]);
    const reservationId = Number(r.lastInsertRowid);

    for (const articleId of article_ids) {
      await run('INSERT INTO reservation_items (reservation_id,article_id) VALUES (?,?)', [reservationId, articleId]);
      await run("UPDATE articles SET status='RESERVED',updated_at=datetime('now') WHERE id=?", [articleId]);
    }

    await auditLog(req.user.id, 'CREATE_RESERVATION', 'RESERVATION', reservationId, { client_id, article_ids });
    const reservation = await get(`SELECT r.*, c.name as client_name, c.email as client_email, c.due_date, c.client_number
      FROM reservations r JOIN clients c ON c.id=r.client_id WHERE r.id=?`, [reservationId]);
    res.status(201).json(reservation);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const reservation = await get('SELECT * FROM reservations WHERE id=?', [req.params.id]);
    if (!reservation) return res.status(404).json({ error: 'Reservering niet gevonden' });
    if (reservation.status === 'CANCELLED') return res.status(409).json({ error: 'Al geannuleerd' });
    const hasRental = await get('SELECT id FROM rental_transactions WHERE reservation_id=?', [req.params.id]);
    if (hasRental) return res.status(409).json({ error: 'Kan niet annuleren — bad is al uitgeleverd' });
    await run("UPDATE reservations SET status='CANCELLED',cancelled_at=datetime('now') WHERE id=?", [req.params.id]);
    const items = await all('SELECT * FROM reservation_items WHERE reservation_id=?', [req.params.id]);
    for (const item of items) await run("UPDATE articles SET status='AVAILABLE',updated_at=datetime('now') WHERE id=?", [item.article_id]);
    await auditLog(req.user.id, 'CANCEL_RESERVATION', 'RESERVATION', req.params.id, null);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/confirm', requireAuth, async (req, res) => {
  try {
    const reservation = await get('SELECT * FROM reservations WHERE id=?', [req.params.id]);
    if (!reservation) return res.status(404).json({ error: 'Reservering niet gevonden' });
    await run("UPDATE reservations SET status='CONFIRMED' WHERE id=?", [req.params.id]);
    await auditLog(req.user.id, 'CONFIRM_RESERVATION', 'RESERVATION', req.params.id, null);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
