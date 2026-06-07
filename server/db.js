const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'verhuurdashboard.db');
const db = createClient({ url: `file:${DB_PATH}` });

// Availability: period-overlap logic
// An article is available if status=AVAILABLE AND no existing active reservation/rental
// whose blocked period overlaps with [windowStart, windowEnd]
async function getAvailableArticles(windowStart, windowEnd) {
  const r = await db.execute({
    sql: `SELECT DISTINCT a.* FROM articles a
          WHERE a.status = 'AVAILABLE'
            AND a.id NOT IN (
              SELECT ri.article_id FROM reservation_items ri
              JOIN reservations r ON r.id = ri.reservation_id
              WHERE r.status NOT IN ('CANCELLED')
                AND r.rental_window_start IS NOT NULL
                AND r.rental_window_end IS NOT NULL
                AND r.rental_window_start <= ?
                AND r.rental_window_end >= ?
            )
            AND a.id NOT IN (
              SELECT rli.article_id FROM rental_items rli
              JOIN rental_transactions rt ON rt.id = rli.rental_transaction_id
              WHERE rt.status = 'CHECKED_OUT'
                AND rt.expected_return_date >= ?
            )
          ORDER BY a.name`,
    args: [windowEnd, windowStart, windowStart]
  });
  return r.rows;
}

async function initSchema() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ASSISTANT', must_reset_password INTEGER DEFAULT 1,
      last_login_at TEXT, failed_login_attempts INTEGER DEFAULT 0, locked_until TEXT,
      active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, description TEXT, price REAL NOT NULL DEFAULT 145.0,
      deposit_amount REAL NOT NULL DEFAULT 77.5, dimensions TEXT,
      article_type TEXT DEFAULT 'NORMAAL', usage_count INTEGER DEFAULT 0,
      photo_url TEXT, status TEXT NOT NULL DEFAULT 'AVAILABLE', notes TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_number TEXT UNIQUE,
      name TEXT NOT NULL, email TEXT NOT NULL, due_date TEXT NOT NULL,
      phone TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
      notes TEXT, week_from INTEGER, week_to INTEGER,
      rental_window_start TEXT, rental_window_end TEXT,
      created_at TEXT DEFAULT (datetime('now')), cancelled_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS reservation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL, article_id INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS rental_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, reservation_id INTEGER,
      client_id INTEGER NOT NULL, pickup_date TEXT NOT NULL,
      expected_return_date TEXT, deadline_type TEXT DEFAULT 'estimated',
      birth_date TEXT, return_date TEXT, status TEXT NOT NULL DEFAULT 'CHECKED_OUT',
      is_complete_set INTEGER, is_clean INTEGER, disposables_unopened INTEGER,
      payment_method TEXT DEFAULT 'pin',
      invoice_status TEXT DEFAULT 'created',
      deposit_paid INTEGER DEFAULT 1,
      refund_paid INTEGER DEFAULT 0,
      settlement_status TEXT DEFAULT 'open',
      processed_by INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS rental_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_transaction_id INTEGER NOT NULL, article_id INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT, rental_transaction_id INTEGER,
      reservation_id INTEGER, type TEXT NOT NULL, file_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')), created_by INTEGER)`,
    `CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL,
      article_type TEXT, requested_at TEXT DEFAULT (datetime('now')),
      notes TEXT, resolved INTEGER DEFAULT 0, resolved_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
      action TEXT NOT NULL, entity_type TEXT, entity_id INTEGER,
      details TEXT, timestamp TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired_at INTEGER NOT NULL)`
  ];
  for (const sql of stmts) await db.execute(sql);
}

