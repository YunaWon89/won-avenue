/* eslint-disable no-await-in-loop */
/**
 * Demo data. Run: npm run db:reset  (drops + recreates schema, then seeds).
 * Also used by the admin "Reset demo data" button (DEMO_MODE=true).
 *
 * Demo accounts (password for all: Demo1234!):
 *   customer@demo.com  — Aisha (food passport: halal, no peanut / shrimp), saved cards, order history
 *   owner@demo.com     — restaurant owner (Korean UI): 서울 한식당, 바삭 치킨, 명동 분식
 *   owner2@demo.com    — restaurant owner: 이스탄불 할랄 키친, 그린보울, 달콤 디저트 카페
 *   admin@demo.com     — admin
 *   courier@demo.com   — courier: takes deliveries and marks them delivered
 *   minh@demo.com, olga@demo.com — other customers (reviews in Vietnamese / Russian)
 *
 * All menus are translated by hand into en, zh, vi, th, ru, ja (see demoData.js).
 */
const { pool } = require('../config/db');
const { migrate } = require('./migrate');
const { hashPassword } = require('../services/userService');
const { recalculateRating } = require('../services/reviewService');
const { restaurants, LANGS } = require('./demoData');

const PASSWORD = 'Demo1234!';

// Fixed ids keep demo sessions valid after "Reset demo data".
const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const PEOPLE = [
  { key: 'admin', id: ID(1), name: '관리자', email: 'admin@demo.com', role: 'admin', lang: 'ko' },
  { key: 'owner', id: ID(2), name: '김사장', email: 'owner@demo.com', role: 'manager', lang: 'ko' },
  { key: 'owner2', id: ID(3), name: 'Mehmet Yılmaz', email: 'owner2@demo.com', role: 'manager', lang: 'en' },
  {
    key: 'customer', id: ID(4), name: 'Aisha Rahman', email: 'customer@demo.com', role: 'customer', lang: 'en',
    address: ['03722', '서울특별시 서대문구 연세로 50 (신촌동)', 'International House A-512'],
    passport: { enabled: true, diet: ['halal'], allergens: ['peanut', 'shrimp'], maxSpice: 2 },
  },
  { key: 'minh', id: ID(5), name: 'Nguyễn Minh', email: 'minh@demo.com', role: 'customer', lang: 'vi', address: ['04066', '서울특별시 마포구 양화로 45', '302호'] },
  { key: 'olga', id: ID(6), name: 'Olga Petrova', email: 'olga@demo.com', role: 'customer', lang: 'ru', address: ['04347', '서울특별시 용산구 이태원로 200', '1503호'] },
  { key: 'courier', id: ID(7), name: '박민수', email: 'courier@demo.com', role: 'courier', lang: 'ko' },
];

/** { ko: x, en: y, ... } -> translations JSON without the source language. */
function translationsOf(fields, source = 'ko') {
  const out = {};
  LANGS.filter((l) => l !== source).forEach((lang) => {
    const entry = {};
    Object.entries(fields).forEach(([field, byLang]) => { if (byLang[lang]) entry[field] = byLang[lang]; });
    if (Object.keys(entry).length) out[lang] = entry;
  });
  return out;
}

