const env = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { toCamel } = require('../utils/caseMapper');
const { WhereBuilder, runPaginated } = require('../utils/pagination');
const restaurantService = require('./restaurantService');
const { translate, mergeTranslations, applyManual } = require('./translationService');

// ---------- Categories ----------
async function findCategory(id) {
  const { rows } = await db.query('SELECT * FROM menu_categories WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Category not found');
  return toCamel(rows[0]);
}

async function createCategory({ restaurantId, name, sortOrder = 0, sourceLanguage, isSide = false }, user) {
  const restaurant = await restaurantService.assertCanManage(restaurantId, user);
  const src = sourceLanguage || restaurant.sourceLanguage;
  const tr = await translate({ name }, src, { kind: 'category', restaurant: restaurant.name });
  const { rows } = await db.query(
    `INSERT INTO menu_categories (restaurant_id, name, sort_order, source_language, translations, translation_status, is_side)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [restaurantId, name, sortOrder, src, tr.translations, tr.status, Boolean(isSide)],
  );
  return toCamel(rows[0]);
}

async function updateCategory(id, { name, sortOrder, sourceLanguage, isSide }, user) {
  const category = await findCategory(id);
  const restaurant = await restaurantService.assertCanManage(category.restaurantId, user);
  let { translations, translationStatus } = category;
  const src = sourceLanguage || category.sourceLanguage;
  if ((name && name !== category.name) || src !== category.sourceLanguage) {
    const tr = await translate({ name: name || category.name }, src, { kind: 'category', restaurant: restaurant.name });
    translations = mergeTranslations(category.translations, tr.translations, ['name']);
    translationStatus = tr.status;
  }
  const { rows } = await db.query(
    `UPDATE menu_categories SET name = COALESCE($2, name), sort_order = COALESCE($3, sort_order),
       source_language = $4, translations = $5, translation_status = $6, is_side = COALESCE($7, is_side), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, name ?? null, sortOrder ?? null, src, translations, translationStatus, isSide ?? null],
  );
  return toCamel(rows[0]);
}

async function deleteCategory(id, user) {
  const category = await findCategory(id);
  await restaurantService.assertCanManage(category.restaurantId, user);
  // Items in the category stay on the menu but become uncategorised (ON DELETE SET NULL).
  await db.query('DELETE FROM menu_categories WHERE id = $1', [id]);
}

// ---------- Menu items ----------
const SORTS = {
  price_asc: 'i.price ASC, i.name ASC',
  price_desc: 'i.price DESC, i.name ASC',
  newest: 'i.created_at DESC',
  name: 'c.sort_order NULLS LAST, i.name ASC',
};

async function listItems(restaurantId, query, user) {
  const restaurant = await restaurantService.findRaw(restaurantId);
  const manages = restaurant && restaurantService.canManage(restaurant, user);
  if (!restaurant || (!restaurant.isActive && !manages)) throw ApiError.notFound('Restaurant not found');

  const where = new WhereBuilder().add('i.restaurant_id = ?', restaurantId);
  // Customers and guests only see available items; owners/admin can see and filter all.
  if (!manages) where.raw('i.is_available = TRUE');
  else if (query.available !== undefined) where.add('i.is_available = ?', query.available);
  if (query.search) where.add('(i.name ILIKE ? OR i.translations::text ILIKE ?)', `%${query.search}%`);
  if (query.categoryId) where.add('i.category_id = ?', query.categoryId);
  if (query.minPrice !== undefined) where.add('i.price >= ?', query.minPrice);
  if (query.maxPrice !== undefined) where.add('i.price <= ?', query.maxPrice);
  // Allergy filter: hide anything that contains at least one of the selected allergens.
  if (query.excludeAllergens?.length) where.add('NOT (i.allergens && ?::text[])', query.excludeAllergens);
  // Diet filter: item must carry all selected tags (e.g. halal AND vegetarian).
  if (query.diet?.length) where.add('i.dietary_tags @> ?::text[]', query.diet);
  if (query.maxSpice !== undefined) where.add('i.spice_level <= ?', query.maxSpice);

  return runPaginated(db, {
    select: 'i.*, c.name AS category_name, c.translations AS category_translations, c.source_language AS category_source_language',
    baseSql: 'FROM menu_items i LEFT JOIN menu_categories c ON c.id = i.category_id',
    where,
    orderBy: SORTS[query.sort],
    page: query.page,
    limit: query.limit,
  });
}

