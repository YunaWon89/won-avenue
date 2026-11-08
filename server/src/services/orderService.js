const crypto = require('crypto');
const { OPEN_SQL } = require('./openingHours');
const env = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { toCamel } = require('../utils/caseMapper');
const { WhereBuilder, runPaginated } = require('../utils/pagination');
const { canTransition, allowedNext } = require('./orderStatus');
const paymentService = require('./paymentService');

/**
 * Create and pay for an order.
 *
 * 1. In a transaction: validate restaurant + items, calculate totals on the server
 *    (the client sends only ids and quantities), insert the order as payment "pending".
 * 2. Charge the saved card (external call, outside the DB transaction).
 * 3. Mark as paid, or mark payment failed + cancel the order and return 402.
 */
/** Validate one restaurant's part of a checkout and insert it (unpaid). Runs inside a transaction. */
async function insertOrder(client, customer, dto) {
  const { restaurantId, orderType, items, customerNote, paymentMethodId } = dto;
  const r = await client.query(`SELECT r.*, ${OPEN_SQL} AS is_open FROM restaurants r WHERE r.id = $1`, [restaurantId]);
  const restaurant = r.rows[0];
  if (!restaurant) throw ApiError.notFound('Restaurant not found');
  if (!restaurant.is_active) throw ApiError.badRequest('Restaurant is not accepting orders', { code: 'RESTAURANT_INACTIVE' });
  if (!restaurant.is_open) throw ApiError.badRequest('Restaurant is closed right now', { code: 'RESTAURANT_CLOSED' });
  if (orderType === 'delivery' && !restaurant.supports_delivery) {
    throw ApiError.badRequest('This restaurant does not deliver', { code: 'DELIVERY_NOT_SUPPORTED' });
  }
  if (orderType === 'pickup' && !restaurant.supports_pickup) {
    throw ApiError.badRequest('This restaurant does not offer pickup', { code: 'PICKUP_NOT_SUPPORTED' });
  }

  const contactPhone = dto.contactPhone || customer.phone;
  if (!contactPhone) {
    throw ApiError.badRequest('Contact phone is required', { errors: [{ field: 'contactPhone', message: 'Contact phone is required' }] });
  }

  // Merge duplicates: [{A, 1}, {A, 2}] -> {A: 3}
  const quantities = new Map();
  for (const { menuItemId, quantity } of items) quantities.set(menuItemId, (quantities.get(menuItemId) || 0) + quantity);
  const ids = [...quantities.keys()];
  const { rows: menuRows } = await client.query(
    'SELECT id, name, price, is_available FROM menu_items WHERE id = ANY($1::uuid[]) AND restaurant_id = $2',
    [ids, restaurantId],
  );
  const byId = new Map(menuRows.map((m) => [m.id, m]));
  const errors = [];
  ids.forEach((id) => {
    const m = byId.get(id);
    if (!m) errors.push({ field: 'items', message: `Menu item ${id} does not belong to this restaurant` });
    else if (!m.is_available) errors.push({ field: 'items', message: `"${m.name}" is currently unavailable` });
  });
  if (errors.length) throw ApiError.badRequest('Some items cannot be ordered', { code: 'ITEMS_UNAVAILABLE', errors });

  const lines = ids.map((id) => {
    const m = byId.get(id);
    const quantity = quantities.get(id);
    return { menuItemId: id, name: m.name, price: m.price, quantity, subtotal: m.price * quantity };
  });
  const itemsAmount = lines.reduce((sum, l) => sum + l.subtotal, 0);
  if (orderType === 'delivery' && itemsAmount < restaurant.min_order_amount) {
    throw ApiError.badRequest(`Minimum order for delivery is ₩${restaurant.min_order_amount.toLocaleString('ko-KR')}`, {
      code: 'MIN_ORDER_NOT_MET',
    });
  }
  const deliveryFee = orderType === 'delivery' ? restaurant.delivery_fee : 0;
  const total = itemsAmount + deliveryFee;

  const method = await paymentService.getMethodForCharge(customer.id, paymentMethodId, client);

  const { rows } = await client.query(
    `INSERT INTO orders (customer_id, restaurant_id, order_type, delivery_address, contact_phone, customer_note,
       items_amount, delivery_fee, total_amount, payment_method_id, payment_provider, card_label, checkout_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [customer.id, restaurantId, orderType, orderType === 'delivery' ? dto.deliveryAddress : null, contactPhone,
      customerNote ?? null, itemsAmount, deliveryFee, total, method.id, method.provider, paymentService.cardLabel(method),
      dto.checkoutId ?? null],
  );
  const orderId = rows[0].id;
  for (const l of lines) {
    await client.query(
      `INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, price_snapshot, quantity, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, l.menuItemId, l.name, l.price, l.quantity, l.subtotal],
    );
  }
  const orderName = lines.length > 1 ? `${lines[0].name} 외 ${lines.length - 1}건` : lines[0].name;
  return { orderId, total, method, orderName, paymentProvider: method.provider };
}

