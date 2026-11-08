---
name: add-ui-text
description: Use whenever a WON AVENUE UI change adds, renames or removes visible text (labels, buttons, messages, statuses, error texts). Keeps all 7 languages in sync.
---

# Add or change UI text (7 languages)

Languages: `en, ko, zh, vi, th, ru, ja` — files in `client/src/i18n/`. English is the reference; all files must have the same keys.

## Steps
1. Pick a key in the existing namespace (look at nearby keys in `en.json`, e.g. `orders.*`, `review.*`, `errors.*`, `status.*`).
   Do not create a new top-level namespace if a fitting one exists.
2. Add the key to **all 7 files** at the same place. Write real translations, natural for each language:
   - Korean: polite 해요체, as Korean delivery apps write.
   - Keep placeholders exactly: `{{count}}`, `{{name}}`, etc. Plurals follow i18next suffixes already used in the file.
   - Keep it short — buttons and badges must fit on a 375 px phone.
3. Use it in JSX via `const { t } = useTranslation();` → `t('namespace.key')`. Never hard-code visible text.
4. Server error codes: the API returns `code` (e.g. `ORDER_NOT_COMPLETED`); the client maps codes to `errors.*` keys —
   add the new code there instead of showing the raw server message.
5. Removing text: delete the key from all 7 files.
6. Run `npm run check:i18n` — it must print `OK — 7 languages, N keys each`.
7. Look at the screen in at least English, Korean and one long language (Russian or Vietnamese) to be sure nothing overflows.
