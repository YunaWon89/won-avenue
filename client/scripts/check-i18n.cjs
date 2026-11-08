/**
 * Checks that all 7 UI translation files have exactly the same keys and no empty values.
 *   npm run check:i18n
 * English (en.json) is the reference. Exits with code 1 if something is missing.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/i18n');
const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const data = Object.fromEntries(files.map((f) => [f.replace('.json', ''), new Map(flatten(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))))]));
const ref = data.en;
let problems = 0;

for (const [lang, keys] of Object.entries(data)) {
  if (lang === 'en') continue;
  const missing = [...ref.keys()].filter((k) => !keys.has(k));
  const extra = [...keys.keys()].filter((k) => !ref.has(k));
  const empty = [...keys].filter(([, v]) => typeof v === 'string' && !v.trim()).map(([k]) => k);
  for (const [label, list] of [['missing', missing], ['extra', extra], ['empty', empty]]) {
    if (list.length) { problems += list.length; console.log(`${lang}: ${list.length} ${label} — ${list.slice(0, 10).join(', ')}${list.length > 10 ? ' …' : ''}`); }
  }
}
console.log(problems ? `\n${problems} problem(s) found.` : `OK — ${files.length} languages, ${ref.size} keys each.`);
process.exitCode = problems ? 1 : 0;
