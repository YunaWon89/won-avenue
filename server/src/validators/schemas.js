/**
 * Request DTOs (Zod schemas). Every body / query / param is validated on the server.
 */
const {
  z, boolish, emptyToUndef, nullable, enumList, uuid, pagination, won, phone,
  LANGUAGES, ROLES, ORDER_STATUSES, ALLERGENS, DIETARY_TAGS, PASSPORT_DIETS, MOOD_TAGS, MOODS,
} = require('./common');

/** JSON object sent as a string in multipart forms. */
const jsonObject = (schema) => z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  if (!v.trim()) return undefined;
  try { return JSON.parse(v); } catch { return v; }
}, schema);

/** Food passport (stored per user). */
const passport = z.object({
  enabled: z.boolean(),
  diet: z.array(z.enum(PASSPORT_DIETS)).max(PASSPORT_DIETS.length).default([]),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length).default([]),
  maxSpice: z.number().int().min(0).max(3).default(3),
});

/** Owner edits of machine translations: { en: { name, description, explanation } | null } */
const translationEdits = jsonObject(z.partialRecord(z.enum(LANGUAGES), z.object({
  name: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  explanation: z.string().trim().max(1000).optional(),
}).nullable()).optional());

const opt = (schema) => emptyToUndef(schema.optional());

// ---------- Auth / users ----------
const name = z.string().trim().min(2, 'Name must be 2-50 characters').max(50, 'Name must be 2-50 characters');
const email = z.string().trim().toLowerCase().pipe(z.email('Email must be valid'));
const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const address = {
  postalCode: opt(z.string().trim().regex(/^\d{5}$/, 'Postal code must be 5 digits')),
  addressLine1: opt(z.string().trim().min(5, 'Address must be 5-255 characters').max(255)),
  addressLine2: opt(z.string().trim().max(255)),
};

const register = z.object({
  name,
  email,
  password,
  phone,
  accountType: z.enum(['customer', 'manager', 'courier']).default('customer'),
  preferredLanguage: z.enum(LANGUAGES).optional(),
  ...address,
}).superRefine((v, ctx) => {
  if (v.accountType === 'customer' && !v.addressLine1) {
    ctx.addIssue({ code: 'custom', path: ['addressLine1'], message: 'Address is required' });
  }
});

const login = z.object({ email, password: z.string().min(1, 'Password is required') });

const updateProfile = z.object({
  name: name.optional(),
  phone: phone.optional(),
  preferredLanguage: z.enum(LANGUAGES).optional(),
  passport: passport.nullable().optional(),
  // Diet / allergy info is health-related: storing it on the account needs explicit consent.
  passportConsent: z.boolean().optional(),
  ...address,
});

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});

const adminCreateUser = z.object({
  name, email, password, role: z.enum(ROLES), phone: phone.optional(), isActive: z.boolean().optional(),
});

