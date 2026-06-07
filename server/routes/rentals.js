const express = require('express');
const router = express.Router();
const { get, all, run, getSettings } = require('../db');
const { requireAuth, auditLog } = require('../auth');

function addWorkingDays(dateStr, days) {
  const d = new Date(dateStr);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

async function calcExpectedReturn(pickupDate, birthDate) {
  if (birthDate) return addWorkingDays(birthDate, 3);
  const s = await getSettings();
  const days = parseInt(s.return_deadline_days || '14');
  const d = new Date(pickupDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, q } = req.query;
    let sql = `SELECT rt.*, c.name as client_name, c.email as client_email, c.due_date, c.client_number,
      u.name as processed_by_name,
      (SELECT COUNT(*) FROM rental_items ri WHERE ri.rental_transaction_id=rt.id) as article_count
      FROM rental_transactions rt JOIN clients c ON c.id=rt.client_id JOIN users u ON u.id=rt.processed_by WHERE 1=1`;
    const args = [];
    if (status) { sql += ' AND rt.status=?'; args.push(status); }
    if (q) { sql += ' AND (c.name LIKE ? OR c.client_number LIKE ?)'; args.push(`%${q}%`,`%${q}%`); }
    sql += ' ORDER BY rt.created_at DESC LIMIT 200';
    res.json(await all(sql, args));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const rental = await get(`SELECT rt.*, c.name as client_name, c.email as client_email, c.due_date, c.client_number, c.phone, u.name as processed_by_name
      FROM rental_transactions rt JOIN clients c ON c.id=rt.client_id JOIN users u ON u.id=rt.processed_by WHERE rt.id=?`, [req.params.id]);
    if (!rental) return res.status(404).json({ error: 'Verhuur niet gevonden' });
    const items = await all(`SELECT ri.*, a.name as article_name, a.article_type, a.price, a.deposit_amount, a.status as article_status
      FROM rental_items ri JOIN articles a ON a.id=ri.article_id WHERE ri.rental_transaction_id=?`, [req.params.id]);
    const documents = await all('SELECT * FROM documents WHERE rental_transaction_id=? ORDER BY created_at DESC', [req.params.id]);
    const reservation = rental.reservation_id ? await get(`SELECT r.*, c.name as client_name FROM reservations r JOIN clients c ON c.id=r.client_id WHERE r.id=?`, [rental.reservation_id]) : null;
    const audit = await all(`SELECT al.*, u.name as user_name FROM audit_log al LEFT JOIN users u ON u.id=al.user_id
      WHERE (al.entity_type='RENTAL' AND al.entity_id=?) OR (al.entity_type='RESERVATION' AND al.entity_id=?)
      ORDER BY al.timestamp ASC`, [req.params.id, rental.reservation_id || -1]);
    res.json({ ...rental, items, documents, reservation, audit });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { reservation_id, client_id, article_ids, payment_method, pickup_date, birth_date } = req.body;
    if (!client_id || !article_ids?.length) return res.status(400).json({ error: 'Klant en artikelen zijn verplicht' });
    if (!payment_method || !['pin','cash'].includes(payment_method)) return res.status(400).json({ error: 'Betaalmethode moet "pin" of "cash" zijn' });
    const client = await get('SELECT * FROM clients WHERE id=?', [client_id]);
    if (!client) return res.status(404).json({ error: 'Klant niet gevonden' });

    const pickupDateStr = pickup_date || new Date().toISOString().split('T')[0];
    const expectedReturn = await calcExpectedReturn(pickupDateStr, birth_date || null);
    const deadlineType = birth_date ? 'definitive' : 'estimated';

    if (reservation_id) {
      const reservation = await get('SELECT * FROM reservations WHERE id=?', [reservation_id]);
      if (!reservation) return res.status(404).json({ error: 'Reservering niet gevonden' });
      if (reservation.status === 'CANCELLED') return res.status(409).json({ error: 'Reservering is geannuleerd' });
      const settings = await getSettings();
      if (reservation.status === 'PENDING_SIGNATURE' && settings.unsigned_agreement_blocks_pickup === 'true')
        return res.status(409).json({ error: 'Overeenkomst is nog niet ondertekend' });
    }

    for (const articleId of article_ids) {
      const article = await get('SELECT * FROM articles WHERE id=?', [articleId]);
      if (!article) return res.status(404).json({ error: `Artikel ${articleId} niet gevonden` });
      if (['CHECKED_OUT','INACTIVE'].includes(article.status)) return res.status(409).json({ error: `${article.name} is niet beschikbaar` });
    }

    const r = await run(`INSERT INTO rental_transactions (reservation_id,client_id,pickup_date,expected_return_date,deadline_type,birth_date,status,payment_method,processed_by) VALUES (?,?,?,?,?,?,'CHECKED_OUT',?,?)`,
      [reservation_id||null, client_id, pickupDateStr, expectedReturn, deadlineType, birth_date||null, payment_method, req.user.id]);
    const rentalId = Number(r.lastInsertRowid);

    for (const articleId of article_ids) {
      await run('INSERT INTO rental_items (rental_transaction_id,article_id) VALUES (?,?)', [rentalId, articleId]);
      await run("UPDATE articles SET status='CHECKED_OUT',usage_count=usage_count+1,updated_at=datetime('now') WHERE id=?", [articleId]);
    }
    if (reservation_id) await run("UPDATE reservations SET status='CONFIRMED' WHERE id=? AND status='PENDING_SIGNATURE'", [reservation_id]);

    await auditLog(req.user.id, 'PROCESS_PICKUP', 'RENTAL', rentalId, { reservation_id, article_ids, payment_method });
    const rental = await get(`SELECT rt.*, c.name as client_name, c.client_number FROM rental_transactions rt JOIN clients c ON c.id=rt.client_id WHERE rt.id=?`, [rentalId]);
    res.status(201).json(rental);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/birth-date', requireAuth, async (req, res) => {
  try {
    const { birth_date } = req.body;
    const rental = await get("SELECT * FROM rental_transactions WHERE id=? AND status='CHECKED_OUT'", [req.params.id]);
    if (!rental) return res.status(404).json({ error: 'Actieve verhuur niet gevonden' });
    const newDeadline = addWorkingDays(birth_date, 3);
    await run('UPDATE rental_transactions SET birth_date=?,expected_return_date=?,deadline_type=? WHERE id=?', [birth_date, newDeadline, 'definitive', req.params.id]);
    await auditLog(req.user.id, 'UPDATE_BIRTH_DATE', 'RENTAL', req.params.id, { birth_date, new_deadline: newDeadline });
    res.json({ ok: true, expected_return_date: newDeadline });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.calcExpectedReturn = calcExpectedReturn;
module.exports.addWorkingDays = addWorkingDays;