/** Demo reviews translated by hand (new reviews are translated automatically). text -> [sourceLanguage, { lang: comment }] */
const REVIEW_TRANSLATIONS = {
  "Everything was clearly marked, so I could finally order Korean food without worrying. The tofu bowl was perfect!": [
    "en",
    {
      "ko": "모든 메뉴에 표시가 잘 되어 있어서 드디어 걱정 없이 한식을 주문할 수 있었어요. 두부 덮밥이 완벽했어요!",
      "zh": "所有信息都标得很清楚，我终于可以放心点韩餐了。豆腐盖饭太完美了！",
      "vi": "Mọi thứ đều được ghi rõ ràng nên cuối cùng tôi đã có thể gọi đồ ăn Hàn mà không phải lo lắng. Cơm đậu phụ thật hoàn hảo!",
      "th": "ทุกอย่างมีข้อมูลบอกไว้ชัดเจน ในที่สุดก็สั่งอาหารเกาหลีได้โดยไม่ต้องกังวล ข้าวหน้าเต้าหู้ดีมาก!",
      "ru": "Всё было понятно отмечено, так что я наконец смогла заказать корейскую еду без переживаний. Рис с тофу — идеальный!",
      "ja": "すべてがはっきり表示されていたので、やっと安心して韓国料理を注文できました。豆腐丼は完璧でした！"
    }
  ],
  "Real halal food, generous portions and very kind staff 🙏": [
    "en",
    {
      "ko": "진짜 할랄 음식에 양도 넉넉하고 직원분들도 정말 친절해요 🙏",
      "zh": "真正的清真食物，分量很足，店员也非常友善 🙏",
      "vi": "Đồ ăn halal chuẩn, phần ăn nhiều và nhân viên rất thân thiện 🙏",
      "th": "อาหารฮาลาลแท้ ให้เยอะ และพนักงานใจดีมาก 🙏",
      "ru": "Настоящая халяльная еда, большие порции и очень приветливый персонал 🙏",
      "ja": "本物のハラール料理で量もたっぷり、スタッフもとても親切です 🙏"
    }
  ],
  "Fresh and light. Would love a slightly bigger portion.": [
    "en",
    {
      "ko": "신선하고 가벼워요. 양이 조금만 더 많았으면 좋겠어요.",
      "zh": "新鲜又清爽。希望分量能再多一点。",
      "vi": "Tươi và nhẹ nhàng. Mong phần ăn nhiều hơn một chút.",
      "th": "สดและเบาสบาย อยากให้ปริมาณเยอะกว่านี้อีกนิด",
      "ru": "Свежо и легко. Хотелось бы порцию чуть побольше.",
      "ja": "新鮮で軽やか。もう少し量が多いとうれしいです。"
    }
  ],
  "Bingsu dâu siêu ngon, đá mịn như tuyết! Sẽ quay lại.": [
    "vi",
    {
      "en": "The strawberry bingsu is super tasty, the ice is as fine as snow! I'll be back.",
      "ko": "딸기 빙수 정말 맛있어요, 얼음이 눈처럼 부드러워요! 또 올게요.",
      "zh": "草莓雪冰超好吃，冰细得像雪一样！还会再来。",
      "th": "บิงซูสตรอว์เบอร์รีอร่อยสุด ๆ น้ำแข็งละเอียดเหมือนหิมะ! จะกลับมาอีก",
      "ru": "Клубничный пинсу — суперский, лёд нежный, как снег! Вернусь ещё.",
      "ja": "いちごのかき氷、最高においしい！氷が雪みたいにふわふわ。また来ます。"
    }
  ],
  "Tteokbokki rất cay nhưng rất ngon. Gimbap tươi.": [
    "vi",
    {
      "en": "The tteokbokki is very spicy but very tasty. The gimbap is fresh.",
      "ko": "떡볶이가 아주 맵지만 정말 맛있어요. 김밥도 신선해요.",
      "zh": "炒年糕很辣但非常好吃。紫菜包饭很新鲜。",
      "th": "ต๊อกบกกีเผ็ดมากแต่อร่อยมาก คิมบับสดใหม่",
      "ru": "Токпокки очень острые, но очень вкусные. Кимпаб свежий.",
      "ja": "トッポッキはすごく辛いけど、とてもおいしい。キンパも新鮮です。"
    }
  ],
  "Очень хрустящая курица, соево-чесночный соус — просто огонь!": [
    "ru",
    {
      "en": "Super crispy chicken, and the soy-garlic sauce is just fire!",
      "ko": "치킨이 정말 바삭하고, 간장 마늘 소스는 그냥 최고예요!",
      "zh": "鸡肉超级酥脆，酱油蒜香酱简直绝了！",
      "vi": "Gà rất giòn, sốt tỏi xì dầu đúng là đỉnh!",
      "th": "ไก่กรอบมาก ซอสกระเทียมซีอิ๊วคือสุดยอด!",
      "ja": "チキンがすごくサクサクで、醤油ガーリックソースは最高です！"
    }
  ],
  "Отличный стритфуд, всё горячее и быстро привезли.": [
    "ru",
    {
      "en": "Great street food, everything was hot and delivered fast.",
      "ko": "훌륭한 분식이에요. 모두 따끈했고 배달도 빨랐어요.",
      "zh": "很棒的街头小吃，全都热乎乎的，送得也快。",
      "vi": "Đồ ăn đường phố tuyệt vời, mọi thứ đều nóng hổi và giao nhanh.",
      "th": "สตรีทฟู้ดเยี่ยมมาก ทุกอย่างร้อน ๆ และส่งไว",
      "ja": "最高の屋台料理。全部あつあつで、配達も早かったです。"
    }
  ]
};

