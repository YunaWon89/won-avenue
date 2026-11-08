const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const db = require('../config/db');
const catalog = require('../config/catalog');
const ApiError = require('../utils/ApiError');
const validate = require('../middleware/validate');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const { upload, reviewPhotos } = require('../middleware/upload');
const { idParam } = require('../validators/common');
const s = require('../validators/schemas');
const translationService = require('../services/translationService');
const paymentService = require('../services/paymentService');
const auth = require('../controllers/authController');
const restaurants = require('../controllers/restaurantController');
const menu = require('../controllers/menuController');
const orders = require('../controllers/orderController');
const admin = require('../controllers/adminController');
const menuService = require('../services/menuService');

const router = express.Router();
const ADMIN = requireRole('admin');
const STAFF = requireRole('manager', 'admin');
const CUSTOMER = requireRole('customer');
const id = validate({ params: idParam });
const image = upload.single('image');

// Brute-force protection for credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res, next) => next(new ApiError(429, 'Too many attempts, please try again later', { code: 'RATE_LIMITED' })),
});

// ---------- health & meta ----------
router.get('/health', async (req, res) => {
  await db.query('SELECT 1');
  res.json({ success: true, status: 'ok' });
});

router.get('/meta', optionalAuth, (req, res) => res.json({
  success: true,
  data: {
    allergens: catalog.ALLERGENS,
    dietaryTags: catalog.DIETARY_TAGS,
    passportDiets: catalog.PASSPORT_DIETS,
    cuisines: catalog.CUISINES,
    moods: catalog.MOODS,
    moodTags: catalog.MOOD_TAGS,
    fastMinutes: catalog.FAST_MINUTES,
    languages: catalog.LANGUAGES,
    autoTranslate: translationService.isEnabled(),
    translationProvider: translationService.providerName(),
    demoMode: env.demoMode,
    dishFixDays: env.dishFixDays,
    currency: 'KRW',
    payment: paymentService.publicConfig(req.user),
  },
}));

// ---------- auth ----------
router.post('/auth/register', authLimiter, validate({ body: s.register }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: s.login }), auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', authenticate, auth.me);
// Same as /auth/me but returns { data: null } for guests (no 401 noise on app start).
router.get('/auth/session', optionalAuth, (req, res) => res.json({ success: true, data: req.user || null }));
router.patch('/auth/me', authenticate, validate({ body: s.updateProfile }), auth.updateMe);
router.post('/auth/me/password', authenticate, authLimiter, validate({ body: s.changePassword }), auth.changePassword);

