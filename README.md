# WON AVENUE — food delivery & pickup in Korea

**English** · [한국어](README.ko.md)

Food ordering in Korea for **everyone** — especially foreigners, people with allergies, and halal / vegetarian / vegan eaters.

- 🌏 **7 languages**: English (default), 한국어, 中文, Tiếng Việt, ภาษาไทย, Русский, 日本語 — chosen by the largest foreign communities in Korea. Korean owners write menus in Korean; customers read them in their own language.
- 🛂 **Food passport**: set diet, allergies and spice tolerance once; every dish is marked *safe for you* or *not for you*. A single on/off switch: when it is off, the menu is shown normally with no marks.
- 🧑‍🍳 **"What is it?"** explanations and pronunciation (🔊) for Korean dishes.
- 😋 **Mood tiles**: spicy, light, comfort, sweet, late-night, fast (≤ 20 min).
- 💳 Pay in **KRW** with saved Korean or international cards; **delivery or pickup**.
- 🛒 **One cart, several restaurants** (up to 5): one payment, and each restaurant gets its own order, delivery fee and courier.
- 🏪 Owners manage menus (allergens, labels, photos, translations) and only tap **Accept / Reject** and **Hand to courier / Ready for pickup**.
- 🛵 **Couriers** take deliveries and mark them delivered; everything else moves on automatically.
- ✨ **Light & dark gold themes** (follow the phone), a hanok emblem with the 윤아 signature, and small animations: the dish flies into the cart with golden sparkles, little chefs cook while the order is being prepared, a courier rides across an illustrated map, and waves at the gate on delivery.
- 🛡️ Admins approve restaurants, **check new dishes after publication**, manage users, moderate reviews and can **reset the demo** before a presentation.

**Stack:** React 19 (Vite) · Node.js + Express 5 · PostgreSQL · JWT in httpOnly cookies · Zod · Jest + Supertest

---

## Features

