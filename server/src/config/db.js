const { Pool, types } = require('pg');
const env = require('./env');

// Return NUMERIC (ratings) and BIGINT (counts/sums) as JS numbers.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const makePool = (max) => {
  const p = new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max,
    idleTimeoutMillis: env.serverless ? 5000 : 10000,
    // Never wait forever for a free connection: fail the request with an error instead of hanging it.
    connectionTimeoutMillis: 15000,
  });
  // On Vercel, close idle connections before an instance is suspended.
  if (env.serverless) {
    try { require('@vercel/functions').attachDatabasePool(p); } catch { /* not on Vercel runtime */ }
  }
  return p;
};

// Serverless: many small instances share the database, so each keeps few connections.
const pool = makePool(env.serverless ? 5 : 10);

// Connections that only hold advisory locks come from their own small pool. A lock holder waits for its work,
// and the work needs a connection from `pool`: sharing one pool could use every connection for lock holders and
// deadlock (this hung requests on Vercel). Created on first use.
let lockPool = null;
const getLockPool = () => { if (!lockPool) lockPool = makePool(3); return lockPool; };
/** Closes both pools (scripts, tests). */
const closeAll = () => Promise.all([pool.end(), lockPool ? lockPool.end() : null]);

const query = (text, params) => pool.query(text, params);

/** Run fn inside a transaction; fn receives a dedicated client. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction, getLockPool, closeAll };
