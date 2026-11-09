const { getLockPool } = require('../config/db');

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * Runs fn while holding a PostgreSQL advisory lock, so only one server instance does it at a time.
 *
 * The lock is transaction-scoped (pg_try_advisory_xact_lock inside BEGIN … COMMIT): it works through connection
 * poolers in transaction mode (Neon / PgBouncer, used on Vercel) and is released automatically when the
 * transaction ends — also if the instance is killed mid-way. Session-level locks are NOT safe there: a pooler can
 * send the unlock to another server connection, leaving the lock held forever.
 * Never waits forever: tries until `waitMs` has passed, then returns { locked: false }.
 *
 * @returns {Promise<{locked: boolean, value?: any}>}
 */
async function withAdvisoryLock(lockId, fn, { waitMs = 0, pollMs = 500 } = {}) {
  const client = await getLockPool().connect(); // separate pool: see config/db.js
  let open = false;
  try {
    await client.query('BEGIN');
    open = true;
    const deadline = Date.now() + waitMs;
    for (;;) {
      const { rows } = await client.query('SELECT pg_try_advisory_xact_lock($1) AS ok', [lockId]);
      if (rows[0].ok) break;
      if (Date.now() >= deadline) return { locked: false };
      await sleep(pollMs);
    }
    const value = await fn();
    return { locked: true, value };
  } finally {
    // Ending the transaction releases the lock. The work itself ran on other connections, so a failed
    // COMMIT (e.g. the database closed an idle transaction) must not turn finished work into an error.
    if (open) await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

module.exports = { withAdvisoryLock };
