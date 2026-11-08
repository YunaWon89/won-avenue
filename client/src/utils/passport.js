/**
 * Food passport rules (same as server/src/services/passport.js).
 *
 *  - allergens: the dish must not contain any of them
 *  - diet: halal / vegetarian / vegan -> must carry that label
 *          no_pork     -> labelled no_pork or halal, or pork is not among its allergens
 *          gluten_free -> labelled gluten_free, or wheat is not among its allergens
 *  - spice: above the person's max is a soft warning (not a block)
 */
export const EMPTY_PASSPORT = { enabled: true, diet: [], allergens: [], maxSpice: 3 };

export const isConfigured = (p) => Boolean(p && ((p.diet?.length || 0) + (p.allergens?.length || 0) > 0 || (p.maxSpice ?? 3) < 3));

export const isActive = (p) => Boolean(p?.enabled && isConfigured(p));

function dietOk(item, diet) {
  const tags = item.dietaryTags || [];
  const allergens = item.allergens || [];
  if (diet === 'no_pork') return tags.includes('no_pork') || tags.includes('halal') || !allergens.includes('pork');
  if (diet === 'gluten_free') return tags.includes('gluten_free') || !allergens.includes('wheat');
  return tags.includes(diet);
}

/**
 * @returns {{ safe: boolean, blockedAllergens: string[], missingDiets: string[], tooSpicy: boolean }}
 */
export function evaluate(item, passport) {
  if (!isConfigured(passport)) return { safe: true, blockedAllergens: [], missingDiets: [], tooSpicy: false };
  const blockedAllergens = (item.allergens || []).filter((a) => passport.allergens.includes(a));
  const missingDiets = passport.diet.filter((d) => !dietOk(item, d));
  const tooSpicy = (item.spiceLevel || 0) > (passport.maxSpice ?? 3);
  return { safe: !blockedAllergens.length && !missingDiets.length, blockedAllergens, missingDiets, tooSpicy };
}

/** Query params for the restaurants API so each card gets a "dishes safe for you" count. */
export function passportQuery(p) {
  if (!isActive(p)) return {};
  return { pDiet: p.diet, pAllergens: p.allergens, pMaxSpice: p.maxSpice ?? 3 };
}
