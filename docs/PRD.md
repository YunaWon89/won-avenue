# WON AVENUE — Product Requirements (PRD)

Status legend: ✅ done · ⚠️ done differently from the original assignment (reason given) · ➕ added beyond the assignment · ⏳ open

The original assignment is a junior-to-middle portfolio food delivery app (React + Node/Express + PostgreSQL).
This PRD is the single source of truth for agents and developers: if code and PRD disagree, ask the owner which one is right
and update the other.

## 1. Goal and users
A realistic food ordering platform for Korea (many foreign residents and visitors), shown to potential buyers.

| User | Goal |
|---|---|
| Guest | Browse restaurants and menus |
| Customer | Order food (delivery or pickup), track it, review it |
| Restaurant manager ("owner") | Sell food: manage restaurant, menu, incoming orders |
| ➕ Courier | Take deliveries and mark them delivered |
| Admin | Keep the platform organised: users, restaurants, reviews, dish checks |

Non-goals: real payments in production (mock payments for the demo; Toss Payments prepared), native mobile apps, cloud file storage.

## 2. Roles and permissions
| Capability | Guest | Customer | Manager | Courier | Admin |
|---|---|---|---|---|---|
| View active restaurants / available dishes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cart, checkout, own orders | | ✅ | | | |
| Cancel own order | | only `pending` | | | |
| Review own completed order (once) | | ✅ | | | |
| Manage own restaurant, categories, dishes, images | | | ✅ | | ✅ |
| Process own restaurant's orders | | | ✅ | | |
| Take / deliver deliveries | | | | ✅ | |
| Users (list, search, role, activate/deactivate) | | | | | ✅ |
| Create / update / deactivate / delete restaurants, assign manager | | | ➕ create (needs approval) | | ✅ |
| All orders, review moderation, dish checks | | | | | ✅ |

Rules: every permission is enforced on the server (role guard + ownership check in the service). Customers see only their own
orders; managers only their restaurants' data; couriers only deliveries waiting for a courier or assigned to them.

## 3. User stories and acceptance criteria
| # | Story | Acceptance criteria | Status |
|---|---|---|---|
| U1 | As a guest I browse restaurants | Active restaurants only; search, cuisine filter, min rating, sort (rating/newest/name), pagination | ✅ |
| U2 | As a guest I register / log in | Validation errors per field; generic "invalid credentials" on wrong login | ✅ |
| U3 | As a customer I filter a menu | By category, availability (managers), price range; sort price ↑↓, newest, name | ✅ |
| U4 | As a customer I add dishes to a cart | Cart persists in localStorage; ➕ up to 5 restaurants, one payment | ✅ |
| U5 | As a customer I place an order with an address | Address 5–255 chars; unavailable dishes rejected; total calculated on the server | ✅ |
| U6 | As a customer I track my order | Status timeline, auto-refresh; ➕ animated scenes (kitchen, courier on map, delivered) | ✅ |
| U7 | As a customer I cancel a pending order | Allowed only in `pending`; refund in mock payments | ✅ |
| U8 | As a customer I review a completed order | Only own completed order, once; rating 1–5, comment ≤ 1000; ➕ up to 3 photos; ➕ auto-translated | ✅ |
| U9 | As a manager I manage the menu | CRUD categories and dishes, image upload, sold-out toggle; category must belong to the same restaurant | ✅ |
| U10 | As a manager I update order statuses | Only valid forward transitions (section 5) | ⚠️ |
| U11 | As an admin I manage users and restaurants | Search, role filter, pagination, activate/deactivate, assign manager, delete/deactivate restaurant | ✅ |
| U12 | As a user I switch the language | Header switcher; persists after reload and in profile | ✅ (7 languages) |

## 4. Functional requirements
- **Auth**: register, login, logout, `GET /api/auth/me`; bcrypt hashes; JWT in httpOnly cookie. ✅
- **Lists**: every list response contains `items, page, limit, totalCount, totalPages`; `page ≥ 1`, `limit 1–50`,
  sort fields whitelisted; a too-large page returns an empty list with correct metadata. ✅
