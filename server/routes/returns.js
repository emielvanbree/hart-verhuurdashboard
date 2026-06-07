const express = require('express');
const router = express.Router();
const { get, all, run, getSettings } = require('../db');
const { requireAuth, auditLog } = require('../auth');
const { addWorkingDays } = require('./rentals');

async function calculateSettlement(is_complete_set, is_clean, disposables_unopened, expectedReturn, returnDate) {
  const s = await getSettings();
  const lateFee = parseFloat(s.deposit_late_fee || 30);
  const dirtyFee = parseFloat(s.deposit_dirty_fee || 30);
  const dispCredit = parseFloat(s.deposit_disposables_credit || 77.50);
  const late = expectedReturn && new Date(returnDate) > new Date(expectedReturn);
  const dirty = !is_clean;
  let extraCharge = 0, creditNote = 0;
  const reasons = [];
  if (late && dirty) { extraCharge = lateFee + dirtyFee; reasons.push('Te laat EN vies'); }
  else if (late) { extraCharge = lateFee; reasons.push('Te laat teruggebracht'); }
  else if (dirty) { extraCharge = dirtyFee; reasons.push('Vies teruggebracht'); }
  if (disposables_unopened) { creditNote = dispCredit; reasons.push('Disposables ongeopend retour'); }
  return { extraCharge, creditNote, reasons, late, dirty };
}

router.post('/:rentalId/return', requireAuth, async (req, res) => {
  try {
    const { is_complete_set, is_clean, disposables_unopened, return_date, birth_date } = req.body;
    if (is_complete_set === undefined || is_clean === undefined || disposables_unopened === undefined)
      return res.status(400).json({ error: 'Retourchecklist is verplicht' });

    const rental = await get("SELECT * FROM rental_transactions WHERE id=? AND status='CHECKED_OUT'", [req.params.rentalId]);
    if (!rental) return res.status(404).json({ error: 'Actieve verhuur niet gevonden' });

    const returnDateStr = return_date || new Date().toISOString().split('T')[0];
    let expectedReturn = rental.expected_return_date;
    let deadlineType = rental.deadline_type;

    if (birth_date && !rental.birth_date) {
      expectedReturn = addWorkingDays(birth_date, 3);
      deadlineType = 'definitive';
    }

    const settlement = await calculateSettlement(
      Boolean(is_complete_set), Boolean(is_clean), Boolean(disposables_unopened),
      expectedReturn, returnDateStr
    );
    const newSettlementStatus = (settlement.extraCharge > 0 || settlement.creditNote > 0) ? 'open' : 'settled';

    await run(`UPDATE rental_transactions SET status='RETURNED',return_date=?,is_complete_set=?,is_clean=?,disposables_unopened=?,
        birth_date=COALESCE(?,birth_date),expected_return_date=?,deadline_type=?,settlement_status=? WHERE id=?`,
      [returnDateStr, is_complete_set?1:0, is_clean?1:0, disposables_unopened?1:0,
       birth_date||null, expectedReturn, deadlineType, newSettlementStatus, req.params.rentalId]);

    const items = await all('SELECT * FROM rental_items WHERE rental_transaction_id=?', [req.params.rentalId]);
    for (const item of items) await run("UPDATE articles SET status='AVAILABLE',updated_at=datetime('now') WHERE id=?", [item.article_id]);

    await auditLog(req.user.id, 'PROCESS_RETURN', 'RENTAL', req.params.rentalId, { returnDateStr, ...settlement });
    res.json({ ok: true, rental_id: parseInt(req.params.rentalId), settlement });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/:rentalId/extra-invoice', requireAuth, async (req, res) => {
  try {
    const { description, amount } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'Omschrijving en bedrag zijn verplicht' });
    const rental = await get('SELECT * FROM rental_transactions WHERE id=?', [req.params.rentalId]);
    if (!rental) return res.status(404).json({ error: 'Verhuur niet gevonden' });
    await auditLog(req.user.id, 'CREATE_EXTRA_INVOICE', 'RENTAL', req.params.rentalId, { description, amount });
    res.json({ ok: true, description, amount });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.calculateSettlement = calculateSettlement;
