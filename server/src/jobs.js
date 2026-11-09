/**
 * Periodic jobs: move orders forward, retry failed translations, hide dishes nobody fixed.
 *  - Long-running server: startTimers() runs them on intervals.
 *  - Serverless (Vercel): there is no process between requests, so runDueJobs() is called on each API
 *    request and runs whatever is due. Order progress is awaited (the response must already show it);
 *    the slower jobs run after the response (runInBackground).
 * Each job takes a transaction-scoped advisory lock (utils/advisoryLock.js), so two instances never run the same job at once.
 */
const { runInBackground } = require('./utils/background');
const { withAdvisoryLock } = require('./utils/advisoryLock');

const JOBS = [
  {
    name: 'orders', lock: 73109002, everyMs: 30 * 1000, wait: true,
    run: () => require('./services/orderService').autoProgress(),
  },
  {
    name: 'translations', lock: 73109003, everyMs: 2 * 60 * 1000, wait: false,
    enabled: () => require('./services/translationService').isEnabled(),
    run: async () => {
      await require('./services/reviewService').retryPendingReviewTranslations();
      await require('./services/menuService').retryPendingTranslations();
    },
  },
  {
    name: 'dishes', lock: 73109004, everyMs: 10 * 60 * 1000, wait: false,
    run: () => require('./services/menuService').hideUnfixedDishes(),
  },
];

/** Runs a job unless another instance is running it right now (then it is simply skipped). */
async function runLocked(job) {
  await withAdvisoryLock(job.lock, job.run, { waitMs: 0 });
}

const lastRun = new Map();

/** Serverless: run the jobs that are due. Never throws (a failed job must not break the request). */
async function runDueJobs(now = Date.now()) {
  const waits = [];
  for (const job of JOBS) {
    if (job.enabled && !job.enabled()) continue;
    if (now - (lastRun.get(job.name) || 0) < job.everyMs) continue;
    lastRun.set(job.name, now);
    const work = () => runLocked(job);
    if (job.wait) waits.push(work().catch((err) => console.warn(`[jobs] ${job.name} failed: ${err.message}`)));
    else runInBackground(work, `jobs:${job.name}`);
  }
  await Promise.all(waits);
}

/** Long-running server: run every job on its own interval. */
function startTimers() {
  for (const job of JOBS) {
    if (job.enabled && !job.enabled()) continue;
    setInterval(() => runLocked(job).catch((err) => console.warn(`[jobs] ${job.name} failed: ${err.message}`)), job.everyMs).unref();
  }
  // Retry translations that failed while the server was off, soon after start.
  const translations = JOBS.find((j) => j.name === 'translations');
  if (translations.enabled()) setTimeout(() => runLocked(translations).catch(() => {}), 5000).unref();
}

module.exports = { runDueJobs, startTimers, JOBS };
