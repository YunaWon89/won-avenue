/**
 * Fixed vocabularies shared with the frontend (labels are translated on the client).
 * Allergens follow the Korean MFDS mandatory allergen labelling list (+ sesame, fish, tree nuts).
 */
const ALLERGENS = [
  'egg', 'milk', 'buckwheat', 'peanut', 'soy', 'wheat', 'mackerel', 'crab', 'shrimp', 'pork',
  'peach', 'tomato', 'sulfites', 'walnut', 'chicken', 'beef', 'squid', 'shellfish', 'pine_nut',
  'fish', 'sesame', 'tree_nuts',
];

const DIETARY_TAGS = ['halal', 'vegetarian', 'vegan', 'gluten_free', 'no_pork', 'no_alcohol'];

/** Diets a customer can put in their food passport. */
const PASSPORT_DIETS = ['halal', 'vegetarian', 'vegan', 'no_pork', 'gluten_free'];

const CUISINES = ['korean', 'chicken', 'pizza', 'chinese', 'japanese', 'western', 'snack', 'cafe_dessert', 'asian', 'halal', 'vegan', 'fast_food'];

/** Restaurant-level mood tags used by the "What's your mood?" tiles. "fast" is computed from prep time. */
const MOOD_TAGS = ['spicy', 'light', 'comfort', 'sweet', 'late_night'];
const MOODS = [...MOOD_TAGS, 'fast'];
const FAST_MINUTES = 20;

/**
 * Supported languages, chosen by the largest foreign communities and visitor groups in Korea.
 * en is the default for new visitors; ko for Korean restaurant owners.
 */
const LANGUAGES = ['en', 'ko', 'zh', 'vi', 'th', 'ru', 'ja'];

module.exports = { ALLERGENS, DIETARY_TAGS, PASSPORT_DIETS, CUISINES, MOOD_TAGS, MOODS, FAST_MINUTES, LANGUAGES };
