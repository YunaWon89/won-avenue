---
name: add-api-endpoint
description: Use when adding or changing a server API endpoint in WON AVENUE (new route, new query filter, new field in a request body). Covers route, Zod validation, permissions, service, test and OpenAPI docs.
---

# Add or change an API endpoint

Read the related section of `docs/PRD.md` first (roles, rules, acceptance criteria).

## Steps
1. **Validation** — add or extend a Zod schema in `server/src/validators/schemas.js` and export it.
   Reuse helpers from `validators/common.js` (`uuid`, `pagination`, `boolish`, `emptyToUndef`, `phone`, `won`).
   List queries: `page` ≥ 1, `limit` 1–50, `sort` as a whitelisted `z.enum`.
2. **Route** — register it in `server/src/routes/index.js` with the right guards, in this order:
   `authenticate` (or `optionalAuth` for public), role guard (`ADMIN`, `STAFF`, …), `validate({ params, query, body })`, controller.
3. **Controller** — thin, in `server/src/controllers/*`: read `req.validQuery` / `req.body` / `req.params`, call the service,
   respond `{ success: true, data }` (lists: `{ success: true, ...result }` with `items, page, limit, totalCount, totalPages`).
   Use status 201 for create.
4. **Service** — business rules and SQL in `server/src/services/*`.
   - Ownership: a manager may touch only their restaurants, a customer only their orders/reviews. Check it here, not in the UI.
   - Errors: `throw ApiError.badRequest/forbidden/notFound/conflict(message, { code: 'MACHINE_CODE' })`.
   - Parameterised SQL only (`$1, $2`), never string-concatenated user input. Multi-step writes → `db.withTransaction`.
   - Order status changes go through `services/orderStatus.js` (`canTransition`), never ad-hoc checks.
5. **Schema change?** — edit `server/src/db/schema.sql` idempotently (`ADD COLUMN IF NOT EXISTS`), update `db/seed.js`
   if demo data needs the field, then `npm run db:reset`.
6. **Test** — add cases to `server/tests/api.test.js` in the matching `describe` block, using the `login(email)` helper.
   Cover: happy path, validation error (400), wrong role (403), someone else's data (403/404).
7. **Docs** — add or update the path in `server/src/docs/openapi.yaml` (summary, roles in the description, params, body, responses).
8. **Client** (if used by the UI) — call it through `client/src/api/client.js` (`api.get/post/patch/delete`);
   map new error codes to translated messages (skill `add-ui-text`).
9. Finish with skill `run-checks`.
