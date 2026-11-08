const toCamelKey = (key) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** Convert a DB row (snake_case) to an API object (camelCase). */
function toCamel(row) {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map(toCamel);
  if (typeof row !== 'object' || row instanceof Date) return row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamelKey(k), toCamel(v)]));
}

module.exports = { toCamel };