| Area | What's included |
|---|---|
| Customers | Sign-up with phone + full Korean address (Kakao postcode search), saved cards, cart, checkout, live order tracking, cancel while pending (auto-refund), call the courier (on the way / just delivered), a "How was it?" prompt with one-tap stars after delivery, reviews with up to 3 photos after completion, order history with filters |
| Allergy & diet | 22 allergens (Korean MFDS list + sesame, fish, tree nuts). "Hide dishes containing…" filter, remembered per device. Diet filters: halal, vegetarian, vegan, gluten-free, no pork, no alcohol. Server rejects e.g. "halal" + pork |
| Multi-restaurant cart | Dishes from up to 5 restaurants in one cart and one checkout. Each restaurant becomes a separate order (own kitchen, delivery fee, courier, status). Delivery / pickup must suit every restaurant (e.g. a pickup-only place makes the checkout pickup). All parts are validated together; if a payment fails, nothing is kept and paid parts are refunded |
| Delivery / pickup | Per-restaurant delivery fee, minimum order, prep time; pickup has its own status flow (`ready_for_pickup`) |
| Payments | KRW, whole won. Saved cards via billing keys — **card numbers are never stored**. `mock` provider for demos, `toss` provider (Toss Payments billing) for real payments |
| Languages | UI in 7 languages (all 560 strings hand-translated). Seller content is translated once on save by **Gemini** (menu-aware prompt, keeps dish names recognisable, writes "What is it?" for foreigners), stored in the DB, editable by the owner (manual edits are never overwritten), retried automatically on failure. Demo menus are hand-translated. **Customer reviews** are translated too: the source language is detected from the text, readers see the review in their language with "Show original" |
| Food passport | Stored on the account (or locally for guests). Server computes "N dishes safe for you" per restaurant; strict rules: allergens excluded, halal/vegan/vegetarian need the label, no-pork / gluten-free checked against ingredients |
| Owners | Self-registration → submit restaurant → admin approval. Menu & categories CRUD with photos, allergens, diet tags, spice level, sold-out toggle. Order desk with auto-refresh and new-order alerts: **Accept** (→ preparing) or **Reject**, then **Hand to courier** / **Ready for pickup**. Sees "Waiting for courier" / "Courier on the way" and admin requests to fix a dish |
| Couriers | "Deliveries" page: available deliveries → **Take** (one courier per order) → call restaurant / customer → **Delivered**. Only the courier who took the order can mark it delivered |
| Admin | Stats dashboard, users (search, role, activate/deactivate), restaurants (approve, assign owner, delete/deactivate), all orders (read-only; can cancel), review moderation, **dish check after publication** |
| Dish check | New and edited dishes are visible at once. Admin marks them **OK** or **Needs changes** with a message; the owner sees the message and a **Fix** button. Fixed → back to the admin. Not fixed in `DISH_FIX_DAYS` (3) → hidden automatically |
| Opening hours | Owners set opening hours (Seoul time, past midnight allowed, empty = 24 h). Closed restaurants show "Closed · opens 11:00" and don't accept orders (`RESTAURANT_CLOSED`). In the demo only 도쿄 라멘 has hours (11:00–21:30), so there's always something open |
| Alerts | Owner order desk and courier page play a short chime for new orders / deliveries ("Sound on" button; browsers need one tap to allow sound) |
| Privacy | Diet and allergy info is health-related: the food passport is stored only after explicit consent (`passportConsent`); deleting it withdraws the consent. Dish marks say "suits you" (based on the restaurant's info) and carry a note that this is not a medical guarantee |
| Automation | Unanswered orders are cancelled and refunded after `AUTO_CANCEL_MINUTES`; delivered / ready orders complete after `AUTO_COMPLETE_MINUTES` if the customer doesn't confirm |
| Quality | Role-based access + ownership checks, validation on both sides, consistent error format, rate limiting on auth, Helmet CSP, 81 API tests, Swagger docs |

## Quick start (local)

Requirements: Node.js 20+, PostgreSQL 14+ (or Docker).

```bash
# 1. Database (skip if you already have PostgreSQL running)
docker compose up -d

# 2. Install
npm run install:all

# 3. Configure
cp server/.env.example server/.env        # Windows: copy server\.env.example server\.env

# 4. Create tables + demo data
npm run db:reset

# 5. Run (two terminals)
npm run dev:server     # API  -> http://localhost:5000  (docs: /api/docs)
npm run dev:client     # App  -> http://localhost:5173
```

Without Docker, create the databases yourself: `food_delivery` (app) and `food_delivery_test` (tests).

### Demo accounts

Password for all: **`Demo1234!`**

| Email | Role |
|---|---|
| customer@demo.com | Aisha — customer with a food passport (halal, no peanut / shrimp), saved cards, order history, one order cooking and one on the way (watch the courier ride on the map) |
| owner@demo.com | Restaurant owner (Korean UI) — 서울 한식당, 바삭 치킨, 명동 분식 |
| owner2@demo.com | Restaurant owner — 이스탄불 할랄 키친, 그린보울, 달콤 디저트 카페 |
| admin@demo.com | Admin (with "Reset demo data") |
| courier@demo.com | Courier 박민수 — one delivery waiting to be taken, two on the way |
| minh@demo.com, olga@demo.com | Customers who left reviews in Vietnamese / Russian |

Demo cards (mock mode): `4242 4242 4242 4242` works, `4000 0000 0000 0002` is always declined. Any future expiry, any CVC.

Demo photos are AI-generated for the demo (`server/src/db/demo-images`) and are only attached to dishes they really match (no meat photos on vegetarian dishes). Real restaurants upload their own photos.

## Tests

```bash
npm test
```

81 API tests (Jest + Supertest) against `food_delivery_test` (reset on every run): auth, role access, CRUD, pagination/filters/sort, allergen & diet filters, food passport, payments, multi-restaurant checkout (all-or-nothing, refund on failed payment), full status flows incl. courier claim / delivered, automatic cancel / complete, dish check after publication, reviews and rating recalculation, uploads, demo reset, opening hours (incl. past midnight), passport consent, error format.

## Environment variables (`server/.env`)

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | local `food_delivery` | PostgreSQL connection string |
| `DATABASE_SSL` | `false` | `true` for hosts that need SSL without a verifiable certificate |
| `JWT_SECRET` | dev value | **Required in production** (long random string) |
| `JWT_EXPIRES_IN` | `7d` | |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin in development |
| `SEED_ON_EMPTY` | `false` | `true` → fills an empty DB with demo data on start |
| `GEMINI_API_KEY` | — | Enables automatic translation of new dishes and reviews ([free key](https://aistudio.google.com/apikey)). Without it, new content is shown as written (demo data is already translated) |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Gemini model to use |
| `TRANSLATION_PROVIDER` | `auto` | `auto` / `gemini` / `deepl` / `none` |
| `DEEPL_API_KEY` | — | Alternative translation provider |
| `DEMO_MODE` | `false` | `true` → admin can "Reset demo data" |
| `PAYMENT_PROVIDER` | `mock` | `mock` or `toss` |
| `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` | — | Toss Payments keys (test keys work for development) |
| `AUTO_CANCEL_MINUTES` | `15` | A pending order nobody accepted is cancelled and refunded |
| `AUTO_COMPLETE_MINUTES` | `10` | A delivered / ready-for-pickup order completes if the customer doesn't confirm |
| `DISH_FIX_DAYS` | `3` | Days the owner has to fix a dish after the admin's request; then it is hidden |

To check the translation key without starting the app: `npm run check:translation` (prints the provider, makes one test request and explains a failure; the key is never printed).

## Deploy (public link)

The server also serves the built React app, so the whole project is **one web service + one database**, on a single URL (same-origin cookies, no CORS setup).

### Render (free)

1. Push this repository to GitHub.
2. Render → **New → Blueprint** → pick the repo. `render.yaml` creates the web service and PostgreSQL.
3. Wait for the first deploy. Demo data is added automatically (`SEED_ON_EMPTY=true`). Open `https://<service>.onrender.com`.
4. Optional: add `GEMINI_API_KEY` in the service's Environment settings to translate new dishes and reviews automatically.

Free-plan notes: the service sleeps after ~15 minutes idle (first request takes ~30–60 s), and Render's free PostgreSQL expires after 30 days. For a long-lived free database, create one on [Neon](https://neon.tech) and set `DATABASE_URL` to its connection string.

### Any Docker host

```bash
docker build -t won-avenue .
docker run -p 5000:5000 -e DATABASE_URL=... -e JWT_SECRET=... -e SEED_ON_EMPTY=true won-avenue
```

## Real payments (Toss Payments)

1. Create a Toss Payments merchant account and sign the **자동결제(빌링)** contract. International card acceptance is part of the merchant contract — confirm it with Toss.
2. Set `PAYMENT_PROVIDER=toss`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`.
3. "Add card" then opens the Toss window. Card details never touch our server; we store only the billing key, brand and last 4 digits. Orders are charged with the billing key, and cancelling a paid order refunds it.

> The Toss integration follows the documented billing API but has to be tested with your own test keys before going live.

## API

Interactive docs: **`/api/docs`** (Swagger UI). Summary:

| Method | URL | Access |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Public |
| GET / PATCH | `/api/auth/me` · POST `/api/auth/me/password` | Logged in |
| GET | `/api/restaurants` (search, cuisine, minRating, orderType, diet, sort, page, limit) | Public |
| GET | `/api/restaurants/:id` · `/:id/menu-items` (search, categoryId, minPrice, maxPrice, excludeAllergens, diet, maxSpice, sort) · `/:id/reviews` | Public |
| POST / PATCH / DELETE | `/api/restaurants` · `/api/categories` · `/api/menu-items` | Owner of the restaurant / admin |
| POST | `/api/orders` · `/api/orders/batch` (several restaurants) | Customer |
| GET | `/api/orders` (status, active, orderType, from, to, customerId, restaurantId, sort) · `/api/orders/:id` | Own / restaurant's / all |
| PATCH | `/api/orders/:id/status` | Per status flow |
| POST | `/api/reviews` · GET/PATCH `/api/reviews` (moderation) | Customer · Admin |
| GET / POST / PATCH / DELETE | `/api/payment-methods` | Customer |
| POST | `/api/orders/:id/claim` | Courier |
| GET · PATCH | `/api/admin/dishes` · `/api/admin/dishes/:id/review` | Admin |
| GET | `/api/manage/flagged-dishes` | Owner |
| GET / POST / PATCH | `/api/admin/users`, GET `/api/admin/stats`, POST `/api/admin/demo/reset` | Admin |

Lists return `{ success, items, page, limit, totalCount, totalPages }`. Errors return `{ success: false, message, code, errors: [{ field, message }] }`.

### Order status flow

```
delivery: pending → preparing → out_for_delivery → delivered → completed
pickup:   pending → preparing → ready_for_pickup → completed
cancel:   customer — only while pending · owner — reject a pending order · admin — any active order
```

| Step | Who |
|---|---|
| pending → preparing | Owner taps **Accept** (accepting and starting to cook is one action, so the separate `accepted` status is not used) |
| pending → cancelled | Owner **Reject**, customer cancel, or automatically after `AUTO_CANCEL_MINUTES` |
| preparing → out_for_delivery / ready_for_pickup | Owner |
| out_for_delivery → delivered | **Only the courier** who took the order |
| delivered → completed | Automatically after `AUTO_COMPLETE_MINUTES` (customers don't have to confirm; for them delivery ends at "Delivered") |
| ready_for_pickup → completed | Restaurant hands the order over, or automatically after `AUTO_COMPLETE_MINUTES` |

Orders never move backwards. Completed and cancelled are final. Cancelling a paid order refunds the payment.

## Manual test checklist

Run `npm run db:reset`, then check in the browser (desktop and phone width). All items were checked before release.

**Guest & languages**
- [x] First visit: welcome screen, language picked from the phone/browser; the 🌐 switcher changes every text, the choice survives a reload
- [x] All 7 languages: no untranslated keys, layout doesn't break on a 390 px screen; dark theme
- [x] Restaurants list: search, cuisine, rating, moods, sort, pages; a guest can't order or review (asked to log in)

**Customer** (`customer@demo.com`)
- [x] Food passport on: unsafe dishes are marked and can't be added; off: normal menu without marks
- [x] Dish sheet → Add: dish flies to the cart, badge count updates
- [x] Cart with two restaurants → one payment → two orders, each with its own delivery fee; a pickup-only restaurant makes the checkout pickup; a 6th restaurant is refused
- [x] Checkout with a saved card (delivery and pickup); declined card `4000 0000 0000 0002` shows an error
- [x] Cancel a pending order → refunded; can't cancel after the restaurant accepted
- [x] Courier on the way / delivered: courier name and a Call button; after delivery the order completes by itself and a "How was it?" card appears; tapping a star opens the review form; second review for the same order is impossible
- [x] Opening `/admin` or `/manage` → "Access denied"

**Owner** (`owner@demo.com`)
- [x] Accept / Reject a new order; Hand to courier; "Waiting for courier" → "Courier on the way"
- [x] Categories and dishes: create, edit, sold out, delete, photo upload (non-image or > 2 MB rejected)
- [x] Admin request to fix a dish appears on the dashboard; Fix opens the dish with the admin's message

**Courier** (`courier@demo.com`)
- [x] Take an available delivery; another courier can't take or deliver it; Delivered moves it to history

**Admin** (`admin@demo.com`)
- [x] Dashboard numbers and order statuses (translated); users: search, role filter, deactivate
- [x] Approve a restaurant, assign an owner; orders are read-only
- [x] Dishes: OK / Needs changes with a message; reviews: hide / show (rating recalculated)
- [x] Reset demo data

**Design**
- [x] Light / dark theme follows the phone; switch in the header; logo, icons and scenes recolour
- [x] Fly-to-cart sparkles; chefs (preparing), courier on the map (on the way), waving courier (delivered)
- [x] Closed restaurant: card shows "Closed · opens …", ordering is disabled; owner sets hours in the restaurant form

## Project structure

```
server/src
  config/       env, db pool, vocabularies (allergens, diets, cuisines)
  db/           schema.sql, migrate, seed
  middleware/   auth (JWT + roles), validate (Zod), upload (multer → DB), error handler
  validators/   request DTOs (Zod)
  services/     business logic: auth, users, restaurants, menu, orders + status machine, reviews, payments, translation
  controllers/  thin HTTP layer
  routes/       all /api routes
  docs/         openapi.yaml
server/tests    Jest + Supertest
client/src
  api/          fetch client (cookies, error normalisation, 401 handling)
  context/      auth, cart (localStorage), toasts, meta
  i18n/         en, ko, zh, vi, th, ru, ja (.json)
  components/   UI kit, layout, cards, address search, payment cards, image input
  pages/        customer, Courier, manage/ (owner), admin/
```

## Security notes

- Passwords hashed with bcrypt. JWT in an **httpOnly, SameSite=Lax** cookie (Secure in production).
- Login uses a generic error and constant-time comparison (no user enumeration). Rate limiting on auth and card endpoints.
- Every endpoint validates input with Zod. Sort fields are whitelisted, SQL is parameterised.
- Ownership checks: customers see only their orders, owners only their restaurants' data; out-of-scope orders return 404.
- Prices and totals are always recalculated on the server.
- Uploads: JPEG/PNG/WEBP only, ≤ 2 MB, magic-byte check, stored in PostgreSQL (persist across redeploys).
- Helmet with a Content-Security-Policy allowing only the Kakao postcode and Toss scripts.
