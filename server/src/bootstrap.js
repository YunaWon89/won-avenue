/**
 * Gets the database ready before the app serves requests:
 *  - applies schema.sql when it changed since the last run (stored hash), so serverless cold starts stay fast;
 *  - fills an empty database with demo data when SEED_ON_EMPTY=true (first deploy).
 * A PostgreSQL advisory lock makes this safe when several instances start at the same time.
 * Used by the long-running server (server.js) and by the Vercel function (api/index.js).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/db');
const { migrate } = require('./db/migrate');

const LOCK_ID = 52034101; // any constant: "WON AVENUE bootstrap"
const schemaHash = () => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8')).digest('hex');

async function prepare({ log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]); // waits while another instance migrates / seeds
    await client.query('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const hash = schemaHash();
    const { rows } = await client.query("SELECT value FROM app_meta WHERE key = 'schema_hash'");
    if (rows[0]?.value !== hash) {
      log('[db] applying schema');
      await migrate();
      await client.query(
        "INSERT INTO app_meta (key, value) VALUES ('schema_hash', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [hash],
      );
    }
    if (process.env.SEED_ON_EMPTY === 'true') {
      const users = await client.query('SELECT COUNT(*)::int AS c FROM users');
      if (users.rows[0].c === 0) {
        log('[db] empty database — adding demo data');
        await require('./db/seed').seed();
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

let ready = null;
/** Runs prepare() once per process; if it fails, the next call tries again. */
function ensureReady(opts) {
  if (!ready) ready = prepare(opts).catch((err) => { ready = null; throw err; });
  return ready;
}

module.exports = { ensureReady };
