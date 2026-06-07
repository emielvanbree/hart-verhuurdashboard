const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { get, all } = require('../db');
const { requireAuth, auditLog } = require('../auth');

router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const doc = await get('SELECT * FROM documents WHERE id=?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Document niet gevonden' });
    const filePath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(__dirname,'..','..', doc.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Bestand niet gevonden op schijf' });
    await auditLog(req.user.id,'DOWNLOAD_DOCUMENT','DOCUMENT',doc.id,{type:doc.type});
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Type','application/pdf');
    res.sendFile(filePath);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rental_id, reservation_id } = req.query;
    if (rental_id) return res.json(await all('SELECT * FROM documents WHERE rental_transaction_id=? ORDER BY created_at DESC',[rental_id]));
    if (reservation_id) return res.json(await all('SELECT * FROM documents WHERE reservation_id=? ORDER BY created_at DESC',[reservation_id]));
    res.json(await all('SELECT * FROM documents ORDER BY created_at DESC LIMIT 50'));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
