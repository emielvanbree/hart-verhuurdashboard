const express = require('express');
const router = express.Router();
const { all, run } = require('../db');
const { requireAdmin, requireAuth } = require('../auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await all('SELECT key,value FROM settings ORDER BY key');
    const obj = {}; rows.forEach(r => { obj[r.key]=r.value; });
    res.json(obj);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/', requireAdmin, async (req, res) => {
  try {
    for (const [key,value] of Object.entries(req.body)) {
      if (typeof value==='string'||typeof value==='number')
        await run("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))",[key,String(value)]);
    }
    const rows = await all('SELECT key,value FROM settings ORDER BY key');
    const obj = {}; rows.forEach(r => { obj[r.key]=r.value; });
    res.json(obj);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;
