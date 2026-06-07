const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { init, get, run, all, getSettings } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new FileStore({ path: dataDir + '/sessions', ttl: 28800, logFn: ()=>{} }),
  secret: process.env.SESSION_SECRET || 'verhuurdashboard-dev-secret-change-in-production',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV==='production', maxAge: 8*60*60*1000, sameSite: 'lax' },
  rolling: true
}));

app.use('/api/auth/login', rateLimit({ windowMs: 60000, max: 10, message: { error: 'Te veel verzoeken.' } }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/rentals', require('./routes/rentals'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/waitlist', require('./routes/waitlist'));

const { requireAuth } = require('./auth');
const { generateAgreementPDF, generateInvoicePDF, generateCreditNotePDF, generateExtraInvoicePDF } = require('./services/pdf');
const { sendAgreementEmail, sendInvoiceEmail } = require('./services/email');
const { calculateSettlement } = require('./routes/returns');

// Generate agreement PDF + email
app.post('/api/reservations/:id/agreement', requireAuth, async (req, res) => {
  try {
    const reservation = await get('SELECT * FROM reservations WHERE id=?', [req.params.id]);
    if (!reservation) return res.status(404).json({ error: 'Reservering niet gevonden' });
    const client = await get('SELECT * FROM clients WHERE id=?', [reservation.client_id]);
    const articles = await all(`SELECT a.* FROM reservation_items ri JOIN articles a ON a.id=ri.article_id WHERE ri.reservation_id=?`, [req.params.id]);
    const settings = await getSettings();
    const { filePath, filename } = await generateAgreementPDF({ client, articles, reservation, settings });
    const r = await run('INSERT INTO documents (reservation_id,type,file_path,created_by) VALUES (?,?,?,?)', [reservation.id,'AGREEMENT',filePath,req.user.id]);
    if (req.body.send_email !== false) await sendAgreementEmail({ client, pdfPath: filePath, settings }).catch(e => console.error('Email err:', e.message));
    res.json({ ok: true, document_id: Number(r.lastInsertRowid), filename });
  } catch(e) { res.status(500).json({ error: 'PDF generatie mislukt: ' + e.message }); }
});

// Generate invoice PDF
app.post('/api/rentals/:id/invoice', requireAuth, async (req, res) => {
  try {
    const rental = await get('SELECT * FROM rental_transactions WHERE id=?', [req.params.id]);
    if (!rental) return res.status(404).json({ error: 'Verhuur niet gevonden' });
    const client = await get('SELECT * FROM clients WHERE id=?', [rental.client_id]);
    const articles = await all(`SELECT a.* FROM rental_items ri JOIN articles a ON a.id=ri.article_id WHERE ri.rental_transaction_id=?`, [req.params.id]);
    const settings = await getSettings();
    // Prevent duplicate invoices
    const existingInvoice = await get("SELECT id FROM documents WHERE rental_transaction_id=? AND type='INVOICE'", [rental.id]);
    if (existingInvoice) return res.json({ ok: true, document_id: existingInvoice.id, filename: 'existing', note: 'Factuur bestaat al' });
    const { filePath, filename } = await generateInvoicePDF({ client, articles, rental, settings, invoiceNumber: String(rental.id) });
    const r = await run('INSERT INTO documents (rental_transaction_id,type,file_path,created_by) VALUES (?,?,?,?)', [rental.id,'INVOICE',filePath,req.user.id]);
    await run("UPDATE rental_transactions SET invoice_status='created' WHERE id=?", [rental.id]);
    if (req.body.send_email) await sendInvoiceEmail({ client, pdfPath: filePath, settings }).catch(e => console.error('Email err:', e.message));
    res.json({ ok: true, document_id: Number(r.lastInsertRowid), filename });
  } catch(e) { res.status(500).json({ error: 'PDF generatie mislukt: ' + e.message }); }
});

// Generate settlement docs
app.post('/api/rentals/:id/settlement-docs', requireAuth, async (req, res) => {
  try {
    const rental = await get('SELECT * FROM rental_transactions WHERE id=?', [req.params.id]);
    if (!rental) return res.status(404).json({ error: 'Verhuur niet gevonden' });
    const client = await get('SELECT * FROM clients WHERE id=?', [rental.client_id]);
    const settings = await getSettings();
    const settlement = await calculateSettlement(rental.is_complete_set, rental.is_clean, rental.disposables_unopened, rental.expected_return_date, rental.return_date);
    const docs = [];
    if (settlement.extraCharge > 0) {
      const desc = settlement.reasons.filter(r => r!=='Disposables ongeopend retour').join(', ') || 'Aanvullende kosten';
      const { filePath, filename } = await generateExtraInvoicePDF({ client, rental, description: desc, amount: settlement.extraCharge, settings });
      const r = await run('INSERT INTO documents (rental_transaction_id,type,file_path,created_by) VALUES (?,?,?,?)', [rental.id,'EXTRA_INVOICE',filePath,req.user.id]);
      docs.push({ type:'EXTRA_INVOICE', document_id: Number(r.lastInsertRowid), filename, amount: settlement.extraCharge });
    }
    if (settlement.creditNote > 0) {
      const { filePath, filename } = await generateCreditNotePDF({ client, rental, creditAmount: settlement.creditNote, settings });
      const r = await run('INSERT INTO documents (rental_transaction_id,type,file_path,created_by) VALUES (?,?,?,?)', [rental.id,'CREDIT_NOTE',filePath,req.user.id]);
      docs.push({ type:'CREDIT_NOTE', document_id: Number(r.lastInsertRowid), filename, amount: settlement.creditNote });
    }
    if (docs.length === 0) await run("UPDATE rental_transactions SET settlement_status='settled' WHERE id=?", [rental.id]);
    res.json({ ok: true, settlement, documents: docs });
  } catch(e) { res.status(500).json({ error: 'Afrekening mislukt: ' + e.message }); }
});

// Test email
app.post('/api/settings/test-email', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();
    const { dispatchEmail } = require('./services/email');
    await dispatchEmail({ settings, to: req.user.email, subject: 'Testmail - Verhuurdashboard',
      htmlBody: `<p>Testmail verstuurd via methode: <strong>${settings.email_method||'dev'}</strong></p>`, attachments: [] });
    res.json({ ok: true, message: `Testmail verstuurd naar ${req.user.email}` });
  } catch(e) { res.status(500).json({ error: 'Email test mislukt: ' + e.message }); }
});


