/**
 * Food passport rules — "does this dish suit this person?"
 * The same rules are implemented on the client (client/src/utils/passport.js) for instant UI.
 *
 *  - allergens: the dish must not contain any of them
 *  - diet:
 *      halal / vegetarian / vegan -> the dish must carry that label
 *      no_pork     -> labelled no_pork or halal, or pork is not among its allergens
 *      gluten_free -> labelled gluten_free, or wheat is not among its allergens
 *  - maxSpice: dish spice level must not exceed it
 */
const { ALLERGENS, PASSPORT_DIETS } = require('../config/catalog');

const lit = (values, allowed) => `ARRAY[${values.filter((v) => allowed.includes(v)).map((v) => `'${v}'`).join(',')}]::text[]`;

/**
 * SQL boolean expression for "menu item <alias> suits this passport".
 * Values are inlined as literals, which is safe because every value is checked against a fixed whitelist.
 */
function safeItemSql(alias, { diet = [], allergens = [], maxSpice } = {}) {
  const parts = [`${alias}.is_available`];
  if (allergens.length) parts.push(`NOT (${alias}.allergens && ${lit(allergens, ALLERGENS)})`);
  diet.filter((d) => PASSPORT_DIETS.includes(d)).forEach((d) => {
    if (d === 'no_pork') parts.push(`('no_pork' = ANY(${alias}.dietary_tags) OR 'halal' = ANY(${alias}.dietary_tags) OR NOT ('pork' = ANY(${alias}.allergens)))`);
    else if (d === 'gluten_free') parts.push(`('gluten_free' = ANY(${alias}.dietary_tags) OR NOT ('wheat' = ANY(${alias}.allergens)))`);
    else parts.push(`'${d}' = ANY(${alias}.dietary_tags)`);
  });
  if (Number.isInteger(maxSpice) && maxSpice >= 0 && maxSpice <= 3) parts.push(`${alias}.spice_level <= ${maxSpice}`);
  return parts.join(' AND ');
}

/** SQL: menu item <alias> is a main dish (not in a sides / drinks category). */
const mainDishSql = (alias) => `NOT EXISTS (SELECT 1 FROM menu_categories mc WHERE mc.id = ${alias}.category_id AND mc.is_side)`;

const hasPassport = (p) => Boolean(p && ((p.diet && p.diet.length) || (p.allergens && p.allergens.length) || Number.isInteger(p.maxSpice)));

module.exports = { safeItemSql, mainDishSql, hasPassport };
