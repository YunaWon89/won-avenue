# WON AVENUE — notes for AI coding agents

Food delivery & pickup web app for Korea. Portfolio / demo project.
**What we build and why → `docs/PRD.md`** (requirements, roles, status flow, acceptance criteria).
Read the relevant PRD section before adding or changing a feature.

## Stack
- `client/` — React 19 + Vite, React Router, i18next (7 languages), Context API, plain CSS (`src/styles.css`, CSS variables, light/dark theme).
- `server/` — Node.js + Express 5, PostgreSQL (raw SQL with `pg`), Zod validation, JWT in httpOnly cookie, multer.
- Tests: Jest + Supertest in `server/tests/api.test.js` (real test database `food_delivery_test`).
- API docs: `server/src/docs/openapi.yaml` (Swagger UI at `/api/docs`).

## Commands (run from the repo root)
| Task | Command |
|---|---|
| Install everything | `npm run install:all` |
| API (port 5000) | `npm run dev:server` |
| Web app (port 5173) | `npm run dev:client` |
| Reset DB with demo data | `npm run db:reset` |
| API tests | `npm test` |
| UI texts in sync (7 languages) | `npm run check:i18n` |
| Lint client | `npm run lint --prefix client` |
| Build client | `npm run build --prefix client` |
| Check translation key | `npm run check:translation` |

## Server layout (request flow)
`routes/index.js` (auth + role guard + `validate(...)`) → `controllers/*` (thin: read req, call service, send JSON)
→ `services/*` (business rules, SQL) → `config/db.js`.
- Validation schemas: `validators/schemas.js` (Zod). Every body, query and param is validated.
- Errors: throw `ApiError.badRequest/notFound/...` (`utils/ApiError.js`); `middleware/error.js` formats them.
- Order status rules: `services/orderStatus.js` (single source of truth for transitions).
- Schema: `db/schema.sql` (idempotent, `ALTER ... IF NOT EXISTS` for new columns). Demo data: `db/seed.js`, `db/demoData.js`.
- Images are stored in the `images` table and served from `/api/images/:id` (not on disk — free hosts wipe disks).

## Hosting: Vercel (serverless) and long-running server
- Production runs on **Vercel**: `vercel.json` + `api/index.js` (one function wrapping the Express app, region `sin1`); database Neon.
- `server/src/server.js` is the long-running entry (local, Docker, Render). Both use:
  - `server/src/bootstrap.js` — schema (when `schema.sql` changed) + demo data on an empty DB, under an advisory lock;
  - `server/src/jobs.js` — periodic jobs: timers on a server, run-on-request on Vercel (each job under its own advisory lock).
- Never rely on in-memory state or timers surviving between requests. Work after the response → `runInBackground()`
  (`server/src/utils/background.js`, uses Vercel `waitUntil`). Request bodies must stay under 4.5 MB (photos are compressed in the browser).
- New periodic work → add it to `JOBS` in `jobs.js`, not a `setInterval`.
- Keep `render.yaml`, `Dockerfile` and `docker-compose.yml` inside `deploy/`: at the repo root Vercel detects them
  and refuses the single-project setup from `vercel.json`.

## Client layout
`pages/` (one file per screen; `admin/`, `manage/`), `components/` (shared UI; `ui.jsx` has inputs, badges, dialogs),
`context/` (auth, cart, meta, passport, toast), `api/client.js` (single API client, cookies, 401/403 handling),
`hooks/useApi.js`, `i18n/*.json`, `utils/`.

## Rules
- **API response format**: success `{ success: true, data }`; lists `{ success: true, items, page, limit, totalCount, totalPages }`;
  errors `{ success: false, message, code?, errors? }`.
- **Every new UI text goes into all 7 files** in `client/src/i18n/` (en, ko, zh, vi, th, ru, ja) with the same keys.
  Never hard-code visible text in JSX. Run `npm run check:i18n`.
- **Permissions are checked on the server** (role guard + ownership in the service), never only in the UI.
- Prices are integers in KRW, totals are calculated on the server.
- New endpoint ⇒ Zod schema + test + `openapi.yaml` entry (see skill `add-api-endpoint`).
- Keep the UI responsive (check ~375 px width) and working in both themes.
- Match the existing code style: small functions, comments explain *why*, no new libraries without a reason.
- Demo accounts and data must keep working after `npm run db:reset` (password `Demo1234!`).

## Never
- Commit, print or edit `server/.env` (real keys). Use `server/.env.example` for new variables.
- Deploy, push or delete data without the owner's explicit OK.
- Weaken validation or permissions to make a test pass.
- Say "done" before tests pass (see skill `run-checks`).
