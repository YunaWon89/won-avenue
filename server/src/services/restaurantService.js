const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { toCamel } = require('../utils/caseMapper');
const { WhereBuilder, runPaginated } = require('../utils/pagination');
const { translate, mergeTranslations } = require('./translationService');
const { safeItemSql, mainDishSql, hasPassport } = require('./passport');
const { FAST_MINUTES, MOOD_TAGS } = require('../config/catalog');

const SORTS = {
  rating: 'r.average_rating DESC, r.review_count DESC, r.name ASC',
  newest: 'r.created_at DESC',
  name: 'r.name ASC',
  delivery_fee: 'r.delivery_fee ASC, r.average_rating DESC',
  fast: 'r.prep_time_minutes ASC, r.average_rating DESC',
};

const { OPEN_SQL } = require('./openingHours');
const SELECT = `r.*, u.name AS manager_name, u.email AS manager_email, ${OPEN_SQL} AS is_open`;
const BASE = 'FROM restaurants r LEFT JOIN users u ON u.id = r.manager_id';

/** camelCase field -> column. */
const COLUMN = {
  name: 'name', description: 'description', cuisineType: 'cuisine_type', address: 'address',
  phone: 'phone', imageUrl: 'image_url', isActive: 'is_active', managerId: 'manager_id',
  supportsDelivery: 'supports_delivery', supportsPickup: 'supports_pickup', deliveryFee: 'delivery_fee',
  minOrderAmount: 'min_order_amount', prepTimeMinutes: 'prep_time_minutes', sourceLanguage: 'source_language',
  moodTags: 'mood_tags', opensAt: 'opens_at', closesAt: 'closes_at',
};
/** Fields only an admin may change. */
const ADMIN_ONLY = ['isActive', 'managerId'];
const TRANSLATABLE = ['description'];

async function list(query, user) {
  const where = new WhereBuilder();

  if (query.managed && user?.role === 'manager') {
    where.add('r.manager_id = ?', user.id);
  } else if (user?.role === 'admin') {
    if (query.isActive !== undefined) where.add('r.is_active = ?', query.isActive);
  } else {
    where.raw('r.is_active = TRUE');
  }
  if (query.search) {
    where.add(`(r.name ILIKE ? OR r.cuisine_type ILIKE ? OR r.translations::text ILIKE ? OR EXISTS (
      SELECT 1 FROM menu_items mi WHERE mi.restaurant_id = r.id AND mi.is_available
        AND (mi.name ILIKE ? OR mi.translations::text ILIKE ?)))`, `%${query.search}%`);
  }
  if (query.cuisine) where.add('r.cuisine_type = ?', query.cuisine);
  if (query.minRating !== undefined) where.add('r.average_rating >= ?', query.minRating);
  if (query.orderType === 'delivery') where.raw('r.supports_delivery');
  if (query.orderType === 'pickup') where.raw('r.supports_pickup');
  if (query.mood === 'fast') where.raw(`r.prep_time_minutes <= ${FAST_MINUTES}`);
  else if (query.mood && MOOD_TAGS.includes(query.mood)) where.add('? = ANY(r.mood_tags)', query.mood);
  if (query.diet?.length) {
    // Only main dishes count: a chicken place with vegetarian fries is not a "vegetarian restaurant".
    where.add(`EXISTS (SELECT 1 FROM menu_items mi WHERE mi.restaurant_id = r.id AND mi.is_available
      AND ${mainDishSql('mi')} AND mi.dietary_tags @> ?::text[])`, query.diet);
  }

  // Food passport: count the dishes that suit the viewer.
  const passport = { diet: query.pDiet || [], allergens: query.pAllergens || [], maxSpice: query.pMaxSpice };
  const withPassport = hasPassport(passport);
  // Safe count = main dishes that suit the viewer (sides and drinks don't make a restaurant a good match).
  const safeSql = withPassport ? `${safeItemSql('mi', passport)} AND ${mainDishSql('mi')}` : 'mi.is_available';
  if (withPassport && query.safeOnly) where.raw(`EXISTS (SELECT 1 FROM menu_items mi WHERE mi.restaurant_id = r.id AND ${safeSql})`);

  const orderBy = query.sort === 'safe' && withPassport ? `safe_count DESC, ${SORTS.rating}` : SORTS[query.sort] || SORTS.rating;

  return runPaginated(db, {
    select: `${SELECT},
      (SELECT COALESCE(array_agg(DISTINCT t), '{}') FROM menu_items mi, unnest(mi.dietary_tags) t
        WHERE mi.restaurant_id = r.id AND mi.is_available AND ${mainDishSql('mi')}) AS dietary_tags,
      (SELECT MIN(price) FROM menu_items mi WHERE mi.restaurant_id = r.id AND mi.is_available) AS min_item_price,
      (SELECT COUNT(*)::int FROM menu_items mi WHERE mi.restaurant_id = r.id AND mi.is_available) AS item_count,
      ${withPassport ? `(SELECT COUNT(*)::int FROM menu_items mi WHERE mi.restaurant_id = r.id AND ${safeSql})` : 'NULL::int'} AS safe_count`,
    baseSql: BASE,
    where,
    orderBy,
    page: query.page,
    limit: query.limit,
  });
}

