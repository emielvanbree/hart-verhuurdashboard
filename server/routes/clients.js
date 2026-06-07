const express = require('express');
const router = express.Router();
const { get, all, run, getNextClientNumber } = require('../db');
const { requireAuth, auditLog } = require('../auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    const clients = q
      ? await all("SELECT * FROM clients WHERE name LIKE ? OR email LIKE ? OR client_number LIKE ? ORDER BY created_at DESC", [`%${q}%`,`%${q}%`,`%${q}%`])
      : await all('SELECT * FROM clients ORDER BY created_at DESC LIMIT 200');
    res.json(clients);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, email, due_date, phone } = req.body;
    if (!name || !email || !due_date) return res.status(400).json({ error: 'Naam, email en uitgerekende datum zijn verplicht' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Ongeldig emailadres' });
    const clientNumber = await getNextClientNumber();
    const r = await run('INSERT INTO clients (client_number,name,email,due_date,phone) VALUES (?,?,?,?,?)',
      [clientNumber, name.trim(), email.toLowerCase().trim(), due_date, phone||null]);
    await auditLog(req.user.id, 'CREATE_CLIENT', 'CLIENT', r.lastInsertRowid, { name });
    res.status(201).json(await get('SELECT * FROM clients WHERE id=?', [r.lastInsertRowid]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const client = await get('SELECT * FROM clients WHERE id=?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Klant niet gevonden' });
    const reservations = await all('SELECT * FROM reservations WHERE client_id=? ORDER BY created_at DESC', [req.params.id]);
    const rentals = await all('SELECT * FROM rental_transactions WHERE client_id=? ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...client, reservations, rentals });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