/**
 * Demo photos (AI-generated for the demo, stored in the images table like uploads).
 * Only dishes whose photo matches the dish data: e.g. no photo with meat on a vegetarian dish.
 */
const DEMO_PHOTOS = {
  dishes: {
    '소불고기': 'bulgogi', '된장찌개': 'doenjang-jjigae', '양념 치킨': 'yangnyeom-chicken', '간장 마늘 치킨': 'soy-garlic-chicken',
    '치즈볼 (5개)': 'cheese-balls', '떡볶이': 'tteokbokki', '어묵꼬치 (3개)': 'eomuk-skewers', '김치찌개': 'kimchi-jjigae',
    '두부 포케': 'tofu-poke', '돈코츠 라멘': 'tonkotsu-ramen',
    '마르게리타': 'margherita', '페퍼로니': 'pepperoni', '치킨 케밥 플레이트': 'chicken-kebab-plate', '팔라펠 랩': 'falafel-wrap',
    '후무스 & 피타': 'hummus-pita', '딸기 빙수': 'strawberry-bingsu', '크로플': 'croffle', '호떡 (2개)': 'hotteok',
    '콜드브루 오트라떼': 'cold-brew-oat-latte', '말차 라떼': 'matcha-latte',
    '야채 김밥': 'vegetable-gimbap', '제육볶음': 'jeyuk-bokkeum', '두부 덮밥': 'tofu-rice-bowl',
    '비빔밥': 'bibimbap', '양고기 되네르 랩': 'doner-wrap', '버섯 퀴노아 보울': 'mushroom-quinoa-bowl', '야채 라멘': 'vegetable-ramen',
    '후라이드 치킨': 'fried-chicken', '감자튀김': 'french-fries', '김말이 튀김': 'gimmari',
  },
  restaurants: {
    '서울 한식당': 'bulgogi', '바삭 치킨': 'yangnyeom-chicken', '명동 분식': 'tteokbokki',
    '나폴리 피자': 'margherita', '달콤 디저트 카페': 'strawberry-bingsu', // covers show dishes that are on the menu
    '이스탄불 할랄 키친': 'doner-wrap', '그린보울': 'tofu-poke', '도쿄 라멘': 'tonkotsu-ramen',
  },
  reviews: {
    'Очень хрустящая курица, соево-чесночный соус — просто огонь!': 'soy-garlic-chicken',
    'Bingsu dâu siêu ngon, đá mịn như tuyết! Sẽ quay lại.': 'strawberry-bingsu',
  },
};

async function addDemoPhotos() {
  const fs = require('fs');
  const path = require('path');
  const ids = {};
  const imageUrl = async (file) => {
    if (!ids[file]) {
      const data = fs.readFileSync(path.join(__dirname, 'demo-images', `${file}.webp`));
      const { rows } = await pool.query('INSERT INTO images (mime_type, size_bytes, data) VALUES ($1, $2, $3) RETURNING id', ['image/webp', data.length, data]);
      ids[file] = `/api/images/${rows[0].id}`;
    }
    return ids[file];
  };
  for (const [name, file] of Object.entries(DEMO_PHOTOS.dishes)) {
    await pool.query('UPDATE menu_items SET image_url = $2 WHERE name = $1', [name, await imageUrl(file)]);
  }
  for (const [name, file] of Object.entries(DEMO_PHOTOS.restaurants)) {
    await pool.query('UPDATE restaurants SET image_url = $2 WHERE name = $1', [name, await imageUrl(file)]);
  }
  // a couple of demo reviews come with the customer's photo
  for (const [comment, file] of Object.entries(DEMO_PHOTOS.reviews)) {
    await pool.query('UPDATE reviews SET photo_urls = $2 WHERE comment = $1', [comment, [await imageUrl(file)]]);
  }
}

