const { z } = require('zod');
const { ALLERGENS, DIETARY_TAGS, LANGUAGES, PASSPORT_DIETS, MOOD_TAGS, MOODS } = require('../config/catalog');

/** Accepts real booleans (JSON) and "true"/"false" strings (query / multipart). */
const boolish = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);

/** Empty strings from forms become undefined. */
const emptyToUndef = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema);

/** Empty string or "null" becomes null (used to clear nullable relations). */
const nullable = (schema) => z.preprocess((v) => (v === '' || v === 'null' ? null : v), schema.nullable());

/**
 * List of enum values. Accepts an array (JSON), a JSON string or a comma-separated string
 * (query params / multipart form fields).
 */
const enumList = (values) => z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return v === '' ? [] : undefined;
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    if (v.trim().startsWith('[')) { try { return JSON.parse(v); } catch { return v; } }
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return v;
}, z.array(z.enum(values)).max(values.length).transform((a) => [...new Set(a)]));

const uuid = z.uuid({ message: 'Must be a valid UUID' });
const idParam = z.object({ id: uuid });

const pagination = {
  page: z.coerce.number().int().min(1, 'page must be 1 or greater').default(1),
  limit: z.coerce.number().int().min(1).max(50, 'limit must be between 1 and 50').default(12),
};

/** KRW amounts are whole numbers. */
const won = (msg = 'Amount must be a whole number of won') => z.coerce.number({ message: msg }).int(msg);

const phone = z.string().trim().regex(/^\+?[0-9\s\-()]{9,20}$/, 'Phone format is invalid');

const ROLES = ['customer', 'manager', 'admin', 'courier'];
const ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];

module.exports = {
  z, boolish, emptyToUndef, nullable, enumList, uuid, idParam, pagination, won, phone,
  LANGUAGES, ROLES, ORDER_STATUSES, ALLERGENS, DIETARY_TAGS, PASSPORT_DIETS, MOOD_TAGS, MOODS,
};
