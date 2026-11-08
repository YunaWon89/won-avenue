/**
 * Vercel entry point: every /api/* request comes here (see vercel.json).
 * The same Express app as the long-running server; on each request it first makes sure the database is
 * ready (schema + demo data on first deploy) and runs the periodic jobs that are due (see server/src/jobs.js).
 * The React app itself is served as static files by Vercel.
 */
let app;
let ensureReady;
let runDueJobs;
let startupError = null;

try {
  app = require('../server/src/app');
  ({ ensureReady } = require('../server/src/bootstrap'));
  ({ runDueJobs } = require('../server/src/jobs'));
} catch (err) {
  startupError = err; // e.g. JWT_SECRET missing in production — shown as a clear message below
  console.error('[startup]', err);
}

function fail(res, status, message, code) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ success: false, message, code }));
}

module.exports = async (req, res) => {
  if (startupError) {
    return fail(res, 500, `Server is not configured: ${startupError.message}. Check the environment variables in Vercel.`, 'NOT_CONFIGURED');
  }
  try {
    await ensureReady();
  } catch (err) {
    console.error('[db] not ready:', err);
    const env = require('../server/src/config/env');
    const hint = env.hasDatabaseUrl ? 'Check that the database is running and DATABASE_URL is correct.' : 'DATABASE_URL is not set.';
    return fail(res, 503, `Database is not available. ${hint}`, 'DB_UNAVAILABLE');
  }
  await runDueJobs();
  return app(req, res);
};
