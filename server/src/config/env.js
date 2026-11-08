const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });


const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  // DATABASE_URL (Render, local) or POSTGRES_URL (Vercel + Neon integration).
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/food_delivery',
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
  // Serverless hosting (Vercel): no long-running process, so timers are replaced by jobs run on requests.
  serverless: Boolean(process.env.VERCEL),
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  maxUploadSize: 2 * 1024 * 1024,

  // Auto-translation of seller content (optional). Without a key, content is shown as written.
  translationProvider: process.env.TRANSLATION_PROVIDER || 'auto', // auto | gemini | deepl | none
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  deeplApiKey: process.env.DEEPL_API_KEY || '',

  // Automatic order progress (minutes). "Delivered" is set only by the courier.
  autoCompleteMinutes: Number(process.env.AUTO_COMPLETE_MINUTES) || 10,   // delivered / ready_for_pickup -> completed
  autoCancelMinutes: Number(process.env.AUTO_CANCEL_MINUTES) || 15,       // pending without answer -> cancelled + refund

  // Dish check after publication: days an owner has to fix a dish before it is hidden.
  dishFixDays: Number(process.env.DISH_FIX_DAYS) || 3,

  // Demo mode: enables the admin "Reset demo data" button.
  demoMode: process.env.DEMO_MODE === 'true',

  // Payments: 'mock' (demo, no real money) or 'toss' (Toss Payments, requires merchant keys).
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  tossClientKey: process.env.TOSS_CLIENT_KEY || '',
  tossSecretKey: process.env.TOSS_SECRET_KEY || '',
};
env.isProd = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

if (env.isProd && env.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
