/**
 * Gets the database ready before the app serves requests:
 *  - applies schema.sql when it changed since the last run (hash stored in app_meta), so serverless cold starts stay fast;
 *  - fills the database with demo data when SEED_ON_EMPTY=true and it is empty — or when an earlier fill was
 *    interrupted (state stored in app_meta), so a half-filled database is never served.
 * An advisory lock (utils/advisoryLock.js) makes this safe when several instances start at the same time.
 * Used by the long-running server (server.js) and by the Vercel function (api/index.js).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('./config/env');
const { pool } = require('./config/db');
const { migrate } = require('./db/migrate');
const { withAdvisoryLock } = require('./utils/advisoryLock');

const LOCK_ID = 73109001; // "WON AVENUE bootstrap"
const WAIT_MS = 120 * 1000; // another instance may be filling demo data right now

const schemaHash = () => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8')).digest('hex');

const getMeta = async (key) => (await pool.query('SELECT value FROM app_meta WHERE key = $1', [key])).rows[0]?.value;
const setMeta = (key, value) => pool.query(
  'INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value],
);

async function needsSeed() {
  if (process.env.SEED_ON_EMPTY !== 'true') return false;
  const state = await getMeta('seed_state');
  if (state === 'started') return true; // an earlier fill was interrupted
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c === 0) return true;
  // Serverless deploys before seed_state existed may have been cut off mid-way: fill once more to be safe.
  return env.serverless && state === undefined;
}

async function isReady() {
  if (await getMeta('schema_hash') !== schemaHash()) return false;
  return !(await needsSeed());
}

async function prepare({ log = console.log } = {}) {
  await pool.query('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  if (await isReady()) return; // the usual case: nothing to do, no lock needed

  const { locked } = await withAdvisoryLock(LOCK_ID, async () => {
    if (await getMeta('schema_hash') !== schemaHash()) {
      log('[db] applying schema');
      await migrate();
      await setMeta('schema_hash', schemaHash());
    }
    if (await needsSeed()) {
      log('[db] adding demo data');
      await setMeta('seed_state', 'started');
      await require('./db/seed').seed();
      await setMeta('seed_state', 'done');
    }
  }, { waitMs: WAIT_MS });

  if (!locked && !(await isReady())) {
    throw new Error('Database is being prepared by another instance, try again in a minute');
  }
}

let ready = null;
/** Runs prepare() once per process; if it fails, the next call tries again. */
function ensureReady(opts) {
  if (!ready) ready = prepare(opts).catch((err) => { ready = null; throw err; });
  return ready;
}

module.exports = { ensureReady };