/**
 * Charge the inserted orders one by one (each restaurant is paid separately, so each can be refunded on its own).
 * If a charge fails, nothing is kept: orders already paid in this checkout are refunded and all of them are cancelled.
 */
async function chargeAll(customer, created) {
  const paid = [];
  for (let i = 0; i < created.length; i += 1) {
    const c = created[i];
    try {
      const { reference } = await paymentService.charge({
        method: c.method, user: customer, amount: c.total, orderId: c.orderId, orderName: c.orderName,
      });
      await db.query(
        `UPDATE orders SET payment_status = 'paid', payment_reference = $2, updated_at = NOW() WHERE id = $1`,
        [c.orderId, reference],
      );
      paid.push({ ...c, reference });
    } catch (err) {
      for (const p of paid) {
        await paymentService.refund({ providerName: p.paymentProvider, reference: p.reference, reason: 'Checkout payment failed' });
        await db.query(
          `UPDATE orders SET payment_status = 'refunded', status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [p.orderId],
        );
      }
      await db.query(
        `UPDATE orders SET payment_status = 'failed', status = 'cancelled', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
        [created.slice(i).map((x) => x.orderId)],
      );
      throw new ApiError(402, err.message || 'Payment failed', { code: err.code || 'PAYMENT_FAILED' });
    }
  }
}

async function create(customer, dto) {
  if (customer.role !== 'customer') throw ApiError.forbidden('Only customers can place orders');
  const created = await db.withTransaction((client) => insertOrder(client, customer, dto));
  await chargeAll(customer, [created]);
  return getById(created.orderId, customer);
}

/**
 * One checkout for a cart with several restaurants: one order per restaurant (each has its own kitchen,
 * delivery fee, courier and status), sharing address, phone, note and card. All orders are validated
 * together — if any part is invalid nothing is created.
 */
async function createMany(customer, dto) {
  if (customer.role !== 'customer') throw ApiError.forbidden('Only customers can place orders');
  const { orders, ...shared } = dto;
  // Orders paid together share a checkout id, so the customer sees them as one payment.
  const checkoutId = orders.length > 1 ? crypto.randomUUID() : null;
  const created = await db.withTransaction(async (client) => {
    const out = [];
    for (const part of orders) {
      try {
        out.push(await insertOrder(client, customer, { ...shared, ...part, checkoutId }));
      } catch (err) {
        if (err instanceof ApiError) err.restaurantId = part.restaurantId; // tells the client which restaurant to fix
        throw err;
      }
    }
    return out;
  });
  await chargeAll(customer, created);
  return Promise.all(created.map((c) => getById(c.orderId, customer)));
}

const SORTS = {
  newest: 'o.created_at DESC',
  oldest: 'o.created_at ASC',
  status: `array_position(ARRAY['pending','accepted','preparing','ready_for_pickup','out_for_delivery','delivered','completed','cancelled']::order_status[], o.status), o.created_at DESC`,
};

/** Restrict a WHERE clause to orders the user is allowed to see. */
function scopeToUser(where, user) {
  if (user.role === 'customer') where.add('o.customer_id = ?', user.id);
  else if (user.role === 'manager') where.add('r.manager_id = ?', user.id);
  else if (user.role === 'courier') {
    // My deliveries + deliveries waiting for any courier
    where.add(`(o.courier_id = ? OR (o.status = 'out_for_delivery' AND o.courier_id IS NULL AND o.order_type = 'delivery'))`, user.id);
  }
  return where;
}

const withTransitions = (o, role) => ({ ...o, allowedTransitions: allowedNext(o.status, role, o.orderType) });

async function list(query, user) {
  const where = scopeToUser(new WhereBuilder(), user);
  // Failed payments never reach the restaurant.
  if (user.role === 'manager') where.raw(`o.payment_status <> 'failed'`);
  if (query.scope === 'available') where.raw(`o.status = 'out_for_delivery' AND o.courier_id IS NULL`);
  if (query.scope === 'mine' && user.role === 'courier') where.add('o.courier_id = ?', user.id);
  if (query.status) where.add('o.status = ?', query.status);
  if (query.active) where.raw(`o.status NOT IN ('completed', 'cancelled')`);
  if (query.orderType) where.add('o.order_type = ?', query.orderType);
  if (query.from) where.add('o.created_at >= ?', query.from);
  if (query.to) {
    const to = new Date(query.to);
    to.setUTCHours(23, 59, 59, 999); // include the whole "to" day
    where.add('o.created_at <= ?', to);
  }
  if (query.restaurantId) where.add('o.restaurant_id = ?', query.restaurantId);
  if (query.customerId && user.role !== 'customer') where.add('o.customer_id = ?', query.customerId);

  const result = await runPaginated(db, {
    select: `o.id, o.order_number, o.customer_id, o.restaurant_id, o.order_type, o.status, o.delivery_address,
             o.total_amount, o.payment_status, o.created_at, o.updated_at, o.courier_id, o.contact_phone, o.customer_note, o.checkout_id, o.card_label,
             r.address AS restaurant_address, r.phone AS restaurant_phone,
             r.name AS restaurant_name, r.image_url AS restaurant_image_url, u.name AS customer_name, u.email AS customer_email,
             (SELECT COALESCE(SUM(quantity), 0)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
             (SELECT string_agg(oi.item_name_snapshot || ' ×' || oi.quantity, ', ') FROM order_items oi WHERE oi.order_id = o.id) AS items_summary,
             (SELECT COALESCE(json_agg(json_build_object('name', oi.item_name_snapshot, 'quantity', oi.quantity,
                 'translations', mi.translations, 'sourceLanguage', mi.source_language) ORDER BY oi.item_name_snapshot), '[]')
                FROM order_items oi LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = o.id) AS lines,
             r.translations AS restaurant_translations,
             EXISTS (SELECT 1 FROM reviews rv WHERE rv.order_id = o.id) AS has_review`,
    baseSql: 'FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN users u ON u.id = o.customer_id',
    where,
    orderBy: SORTS[query.sort],
    page: query.page,
    limit: query.limit,
  });
  result.items = result.items.map((o) => withTransitions(o, user.role));
  return result;
}

/** Order details. Returns 404 (not 403) for orders outside the user's scope. */
async function getById(id, user) {
  const where = scopeToUser(new WhereBuilder().add('o.id = ?', id), user);
  const { rows } = await db.query(
    `SELECT o.*, r.name AS restaurant_name, r.phone AS restaurant_phone, r.address AS restaurant_address,
            r.image_url AS restaurant_image_url, r.prep_time_minutes, r.cuisine_type, r.translations AS restaurant_translations,
            u.name AS customer_name, u.email AS customer_email,
            cu.name AS courier_name, cu.phone AS courier_phone
     FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN users u ON u.id = o.customer_id
     LEFT JOIN users cu ON cu.id = o.courier_id
     ${where.toSql()}`,
    where.params,
  );
  if (!rows[0]) throw ApiError.notFound('Order not found');
  const order = toCamel(rows[0]);
  delete order.paymentReference; // internal
  const [itemsRes, reviewRes] = await Promise.all([
    db.query(`SELECT oi.*, mi.translations, mi.source_language FROM order_items oi
              LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = $1 ORDER BY oi.item_name_snapshot`, [id]),
    db.query('SELECT * FROM reviews WHERE order_id = $1', [id]),
  ]);
  return withTransitions({ ...order, items: toCamel(itemsRes.rows), review: toCamel(reviewRes.rows[0]) || null }, user.role);
}

async function updateStatus(id, status, user) {
  await db.withTransaction(async (client) => {
    const where = scopeToUser(new WhereBuilder().add('o.id = ?', id), user);
    const { rows } = await client.query(
      `SELECT o.status, o.order_type, o.payment_status, o.payment_provider, o.payment_reference, o.courier_id
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id ${where.toSql()} FOR UPDATE OF o`,
      where.params,
    );
    const order = rows[0];
    if (!order) throw ApiError.notFound('Order not found');
    if (user.role === 'courier' && order.courier_id !== user.id) {
      throw ApiError.forbidden('Take the delivery first', { code: 'NOT_YOUR_DELIVERY' });
    }
    if (!canTransition(order.status, status, user.role, order.order_type)) {
      throw ApiError.badRequest(`Cannot change order status from "${order.status}" to "${status}"`, {
        code: 'INVALID_STATUS_TRANSITION',
      });
    }
    let paymentStatus = order.payment_status;
    if (status === 'cancelled' && order.payment_status === 'paid') {
      // Refund first; if the provider refuses, the transaction rolls back and the order stays active.
      await paymentService.refund({ providerName: order.payment_provider, reference: order.payment_reference, reason: 'Order cancelled' });
      paymentStatus = 'refunded';
    }
    await client.query('UPDATE orders SET status = $2, payment_status = $3, updated_at = NOW() WHERE id = $1', [id, status, paymentStatus]);
  });
  return getById(id, user);
}

/**
 * Background job: moves orders forward without anyone tapping buttons.
 *  - pending for too long (restaurant didn't answer) -> cancelled + refunded
 *  - delivered / ready_for_pickup for a while          -> completed
 * Returns the number of orders changed.
 */
async function autoProgress({ now = new Date() } = {}) {
  const minutesAgo = (m) => new Date(now.getTime() - m * 60000);
  let changed = 0;

  const stale = await db.query(
    `SELECT id, payment_status, payment_provider, payment_reference FROM orders
     WHERE status = 'pending' AND payment_status <> 'failed' AND updated_at <= $1`, [minutesAgo(env.autoCancelMinutes)],
  );
  for (const o of stale.rows) {
    let paymentStatus = o.payment_status;
    try {
      if (o.payment_status === 'paid') {
        await paymentService.refund({ providerName: o.payment_provider, reference: o.payment_reference, reason: 'Restaurant did not respond' });
        paymentStatus = 'refunded';
      }
      await db.query(`UPDATE orders SET status = 'cancelled', payment_status = $2, updated_at = $3 WHERE id = $1 AND status = 'pending'`,
        [o.id, paymentStatus, now]);
      changed += 1;
    } catch (err) {
      console.warn(`[orders] auto-cancel ${o.id} failed: ${err.message}`);
    }
  }

  const completed = await db.query(
    `UPDATE orders SET status = 'completed', updated_at = $2 WHERE status IN ('delivered', 'ready_for_pickup') AND updated_at <= $1`,
    [minutesAgo(env.autoCompleteMinutes), now],
  );
  return changed + completed.rowCount;
}

/** Courier takes a delivery that a restaurant has handed over. First come, first served. */
async function claim(id, courier) {
  const { rowCount } = await db.query(
    `UPDATE orders SET courier_id = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'out_for_delivery' AND order_type = 'delivery' AND courier_id IS NULL`,
    [id, courier.id],
  );
  if (!rowCount) throw ApiError.conflict('This delivery is no longer available', { code: 'DELIVERY_TAKEN' });
  return getById(id, courier);
}

module.exports = { create, createMany, list, getById, updateStatus, autoProgress, claim };