async function findRaw(id, client = db) {
  const { rows } = await client.query(`SELECT ${SELECT} ${BASE} WHERE r.id = $1`, [id]);
  return toCamel(rows[0]) || null;
}

const canManage = (restaurant, user) => Boolean(
  user && (user.role === 'admin' || (user.role === 'manager' && restaurant.managerId === user.id)),
);

/** Details with categories. Inactive restaurants are visible only to admin / its owner. */
async function getById(id, user) {
  const restaurant = await findRaw(id);
  if (!restaurant || (!restaurant.isActive && !canManage(restaurant, user))) throw ApiError.notFound('Restaurant not found');
  const { rows } = await db.query(
    `SELECT c.*, (SELECT COUNT(*)::int FROM menu_items i WHERE i.category_id = c.id) AS item_count
     FROM menu_categories c WHERE c.restaurant_id = $1 ORDER BY c.sort_order, c.name`,
    [id],
  );
  return { ...restaurant, categories: toCamel(rows), canManage: canManage(restaurant, user) };
}

async function listCuisines() {
  const { rows } = await db.query('SELECT DISTINCT cuisine_type FROM restaurants WHERE is_active ORDER BY cuisine_type');
  return rows.map((r) => r.cuisine_type);
}

/** Throws unless the user is admin or the assigned owner. Returns the restaurant. */
async function assertCanManage(restaurantId, user, client = db) {
  const restaurant = await findRaw(restaurantId, client);
  if (!restaurant) throw ApiError.notFound('Restaurant not found');
  if (!canManage(restaurant, user)) throw ApiError.forbidden('You can manage only your own restaurant');
  return restaurant;
}

async function assertManagerUser(managerId) {
  if (!managerId) return;
  const { rows } = await db.query('SELECT role FROM users WHERE id = $1', [managerId]);
  if (!rows[0] || rows[0].role !== 'manager') {
    throw ApiError.badRequest('Assigned user must have the restaurant owner (manager) role', {
      code: 'NOT_A_MANAGER',
      errors: [{ field: 'managerId', message: 'Assigned user must have the manager role' }],
    });
  }
}

/**
 * Admin creates any restaurant. A restaurant owner (manager) can submit their own restaurant:
 * it is assigned to them and stays inactive until an admin approves (activates) it.
 */