async function findItem(id) {
  const { rows } = await db.query('SELECT * FROM menu_items WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Menu item not found');
  return toCamel(rows[0]);
}

async function assertCategoryBelongs(categoryId, restaurantId) {
  if (!categoryId) return;
  const { rows } = await db.query('SELECT restaurant_id FROM menu_categories WHERE id = $1', [categoryId]);
  if (!rows[0] || rows[0].restaurant_id !== restaurantId) {
    throw ApiError.badRequest('Category must belong to the same restaurant', {
      code: 'CATEGORY_MISMATCH',
      errors: [{ field: 'categoryId', message: 'Category must belong to the same restaurant' }],
    });
  }
}

/** Halal / vegan items should not list pork; vegan implies vegetarian. */
function normaliseTags(dietaryTags = [], allergens = []) {
  const tags = new Set(dietaryTags);
  if (tags.has('vegan')) tags.add('vegetarian');
  const meat = ['pork', 'beef', 'chicken'];
  if (tags.has('vegetarian') && allergens.some((a) => meat.includes(a))) {
    throw ApiError.badRequest('A vegetarian item cannot contain meat', { code: 'DIET_CONFLICT', errors: [{ field: 'dietaryTags', message: 'A vegetarian item cannot contain meat' }] });
  }
  if ((tags.has('halal') || tags.has('no_pork')) && allergens.includes('pork')) {
    throw ApiError.badRequest('A halal / no-pork item cannot contain pork', { code: 'DIET_CONFLICT', errors: [{ field: 'dietaryTags', message: 'A halal / no-pork item cannot contain pork' }] });
  }
  return [...tags];
}

const TEXT_FIELDS = ['name', 'description', 'explanation'];

async function createItem(data, user) {
  const restaurant = await restaurantService.assertCanManage(data.restaurantId, user);
  await assertCategoryBelongs(data.categoryId, data.restaurantId);
  const allergens = data.allergens || [];
  const dietaryTags = normaliseTags(data.dietaryTags, allergens);
  const src = data.sourceLanguage || restaurant.sourceLanguage;
  const tr = await translate(
    { name: data.name, description: data.description, explanation: data.explanation },
    src,
    { kind: 'dish', restaurant: restaurant.name, cuisine: restaurant.cuisineType },
  );
  const translations = applyManual(tr.translations, data.translations);

  const { rows } = await db.query(
    `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, image_url, is_available,
       allergens, dietary_tags, spice_level, source_language, translations, translation_status, romanization, explanation, review_status)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), $8, $9, COALESCE($10, 0), $11, $12, $13, $14, $15, $16) RETURNING *`,
    [data.restaurantId, data.categoryId ?? null, data.name, data.description ?? null, data.price,
      data.imageUrl ?? null, data.isAvailable ?? null, allergens, dietaryTags, data.spiceLevel ?? null, src,
      translations, tr.status, data.romanization || tr.romanization || null, data.explanation ?? null,
      user.role === 'admin' ? 'ok' : 'new'],
  );
  return toCamel(rows[0]);
}

