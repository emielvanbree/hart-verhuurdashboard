// Custom session store using @libsql/client (same DB as the app)
const session = require('express-session');
const Store = session.Store;

class LibsqlStore extends Store {
  constructor(db) {
    super();
    this.db = db;
    // Create sessions table
    db.execute(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired_at INTEGER NOT NULL
    )`).catch(e => console.error('Session table error:', e.message));
    // Cleanup expired sessions every 15 min
    setInterval(() => {
      db.execute({ sql: 'DELETE FROM sessions WHERE expired_at <= ?', args: [Date.now()] })
        .catch(() => {});
    }, 15 * 60 * 1000);
  }

  get(sid, callback) {
    this.db.execute({ sql: 'SELECT sess FROM sessions WHERE sid=? AND expired_at > ?', args: [sid, Date.now()] })
      .then(r => {
        if (!r.rows[0]) return callback(null, null);
        try { callback(null, JSON.parse(r.rows[0].sess)); }
        catch(e) { callback(e); }
      })
      .catch(e => callback(e));
  }

  set(sid, sess, callback) {
    const ttl = (sess.cookie && sess.cookie.maxAge) ? sess.cookie.maxAge : 28800000;
    const expiredAt = Date.now() + ttl;
    this.db.execute({
      sql: 'INSERT OR REPLACE INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)',
      args: [sid, JSON.stringify(sess), expiredAt]
    })
      .then(() => callback && callback(null))
      .catch(e => callback && callback(e));
  }

  destroy(sid, callback) {
    this.db.execute({ sql: 'DELETE FROM sessions WHERE sid=?', args: [sid] })
      .then(() => callback && callback(null))
      .catch(e => callback && callback(e));
  }

  touch(sid, sess, callback) {
    const ttl = (sess.cookie && sess.cookie.maxAge) ? sess.cookie.maxAge : 28800000;
    this.db.execute({
      sql: 'UPDATE sessions SET expired_at=? WHERE sid=?',
      args: [Date.now() + ttl, sid]
    })
      .then(() => callback && callback(null))
      .catch(e => callback && callback(e));
  }
}

module.exports = LibsqlStore;