- **Orders list**: filter by status, date range, customer, restaurant; sort by date or status. ✅
- **Images**: JPEG / PNG / WEBP, ≤ 2 MB, content checked (not only the extension).
  ⚠️ Stored in PostgreSQL (`images` table, served from `/api/images/:id`) instead of an `uploads/` folder,
  because free hosting wipes the disk on every restart.
- **Multilanguage**: 7 UI languages (en, ko, zh, vi, th, ru, ja) in `client/src/i18n/*.json`, all with identical keys;
  statuses and validation messages translated; `preferredLanguage` stored on the user. ✅
  ➕ Seller content (dishes, restaurants) and reviews are machine-translated (Gemini) and stored; the reader can show the original.
- **Reviews**: average rating from approved reviews only, recalculated after create / moderation; unique review per order. ✅

## 5. Order status flow
Statuses: `pending, accepted, preparing, ready_for_pickup, out_for_delivery, delivered, completed, cancelled`.

Current implementation (`server/src/services/orderStatus.js`):
```
delivery: pending → preparing → out_for_delivery → delivered → completed
pickup:   pending → preparing → ready_for_pickup → completed
```
| Transition | Who |
|---|---|
| pending → preparing ("Accept") / pending → cancelled ("Reject") | Manager |
| preparing → out_for_delivery / ready_for_pickup | Manager |
| out_for_delivery → delivered | Courier only |
| delivered / ready_for_pickup → completed | System, automatically after `AUTO_COMPLETE_MINUTES` (10); manager hands over pickup orders |
| pending → cancelled | Customer; system after `AUTO_CANCEL_MINUTES` (15) without answer |
| any active → cancelled | Admin (exceptional cases) |
Completed and cancelled orders never change again; no backward moves.

⚠️ Differences from the original assignment (waiting for the mentor's decision):
1. No separate `accepted` step — "Accept" goes straight to `preparing` (one tap less for restaurants). `accepted` stays in the enum.
2. `delivered` is set by the courier, not the manager; `completed` is automatic, not set by manager/admin.
Option if required: restore `pending → accepted → preparing`, let the manager mark `delivered` when no courier is assigned,
and let manager/admin complete delivered orders manually (update tests + OpenAPI).

## 6. Data model (main tables)
users · restaurants · menu_categories · menu_items · orders · order_items (name/price snapshots) · reviews (unique order_id)
➕ images · payment_methods · payments/refunds · checkout_id on orders · opening hours · food passport · translations (JSONB).
Schema: `server/src/db/schema.sql`.

## 7. Validation rules
Name 2–50 · email valid & unique · password ≥ 8 with a letter and a digit · restaurant name 2–100 · dish name 2–100,
price > 0, description ≤ 1000 · order: active restaurant, ≥ 1 item, quantity ≥ 1, address 5–255 · review: rating 1–5,
comment ≤ 1000, own completed order. Server validation with Zod is authoritative; forms validate before submit and show
server errors per field.

## 8. Errors
`{ success: false, message, code?, errors? }` with 400 / 401 / 403 / 404 / 409 / 500; no stack traces in production.
Client: field errors under inputs, toasts for general errors, redirect to login on 401, "Access denied" page on 403.

## 9. Quality bar (Definition of Done for any change)
- Server: Zod schema, permission + ownership check, consistent errors, test in `server/tests/api.test.js`, OpenAPI updated.
- Client: texts in all 7 languages, loading / empty / error states, works at ~375 px and in light + dark themes.
- `npm test`, `npm run check:i18n`, client lint and build pass. README updated if setup or behaviour changed.

## 10. Open items
- ⏳ Deployment: Render (web) + Neon (PostgreSQL, no 30-day expiry) proposed; waiting for the mentor.
- ⏳ Status flow differences (section 5): keep or align with the assignment — waiting for the mentor.