const adminUpdateUser = z.object({
  name: name.optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'At least one field is required');

const userListQuery = z.object({
  ...pagination,
  search: opt(z.string().trim().max(100)),
  role: opt(z.enum(ROLES)),
  isActive: opt(boolish),
  sort: emptyToUndef(z.enum(['newest', 'oldest', 'name', 'email']).default('newest')),
});

// ---------- Restaurants ----------
const restaurantBase = {
  name: z.string().trim().min(2, 'Name must be 2-100 characters').max(100, 'Name must be 2-100 characters'),
  description: opt(z.string().trim().max(2000)),
  cuisineType: z.string().trim().min(1, 'Cuisine type is required').max(50),
  address: opt(z.string().trim().max(255)),
  phone: opt(phone),
  isActive: boolish.optional(),
  managerId: nullable(uuid).optional(),
  supportsDelivery: boolish.optional(),
  supportsPickup: boolish.optional(),
  deliveryFee: opt(won().min(0).max(100000)),
  minOrderAmount: opt(won().min(0).max(1000000)),
  prepTimeMinutes: opt(z.coerce.number().int().min(5).max(240)),
  sourceLanguage: opt(z.enum(LANGUAGES)),
  moodTags: enumList(MOOD_TAGS).optional(),
  // HH:MM in Seoul time; empty / null = open around the clock
  opensAt: nullable(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')).optional(),
  closesAt: nullable(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')).optional(),
};

const createRestaurant = z.object(restaurantBase).refine(
  (v) => v.supportsDelivery !== false || v.supportsPickup !== false,
  { path: ['supportsPickup'], message: 'Enable delivery, pickup or both' },
);
const updateRestaurant = z.object({
  ...restaurantBase,
  name: restaurantBase.name.optional(),
  cuisineType: restaurantBase.cuisineType.optional(),
});

const restaurantListQuery = z.object({
  ...pagination,
  search: opt(z.string().trim().max(100)),
  cuisine: opt(z.string().trim().max(50)),
  minRating: opt(z.coerce.number().min(0).max(5)),
  orderType: opt(z.enum(['delivery', 'pickup'])),
  diet: opt(enumList(DIETARY_TAGS)), // restaurants that have at least one item matching all tags
  mood: opt(z.enum(MOODS)),
  // Food passport of the viewer -> each restaurant gets safeCount (dishes that suit them)
  pDiet: opt(enumList(PASSPORT_DIETS)),
  pAllergens: opt(enumList(ALLERGENS)),
  pMaxSpice: opt(z.coerce.number().int().min(0).max(3)),
  safeOnly: opt(boolish),
  isActive: opt(boolish), // admin only
  managed: opt(boolish), // manager: only my restaurants
  sort: emptyToUndef(z.enum(['rating', 'newest', 'name', 'delivery_fee', 'fast', 'safe']).default('rating')),
});

// ---------- Menu ----------
const createCategory = z.object({
  restaurantId: uuid,
  name: z.string().trim().min(1, 'Name is required').max(100),
  sortOrder: opt(z.coerce.number().int().min(0).max(10000)),
  sourceLanguage: opt(z.enum(LANGUAGES)),
  isSide: boolish.optional(),
});
const updateCategory = z.object({
  name: opt(z.string().trim().min(1, 'Name is required').max(100)),
  sortOrder: opt(z.coerce.number().int().min(0).max(10000)),
  sourceLanguage: opt(z.enum(LANGUAGES)),
  isSide: boolish.optional(),
});

const menuItemBase = {
  restaurantId: uuid,
  categoryId: nullable(uuid).optional(),
  name: z.string().trim().min(2, 'Name must be 2-100 characters').max(100, 'Name must be 2-100 characters'),
  description: opt(z.string().trim().max(1000, 'Description must be at most 1000 characters')),
  price: won('Price must be a whole number of won').positive('Price must be greater than 0').max(10000000),
  isAvailable: boolish.optional(),
  allergens: enumList(ALLERGENS).optional(),
  dietaryTags: enumList(DIETARY_TAGS).optional(),
  spiceLevel: opt(z.coerce.number().int().min(0).max(3)),
  sourceLanguage: opt(z.enum(LANGUAGES)),
  romanization: opt(z.string().trim().max(150)),
  explanation: opt(z.string().trim().max(1000, 'Explanation must be at most 1000 characters')),
  translations: translationEdits,
};
const createMenuItem = z.object(menuItemBase);
const updateMenuItem = z.object({
  categoryId: menuItemBase.categoryId,
  name: menuItemBase.name.optional(),
  description: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(1000).nullable().optional()),
  price: menuItemBase.price.optional(),
  isAvailable: menuItemBase.isAvailable,
  allergens: menuItemBase.allergens,
  dietaryTags: menuItemBase.dietaryTags,
  spiceLevel: menuItemBase.spiceLevel,
  sourceLanguage: menuItemBase.sourceLanguage,
  romanization: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(150).nullable().optional()),
  explanation: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(1000).nullable().optional()),
  translations: translationEdits,
  retranslate: boolish.optional(),
});

const menuItemListQuery = z.object({
  ...pagination,
  limit: z.coerce.number().int().min(1).max(50).default(50),
  search: opt(z.string().trim().max(100)),
  categoryId: opt(uuid),
  available: opt(boolish),
  minPrice: opt(z.coerce.number().min(0)),
  maxPrice: opt(z.coerce.number().min(0)),
  excludeAllergens: opt(enumList(ALLERGENS)), // hide items containing any of these
  diet: opt(enumList(DIETARY_TAGS)), // item must have all of these tags
  maxSpice: opt(z.coerce.number().int().min(0).max(3)),
  sort: emptyToUndef(z.enum(['price_asc', 'price_desc', 'newest', 'name']).default('name')),
});

