const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { toCamel } = require('../utils/caseMapper');
const { WhereBuilder, runPaginated } = require('../utils/pagination');
const restaurantService = require('./restaurantService');
const { translateReview, isEnabled: isTranslationEnabled } = require('./translationService');
const { saveImage, looksLikeImage, MAX_REVIEW_PHOTOS } = require('../middleware/upload');

/** Average rating is calculated only from approved reviews. */
async function recalculateRating(restaurantId, client = db) {
  await client.query(
    `UPDATE restaurants SET
       average_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE restaurant_id = $1 AND is_approved), 0),
       review_count   = (SELECT COUNT(*) FROM reviews WHERE restaurant_id = $1 AND is_approved),
       updated_at = NOW()
     WHERE id = $1`,
    [restaurantId],
  );
}

async function create(customer, { orderId, rating, comment }, photos = []) {
  if (customer.role !== 'customer') throw ApiError.forbidden('Only customers can leave reviews');

  // Check every photo before saving anything (a renamed non-image file is rejected).
  if (photos.length > MAX_REVIEW_PHOTOS) throw ApiError.badRequest('Too many photos (max 3)', { code: 'TOO_MANY_PHOTOS' });
  if (photos.some((f) => !looksLikeImage(f.buffer))) {
    throw ApiError.badRequest('File content is not a valid image', { code: 'INVALID_FILE_TYPE' });
  }

  const review = await db.withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 AND customer_id = $2 FOR UPDATE', [orderId, customer.id]);
    const order = rows[0];
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status !== 'completed') {
      throw ApiError.badRequest('You can review only completed orders', { code: 'ORDER_NOT_COMPLETED' });
    }
    const existing = await client.query('SELECT 1 FROM reviews WHERE order_id = $1', [orderId]);
    if (existing.rowCount) throw ApiError.conflict('This order has already been reviewed', { code: 'REVIEW_EXISTS' });

    const photoUrls = [];
    for (const f of photos) photoUrls.push(await saveImage(f, customer.id, client)); // same transaction as the review
    const inserted = await client.query(
      `INSERT INTO reviews (customer_id, restaurant_id, order_id, rating, comment, source_language, photo_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [customer.id, order.restaurant_id, orderId, rating, comment ?? null, customer.preferredLanguage || 'en', photoUrls],
    );
    await recalculateRating(order.restaurant_id, client);
    return inserted.rows[0];
  });
  // Translate after saving, in the background: the review is published at once even if the
  // provider is slow or down (a failed translation is retried by the background job).
  if (review.comment && isTranslationEnabled()) {
    await db.query("UPDATE reviews SET translation_status = 'pending' WHERE id = $1", [review.id]);
    review.translation_status = 'pending';
    translateReview(review.comment, review.source_language)
      .then((tr) => tr.status === 'done' && db.query(
        'UPDATE reviews SET source_language = $2, translations = $3, translation_status = $4 WHERE id = $1',
        [review.id, tr.sourceLanguage, tr.translations, 'done'],
      ))
      .catch((e) => console.warn('[translate] review save failed:', e.message));
  }
  return toCamel(review);
}

const SELECT = `rv.*, u.name AS customer_name, r.name AS restaurant_name`;
const BASE = 'FROM reviews rv JOIN users u ON u.id = rv.customer_id JOIN restaurants r ON r.id = rv.restaurant_id';

/** Public list for a restaurant. Admin / its manager may also see hidden reviews. */
async function listByRestaurant(restaurantId, query, user) {
  const restaurant = await restaurantService.findRaw(restaurantId);
  if (!restaurant) throw ApiError.notFound('Restaurant not found');
  const where = new WhereBuilder().add('rv.restaurant_id = ?', restaurantId);
  const privileged = restaurantService.canManage(restaurant, user);
  if (!privileged) where.raw('rv.is_approved = TRUE');
  else if (query.isApproved !== undefined) where.add('rv.is_approved = ?', query.isApproved);
  return runPaginated(db, { select: SELECT, baseSql: BASE, where, orderBy: 'rv.created_at DESC', page: query.page, limit: query.limit });
}

/** Admin: all reviews across the platform. */
async function listAll(query) {
  const where = new WhereBuilder();
  if (query.isApproved !== undefined) where.add('rv.is_approved = ?', query.isApproved);
  if (query.restaurantId) where.add('rv.restaurant_id = ?', query.restaurantId);
  return runPaginated(db, { select: SELECT, baseSql: BASE, where, orderBy: 'rv.created_at DESC', page: query.page, limit: query.limit });
}

async function moderate(id, isApproved) {
  const review = await db.withTransaction(async (client) => {
    const { rows } = await client.query('UPDATE reviews SET is_approved = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, isApproved]);
    if (!rows[0]) throw ApiError.notFound('Review not found');
    await recalculateRating(rows[0].restaurant_id, client);
    return rows[0];
  });
  return toCamel(review);
}

/** Background job: translate reviews whose translation failed earlier. */
/** Also picks up reviews written before a translation key was set (status 'none'). */
async function retryPendingReviewTranslations(batch = 5) {
  const { rows } = await db.query("SELECT id, comment, source_language FROM reviews WHERE comment <> '' AND translation_status IN ('pending', 'none') ORDER BY created_at LIMIT $1", [batch]);
  for (const r of rows) {
    const tr = await translateReview(r.comment, r.source_language);
    if (tr.status !== 'done') return; // provider still unavailable
    await db.query('UPDATE reviews SET source_language = $2, translations = $3, translation_status = $4 WHERE id = $1', [r.id, tr.sourceLanguage, tr.translations, 'done']);
  }
}

module.exports = { create, listByRestaurant, listAll, moderate, recalculateRating, retryPendingReviewTranslations };
