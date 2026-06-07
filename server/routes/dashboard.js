const express = require('express');
const router = express.Router();
const { all, get } = require('../db');
const { requireAuth } = require('../auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);

    const [overdue, activeRentals, openReservations, availableArticles, totalArticles,
           waitlistCount, needsReplacement, recentActivity, upcomingReservations] = await Promise.all([
      all(`SELECT rt.id, rt.pickup_date, rt.expected_return_date, rt.deadline_type, rt.birth_date, rt.settlement_status,
             c.name as client_name, c.client_number, c.email, c.due_date,
             a.name as article_name, a.article_type
           FROM rental_transactions rt
           JOIN clients c ON c.id=rt.client_id
           JOIN rental_items ri ON ri.rental_transaction_id=rt.id
           JOIN articles a ON a.id=ri.article_id
           WHERE rt.status='CHECKED_OUT' AND rt.expected_return_date < ?
           ORDER BY rt.expected_return_date ASC`, [today]),
      get("SELECT COUNT(*) as c FROM rental_transactions WHERE status='CHECKED_OUT'"),
      get("SELECT COUNT(*) as c FROM reservations WHERE status IN ('PENDING_SIGNATURE','CONFIRMED')"),
      get("SELECT COUNT(*) as c FROM articles WHERE status='AVAILABLE'"),
      get("SELECT COUNT(*) as c FROM articles WHERE status!='INACTIVE'"),
      get("SELECT COUNT(*) as c FROM waitlist WHERE resolved=0"),
      all("SELECT * FROM articles WHERE usage_count >= 40 AND status!='INACTIVE'"),
      all(`SELECT al.*, u.name as user_name FROM audit_log al LEFT JOIN users u ON u.id=al.user_id ORDER BY al.timestamp DESC LIMIT 10`),
      all(`SELECT r.*, c.name as client_name, c.due_date, c.client_number FROM reservations r
           JOIN clients c ON c.id=r.client_id WHERE r.status NOT IN ('CANCELLED') AND c.due_date BETWEEN ? AND ?
           ORDER BY c.due_date ASC LIMIT 10`, [today, nextWeek.toISOString().split('T')[0]])
    ]);

    res.json({
      stats: {
        activeRentals: activeRentals.c, openReservations: openReservations.c,
        availableArticles: availableArticles.c, totalArticles: totalArticles.c,
        waitlistCount: waitlistCount.c, overdueCount: overdue.length
      },
      overdue, needsReplacement, recentActivity, upcomingReservations
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