// ---------- images ----------
router.get('/images/:id', id, async (req, res) => {
  const { rows } = await db.query('SELECT mime_type, data FROM images WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw ApiError.notFound('Image not found');
  res.set('Content-Type', rows[0].mime_type);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(rows[0].data);
});

// ---------- restaurants ----------
router.get('/restaurants', optionalAuth, validate({ query: s.restaurantListQuery }), restaurants.list);
router.get('/restaurants/cuisines', restaurants.cuisines);
router.get('/restaurants/:id', optionalAuth, id, restaurants.get);
router.post('/restaurants', authenticate, STAFF, image, validate({ body: s.createRestaurant }), restaurants.create);
router.patch('/restaurants/:id', authenticate, STAFF, image, validate({ params: idParam, body: s.updateRestaurant }), restaurants.update);
router.delete('/restaurants/:id', authenticate, ADMIN, id, restaurants.remove);
router.get('/restaurants/:id/menu-items', optionalAuth, validate({ params: idParam, query: s.menuItemListQuery }), restaurants.menuItems);
router.get('/restaurants/:id/reviews', optionalAuth, validate({ params: idParam, query: s.reviewListQuery }), restaurants.reviews);

// ---------- menu ----------
router.post('/categories', authenticate, STAFF, validate({ body: s.createCategory }), menu.createCategory);
router.patch('/categories/:id', authenticate, STAFF, validate({ params: idParam, body: s.updateCategory }), menu.updateCategory);
router.delete('/categories/:id', authenticate, STAFF, id, menu.deleteCategory);

router.get('/menu-items/:id', id, menu.getItem);
router.post('/menu-items', authenticate, STAFF, image, validate({ body: s.createMenuItem }), menu.createItem);
router.patch('/menu-items/:id', authenticate, STAFF, image, validate({ params: idParam, body: s.updateMenuItem }), menu.updateItem);
router.delete('/menu-items/:id', authenticate, STAFF, id, menu.deleteItem);

// ---------- orders ----------
router.post('/orders', authenticate, CUSTOMER, validate({ body: s.createOrder }), orders.create);
// Cart with several restaurants: one order per restaurant, paid in one checkout.
router.post('/orders/batch', authenticate, CUSTOMER, validate({ body: s.createOrders }), orders.createMany);
router.get('/orders', authenticate, validate({ query: s.orderListQuery }), orders.list);
router.get('/orders/:id', authenticate, id, orders.get);
router.post('/orders/:id/claim', authenticate, requireRole('courier'), id, orders.claim);
router.patch('/orders/:id/status', authenticate, validate({ params: idParam, body: s.updateOrderStatus }), orders.updateStatus);

// ---------- reviews ----------
router.post('/reviews', authenticate, CUSTOMER, reviewPhotos, validate({ body: s.createReview }), orders.createReview); // JSON or multipart with up to 3 photos
router.get('/reviews', authenticate, ADMIN, validate({ query: s.reviewListQuery }), orders.listReviews);
router.patch('/reviews/:id', authenticate, ADMIN, validate({ params: idParam, body: s.moderateReview }), orders.moderateReview);

// ---------- saved cards ----------
router.get('/payment-methods/config', authenticate, orders.paymentConfig);
router.get('/payment-methods', authenticate, CUSTOMER, orders.listCards);
router.post('/payment-methods', authenticate, CUSTOMER, authLimiter, validate({ body: s.addPaymentMethod }), orders.addCard);
router.patch('/payment-methods/:id/default', authenticate, CUSTOMER, id, orders.setDefaultCard);
router.delete('/payment-methods/:id', authenticate, CUSTOMER, id, orders.removeCard);

// ---------- admin ----------
router.get('/admin/stats', authenticate, ADMIN, admin.stats);
// Dish check after publication
router.get('/admin/dishes', authenticate, ADMIN, validate({ query: s.adminDishQuery }), async (req, res) => {
  res.json({ success: true, ...(await menuService.listForReview(req.validQuery)) });
});
router.patch('/admin/dishes/:id/review', authenticate, ADMIN, validate({ params: idParam, body: s.reviewDish }), async (req, res) => {
  res.json({ success: true, data: await menuService.reviewDish(req.params.id, req.body) });
});
router.get('/manage/flagged-dishes', authenticate, STAFF, async (req, res) => {
  res.json({ success: true, data: await menuService.listFlaggedForOwner(req.user) });
});
// Demo mode only: restore the original demo data (before showing the app to someone).
router.post('/admin/demo/reset', authenticate, ADMIN, async (req, res) => {
  if (!env.demoMode) throw ApiError.forbidden('Demo reset is disabled', { code: 'DEMO_DISABLED' });
  await require('../db/seed').seed();
  res.json({ success: true, message: 'Demo data restored' });
});
router.get('/admin/users', authenticate, ADMIN, validate({ query: s.userListQuery }), admin.listUsers);
router.post('/admin/users', authenticate, ADMIN, validate({ body: s.adminCreateUser }), admin.createUser);
router.get('/admin/users/:id', authenticate, ADMIN, id, admin.getUser);
router.patch('/admin/users/:id', authenticate, ADMIN, validate({ params: idParam, body: s.adminUpdateUser }), admin.updateUser);

module.exports = router;
