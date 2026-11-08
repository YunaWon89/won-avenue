/**
 * Payments in KRW with saved cards (billing keys).
 *
 * Providers:
 *  - mock: demo mode for development and portfolio deploys. No real money moves.
 *          Card numbers are validated (Luhn) and immediately discarded; only brand + last4 are kept.
 *          Test card 4000 0000 0000 0002 is always declined.
 *  - toss: Toss Payments "자동결제(빌링)". Card data is entered in the Toss window and never reaches
 *          our server; we receive an authKey and exchange it for a billingKey.
 *          Domestic and international cards are supported according to the merchant contract.
 */
const crypto = require('crypto');
const env = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { toCamel } = require('../utils/caseMapper');

const PUBLIC_COLUMNS = 'id, provider, card_brand, last4, is_foreign, is_default, created_at';

// ---------------- mock provider ----------------
function luhnValid(number) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let d = Number(number[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function detectBrand(n) {
  if (/^4/.test(n)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'MASTERCARD';
  if (/^3[47]/.test(n)) return 'AMEX';
  if (/^35/.test(n)) return 'JCB';
  if (/^62/.test(n)) return 'UNIONPAY';
  if (/^9/.test(n)) return 'KR_LOCAL'; // Korean domestic-only cards commonly start with 9
  return 'CARD';
}

const mockProvider = {
  name: 'mock',
  async registerCard({ cardNumber, expMonth, expYear, isForeign }) {
    const number = String(cardNumber).replace(/\D/g, '');
    if (number.length < 13 || number.length > 19 || !luhnValid(number)) {
      throw ApiError.badRequest('Card number is invalid', { code: 'CARD_INVALID', errors: [{ field: 'cardNumber', message: 'Card number is invalid' }] });
    }
    const now = new Date();
    const fullYear = expYear < 100 ? 2000 + expYear : expYear;
    if (fullYear < now.getFullYear() || (fullYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
      throw ApiError.badRequest('Card has expired', { code: 'CARD_EXPIRED', errors: [{ field: 'expiry', message: 'Card has expired' }] });
    }
    const brand = detectBrand(number);
    return {
      billingKey: `mock_bk_${crypto.randomBytes(12).toString('hex')}${number === '4000000000000002' ? '_decline' : ''}`,
      brand: brand === 'KR_LOCAL' ? '국내카드' : brand,
      last4: number.slice(-4),
      isForeign: brand === 'KR_LOCAL' ? false : Boolean(isForeign),
    };
  },
  async charge({ billingKey, amount, orderId }) {
    if (billingKey.endsWith('_decline')) {
      throw ApiError.badRequest('Card was declined', { code: 'PAYMENT_DECLINED' });
    }
    return { reference: `mock_pay_${orderId}_${amount}` };
  },
  async refund() { return { ok: true }; },
};

// ---------------- Toss Payments provider ----------------
const TOSS_API = 'https://api.tosspayments.com/v1';
const tossAuth = () => `Basic ${Buffer.from(`${env.tossSecretKey}:`).toString('base64')}`;

async function tossRequest(path, body) {
  const res = await fetch(`${TOSS_API}${path}`, {
    method: 'POST',
    headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw ApiError.badRequest(data.message || 'Payment provider error', { code: data.code || 'PAYMENT_ERROR' });
  }
  return data;
}

const tossProvider = {
  name: 'toss',
  /** authKey + customerKey come from the Toss billing-auth redirect (successUrl). */
  async registerCard({ authKey, customerKey }) {
    if (!authKey || !customerKey) throw ApiError.badRequest('authKey and customerKey are required');
    const data = await tossRequest('/billing/authorizations/issue', { authKey, customerKey });
    const card = data.card || {};
    const digits = (card.number || data.cardNumber || '').replace(/[^0-9]/g, '');
    return {
      billingKey: data.billingKey,
      brand: data.cardCompany || card.issuerCode || 'CARD',
      last4: digits.slice(-4) || null,
      // Toss returns a Korean card company for domestic cards; anything else is treated as overseas.
      isForeign: !data.cardCompany,
    };
  },
  async charge({ billingKey, customerKey, amount, orderId, orderName, customer }) {
    const data = await tossRequest(`/billing/${encodeURIComponent(billingKey)}`, {
      customerKey, amount, orderId, orderName, customerEmail: customer.email, customerName: customer.name,
    });
    if (data.status !== 'DONE') throw ApiError.badRequest('Payment was not approved', { code: 'PAYMENT_DECLINED' });
    return { reference: data.paymentKey };
  },
  async refund({ reference, reason }) {
    await tossRequest(`/payments/${encodeURIComponent(reference)}/cancel`, { cancelReason: reason || 'Order cancelled' });
    return { ok: true };
  },
};

const provider = () => (env.paymentProvider === 'toss' ? tossProvider : mockProvider);

/** Toss customerKey: stable, non-guessable id per user (do not use email/phone). */
const customerKeyFor = (userId) => `cust_${crypto.createHash('sha256').update(`${userId}:${env.jwtSecret}`).digest('hex').slice(0, 40)}`;

// ---------------- saved cards ----------------
async function listMethods(userId) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [userId],
  );
  return toCamel(rows);
}

async function addMethod(user, input) {
  const p = provider();
  const card = await p.registerCard({ ...input, customerKey: input.customerKey || customerKeyFor(user.id) });
  return db.withTransaction(async (client) => {
    const existing = await client.query('SELECT COUNT(*)::int AS c FROM payment_methods WHERE user_id = $1', [user.id]);
    if (existing.rows[0].c >= 5) throw ApiError.badRequest('You can save up to 5 cards', { code: 'CARD_LIMIT' });
    const makeDefault = existing.rows[0].c === 0 || Boolean(input.makeDefault);
    if (makeDefault) await client.query('UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1', [user.id]);
    const { rows } = await client.query(
      `INSERT INTO payment_methods (user_id, provider, billing_key, card_brand, last4, is_foreign, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${PUBLIC_COLUMNS}`,
      [user.id, p.name, card.billingKey, card.brand, card.last4, card.isForeign, makeDefault],
    );
    return toCamel(rows[0]);
  });
}

async function setDefault(userId, id) {
  return db.withTransaction(async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM payment_methods WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!rowCount) throw ApiError.notFound('Card not found');
    await client.query('UPDATE payment_methods SET is_default = (id = $2), updated_at = NOW() WHERE user_id = $1', [userId, id]);
  });
}

async function removeMethod(userId, id) {
  const { rows } = await db.query('DELETE FROM payment_methods WHERE id = $1 AND user_id = $2 RETURNING is_default', [id, userId]);
  if (!rows[0]) throw ApiError.notFound('Card not found');
  if (rows[0].is_default) {
    await db.query(
      `UPDATE payment_methods SET is_default = TRUE WHERE id = (
         SELECT id FROM payment_methods WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
      [userId],
    );
  }
}

/** Internal: load a card including its billing key, scoped to the user. */
async function getMethodForCharge(userId, id, client = db) {
  const { rows } = await client.query('SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!rows[0]) throw ApiError.badRequest('Selected card was not found', { code: 'CARD_NOT_FOUND', errors: [{ field: 'paymentMethodId', message: 'Selected card was not found' }] });
  return rows[0];
}

const cardLabel = (m) => `${m.card_brand || 'CARD'} •••• ${m.last4 || '----'}`;

async function charge({ method, user, amount, orderId, orderName }) {
  const p = method.provider === 'toss' ? tossProvider : mockProvider;
  return p.charge({ billingKey: method.billing_key, customerKey: customerKeyFor(user.id), amount, orderId, orderName, customer: user });
}

async function refund({ providerName, reference, reason }) {
  if (!reference) return;
  const p = providerName === 'toss' ? tossProvider : mockProvider;
  await p.refund({ reference, reason });
}

function publicConfig(user) {
  return {
    provider: provider().name,
    tossClientKey: env.paymentProvider === 'toss' ? env.tossClientKey : undefined,
    customerKey: user && env.paymentProvider === 'toss' ? customerKeyFor(user.id) : undefined,
    currency: 'KRW',
  };
}

module.exports = {
  listMethods, addMethod, setDefault, removeMethod, getMethodForCharge, cardLabel, charge, refund, publicConfig, luhnValid,
};