async function seed() {
  await migrate({ reset: true });
  const hash = await hashPassword(PASSWORD);
  const users = {};
  for (const p of PEOPLE) {
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, preferred_language, phone, postal_code, address_line1, address_line2, passport,
         passport_consent_at)
       VALUES ($1, $2, $3, $4, $5, $6, '010-1234-5678', $7, $8, $9, $10, $11)`,
      [p.id, p.name, p.email, hash, p.role, p.lang, p.address?.[0] ?? null, p.address?.[1] ?? null, p.address?.[2] ?? null, p.passport ?? null, p.passport ? new Date() : null],
    );
    users[p.key] = p.id;
  }

  const cards = {};
  for (const [key, brand, last4, foreign] of [
    ['customer', 'VISA', '4242', true], ['customer2', '국내카드', '0003', false], ['minh', 'MASTERCARD', '4444', true], ['olga', 'VISA', '1881', true],
  ]) {
    const userId = users[key === 'customer2' ? 'customer' : key];
    const { rows } = await pool.query(
      `INSERT INTO payment_methods (user_id, provider, billing_key, card_brand, last4, is_foreign, is_default)
       VALUES ($1, 'mock', $2, $3, $4, $5, $6) RETURNING id, card_brand, last4`,
      [userId, `mock_bk_seed_${key}`, brand, last4, foreign, key !== 'customer2'],
    );
    cards[key] = rows[0];
  }

  const created = [];
  for (const r of restaurants) {
    const { rows } = await pool.query(
      `INSERT INTO restaurants (name, description, cuisine_type, address, phone, manager_id, delivery_fee, min_order_amount,
         prep_time_minutes, supports_delivery, supports_pickup, source_language, translations, translation_status, mood_tags,
         opens_at, closes_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 'ko', $11, 'done', $12, $13, $14) RETURNING id`,
      [r.name.ko, r.desc.ko, r.cuisine, r.address, r.phone, r.owner ? users[r.owner] : null, r.fee, r.min, r.prep,
        !r.pickupOnly, translationsOf({ name: r.name, description: r.desc }), r.moods, r.hours?.[0] ?? null, r.hours?.[1] ?? null],
    );
    const restaurantId = rows[0].id;
    const categoryIds = [];
    for (const [i, cat] of r.categories.entries()) {
      const c = await pool.query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, translations, translation_status, is_side)
         VALUES ($1, $2, $3, $4, 'done', $5) RETURNING id`,
        [restaurantId, cat.ko, i, translationsOf({ name: cat }), Boolean(cat.isSide)],
      );
      categoryIds.push(c.rows[0].id);
    }
    const items = [];
    for (const it of r.items) {
      const fields = {
        name: Object.fromEntries(LANGS.map((l) => [l, it.t[l][0]])),
        description: Object.fromEntries(LANGS.map((l) => [l, it.t[l][1]])),
        explanation: Object.fromEntries(LANGS.map((l) => [l, it.t[l][2]])),
      };
      const row = await pool.query(
        `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, allergens, dietary_tags, spice_level,
           romanization, translations, translation_status, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'done', 'ok') RETURNING id, name, price`,
        [restaurantId, categoryIds[it.cat], it.t.ko[0], it.t.ko[1], it.price, it.allergens, it.diet, it.spice,
          it.rom, translationsOf(fields)],
      );
      items.push(row.rows[0]);
    }
    created.push({ id: restaurantId, items, fee: r.fee, name: r.name.ko });
  }
  const R = Object.fromEntries(created.map((r) => [r.name, r]));

  // [customer, restaurant, [[itemIndex, qty]], status, hoursAgo, review?, courier?]
  const orders = [
    ['customer', '서울 한식당', [[3, 1], [4, 1]], 'completed', 70, [5, 'Everything was clearly marked, so I could finally order Korean food without worrying. The tofu bowl was perfect!']],
    ['customer', '서울 한식당', [[2, 2]], 'completed', 30],
    ['customer', '이스탄불 할랄 키친', [[0, 1], [3, 1]], 'completed', 120, [5, 'Real halal food, generous portions and very kind staff 🙏']],
    ['customer', '그린보울', [[0, 1], [2, 1]], 'completed', 96, [4, 'Fresh and light. Would love a slightly bigger portion.']],
    ['customer', '나폴리 피자', [[0, 1]], 'completed', 150],
    ['customer', '이스탄불 할랄 키친', [[2, 1], [3, 1]], 'preparing', 0.3],
    ['customer', '서울 한식당', [[3, 2]], 'pending', 0.05],
    // on the way right now, with a courier: open it to watch the courier ride across the map
    ['customer', '바삭 치킨', [[0, 1], [3, 1]], 'out_for_delivery', 0.25, null, 'courier'],
    ['minh', '달콤 디저트 카페', [[0, 1], [1, 1]], 'completed', 50, [5, 'Bingsu dâu siêu ngon, đá mịn như tuyết! Sẽ quay lại.']],
    ['minh', '명동 분식', [[0, 1], [1, 2]], 'completed', 26, [4, 'Tteokbokki rất cay nhưng rất ngon. Gimbap tươi.']],
    ['minh', '바삭 치킨', [[0, 1], [3, 1]], 'pending', 0.1],
    ['olga', '바삭 치킨', [[2, 1], [4, 1]], 'completed', 80, [5, 'Очень хрустящая курица, соево-чесночный соус — просто огонь!']],
    ['olga', '명동 분식', [[1, 1], [2, 2], [3, 1]], 'completed', 20, [5, 'Отличный стритфуд, всё горячее и быстро привезли.'], 'courier'],
    ['olga', '명동 분식', [[0, 1], [1, 1]], 'out_for_delivery', 0.15],
    ['minh', '달콤 디저트 카페', [[1, 1], [3, 1]], 'out_for_delivery', 0.1, null, 'courier'],
  ];
  for (const [who, rname, lines, status, hoursAgo, review, courierKey] of orders) {
    const r = R[rname];
    const card = cards[who];
    const itemsAmount = lines.reduce((s, [i, q]) => s + r.items[i].price * q, 0);
    const person = PEOPLE.find((p) => p.key === who);
    const { rows } = await pool.query(
      `INSERT INTO orders (customer_id, restaurant_id, order_type, status, delivery_address, contact_phone, items_amount, delivery_fee,
         total_amount, payment_status, payment_method_id, payment_provider, payment_reference, card_label, created_at, updated_at, courier_id)
       VALUES ($1, $2, 'delivery', $3, $4, '010-1234-5678', $5, $6, $7, 'paid', $8, 'mock', 'mock_seed', $9,
         NOW() - make_interval(secs => $10), NOW() - make_interval(secs => $10), $11)
       RETURNING id`,
      [users[who], r.id, status, `${person.address[1]}, ${person.address[2]}`, itemsAmount, r.fee, itemsAmount + r.fee,
        card.id, `${card.card_brand} •••• ${card.last4}`, Math.round(hoursAgo * 3600), courierKey ? users[courierKey] : null],
    );
    for (const [i, q] of lines) {
      const it = r.items[i];
      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, price_snapshot, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [rows[0].id, it.id, it.name, it.price, q, it.price * q],
      );
    }
    if (review) {
      await pool.query(
        `INSERT INTO reviews (customer_id, restaurant_id, order_id, rating, comment, created_at, source_language, translations, translation_status)
         VALUES ($1, $2, $3, $4, $5, NOW() - make_interval(secs => $6), $7, $8, 'done')`,
        [users[who], r.id, rows[0].id, review[0], review[1], Math.round((hoursAgo - 1) * 3600),
          REVIEW_TRANSLATIONS[review[1]][0],
          Object.fromEntries(Object.entries(REVIEW_TRANSLATIONS[review[1]][1]).map(([l, c]) => [l, { comment: c }]))],
      );
    }
  }
  for (const r of created) await recalculateRating(r.id);

  await addDemoPhotos();

  if (process.env.NODE_ENV !== 'test') console.log(`Seed complete. Demo password for all accounts: ${PASSWORD}`);
}

if (require.main === module) {
  seed().then(() => pool.end()).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed, PASSWORD };