// ---------- Payments ----------
const addPaymentMethod = z.object({
  // mock provider (demo)
  cardNumber: opt(z.string().trim().regex(/^[0-9\s-]{13,23}$/, 'Card number is invalid')),
  expMonth: opt(z.coerce.number().int().min(1, 'Invalid month').max(12, 'Invalid month')),
  expYear: opt(z.coerce.number().int().min(0).max(2100)),
  cvc: opt(z.string().regex(/^\d{3,4}$/, 'CVC must be 3-4 digits')), // validated, never stored
  isForeign: boolish.optional(),
  // toss provider
  authKey: opt(z.string().max(300)),
  customerKey: opt(z.string().max(300)),
  makeDefault: boolish.optional(),
}).refine((v) => v.authKey || (v.cardNumber && v.expMonth && v.expYear !== undefined && v.cvc), {
  message: 'Card details are required',
  path: ['cardNumber'],
});

// ---------- Orders ----------
const createOrder = z.object({
  restaurantId: uuid,
  orderType: z.enum(['delivery', 'pickup']).default('delivery'),
  items: z.array(z.object({
    menuItemId: uuid,
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(99),
  })).min(1, 'Order must contain at least one item').max(50),
  deliveryAddress: opt(z.string().trim().min(5, 'Delivery address must be 5-255 characters').max(255, 'Delivery address must be 5-255 characters')),
  contactPhone: opt(phone),
  customerNote: opt(z.string().trim().max(500)),
  paymentMethodId: uuid,
}).superRefine((v, ctx) => {
  if (v.orderType === 'delivery' && !v.deliveryAddress) {
    ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Delivery address is required' });
  }
});

// One checkout for several restaurants: shared delivery details + one part per restaurant.
const lineItems = z.array(z.object({
  menuItemId: uuid,
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(99),
})).min(1, 'Order must contain at least one item').max(50);
const createOrders = z.object({
  orderType: z.enum(['delivery', 'pickup']).default('delivery'),
  orders: z.array(z.object({ restaurantId: uuid, items: lineItems }))
    .min(1, 'Order must contain at least one item').max(5, 'At most 5 restaurants per order')
    .refine((parts) => new Set(parts.map((p) => p.restaurantId)).size === parts.length, 'Each restaurant can appear only once'),
  deliveryAddress: opt(z.string().trim().min(5, 'Delivery address must be 5-255 characters').max(255, 'Delivery address must be 5-255 characters')),
  contactPhone: opt(phone),
  customerNote: opt(z.string().trim().max(500)),
  paymentMethodId: uuid,
}).superRefine((v, ctx) => {
  if (v.orderType === 'delivery' && !v.deliveryAddress) {
    ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Delivery address is required' });
  }
});

const updateOrderStatus = z.object({ status: z.enum(ORDER_STATUSES, { message: 'Invalid status' }) });

const isoDate = z.coerce.date({ message: 'Invalid date' });
const orderListQuery = z.object({
  ...pagination,
  scope: opt(z.enum(['available', 'mine'])), // couriers: deliveries waiting for a courier / my deliveries
  status: opt(z.enum(ORDER_STATUSES)),
  active: opt(boolish), // only orders that are not completed/cancelled
  orderType: opt(z.enum(['delivery', 'pickup'])),
  from: opt(isoDate),
  to: opt(isoDate),
  customerId: opt(uuid),
  restaurantId: opt(uuid),
  sort: emptyToUndef(z.enum(['newest', 'oldest', 'status']).default('newest')),
});

// ---------- Dish check by admin (after publication) ----------
const adminDishQuery = z.object({
  ...pagination,
  status: emptyToUndef(z.enum(['new', 'needs_changes', 'removed', 'ok', 'all']).default('new')),
  search: opt(z.string().trim().max(100)),
});
const reviewDish = z.object({
  action: z.enum(['approve', 'request_changes']),
  note: opt(z.string().trim().min(5, 'Write what needs to be fixed (5+ characters)').max(1000)),
}).superRefine((v, ctx) => {
  if (v.action === 'request_changes' && !v.note) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Write what needs to be fixed' });
});

// ---------- Reviews ----------
const createReview = z.object({
  orderId: uuid,
  rating: z.coerce.number().int('Rating must be an integer').min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
  comment: opt(z.string().trim().max(1000, 'Comment must be at most 1000 characters')),
});
const moderateReview = z.object({ isApproved: z.boolean() });
const reviewListQuery = z.object({
  ...pagination,
  isApproved: opt(boolish),
  restaurantId: opt(uuid),
});

module.exports = { createOrders,
  register, login, updateProfile, changePassword, adminCreateUser, adminUpdateUser, userListQuery,
  createRestaurant, updateRestaurant, restaurantListQuery,
  createCategory, updateCategory, createMenuItem, updateMenuItem, menuItemListQuery,
  addPaymentMethod, createOrder, updateOrderStatus, orderListQuery,
  createReview, moderateReview, reviewListQuery, adminDishQuery, reviewDish,
};
