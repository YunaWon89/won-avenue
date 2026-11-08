const bcrypt = require('bcryptjs');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { toCamel } = require('../utils/caseMapper');
const { WhereBuilder, runPaginated } = require('../utils/pagination');

const PUBLIC_COLUMNS = `id, name, email, role, is_active, preferred_language, passport, passport_consent_at, phone,
  postal_code, address_line1, address_line2, created_at, updated_at`;
const SALT_ROUNDS = 10;

const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

async function findById(id) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return toCamel(rows[0]) || null;
}

/** Includes password hash — for authentication only. */
async function findByEmailWithHash(email) {
  const { rows } = await db.query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);
  return toCamel(rows[0]) || null;
}

async function create({
  name, email, password, role = 'customer', isActive = true, preferredLanguage = 'en',
  phone, postalCode, addressLine1, addressLine2, passport,
}) {
  const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existing.rowCount) {
    throw ApiError.conflict('Email is already registered', {
      code: 'EMAIL_TAKEN',
      errors: [{ field: 'email', message: 'Email is already registered' }],
    });
  }
  const passwordHash = await hashPassword(password);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, is_active, preferred_language, phone, postal_code, address_line1, address_line2, passport)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role, isActive, preferredLanguage, phone ?? null, postalCode ?? null, addressLine1 ?? null, addressLine2 ?? null, passport ?? null],
  );
  return toCamel(rows[0]);
}

const USER_SORTS = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  name: 'name ASC',
  email: 'email ASC',
};

async function list({ page, limit, search, role, isActive, sort }) {
  const where = new WhereBuilder();
  if (search) where.add('(name ILIKE ? OR email ILIKE ?)', `%${search}%`);
  if (role) where.add('role = ?', role);
  if (isActive !== undefined) where.add('is_active = ?', isActive);
  return runPaginated(db, {
    select: `${PUBLIC_COLUMNS},
      (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)), '[]')
         FROM restaurants r WHERE r.manager_id = users.id) AS restaurants,
      (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = users.id) AS order_count`,
    baseSql: 'FROM users',
    where,
    orderBy: USER_SORTS[sort],
    page,
    limit,
  });
}

async function getById(id) {
  const user = await findById(id);
  if (!user) throw ApiError.notFound('User not found');
  const { rows } = await db.query('SELECT id, name FROM restaurants WHERE manager_id = $1 ORDER BY name', [id]);
  return { ...user, restaurants: rows };
}

async function adminUpdate(id, data, actor) {
  if (id === actor.id && ((data.role && data.role !== actor.role) || data.isActive === false)) {
    throw ApiError.badRequest('You cannot change your own role or deactivate yourself', { code: 'SELF_UPDATE_FORBIDDEN' });
  }
  const user = await findById(id);
  if (!user) throw ApiError.notFound('User not found');

  const { rows } = await db.query(
    `UPDATE users SET
       name = COALESCE($2, name),
       role = COALESCE($3, role),
       is_active = COALESCE($4, is_active),
       updated_at = NOW()
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, data.name ?? null, data.role ?? null, data.isActive ?? null],
  );
  // A user who is no longer a manager cannot keep assigned restaurants.
  if (data.role && data.role !== 'manager') {
    await db.query('UPDATE restaurants SET manager_id = NULL, updated_at = NOW() WHERE manager_id = $1', [id]);
  }
  return toCamel(rows[0]);
}

const PROFILE_COLUMNS = {
  name: 'name', phone: 'phone', preferredLanguage: 'preferred_language',
  postalCode: 'postal_code', addressLine1: 'address_line1', addressLine2: 'address_line2', passport: 'passport',
};

async function updateProfile(id, data) {
  if (data.passport !== undefined) {
    if (data.passport === null) {
      // Deleting the passport also withdraws the consent.
      await db.query('UPDATE users SET passport = NULL, passport_consent_at = NULL, updated_at = NOW() WHERE id = $1', [id]);
    } else {
      const { rows } = await db.query('SELECT passport_consent_at FROM users WHERE id = $1', [id]);
      if (!rows[0]?.passport_consent_at && data.passportConsent !== true) {
        throw ApiError.badRequest('Consent is required to save your food passport', {
          code: 'PASSPORT_CONSENT_REQUIRED',
          errors: [{ field: 'passportConsent', message: 'Consent is required to save your food passport' }],
        });
      }
      if (data.passportConsent === true) {
        await db.query('UPDATE users SET passport_consent_at = COALESCE(passport_consent_at, NOW()) WHERE id = $1', [id]);
      }
    }
  }
  const fields = Object.keys(PROFILE_COLUMNS).filter((k) => data[k] !== undefined && !(k === 'passport' && data[k] === null));
  if (!fields.length) return findById(id);
  const sets = fields.map((f, i) => `${PROFILE_COLUMNS[f]} = $${i + 2}`);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, ...fields.map((f) => data[f])],
  );
  return toCamel(rows[0]);
}

async function changePassword(id, { currentPassword, newPassword }) {
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [id]);
  const ok = rows[0] && (await bcrypt.compare(currentPassword, rows[0].password_hash));
  if (!ok) {
    throw ApiError.badRequest('Current password is incorrect', {
      code: 'WRONG_PASSWORD',
      errors: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
    });
  }
  await db.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [id, await hashPassword(newPassword)]);
}

async function stats() {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM users WHERE role = 'customer')::int AS customers,
      (SELECT COUNT(*) FROM users WHERE role = 'manager')::int AS managers,
      (SELECT COUNT(*) FROM restaurants)::int AS restaurants,
      (SELECT COUNT(*) FROM restaurants WHERE is_active)::int AS active_restaurants,
      (SELECT COUNT(*) FROM restaurants WHERE NOT is_active)::int AS pending_restaurants,
      (SELECT COUNT(*) FROM orders)::int AS orders,
      (SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('day', NOW()))::int AS orders_today,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed')::bigint AS revenue,
      (SELECT COUNT(*) FROM reviews)::int AS reviews,
      (SELECT COUNT(*) FROM menu_items WHERE review_status = 'new')::int AS new_dishes,
      (SELECT COUNT(*) FROM menu_items WHERE review_status = 'needs_changes')::int AS flagged_dishes,
      (SELECT COALESCE(json_object_agg(status, cnt), '{}') FROM
        (SELECT status, COUNT(*)::int AS cnt FROM orders GROUP BY status) s) AS orders_by_status`);
  // Status keys stay as-is (out_for_delivery) — the client translates them via status.<key>.
  const { orders_by_status: byStatus, ...rest } = rows[0];
  return { ...toCamel(rest), ordersByStatus: byStatus };
}

module.exports = {
  hashPassword, findById, findByEmailWithHash, create, list, getById, adminUpdate, updateProfile, changePassword, stats,
};