// Document HTML preview (opens in browser tab for editing + printing)
app.get('/api/documents/:id/view', requireAuth, async (req, res) => {
  try {
    const doc = await get('SELECT * FROM documents WHERE id=?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Document niet gevonden' });
    const path = require('path');
    const fs = require('fs');
    const htmlPath = doc.file_path.replace(/\.pdf$/, '.html');
    const filePath = path.isAbsolute(htmlPath) ? htmlPath : path.join(__dirname, '..', htmlPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'HTML preview niet beschikbaar' });
    const { auditLog: _auditLog } = require('./auth'); await _auditLog(req.user.id, 'VIEW_DOCUMENT', 'DOCUMENT', doc.id, { type: doc.type });
    // Inject print button + contenteditable into the HTML
    let html = fs.readFileSync(filePath, 'utf8');
    const printBar = `<div id="printbar" style="position:fixed;top:0;left:0;right:0;background:#237062;color:#fff;padding:10px 20px;display:flex;gap:10px;align-items:center;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:Arial,sans-serif">
      <span style="font-weight:700;font-size:14px;flex:1">'t Hart Verhuurdashboard ‚Ä" Documentvoorvertoning</span>
      <span style="font-size:12px;opacity:0.8;margin-right:8px">ü'° Klik op tekst om te bewerken</span>
      <button onclick="window.print()" style="background:#9A1B85;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px">ü-®Ô∏è Afdrukken</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px">‚úï Sluiten</button>
    </div>
    <style>
      @media print { #printbar { display: none !important; } body { padding-top: 0 !important; } }
      body { padding-top: 56px; }
      [contenteditable]:hover { outline: 2px dashed #9A1B85; border-radius: 3px; cursor: text; }
      [contenteditable]:focus { outline: 2px solid #9A1B85; border-radius: 3px; background: #fdf0fb; }
    </style>`;
    // Make text blocks editable
    html = html.replace('<body>', '<body>\n' + printBar);
    // Make paragraphs and specific divs contenteditable
    html = html.replace(/<p([^>]*)>/g, '<p$1 contenteditable="true">');
    html = html.replace(/class="text-block"/g, 'class="text-block" contenteditable="true"');
    html = html.replace(/class="sig-field-label"/g, 'class="sig-field-label" contenteditable="true"');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Generate return receipt
app.post('/api/rentals/:id/return-receipt', requireAuth, async (req, res) => {
  try {
    const rental = await get('SELECT * FROM rental_transactions WHERE id=?', [req.params.id]);
    if (!rental) return res.status(404).json({ error: 'Verhuur niet gevonden' });
    const client = await get('SELECT * FROM clients WHERE id=?', [rental.client_id]);
    const articles = await all('SELECT a.* FROM rental_items ri JOIN articles a ON a.id=ri.article_id WHERE ri.rental_transaction_id=?', [req.params.id]);
    const settings = await getSettings();
    const { calculateSettlement } = require('./routes/returns');
    const settlement = rental.return_date ? await calculateSettlement(rental.is_complete_set, rental.is_clean, rental.disposables_unopened, rental.expected_return_date, rental.return_date) : null;
    const { generateReturnReceiptPDF } = require('./services/pdf');
    const { filePath, filename } = await generateReturnReceiptPDF({ client, rental, articles, settlement, settings });
    const r = await run('INSERT INTO documents (rental_transaction_id,type,file_path,created_by) VALUES (?,?,?,?)', [rental.id,'RETURN_RECEIPT',filePath,req.user.id]);
    res.json({ ok: true, document_id: Number(r.lastInsertRowid), filename });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// Email a specific document to the client
app.post('/api/documents/:id/email', requireAuth, async (req, res) => {
  try {
    const doc = await get('SELECT * FROM documents WHERE id=?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Document niet gevonden' });
    const path = require('path');
    const fs = require('fs');
    const filePath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(__dirname, '..', doc.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Bestand niet gevonden' });

    const settings = await getSettings();
    const { dispatchEmail } = require('./services/email');

    // Get client via rental or reservation
    let client = null;
    if (doc.rental_transaction_id) {
      const rental = await get('SELECT * FROM rental_transactions WHERE id=?', [doc.rental_transaction_id]);
      if (rental) client = await get('SELECT * FROM clients WHERE id=?', [rental.client_id]);
    } else if (doc.reservation_id) {
      const reservation = await get('SELECT * FROM reservations WHERE id=?', [doc.reservation_id]);
      if (reservation) client = await get('SELECT * FROM clients WHERE id=?', [reservation.client_id]);
    }
    if (!client) return res.status(404).json({ error: 'Cli√´nt niet gevonden' });

    const typeLabels = {
      INVOICE: 'Factuur', AGREEMENT: 'Uitleenovereenkomst', CREDIT_NOTE: 'Creditnota',
      EXTRA_INVOICE: 'Extra factuur', RETURN_RECEIPT: 'Ontvangstbevestiging'
    };
    const label = typeLabels[doc.type] || doc.type;
    const subject = `${label} bevallingsbad ‚Ä" ${settings.practice_name}`;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#237062;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">${settings.practice_name}</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p>Beste ${client.name},</p>
          <p style="margin-top:12px">Bijgevoegd vindt u de <strong>${label}</strong> voor de huur van het bevallingsbad.</p>
          <p style="margin-top:20px;color:#666;font-size:12px">Met vriendelijke groet,<br><strong>${settings.practice_name}</strong><br>${settings.practice_email}</p>
        </div>
      </div>`;

    const toAddress = req.body.to || client.email;
    const ccAddress = req.body.cc || null;
    await dispatchEmail({
      settings, to: toAddress, cc: ccAddress, subject, htmlBody,
      attachments: [{ filename: label.replace(/ /g,'_') + '.pdf', path: filePath }]
    });

    const { auditLog: _al } = require('./auth');
    await _al(req.user.id, 'EMAIL_DOCUMENT', 'DOCUMENT', doc.id, { type: doc.type, to: client.email });
    const sentTo = req.body.to || client.email;
    res.json({ ok: true, message: `${label} verstuurd naar ${sentTo}${req.body.cc ? ' (CC: ' + req.body.cc + ')' : ''}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Serve React build
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => { if (!req.path.startsWith('/api')) res.sendFile(path.join(clientBuild,'index.html')); });
} else {
  app.get('/', (req, res) => res.json({ status: 'API running on port ' + PORT }));
}

async function cleanupDuplicateDocuments() {
  // Remove duplicate documents (keep only the first per type per rental)
  try {
    const dupes = await all(`
      SELECT id FROM documents WHERE id NOT IN (
        SELECT MIN(id) FROM documents GROUP BY rental_transaction_id, reservation_id, type
      )`);
    if (dupes.length > 0) {
      for (const d of dupes) await run('DELETE FROM documents WHERE id=?', [d.id]);
      console.log(`Cleaned up ${dupes.length} duplicate document(s)`);
    }
  } catch(e) { console.error('Cleanup error:', e.message); }
}

async function start() {
  await init();
  await cleanupDuplicateDocuments();
  app.listen(PORT, () => {
    console.log(`\n‚úÖ Verhuurdashboard draait op http://localhost:${PORT}`);
    console.log(`   Admin:     admin@thart.nl / Admin123!`);
    console.log(`   Assistent: assistent@thart.nl / Assistent123!\n`);
  });
}

start().catch(e => { console.error('Start error:', e); process.exit(1); });