async function seedData() {
  const r = await db.execute('SELECT COUNT(*) as c FROM users');
  if (r.rows[0].c > 0) return;

  const adminHash = bcrypt.hashSync('Admin123!', 10);
  await db.execute({ sql: "INSERT INTO users (name,email,password_hash,role,must_reset_password,active) VALUES (?,?,?,'ADMIN',0,1)", args: ['Beheerder','admin@thart.nl',adminHash] });
  const assistHash = bcrypt.hashSync('Assistent123!', 10);
  await db.execute({ sql: "INSERT INTO users (name,email,password_hash,role,must_reset_password,active) VALUES (?,?,?,'ASSISTANT',0,1)", args: ['Praktijkassistente','assistent@thart.nl',assistHash] });

  const articles = [
    ['Bad 1 (MINI)','MINI','Bevallingsbad Mini - 1-persoons, 480L','Buiten: 165x145x71cm | Binnen: 114x94x66cm'],
    ['Bad 2','NORMAAL','Bevallingsbad Normaal - ruimte voor partner, 650L','Buiten: 193x165x76cm | Binnen: 142x114x69cm'],
    ['Bad 3','NORMAAL','Bevallingsbad Normaal - ruimte voor partner, 650L','Buiten: 193x165x76cm | Binnen: 142x114x69cm'],
    ['Bad 4','NORMAAL','Bevallingsbad Normaal - ruimte voor partner, 650L','Buiten: 193x165x76cm | Binnen: 142x114x69cm'],
    ['Bad 5','NORMAAL','Bevallingsbad Normaal - ruimte voor partner, 650L','Buiten: 193x165x76cm | Binnen: 142x114x69cm'],
    ['Bad 6 (MINI)','MINI','Bevallingsbad Mini - 1-persoons, 480L','Buiten: 165x145x71cm | Binnen: 114x94x66cm'],
    ['Bad 7 (MINI)','MINI','Bevallingsbad Mini - 1-persoons, 480L','Buiten: 165x145x71cm | Binnen: 114x94x66cm'],
    ['Bad 8 (MINI)','MINI','Bevallingsbad Mini - 1-persoons, 480L','Buiten: 165x145x71cm | Binnen: 114x94x66cm'],
  ];
  for (const [name,type,desc,dims] of articles) {
    await db.execute({ sql: "INSERT INTO articles (name,article_type,description,price,deposit_amount,dimensions,status) VALUES (?,?,?,145.00,77.50,?,'AVAILABLE')", args:[name,type,desc,dims] });
  }

  const settings = [
    ['email_method','dev'],['smtp_host',''],['smtp_port','587'],['smtp_user',''],['smtp_pass',''],['smtp_secure','false'],
    ['graph_tenant_id',''],['graph_client_id',''],['graph_client_secret',''],
    ['practice_name',"'t Hart Verloskunde"],['practice_email','verhuur@thartverloskundigen.nl'],
    ['practice_address',''],['practice_phone',''],['practice_iban',''],['practice_kvk',''],
    ['template_agreement_title','Uitleenovereenkomst Bevallingsbad'],
    ['template_agreement_intro','Geachte client,\n\nBijgaand vindt u de uitleenovereenkomst voor het bevallingsbad.'],
    ['template_agreement_conditions','1. Het bad mag worden meegenomen vanaf week 36 van de zwangerschap.\n2. Het bad dient uiterlijk 3 werkdagen na de bevalling te worden geretourneerd.\n3. Bij te late retour worden extra kosten in rekening gebracht (EUR 30).\n4. Bij vies retourneren worden reinigingskosten in rekening gebracht (EUR 30).\n5. Bij het ongeschonden retourneren van de ongeopende disposable set wordt EUR 77,50 gecrediteerd.\n6. De huurder is verantwoordelijk voor het materiaal gedurende de uitleenperiode.'],
    ['template_invoice_intro','Hartelijk dank voor uw huur van het bevallingsbad.'],
    ['template_invoice_footer','Betaling bij ophalen - pin of contant.'],
    ['template_credit_note_intro','U heeft de disposable set ongeopend geretourneerd. Het borgbedrag wordt terugbetaald.'],
    ['template_footer','Vragen? Neem contact op via bovenstaand e-mailadres.'],
    ['deposit_late_fee','30'],['deposit_dirty_fee','30'],['deposit_disposables_credit','77.50'],
    ['return_deadline_days','14'],['rental_price','145.00'],
    ['max_usage_before_replacement','40'],['min_gestation_weeks','36'],
    ['unsigned_agreement_blocks_pickup','false'],
  ];
  for (const [k,v] of settings) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)', args:[k,v] });
  }
  console.log('Database seeded. Admin: admin@thart.nl / Admin123!');
}

async function init() {
  await initSchema();
  await seedData();
}

// Helper: get single row
async function get(sql, args=[]) {
  const r = await db.execute({ sql, args });
  return r.rows[0] || null;
}

// Helper: get all rows
async function all(sql, args=[]) {
  const r = await db.execute({ sql, args });
  return r.rows;
}

// Helper: run insert/update/delete
async function run(sql, args=[]) {
  const r = await db.execute({ sql, args });
  return { lastInsertRowid: r.lastInsertRowid, changes: r.rowsAffected };
}

// Helper: run multiple statements in a batch
async function batch(stmts) {
  return db.batch(stmts, 'write');
}

// Helper: get settings as object
async function getSettings() {
  const rows = await all('SELECT key, value FROM settings ORDER BY key');
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

// Helper: get next client number
async function getNextClientNumber() {
  const row = await get("SELECT MAX(CAST(client_number AS INTEGER)) as m FROM clients WHERE client_number IS NOT NULL AND client_number GLOB '[0-9]*'");
  return String((row?.m || 14000) + 1);
}

module.exports = { db, init, get, all, run, batch, getSettings, getNextClientNumber, getAvailableArticles };