async function create(data, user) {
  const isAdmin = user.role === 'admin';
  const managerId = isAdmin ? data.managerId ?? null : user.id;
  const isActive = isAdmin ? data.isActive ?? true : false;
  if (isAdmin) await assertManagerUser(managerId);
  const sourceLanguage = data.sourceLanguage || user.preferredLanguage || 'ko';
  const tr = await translate({ description: data.description }, sourceLanguage, { kind: 'restaurant', restaurant: data.name, cuisine: data.cuisineType });

  const { rows } = await db.query(
    `INSERT INTO restaurants (name, description, cuisine_type, address, phone, image_url, is_active, manager_id,
       supports_delivery, supports_pickup, delivery_fee, min_order_amount, prep_time_minutes, source_language, translations,
       translation_status, mood_tags, opens_at, closes_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, TRUE), COALESCE($10, TRUE), COALESCE($11, 3000),
       COALESCE($12, 0), COALESCE($13, 30), $14, $15, $16, $17, $18, $19) RETURNING id`,
    [data.name, data.description ?? null, data.cuisineType, data.address ?? null, data.phone ?? null,
      data.imageUrl ?? null, isActive, managerId, data.supportsDelivery ?? null, data.supportsPickup ?? null,
      data.deliveryFee ?? null, data.minOrderAmount ?? null, data.prepTimeMinutes ?? null, sourceLanguage, tr.translations,
      tr.status, data.moodTags || [], data.opensAt ?? null, data.closesAt ?? null],
  );
  return findRaw(rows[0].id);
}

async function update(id, data, user) {
  const current = await assertCanManage(id, user);
  const fields = Object.keys(data).filter((k) => data[k] !== undefined && COLUMN[k]);
  if (user.role !== 'admin') {
    const forbidden = fields.filter((f) => ADMIN_ONLY.includes(f));
    if (forbidden.length) throw ApiError.forbidden(`Only an admin can change: ${forbidden.join(', ')}`);
  }
  if (data.managerId !== undefined) await assertManagerUser(data.managerId);
  const delivery = data.supportsDelivery ?? current.supportsDelivery;
  const pickup = data.supportsPickup ?? current.supportsPickup;
  if (!delivery && !pickup) {
    throw ApiError.badRequest('Enable delivery, pickup or both', { errors: [{ field: 'supportsPickup', message: 'Enable delivery, pickup or both' }] });
  }

  const values = Object.fromEntries(fields.map((f) => [f, data[f]]));
  const changed = TRANSLATABLE.filter((k) => data[k] !== undefined && data[k] !== current[k]);
  if (changed.length || (data.sourceLanguage && data.sourceLanguage !== current.sourceLanguage)) {
    const src = data.sourceLanguage || current.sourceLanguage;
    const tr = await translate({ description: data.description ?? current.description }, src,
      { kind: 'restaurant', restaurant: data.name || current.name, cuisine: data.cuisineType || current.cuisineType });
    values.translations = mergeTranslations(current.translations, tr.translations, ['description']);
    values.translationStatus = tr.status;
    fields.push('translations', 'translationStatus');
  }
  if (fields.length) {
    const col = (f) => ({ translations: 'translations', translationStatus: 'translation_status' }[f] || COLUMN[f]);
    const sets = fields.map((f, i) => `${col(f)} = $${i + 2}`);
    await db.query(`UPDATE restaurants SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...fields.map((f) => values[f])]);
  }
  return findRaw(id);
}

/** Hard delete when there is no order history, otherwise deactivate. */
async function remove(id) {
  const restaurant = await findRaw(id);
  if (!restaurant) throw ApiError.notFound('Restaurant not found');
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM orders WHERE restaurant_id = $1', [id]);
  if (rows[0].count > 0) {
    await db.query('UPDATE restaurants SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]);
    return { deleted: false, deactivated: true, message: 'Restaurant has order history and was deactivated instead of deleted' };
  }
  await db.query('DELETE FROM restaurants WHERE id = $1', [id]);
  return { deleted: true, deactivated: false, message: 'Restaurant deleted' };
}

module.exports = {
  list, getById, listCuisines, findRaw, assertCanManage, canManage, create, update, remove };