async function updateItem(id, data, user) {
  const item = await findItem(id);
  const restaurant = await restaurantService.assertCanManage(item.restaurantId, user);
  if (data.categoryId) await assertCategoryBelongs(data.categoryId, item.restaurantId);

  const allergens = data.allergens ?? item.allergens;
  const dietaryTags = normaliseTags(data.dietaryTags ?? item.dietaryTags, allergens);

  const src = data.sourceLanguage || item.sourceLanguage;
  const next = {
    name: data.name ?? item.name,
    description: data.description !== undefined ? data.description : item.description,
    explanation: data.explanation !== undefined ? data.explanation : item.explanation,
  };
  const changed = TEXT_FIELDS.filter((k) => next[k] !== item[k]);
  const sourceChanged = src !== item.sourceLanguage;
  let { translations, translationStatus, romanization } = item;

  if (changed.length || sourceChanged || data.retranslate) {
    const full = sourceChanged || data.retranslate;
    const toTranslate = full ? next : Object.fromEntries(changed.map((k) => [k, next[k]]));
    const tr = await translate(toTranslate, src, { kind: 'dish', restaurant: restaurant.name, cuisine: restaurant.cuisineType });
    translations = mergeTranslations(full ? {} : item.translations, tr.translations, full ? TEXT_FIELDS : changed);
    // Keep the owner's manual edits even on a full re-translation.
    Object.entries(item.translations || {}).forEach(([lang, v]) => { if (v?.manual) translations[lang] = v; });
    translationStatus = tr.status;
    if (tr.romanization && (changed.includes('name') || !romanization || data.retranslate)) romanization = tr.romanization;
  }
  if (data.translations) translations = applyManual(translations, data.translations);
  if (data.romanization !== undefined) romanization = data.romanization;

  // Owner edits go back to the admin's "new dishes" list:
  //  - a dish the admin flagged (or that was hidden) counts as "fixed" and becomes visible again;
  //  - a checked dish whose content changed is checked again. Toggling availability alone doesn't count.
  let reviewStatus = item.reviewStatus;
  let isAvailable = data.isAvailable;
  const contentKeys = ['name', 'description', 'explanation', 'price', 'categoryId', 'allergens', 'dietaryTags', 'spiceLevel', 'imageUrl', 'translations'];
  const contentChanged = changed.length > 0 || contentKeys.some((k) => data[k] !== undefined && k !== 'name' && k !== 'description' && k !== 'explanation');
  if (user.role === 'manager') {
    if (['needs_changes', 'removed'].includes(item.reviewStatus)) {
      reviewStatus = 'new';
      if (item.reviewStatus === 'removed' && isAvailable === undefined) isAvailable = true;
    } else if (item.reviewStatus === 'ok' && contentChanged) reviewStatus = 'new';
  }

  const { rows } = await db.query(
    `UPDATE menu_items SET
       category_id = CASE WHEN $2::boolean THEN $3::uuid ELSE category_id END,
       name = $4, description = $5, explanation = $6,
       price = COALESCE($7, price),
       image_url = COALESCE($8, image_url),
       is_available = COALESCE($9, is_available),
       allergens = $10, dietary_tags = $11,
       spice_level = COALESCE($12, spice_level),
       source_language = $13, translations = $14, translation_status = $15, romanization = $16,
       review_status = $17::varchar, flagged_at = CASE WHEN $17::varchar = 'new' THEN NULL ELSE flagged_at END,
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, data.categoryId !== undefined, data.categoryId ?? null, next.name, next.description, next.explanation,
      data.price ?? null, data.imageUrl ?? null, isAvailable ?? null, allergens, dietaryTags,
      data.spiceLevel ?? null, src, translations, translationStatus, romanization ?? null, reviewStatus],
  );
  return toCamel(rows[0]);
}

async function deleteItem(id, user) {
  const item = await findItem(id);
  await restaurantService.assertCanManage(item.restaurantId, user);
  // Past orders keep name/price snapshots (order_items.menu_item_id becomes NULL).
  await db.query('DELETE FROM menu_items WHERE id = $1', [id]);
}

/**
 * Background job: retry translations that failed earlier (provider down / rate limit).
 * Processes a few rows per run to stay within free-tier limits.
 */
async function retryPendingTranslations(batch = 5) {
  const items = await db.query(
    `SELECT i.*, r.name AS restaurant_name, r.cuisine_type FROM menu_items i JOIN restaurants r ON r.id = i.restaurant_id
     WHERE i.translation_status = 'pending' ORDER BY i.updated_at LIMIT $1`, [batch],
  );
  for (const row of items.rows) {
    const it = toCamel(row);
    const tr = await translate({ name: it.name, description: it.description, explanation: it.explanation }, it.sourceLanguage,
      { kind: 'dish', restaurant: it.restaurantName, cuisine: it.cuisineType });
    if (tr.status !== 'done') return; // provider still unavailable — try again next run
    const merged = mergeTranslations(it.translations, tr.translations, TEXT_FIELDS);
    await db.query('UPDATE menu_items SET translations = $2, translation_status = $3, romanization = COALESCE(romanization, $4) WHERE id = $1',
      [it.id, merged, 'done', tr.romanization ?? null]);
  }
  const cats = await db.query(
    `SELECT c.*, r.name AS restaurant_name FROM menu_categories c JOIN restaurants r ON r.id = c.restaurant_id
     WHERE c.translation_status = 'pending' LIMIT $1`, [batch],
  );
  for (const row of cats.rows) {
    const tr = await translate({ name: row.name }, row.source_language, { kind: 'category', restaurant: row.restaurant_name });
    if (tr.status !== 'done') return;
    await db.query('UPDATE menu_categories SET translations = $2, translation_status = $3 WHERE id = $1',
      [row.id, mergeTranslations(row.translations, tr.translations, ['name']), 'done']);
  }
  const rest = await db.query("SELECT * FROM restaurants WHERE translation_status = 'pending' LIMIT $1", [batch]);
  for (const row of rest.rows) {
    const tr = await translate({ description: row.description }, row.source_language, { kind: 'restaurant', restaurant: row.name, cuisine: row.cuisine_type });
    if (tr.status !== 'done') return;
    await db.query('UPDATE restaurants SET translations = $2, translation_status = $3 WHERE id = $1',
      [row.id, mergeTranslations(row.translations, tr.translations, ['description']), 'done']);
  }
}

// ---------- Dish check by admin (after publication) ----------
const REVIEW_SELECT = `i.id, i.name, i.description, i.price, i.image_url, i.allergens, i.dietary_tags, i.spice_level, i.is_available,
  i.review_status, i.admin_note, i.flagged_at, i.created_at, i.updated_at, i.translations, i.source_language,
  r.id AS restaurant_id, r.name AS restaurant_name, r.cuisine_type, u.name AS owner_name, u.email AS owner_email`;
const REVIEW_BASE = 'FROM menu_items i JOIN restaurants r ON r.id = i.restaurant_id LEFT JOIN users u ON u.id = r.manager_id';

/** Admin: dishes to check (newest first). */
async function listForReview({ page, limit, status, search }) {
  const where = new WhereBuilder();
  if (status !== 'all') where.add('i.review_status = ?', status);
  if (search) where.add('(i.name ILIKE ? OR r.name ILIKE ?)', `%${search}%`);
  const result = await runPaginated(db, { select: REVIEW_SELECT, baseSql: REVIEW_BASE, where, orderBy: 'i.updated_at DESC', page, limit });
  result.items = result.items.map(withDeadline);
  return result;
}

/** Deadline for a flagged dish (shown to admin and owner). */
function withDeadline(item) {
  if (item.reviewStatus !== 'needs_changes' || !item.flaggedAt) return item;
  return { ...item, fixDeadline: new Date(new Date(item.flaggedAt).getTime() + env.dishFixDays * 86400000) };
}

/** Admin: approve a dish, or ask the owner to fix it (with a message). */
async function reviewDish(id, { action, note }) {
  const { rows } = action === 'approve'
    ? await db.query(`UPDATE menu_items SET review_status = 'ok', admin_note = NULL, flagged_at = NULL WHERE id = $1 RETURNING *`, [id])
    : await db.query(`UPDATE menu_items SET review_status = 'needs_changes', admin_note = $2, flagged_at = NOW() WHERE id = $1 RETURNING *`, [id, note]);
  if (!rows[0]) throw ApiError.notFound('Menu item not found');
  return withDeadline(toCamel(rows[0]));
}

/** Owner: dishes in my restaurants that the admin asked to fix (or that were hidden). */
async function listFlaggedForOwner(user) {
  const where = new WhereBuilder().raw(`i.review_status IN ('needs_changes', 'removed')`);
  if (user.role === 'manager') where.add('r.manager_id = ?', user.id);
  const { rows } = await db.query(`SELECT ${REVIEW_SELECT} ${REVIEW_BASE} ${where.toSql()} ORDER BY i.flagged_at`, where.params);
  return toCamel(rows).map(withDeadline);
}

/** Background job: hide dishes that were not fixed in time. */
async function hideUnfixedDishes({ now = new Date() } = {}) {
  const { rowCount } = await db.query(
    `UPDATE menu_items SET review_status = 'removed', is_available = FALSE
     WHERE review_status = 'needs_changes' AND flagged_at <= $1`,
    [new Date(now.getTime() - env.dishFixDays * 86400000)],
  );
  return rowCount;
}

module.exports = {
  listForReview, reviewDish, listFlaggedForOwner, hideUnfixedDishes,
  createCategory, updateCategory, deleteCategory,
  listItems, findItem, createItem, updateItem, deleteItem, retryPendingTranslations,
};
