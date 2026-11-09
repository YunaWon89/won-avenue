const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { seed, PASSWORD } = require('../src/db/seed');

/** Logged-in supertest agent (cookie-based session). */
async function login(email, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let admin; let owner; let owner2; let customer; let courier;
let hansik; let chicken; let halal; let napoli; // restaurants
let card;

beforeAll(async () => {
  await seed();
  [admin, owner, owner2, customer, courier] = await Promise.all([
    login('admin@demo.com'), login('owner@demo.com'), login('owner2@demo.com'), login('customer@demo.com'), login('courier@demo.com'),
  ]);
  const { body } = await request(app).get('/api/restaurants?limit=50');
  const byName = (n) => body.items.find((r) => r.name === n);
  hansik = byName('서울 한식당');
  chicken = byName('바삭 치킨');
  halal = byName('이스탄불 할랄 키친');
  napoli = byName('나폴리 피자');
  const cards = await customer.get('/api/payment-methods');
  card = cards.body.data.find((c) => c.isDefault);
});

afterAll(() => pool.end());

const menuOf = async (restaurant, query = '') => (await request(app).get(`/api/restaurants/${restaurant.id}/menu-items${query}`)).body.items;

// ---------------------------------------------------------------------------
describe('Authentication', () => {
  const newUser = {
    name: 'Test User', email: 'new@test.com', password: 'Passw0rd!', phone: '010-9999-0000',
    postalCode: '06236', addressLine1: '서울특별시 강남구 테헤란로 152', addressLine2: '10층',
  };

  test('registers with valid data and sets an httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'new@test.com', role: 'customer', addressLine1: newUser.addressLine1 });
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=.+HttpOnly/i);
  });

  test('rejects duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'EMAIL_TAKEN' });
  });

  test('rejects invalid email, short password and missing address with field errors', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short', phone: '1' });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password', 'phone', 'addressLine1']));
  });

  test('owner registration creates a manager account (no address required)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'New Owner', email: 'newowner@test.com', password: 'Passw0rd!', phone: '010-1111-2222', accountType: 'manager',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('manager');
  });

  test('login with wrong password returns a generic 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'customer@demo.com', password: 'wrong-pass1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@demo.com', password: 'wrong-pass1' });
    expect(unknown.body.message).toBe(res.body.message);
  });

  test('protected routes reject unauthenticated requests; logout clears the session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const agent = await login('customer@demo.com');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  test('Bearer token from login also works for API clients', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@demo.com', password: PASSWORD });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.data.role).toBe('admin');
  });

  test('deactivated users cannot log in', async () => {
    const users = await admin.get('/api/admin/users?search=new@test.com');
    await admin.patch(`/api/admin/users/${users.body.items[0].id}`).send({ isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'new@test.com', password: 'Passw0rd!' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Role access', () => {
  test('customer cannot access admin endpoints', async () => {
    expect((await customer.get('/api/admin/users')).status).toBe(403);
  });

  test('customer cannot manage menu items', async () => {
    const res = await customer.post('/api/menu-items').send({ restaurantId: hansik.id, name: 'Hack', price: 1000 });
    expect(res.status).toBe(403);
  });

  test("owner cannot update another owner's restaurant or menu", async () => {
    const [item] = await menuOf(hansik);
    expect((await owner2.patch(`/api/menu-items/${item.id}`).send({ price: 1 })).status).toBe(403);
    expect((await owner2.patch(`/api/restaurants/${hansik.id}`).send({ name: 'Mine now' })).status).toBe(403);
  });

  test('owner cannot activate their own restaurant (admin only)', async () => {
    const res = await owner.patch(`/api/restaurants/${hansik.id}`).send({ isActive: false });
    expect(res.status).toBe(403);
  });

  test('admin can access management endpoints', async () => {
    const res = await admin.get('/api/admin/users?role=manager');
    expect(res.status).toBe(200);
    expect(res.body.items.every((u) => u.role === 'manager')).toBe(true);
    expect((await admin.get('/api/admin/stats')).body.data.orders).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe('Restaurant & menu CRUD', () => {
  let created;

  test('admin creates, updates and deletes a restaurant', async () => {
    const res = await admin.post('/api/restaurants').send({ name: '테스트 식당', cuisineType: 'korean', deliveryFee: 1000 });
    expect(res.status).toBe(201);
    created = res.body.data;
    expect(created.isActive).toBe(true);
    const upd = await admin.patch(`/api/restaurants/${created.id}`).send({ name: '테스트 식당 2', minOrderAmount: 5000 });
    expect(upd.body.data).toMatchObject({ name: '테스트 식당 2', minOrderAmount: 5000 });
    const del = await admin.delete(`/api/restaurants/${created.id}`);
    expect(del.body.deleted).toBe(true);
  });

  test('restaurant with order history is deactivated instead of deleted', async () => {
    const res = await admin.delete(`/api/restaurants/${napoli.id}`);
    expect(res.body).toMatchObject({ deleted: false, deactivated: true });
    const list = await request(app).get('/api/restaurants?limit=50');
    expect(list.body.items.find((r) => r.id === napoli.id)).toBeUndefined();
  });

  test("owner's own restaurant submission is pending approval until admin activates it", async () => {
    const res = await owner.post('/api/restaurants').send({ name: '사장님 새 가게', cuisineType: 'cafe_dessert' });
    expect(res.status).toBe(201);
    expect(res.body.data.isActive).toBe(false);
    expect((await request(app).get(`/api/restaurants/${res.body.data.id}`)).status).toBe(404); // hidden from public
    await admin.patch(`/api/restaurants/${res.body.data.id}`).send({ isActive: true });
    expect((await request(app).get(`/api/restaurants/${res.body.data.id}`)).status).toBe(200);
  });

  test('owner creates, updates and deletes a category', async () => {
    const c = await owner.post('/api/categories').send({ restaurantId: hansik.id, name: '디저트' });
    expect(c.status).toBe(201);
    const u = await owner.patch(`/api/categories/${c.body.data.id}`).send({ name: '후식' });
    expect(u.body.data.name).toBe('후식');
    expect((await owner.delete(`/api/categories/${c.body.data.id}`)).status).toBe(200);
  });

  test('owner creates a menu item with allergens, diet tags and an image', async () => {
    const res = await owner.post('/api/menu-items')
      .field('restaurantId', hansik.id)
      .field('name', '잡채')
      .field('price', '9000')
      .field('allergens', 'soy,sesame,wheat')
      .field('dietaryTags', 'vegan')
      .attach('image', PNG_1x1, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ price: 9000, allergens: ['soy', 'sesame', 'wheat'] });
    expect(res.body.data.dietaryTags).toEqual(expect.arrayContaining(['vegan', 'vegetarian'])); // vegan implies vegetarian
    expect(res.body.data.imageUrl).toMatch(/^\/api\/images\//);
    const img = await request(app).get(res.body.data.imageUrl);
    expect(img.headers['content-type']).toBe('image/png');

    const upd = await owner.patch(`/api/menu-items/${res.body.data.id}`).send({ isAvailable: false });
    expect(upd.body.data.isAvailable).toBe(false);
    expect((await owner.delete(`/api/menu-items/${res.body.data.id}`)).status).toBe(200);
  });

  test('negative / fractional price and invalid allergen are rejected', async () => {
    const neg = await owner.post('/api/menu-items').send({ restaurantId: hansik.id, name: '음식', price: -100 });
    expect(neg.status).toBe(400);
    const frac = await owner.post('/api/menu-items').send({ restaurantId: hansik.id, name: '음식', price: 99.5 });
    expect(frac.status).toBe(400);
    const bad = await owner.post('/api/menu-items').send({ restaurantId: hansik.id, name: '음식', price: 1000, allergens: ['plutonium'] });
    expect(bad.status).toBe(400);
  });

  test('halal item cannot contain pork', async () => {
    const res = await owner.post('/api/menu-items').send({
      restaurantId: hansik.id, name: '돼지국밥', price: 9000, allergens: ['pork'], dietaryTags: ['halal'],
    });
    expect(res.status).toBe(400);
  });

  test('category must belong to the same restaurant', async () => {
    const detail = await request(app).get(`/api/restaurants/${chicken.id}`);
    const res = await owner.post('/api/menu-items').send({
      restaurantId: hansik.id, categoryId: detail.body.data.categories[0].id, name: '치킨', price: 1000,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CATEGORY_MISMATCH');
  });

  test('uploading a non-image file fails', async () => {
    const res = await owner.patch(`/api/restaurants/${hansik.id}`)
      .attach('image', Buffer.from('not an image'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE_TYPE');
    const disguised = await owner.patch(`/api/restaurants/${hansik.id}`)
      .attach('image', Buffer.from('definitely not a png file'), { filename: 'x.png', contentType: 'image/png' });
    expect(disguised.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Search, filtering, sorting, pagination', () => {
  test('restaurant list returns pagination metadata', async () => {
    const res = await request(app).get('/api/restaurants?page=1&limit=2');
    expect(res.body).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.totalPages).toBe(Math.ceil(res.body.totalCount / 2));
  });

  test('search by restaurant name and by dish name', async () => {
    const byName = await request(app).get('/api/restaurants').query({ search: '바삭' });
    expect(byName.body.items.map((r) => r.name)).toEqual(['바삭 치킨']);
    const byDish = await request(app).get('/api/restaurants').query({ search: '케밥' });
    expect(byDish.body.items.map((r) => r.name)).toContain('이스탄불 할랄 키친');
  });

  test('sort restaurants by rating', async () => {
    const res = await request(app).get('/api/restaurants?sort=rating&limit=50');
    const ratings = res.body.items.map((r) => r.averageRating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  test('filter restaurants by diet and order type', async () => {
    const res = await request(app).get('/api/restaurants?diet=halal&limit=50');
    expect(res.body.items.every((r) => r.dietaryTags.includes('halal'))).toBe(true);
    const pickup = await request(app).get('/api/restaurants?orderType=delivery&limit=50');
    expect(pickup.body.items.find((r) => r.name === '도쿄 라멘')).toBeUndefined();
  });

  test('filter menu items by category and price range, sort by price', async () => {
    const detail = await request(app).get(`/api/restaurants/${hansik.id}`);
    const rice = detail.body.data.categories.find((c) => c.name === '밥');
    const items = await menuOf(hansik, `?categoryId=${rice.id}`);
    expect(items.every((i) => i.categoryId === rice.id)).toBe(true);
    const ranged = await menuOf(hansik, '?minPrice=9000&maxPrice=12000&sort=price_desc');
    expect(ranged.every((i) => i.price >= 9000 && i.price <= 12000)).toBe(true);
    expect(ranged.map((i) => i.price)).toEqual([...ranged.map((i) => i.price)].sort((a, b) => b - a));
  });

  test('allergy filter hides items containing excluded allergens', async () => {
    const items = await menuOf(hansik, '?excludeAllergens=pork,egg');
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.allergens.includes('pork') || i.allergens.includes('egg'))).toBe(false);
  });

  test('diet filter requires all selected tags', async () => {
    const items = await menuOf(halal, '?diet=halal,vegan');
    expect(items.map((i) => i.name).sort()).toEqual(['팔라펠 랩', '후무스 & 피타'].sort());
  });

  test('very large page number returns an empty list with correct metadata', async () => {
    const res = await request(app).get('/api/restaurants?page=999&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.page).toBe(999);
    expect(res.body.totalCount).toBeGreaterThan(0);
  });

  test('invalid pagination / sort values are rejected', async () => {
    expect((await request(app).get('/api/restaurants?limit=500')).status).toBe(400);
    expect((await request(app).get('/api/restaurants?page=0')).status).toBe(400);
    expect((await request(app).get('/api/restaurants?sort=drop_table')).status).toBe(400);
  });

  test('order list can be filtered by status', async () => {
    const res = await customer.get('/api/orders?status=completed');
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((o) => o.status === 'completed')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('Payments (saved cards)', () => {
  test('invalid card number is rejected', async () => {
    const res = await customer.post('/api/payment-methods').send({ cardNumber: '4242 4242 4242 4241', expMonth: 12, expYear: 2030, cvc: '123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CARD_INVALID');
  });

  test('valid foreign card is saved without storing the card number', async () => {
    const res = await customer.post('/api/payment-methods').send({
      cardNumber: '5555 5555 5555 4444', expMonth: 12, expYear: 2030, cvc: '123', isForeign: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ cardBrand: 'MASTERCARD', last4: '4444', isForeign: true });
    expect(res.body.data.billingKey).toBeUndefined();
    const { rows } = await pool.query("SELECT * FROM payment_methods WHERE last4 = '4444'");
    expect(JSON.stringify(rows)).not.toContain('5555555555554444');
  });

  test('only customers manage cards', async () => {
    expect((await owner.get('/api/payment-methods')).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Orders and status flow', () => {
  let bulgogi; let kimchi;
  beforeAll(async () => {
    const items = await menuOf(hansik);
    bulgogi = items.find((i) => i.name === '소불고기');
    kimchi = items.find((i) => i.name === '김치찌개');
  });

  const deliveryOrder = (extra = {}) => ({
    restaurantId: hansik.id,
    orderType: 'delivery',
    items: [{ menuItemId: bulgogi.id, quantity: 1 }, { menuItemId: kimchi.id, quantity: 2 }],
    deliveryAddress: '서울특별시 마포구 양화로 45, 101동 1203호',
    paymentMethodId: card.id,
    ...extra,
  });

  test('customer creates a paid delivery order; totals are calculated on the server', async () => {
    const res = await customer.post('/api/orders').send({ ...deliveryOrder(), totalAmount: 1 });
    expect(res.status).toBe(201);
    const items = 13000 + 9000 * 2;
    expect(res.body.data).toMatchObject({
      status: 'pending', orderType: 'delivery', paymentStatus: 'paid', currency: 'KRW',
      itemsAmount: items, deliveryFee: hansik.deliveryFee, totalAmount: items + hansik.deliveryFee,
    });
  });

  test('pickup order has no delivery fee and needs no address', async () => {
    const res = await customer.post('/api/orders').send(deliveryOrder({ orderType: 'pickup', deliveryAddress: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ deliveryFee: 0, deliveryAddress: null, totalAmount: 13000 + 18000 });
  });

  test('delivery order requires address and minimum amount', async () => {
    expect((await customer.post('/api/orders').send(deliveryOrder({ deliveryAddress: undefined }))).status).toBe(400);
    const small = await customer.post('/api/orders').send(deliveryOrder({ items: [{ menuItemId: kimchi.id, quantity: 1 }] }));
    expect(small.status).toBe(400);
    expect(small.body.code).toBe('MIN_ORDER_NOT_MET');
  });

  test('empty order is rejected', async () => {
    expect((await customer.post('/api/orders').send(deliveryOrder({ items: [] }))).status).toBe(400);
  });

  test('ordering an unavailable item fails', async () => {
    await owner.patch(`/api/menu-items/${kimchi.id}`).send({ isAvailable: false });
    const res = await customer.post('/api/orders').send(deliveryOrder());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ITEMS_UNAVAILABLE');
    await owner.patch(`/api/menu-items/${kimchi.id}`).send({ isAvailable: true });
  });

  test('deactivated restaurant does not accept orders', async () => {
    await admin.patch(`/api/restaurants/${chicken.id}`).send({ isActive: false });
    const [item] = await (await owner.get(`/api/restaurants/${chicken.id}/menu-items`)).body.items;
    const res = await customer.post('/api/orders').send({
      restaurantId: chicken.id, orderType: 'pickup', items: [{ menuItemId: item.id, quantity: 1 }], paymentMethodId: card.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESTAURANT_INACTIVE');
    await admin.patch(`/api/restaurants/${chicken.id}`).send({ isActive: true });
  });

  test('declined card returns 402 and the order is cancelled', async () => {
    const add = await customer.post('/api/payment-methods').send({ cardNumber: '4000000000000002', expMonth: 1, expYear: 2031, cvc: '000' });
    const res = await customer.post('/api/orders').send(deliveryOrder({ paymentMethodId: add.body.data.id }));
    expect(res.status).toBe(402);
    const list = await customer.get('/api/orders?status=cancelled');
    expect(list.body.items.some((o) => o.paymentStatus === 'failed')).toBe(true);
  });

  // ---- cart with several restaurants: one checkout, one order per restaurant ----
  const twoRestaurants = async (extra = {}) => {
    const chickenItem = (await menuOf(chicken)).find((i) => i.isAvailable);
    return {
      orderType: 'delivery',
      deliveryAddress: '서울특별시 마포구 양화로 45, 101동 1203호',
      paymentMethodId: card.id,
      orders: [
        { restaurantId: hansik.id, items: [{ menuItemId: bulgogi.id, quantity: 1 }, { menuItemId: kimchi.id, quantity: 2 }] },
        { restaurantId: chicken.id, items: [{ menuItemId: chickenItem.id, quantity: 3 }] },
      ],
      ...extra,
    };
  };

  test('one checkout with two restaurants creates two paid orders, each with its own delivery fee', async () => {
    const body = await twoRestaurants();
    const res = await customer.post('/api/orders/batch').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    const [a, b] = res.body.data;
    expect(a).toMatchObject({ restaurantId: hansik.id, status: 'pending', paymentStatus: 'paid', deliveryFee: hansik.deliveryFee });
    expect(b).toMatchObject({ restaurantId: chicken.id, status: 'pending', paymentStatus: 'paid', deliveryFee: chicken.deliveryFee });
    expect(a.deliveryAddress).toBe(b.deliveryAddress);
    // paid together -> same checkout id (shown as one payment), also in the list
    expect(a.checkoutId).toBeTruthy();
    expect(b.checkoutId).toBe(a.checkoutId);
    const mine = await customer.get('/api/orders?limit=5');
    expect(mine.body.items.filter((o) => o.checkoutId === a.checkoutId)).toHaveLength(2);
    // each restaurant sees only its own order
    const ownerList = await owner.get(`/api/orders?restaurantId=${chicken.id}&status=pending`);
    expect(ownerList.body.items.some((o) => o.id === b.id)).toBe(true);
    expect(ownerList.body.items.some((o) => o.id === a.id)).toBe(false);
  });

  test('if one restaurant part is invalid, no order is created', async () => {
    const before = (await customer.get('/api/orders?limit=1')).body.totalCount;
    const body = await twoRestaurants();
    body.orders[1].items[0].quantity = 1; // below the chicken restaurant's minimum for delivery
    body.orders[1].items = [{ menuItemId: kimchi.id, quantity: 1 }]; // and an item from another restaurant
    const res = await customer.post('/api/orders/batch').send(body);
    expect(res.status).toBe(400);
    expect(res.body.restaurantId).toBe(chicken.id);
    expect((await customer.get('/api/orders?limit=1')).body.totalCount).toBe(before);
  });

  test('the same restaurant twice in one checkout is rejected', async () => {
    const body = await twoRestaurants();
    body.orders[1] = body.orders[0];
    expect((await customer.post('/api/orders/batch').send(body)).status).toBe(400);
  });

  test('if the second payment fails, the first is refunded and both orders are cancelled', async () => {
    const paymentService = require('../src/services/paymentService');
    const realCharge = paymentService.charge;
    let calls = 0;
    const spy = jest.spyOn(paymentService, 'charge').mockImplementation(async (args) => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error('Card declined'), { code: 'CARD_DECLINED' });
      return realCharge(args);
    });
    const res = await customer.post('/api/orders/batch').send(await twoRestaurants());
    spy.mockRestore();
    expect(res.status).toBe(402);
    const recent = (await customer.get('/api/orders?status=cancelled&limit=2')).body.items;
    expect(recent.map((o) => o.paymentStatus).sort()).toEqual(['failed', 'refunded']);
  });

  test('couriers and owners cannot use the multi-restaurant checkout', async () => {
    expect((await owner.post('/api/orders/batch').send(await twoRestaurants())).status).toBe(403);
  });

  test('customer sees only own orders; others get 404', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Other', email: 'other@test.com', password: 'Passw0rd!', phone: '010-2222-3333', addressLine1: '서울특별시 중구 세종대로 110',
    });
    expect(reg.status).toBe(201);
    const other = await login('other@test.com', 'Passw0rd!');
    const mine = await customer.get('/api/orders');
    expect((await other.get('/api/orders')).body.totalCount).toBe(0);
    expect((await other.get(`/api/orders/${mine.body.items[0].id}`)).status).toBe(404);
  });

  test('owner sees only orders of own restaurants', async () => {
    const res = await owner2.get('/api/orders?limit=50');
    const names = new Set(res.body.items.map((o) => o.restaurantName));
    expect(names.has('서울 한식당')).toBe(false);
  });

  test('delivery flow: restaurant accepts and sends out, invalid transitions rejected', async () => {
    const { body } = await customer.post('/api/orders').send(deliveryOrder());
    const oid = body.data.id;
    const set = (agent, status) => agent.patch(`/api/orders/${oid}/status`).send({ status });

    expect((await set(admin, 'preparing')).status).toBe(400); // admin is not part of the normal flow
    expect((await set(owner, 'out_for_delivery')).status).toBe(400); // must accept first
    expect((await set(owner, 'preparing')).body.data.status).toBe('preparing'); // "Accept" = start cooking
    expect((await set(customer, 'cancelled')).status).toBe(400); // customer cannot cancel after acceptance
    expect((await set(owner, 'pending')).status).toBe(400); // cannot move backwards
    expect((await set(owner, 'delivered')).status).toBe(400); // cannot skip steps
    expect((await set(owner, 'ready_for_pickup')).status).toBe(400); // pickup-only status
    expect((await set(owner, 'out_for_delivery')).body.data.status).toBe('out_for_delivery'); // handed to a courier
    expect((await set(owner, 'delivered')).status).toBe(400); // only the courier marks it delivered
    expect((await set(courier, 'delivered')).status).toBe(403); // courier must take the delivery first
    const available = await courier.get('/api/orders?scope=available&limit=50');
    expect(available.body.items.some((o) => o.id === oid)).toBe(true);
    expect((await courier.post(`/api/orders/${oid}/claim`)).body.data.courierId).toBeTruthy();
    expect((await courier.post(`/api/orders/${oid}/claim`)).status).toBe(409); // already taken
    expect((await set(courier, 'delivered')).body.data.status).toBe('delivered');
    // the customer sees who delivers and can call them
    const tracked = (await customer.get(`/api/orders/${oid}`)).body.data;
    expect(tracked.courierName).toBeTruthy();
    expect(tracked.courierPhone).toBeTruthy();
    // customers don't confirm receipt: "Delivered" ends it for them and the order completes automatically
    expect((await set(customer, 'completed')).status).toBe(400);
    const { autoProgress } = require('../src/services/orderService');
    await autoProgress({ now: new Date(Date.now() + 15 * 60000) });
    expect((await customer.get(`/api/orders/${oid}`)).body.data.status).toBe('completed');
    const after = await set(admin, 'cancelled');
    expect(after.status).toBe(400); // completed is final
    expect(after.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('pickup flow uses ready_for_pickup', async () => {
    const { body } = await customer.post('/api/orders').send(deliveryOrder({ orderType: 'pickup', deliveryAddress: undefined }));
    const set = (status) => owner.patch(`/api/orders/${body.data.id}/status`).send({ status });
    for (const s of ['preparing', 'ready_for_pickup', 'completed']) expect((await set(s)).status).toBe(200);
  });

  test('customer can cancel a pending order and payment is refunded', async () => {
    const { body } = await customer.post('/api/orders').send(deliveryOrder());
    const res = await customer.patch(`/api/orders/${body.data.id}/status`).send({ status: 'cancelled' });
    expect(res.body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded' });
    expect((await owner.patch(`/api/orders/${body.data.id}/status`).send({ status: 'preparing' })).status).toBe(400);
  });

  test('another courier cannot take or finish a delivery that is already taken', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Second Courier', email: 'courier2@test.com', password: 'Passw0rd!', phone: '010-5555-6666', accountType: 'courier',
    });
    expect(reg.body.data.role).toBe('courier');
    const other = await login('courier2@test.com', 'Passw0rd!');
    const { body } = await customer.post('/api/orders').send(deliveryOrder());
    await owner.patch(`/api/orders/${body.data.id}/status`).send({ status: 'preparing' });
    await owner.patch(`/api/orders/${body.data.id}/status`).send({ status: 'out_for_delivery' });
    await courier.post(`/api/orders/${body.data.id}/claim`);
    expect((await other.post(`/api/orders/${body.data.id}/claim`)).status).toBe(409);
    expect((await other.patch(`/api/orders/${body.data.id}/status`).send({ status: 'delivered' })).status).toBe(404);
    expect((await customer.post(`/api/orders/${body.data.id}/claim`)).status).toBe(403); // customers can't claim
  });

  test('orders move forward automatically: completed after delivery, unanswered ones cancelled', async () => {
    const { autoProgress } = require('../src/services/orderService');
    const sent = (await customer.post('/api/orders').send(deliveryOrder())).body.data;
    await owner.patch(`/api/orders/${sent.id}/status`).send({ status: 'preparing' });
    await owner.patch(`/api/orders/${sent.id}/status`).send({ status: 'out_for_delivery' });
    const waiting = (await customer.post('/api/orders').send(deliveryOrder())).body.data;

    const later = (min) => new Date(Date.now() + min * 60000);
    await autoProgress({ now: later(25) }); // past the "no answer" limit
    // "Delivered" is never set by a timer — only by the courier.
    expect((await customer.get(`/api/orders/${sent.id}`)).body.data.status).toBe('out_for_delivery');
    const cancelled = (await customer.get(`/api/orders/${waiting.id}`)).body.data;
    expect(cancelled).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded' });

    await courier.post(`/api/orders/${sent.id}/claim`);
    await courier.patch(`/api/orders/${sent.id}/status`).send({ status: 'delivered' });
    await autoProgress({ now: later(40) });
    expect((await customer.get(`/api/orders/${sent.id}`)).body.data.status).toBe('completed');
  });

  test('admin can cancel an active order in exceptional cases', async () => {
    const { body } = await customer.post('/api/orders').send(deliveryOrder());
    await owner.patch(`/api/orders/${body.data.id}/status`).send({ status: 'preparing' });
    const res = await admin.patch(`/api/orders/${body.data.id}/status`).send({ status: 'cancelled' });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('Ratings and reviews', () => {
  test('customer cannot review a pending order', async () => {
    const items = await menuOf(hansik);
    const dish = items.find((i) => i.name === '소불고기');
    const order = await customer.post('/api/orders').send({
      restaurantId: hansik.id, orderType: 'pickup', items: [{ menuItemId: dish.id, quantity: 1 }], paymentMethodId: card.id,
    });
    const res = await customer.post('/api/reviews').send({ orderId: order.body.data.id, rating: 5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ORDER_NOT_COMPLETED');
  });

  test('invalid rating is rejected', async () => {
    const done = await customer.get('/api/orders?status=completed');
    expect((await customer.post('/api/reviews').send({ orderId: done.body.items[0].id, rating: 6 })).status).toBe(400);
    expect((await customer.post('/api/reviews').send({ orderId: done.body.items[0].id, rating: 2.5 })).status).toBe(400);
  });

  test('customer reviews a completed order, average updates, duplicate is rejected', async () => {
    const done = await customer.get(`/api/orders?status=completed&restaurantId=${hansik.id}`);
    const order = done.body.items.find((o) => !o.hasReview);
    const res = await customer.post('/api/reviews').send({ orderId: order.id, rating: 1, comment: 'Cold food' });
    expect(res.status).toBe(201);

    const detail = await request(app).get(`/api/restaurants/${hansik.id}`);
    expect(detail.body.data.averageRating).toBe(3); // (5 + 1) / 2
    expect(detail.body.data.reviewCount).toBe(2);

    const dup = await customer.post('/api/reviews').send({ orderId: order.id, rating: 5 });
    expect(dup.status).toBe(409);

    const reviews = await request(app).get(`/api/restaurants/${hansik.id}/reviews`);
    expect(reviews.body.items.some((r) => r.comment === 'Cold food')).toBe(true);
  });

  test('admin moderation hides a review and recalculates the rating', async () => {
    const all = await admin.get(`/api/reviews?restaurantId=${hansik.id}`);
    const bad = all.body.items.find((r) => r.rating === 1);
    await admin.patch(`/api/reviews/${bad.id}`).send({ isApproved: false });
    const detail = await request(app).get(`/api/restaurants/${hansik.id}`);
    expect(detail.body.data.averageRating).toBe(5);
    const pub = await request(app).get(`/api/restaurants/${hansik.id}/reviews`);
    expect(pub.body.items.some((r) => r.id === bad.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('Error format', () => {
  test('unknown route and invalid id return the standard error shape', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    const bad = await request(app).get('/api/restaurants/not-a-uuid');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
describe('Food passport, moods and translations', () => {
  const passportQuery = '?pDiet=halal&pAllergens=peanut,shrimp&pMaxSpice=2&limit=50';

  test('customer saves and toggles the food passport', async () => {
    const res = await customer.patch('/api/auth/me').send({ passport: { enabled: true, diet: ['halal', 'no_pork'], allergens: ['peanut'], maxSpice: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.data.passport).toEqual({ enabled: true, diet: ['halal', 'no_pork'], allergens: ['peanut'], maxSpice: 1 });
    const bad = await customer.patch('/api/auth/me').send({ passport: { enabled: true, diet: ['carnivore'], allergens: [], maxSpice: 9 } });
    expect(bad.status).toBe(400);
  });

  test('restaurant list returns safeCount for the viewer passport and can show only safe places', async () => {
    const res = await request(app).get(`/api/restaurants${passportQuery}`);
    const halalPlace = res.body.items.find((r) => r.name === '이스탄불 할랄 키친');
    expect(halalPlace.safeCount).toBe(4);
    expect(res.body.items.find((r) => r.name === '나폴리 피자')?.safeCount ?? 0).toBe(0);
    const safe = await request(app).get(`/api/restaurants${passportQuery}&safeOnly=true`);
    expect(safe.body.items.every((r) => r.safeCount > 0)).toBe(true);
    expect(res.body.items[0].minItemPrice).toBeGreaterThan(0);
  });

  test('sides and drinks do not make a restaurant match a diet', async () => {
    const veg = await request(app).get('/api/restaurants?diet=vegetarian&limit=50');
    const names = veg.body.items.map((r) => r.name);
    expect(names).not.toContain('바삭 치킨'); // only fries / cheese balls (sides) are vegetarian
    expect(names).toContain('서울 한식당'); // bibimbap, tofu bowl are mains
    const p = await request(app).get('/api/restaurants?pDiet=vegetarian&safeOnly=true&limit=50');
    expect(p.body.items.map((r) => r.name)).not.toContain('바삭 치킨');
  });

  test('mood filters: sweet tag and fast (prep time)', async () => {
    const sweet = await request(app).get('/api/restaurants?mood=sweet');
    expect(sweet.body.items.map((r) => r.name)).toEqual(['달콤 디저트 카페']);
    const fast = await request(app).get('/api/restaurants?mood=fast&limit=50');
    expect(fast.body.items.length).toBeGreaterThan(0);
    expect(fast.body.items.every((r) => r.prepTimeMinutes <= 20)).toBe(true);
  });

  test('passport is a simple on/off switch: ordering does not change it', async () => {
    await customer.patch('/api/auth/me').send({ passport: { enabled: false, diet: ['halal'], allergens: ['peanut'], maxSpice: 2 } });
    const items = await menuOf(hansik);
    const bulgogi = items.find((i) => i.name === '소불고기');
    const res = await customer.post('/api/orders').send({
      restaurantId: hansik.id, orderType: 'pickup', items: [{ menuItemId: bulgogi.id, quantity: 1 }], paymentMethodId: card.id,
    });
    expect(res.status).toBe(201);
    const me = await customer.get('/api/auth/me');
    expect(me.body.data.passport.enabled).toBe(false);
  });

  test('menu items carry hand-written translations; owner can override one language', async () => {
    const items = await menuOf(hansik);
    const kimchi = items.find((i) => i.name === '김치찌개');
    expect(kimchi.translations.ru.name).toBe('Кимчи-чигэ');
    expect(kimchi.translations.th.explanation).toBeTruthy();
    expect(kimchi.romanization).toBe('kimchi-jjigae');
    const upd = await owner.patch(`/api/menu-items/${kimchi.id}`).send({ translations: { en: { name: 'Kimchi jjigae (stew)', description: 'Our signature stew.' } } });
    expect(upd.status).toBe(200);
    expect(upd.body.data.translations.en).toMatchObject({ name: 'Kimchi jjigae (stew)', manual: true });
    expect(upd.body.data.translations.ru.name).toBe('Кимчи-чигэ');
  });

  test('new dish without a translation provider is saved with status "none"', async () => {
    const res = await owner.post('/api/menu-items').send({ restaurantId: hansik.id, name: '잡채밥', price: 9000, explanation: '' });
    expect(res.status).toBe(201);
    expect(res.body.data.translationStatus).toBe('none');
  });

  test('meta exposes languages, moods and passport diets', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.body.data.languages).toEqual(['en', 'ko', 'zh', 'vi', 'th', 'ru', 'ja']);
    expect(res.body.data.moods).toContain('fast');
    expect(res.body.data.passportDiets).toContain('halal');
  });

  test('only admin can reset demo data; sessions survive the reset', async () => {
    expect((await customer.post('/api/admin/demo/reset')).status).toBe(403);
    const res = await admin.post('/api/admin/demo/reset');
    expect(res.status).toBe(200);
    expect((await admin.get('/api/auth/me')).status).toBe(200);
    const list = await request(app).get('/api/restaurants?limit=50');
    expect(list.body.totalCount).toBe(8);
  });
});

// ---------------------------------------------------------------------------
describe('Dish check by admin after publication', () => {
  let dish;
  beforeAll(async () => {
    // Demo reset in an earlier test re-created restaurants with new ids.
    const { body } = await request(app).get('/api/restaurants?limit=50');
    hansik = body.items.find((r) => r.name === '서울 한식당');
  });

  test("owner's new dish is visible at once and appears in the admin's list", async () => {
    const res = await owner.post('/api/menu-items').send({ restaurantId: hansik.id, name: '해물파전', price: 15000, allergens: ['shrimp', 'squid', 'wheat'] });
    dish = res.body.data;
    expect(dish.reviewStatus).toBe('new');
    expect((await menuOf(hansik)).some((i) => i.id === dish.id)).toBe(true);
    const list = await admin.get('/api/admin/dishes?status=new');
    expect(list.body.items.some((i) => i.id === dish.id && i.restaurantName === '서울 한식당')).toBe(true);
    expect((await customer.get('/api/admin/dishes')).status).toBe(403);
    expect((await owner.get('/api/admin/dishes')).status).toBe(403);
  });

  test('admin asks for changes with a message; owner sees it with a deadline', async () => {
    expect((await admin.patch(`/api/admin/dishes/${dish.id}/review`).send({ action: 'request_changes' })).status).toBe(400); // message required
    const res = await admin.patch(`/api/admin/dishes/${dish.id}/review`).send({ action: 'request_changes', note: 'Please add egg to allergens' });
    expect(res.body.data).toMatchObject({ reviewStatus: 'needs_changes', adminNote: 'Please add egg to allergens' });
    const flagged = await owner.get('/api/manage/flagged-dishes');
    const mine = flagged.body.data.find((i) => i.id === dish.id);
    expect(mine.adminNote).toBe('Please add egg to allergens');
    expect(new Date(mine.fixDeadline).getTime()).toBeGreaterThan(Date.now());
    expect((await owner2.get('/api/manage/flagged-dishes')).body.data.some((i) => i.id === dish.id)).toBe(false);
  });

  test('a dish not fixed in time is hidden from customers; fixing it brings it back for a new check', async () => {
    const { hideUnfixedDishes } = require('../src/services/menuService');
    await hideUnfixedDishes({ now: new Date(Date.now() + 2 * 86400000) });
    expect((await menuOf(hansik)).some((i) => i.id === dish.id)).toBe(true); // still within the deadline
    await hideUnfixedDishes({ now: new Date(Date.now() + 4 * 86400000) });
    expect((await menuOf(hansik)).some((i) => i.id === dish.id)).toBe(false);
    expect((await owner.get('/api/manage/flagged-dishes')).body.data.find((i) => i.id === dish.id).reviewStatus).toBe('removed');

    const fixed = await owner.patch(`/api/menu-items/${dish.id}`).send({ allergens: ['shrimp', 'squid', 'wheat', 'egg'] });
    expect(fixed.body.data).toMatchObject({ reviewStatus: 'new', isAvailable: true });
    expect((await menuOf(hansik)).some((i) => i.id === dish.id)).toBe(true);
  });

  test('admin approves; toggling availability later does not send it back for review', async () => {
    const res = await admin.patch(`/api/admin/dishes/${dish.id}/review`).send({ action: 'approve' });
    expect(res.body.data).toMatchObject({ reviewStatus: 'ok', adminNote: null });
    const toggled = await owner.patch(`/api/menu-items/${dish.id}`).send({ isAvailable: false });
    expect(toggled.body.data.reviewStatus).toBe('ok');
    const edited = await owner.patch(`/api/menu-items/${dish.id}`).send({ price: 16000 });
    expect(edited.body.data.reviewStatus).toBe('new');
  });
});

// ---------------------------------------------------------------------------
describe('Opening hours and passport consent', () => {
  // HH:MM in Seoul, offset from now in minutes
  const seoulHM = (offsetMin) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(Date.now() + offsetMin * 60000));
  let shop; let dish; let myCard;
  beforeAll(async () => {
    // demo data may have been reset by an earlier test: look everything up again
    myCard = (await customer.get('/api/payment-methods')).body.data[0];
    shop = (await request(app).get('/api/restaurants?search=서울 한식당')).body.items[0];
    dish = (await menuOf(shop)).find((i) => i.isAvailable);
  });
  afterAll(async () => { await admin.patch(`/api/restaurants/${shop.id}`).send({ opensAt: null, closesAt: null }); });

  const pickup = () => ({ restaurantId: shop.id, orderType: 'pickup', items: [{ menuItemId: dish.id, quantity: 1 }], paymentMethodId: myCard.id });

  test('a closed restaurant shows as closed and does not accept orders', async () => {
    const upd = await owner.patch(`/api/restaurants/${shop.id}`).send({ opensAt: seoulHM(60), closesAt: seoulHM(120) });
    expect(upd.status).toBe(200);
    const detail = (await request(app).get(`/api/restaurants/${shop.id}`)).body.data;
    expect(detail.isOpen).toBe(false);
    expect(detail.opensAt.slice(0, 5)).toBe(seoulHM(60));
    const res = await customer.post('/api/orders').send(pickup());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESTAURANT_CLOSED');
  });

  test('hours past midnight count as open (e.g. opened an hour ago, closes "tomorrow")', async () => {
    await owner.patch(`/api/restaurants/${shop.id}`).send({ opensAt: seoulHM(-60), closesAt: seoulHM(-120) });
    expect((await request(app).get(`/api/restaurants/${shop.id}`)).body.data.isOpen).toBe(true);
    const ok = await customer.post('/api/orders').send(pickup());
    expect([ok.status, ok.body.code, ok.body.message]).toEqual([201, undefined, undefined]);
  });

  test('empty hours = open around the clock; invalid time is rejected', async () => {
    expect((await owner.patch(`/api/restaurants/${shop.id}`).send({ opensAt: '25:00' })).status).toBe(400);
    await owner.patch(`/api/restaurants/${shop.id}`).send({ opensAt: '', closesAt: '' });
    const detail = (await request(app).get(`/api/restaurants/${shop.id}`)).body.data;
    expect(detail).toMatchObject({ isOpen: true, opensAt: null, closesAt: null });
  });

  test('food passport is stored only with consent; deleting it withdraws consent', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      name: 'Consent Test', email: 'consent@test.com', password: 'Passw0rd!', phone: '010-3333-4444', addressLine1: '서울특별시 중구 세종대로 110',
    });
    const value = { enabled: true, diet: ['vegan'], allergens: ['peanut'], maxSpice: 1 };
    const no = await agent.patch('/api/auth/me').send({ passport: value });
    expect(no.status).toBe(400);
    expect(no.body.code).toBe('PASSPORT_CONSENT_REQUIRED');
    const yes = await agent.patch('/api/auth/me').send({ passport: value, passportConsent: true });
    expect(yes.status).toBe(200);
    expect(yes.body.data.passport.diet).toEqual(['vegan']);
    expect(yes.body.data.passportConsentAt).toBeTruthy();
    // later changes (e.g. switching it off) don't need to ask again
    expect((await agent.patch('/api/auth/me').send({ passport: { ...value, enabled: false } })).status).toBe(200);
    const del = await agent.patch('/api/auth/me').send({ passport: null });
    expect(del.status).toBe(200);
    expect(del.body.data).toMatchObject({ passport: null, passportConsentAt: null });
  });
});

// ---------------------------------------------------------------------------
describe('Review translations', () => {
  test('reviews come with their source language and translations into the other languages', async () => {
    const chicken2 = (await request(app).get('/api/restaurants?search=바삭 치킨')).body.items[0];
    const res = await request(app).get(`/api/restaurants/${chicken2.id}/reviews`);
    const ru = res.body.items.find((r) => r.sourceLanguage === 'ru');
    expect(ru).toBeTruthy();
    expect(ru.translationStatus).toBe('done');
    expect(Object.keys(ru.translations).sort()).toEqual(['en', 'ja', 'ko', 'th', 'vi', 'zh']);
    expect(ru.translations.ko.comment).toMatch(/치킨/);
  });

  test('a new review keeps the author language; translation is skipped when no provider is configured', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      name: 'Review Person', email: 'reviewer@test.com', password: 'Passw0rd!', phone: '010-5555-6666',
      addressLine1: '서울특별시 중구 세종대로 110', preferredLanguage: 'vi',
    });
    const shop = (await request(app).get('/api/restaurants?search=서울 한식당')).body.items[0];
    const dish = (await menuOf(shop)).find((i) => i.isAvailable);
    const cardRes = await agent.post('/api/payment-methods').send({ cardNumber: '4242424242424242', expMonth: 1, expYear: 2031, cvc: '123' });
    const order = await agent.post('/api/orders').send({ restaurantId: shop.id, orderType: 'pickup', items: [{ menuItemId: dish.id, quantity: 1 }], paymentMethodId: cardRes.body.data.id });
    expect(order.status).toBe(201);
    const ownerAgent = await login('owner@demo.com');
    await ownerAgent.patch(`/api/orders/${order.body.data.id}/status`).send({ status: 'preparing' });
    await ownerAgent.patch(`/api/orders/${order.body.data.id}/status`).send({ status: 'ready_for_pickup' });
    await ownerAgent.patch(`/api/orders/${order.body.data.id}/status`).send({ status: 'completed' }); // restaurant hands it over
    const rv = await agent.post('/api/reviews').send({ orderId: order.body.data.id, rating: 5, comment: 'Ngon lắm!' });
    expect(rv.status).toBe(201);
    expect(rv.body.data).toMatchObject({ sourceLanguage: 'vi', translationStatus: 'none', translations: {} });
  });
});

// ---------------------------------------------------------------------------
describe('Review photos', () => {
  let agent; let ownerAgent;
  beforeAll(async () => {
    agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      name: 'Photo Person', email: 'photos@test.com', password: 'Passw0rd!', phone: '010-7777-8888', addressLine1: '서울특별시 중구 세종대로 110',
    });
    ownerAgent = await login('owner@demo.com');
  });
  // a completed pickup order of this customer that can be reviewed
  const completedOrder = async () => {
    const shop = (await request(app).get('/api/restaurants?search=서울 한식당')).body.items[0];
    const dish = (await menuOf(shop)).find((i) => i.isAvailable);
    let cards = (await agent.get('/api/payment-methods')).body.data;
    if (!cards.length) cards = [(await agent.post('/api/payment-methods').send({ cardNumber: '4242424242424242', expMonth: 1, expYear: 2031, cvc: '123' })).body.data];
    const order = (await agent.post('/api/orders').send({ restaurantId: shop.id, orderType: 'pickup', items: [{ menuItemId: dish.id, quantity: 1 }], paymentMethodId: cards[0].id })).body.data;
    for (const s of ['preparing', 'ready_for_pickup', 'completed']) await ownerAgent.patch(`/api/orders/${order.id}/status`).send({ status: s });
    return order;
  };
  const png = (name) => [PNG_1x1, { filename: name, contentType: 'image/png' }];

  test('a review can have up to 3 photos; they are shown with the review', async () => {
    const order = await completedOrder();
    const res = await agent.post('/api/reviews').field('orderId', order.id).field('rating', '5').field('comment', 'Look at this!')
      .attach('photos', ...png('a.png')).attach('photos', ...png('b.png'));
    expect(res.status).toBe(201);
    expect(res.body.data.photoUrls).toHaveLength(2);
    expect((await request(app).get(res.body.data.photoUrls[0])).status).toBe(200);
    const list = await request(app).get(`/api/restaurants/${res.body.data.restaurantId}/reviews`);
    expect(list.body.items.find((r) => r.id === res.body.data.id).photoUrls).toHaveLength(2);
  });

  test('more than 3 photos or a fake image is rejected and nothing is saved', async () => {
    const order = await completedOrder();
    const before = (await pool.query('SELECT COUNT(*)::int AS c FROM images')).rows[0].c;
    let req = agent.post('/api/reviews').field('orderId', order.id).field('rating', '4');
    for (const n of ['1', '2', '3', '4']) req = req.attach('photos', ...png(`${n}.png`));
    const tooMany = await req;
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.code).toBe('TOO_MANY_PHOTOS');
    const fake = await agent.post('/api/reviews').field('orderId', order.id).field('rating', '4')
      .attach('photos', Buffer.from('definitely not a png'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.code).toBe('INVALID_FILE_TYPE');
    expect((await pool.query('SELECT COUNT(*)::int AS c FROM images')).rows[0].c).toBe(before);
    // the order can still be reviewed afterwards (nothing half-saved)
    expect((await agent.post('/api/reviews').send({ orderId: order.id, rating: 4 })).status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
describe('Serverless mode (Vercel): jobs on requests, database bootstrap', () => {
  const { runDueJobs, JOBS } = require('../src/jobs');
  const deliveredLongAgo = async () => {
    const { rows } = await pool.query(
      `UPDATE orders SET status = 'delivered', updated_at = NOW() - INTERVAL '20 minutes'
       WHERE id = (SELECT id FROM orders WHERE status = 'out_for_delivery' AND order_type = 'delivery' LIMIT 1) RETURNING id`,
    );
    return rows[0].id;
  };
  const statusOf = async (id) => (await pool.query('SELECT status FROM orders WHERE id = $1', [id])).rows[0].status;

  test('due jobs run on a request; the same job is not repeated within its interval', async () => {
    const t0 = Date.now() + 10 * 60 * 1000; // later than anything run before in this file
    const first = await deliveredLongAgo();
    await runDueJobs(t0);
    expect(await statusOf(first)).toBe('completed'); // delivered 20 min ago -> completed automatically

    await seed(); // fresh orders
    const second = await deliveredLongAgo();
    await runDueJobs(t0 + 1000); // 1 s later: orders job is not due yet
    expect(await statusOf(second)).toBe('delivered');
    await runDueJobs(t0 + JOBS.find((j) => j.name === 'orders').everyMs + 1000);
    expect(await statusOf(second)).toBe('completed');
  });

  test('a job is skipped while another instance holds its lock', async () => {
    const id = await deliveredLongAgo();
    const other = await pool.connect(); // pretend another server instance is running the orders job
    const lock = JOBS.find((j) => j.name === 'orders').lock;
    try {
      await other.query('SELECT pg_advisory_lock($1)', [lock]);
      await runDueJobs(Date.now() + 60 * 60 * 1000);
      expect(await statusOf(id)).toBe('delivered');
    } finally {
      await other.query('SELECT pg_advisory_unlock($1)', [lock]);
      other.release();
    }
    await runDueJobs(Date.now() + 2 * 60 * 60 * 1000);
    expect(await statusOf(id)).toBe('completed');
  });

  test('bootstrap stores the schema version and keeps existing data', async () => {
    const usersBefore = (await pool.query('SELECT COUNT(*)::int AS c FROM users')).rows[0].c;
    await pool.query("DELETE FROM app_meta WHERE key = 'schema_hash'").catch(() => {});
    await jest.isolateModulesAsync(async () => {
      await require('../src/bootstrap').ensureReady({ log: () => {} });
    });
    const meta = await pool.query("SELECT value FROM app_meta WHERE key = 'schema_hash'");
    expect(meta.rows[0].value).toMatch(/^[0-9a-f]{64}$/);
    expect((await pool.query('SELECT COUNT(*)::int AS c FROM users')).rows[0].c).toBe(usersBefore);
  });
});

describe('Bootstrap: interrupted demo data fill', () => {
  test('a fill that was cut off mid-way is redone on the next start', async () => {
    await pool.query("INSERT INTO app_meta (key, value) VALUES ('seed_state', 'started') ON CONFLICT (key) DO UPDATE SET value = 'started'");
    await pool.query("UPDATE restaurants SET name = 'half-filled' WHERE name = '나폴리 피자'"); // pretend the fill stopped half-way
    const before = process.env.SEED_ON_EMPTY;
    process.env.SEED_ON_EMPTY = 'true';
    try {
      await jest.isolateModulesAsync(async () => {
        await require('../src/bootstrap').ensureReady({ log: () => {} });
      });
    } finally {
      if (before === undefined) delete process.env.SEED_ON_EMPTY; else process.env.SEED_ON_EMPTY = before;
    }
    expect((await pool.query("SELECT value FROM app_meta WHERE key = 'seed_state'")).rows[0].value).toBe('done');
    expect((await pool.query("SELECT COUNT(*)::int AS c FROM restaurants WHERE name = '나폴리 피자'")).rows[0].c).toBe(1);
    // advisory locks are transaction-scoped: nothing is left held afterwards
    expect((await pool.query("SELECT COUNT(*)::int AS c FROM pg_locks WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database())")).rows[0].c).toBe(0);
  });
});
