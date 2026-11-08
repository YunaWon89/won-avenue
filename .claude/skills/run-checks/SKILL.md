---
name: run-checks
description: Use before saying a WON AVENUE task is done, before a commit, or when asked to verify the project. Runs tests, i18n check, lint and build, and checks the change against the PRD.
---

# Run checks before "done"

Run from the repo root. PostgreSQL must be running (test DB `food_delivery_test`).

| Check | Command | Must show |
|---|---|---|
| API tests | `npm test` | all tests passed |
| UI texts | `npm run check:i18n` | `OK — 7 languages` |
| Client lint | `npm run lint --prefix client` | no errors (warnings: fix the ones in files you touched) |
| Client build | `npm run build --prefix client` | `built in …` |

Then review the change itself:
- Matches the acceptance criteria in `docs/PRD.md`; if behaviour changed on purpose, update the PRD (status marks, section 5 for statuses).
- New endpoint → Zod schema, permission + ownership check, test, `openapi.yaml` entry.
- New UI → loading / empty / error states, 375 px width, light and dark theme.
- New environment variable → `server/.env.example` + README table (never `server/.env`).
- README (en + ko) updated if setup, commands, demo data or behaviour changed.
- Demo still works after `npm run db:reset` (accounts with password `Demo1234!`).

Report honestly: list what passed, what failed (with the output) and what was not checked.
Do not commit or push unless the owner asked.
