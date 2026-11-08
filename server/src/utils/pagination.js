const { toCamel } = require('./caseMapper');

/**
 * Build a standard paginated response.
 * All list endpoints return: { items, page, limit, totalCount, totalPages }.
 */
function paginated(rows, totalCount, { page, limit }) {
  return {
    items: toCamel(rows),
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  };
}

/** Small helper to build parameterised WHERE clauses. Use "?" as the placeholder. */
class WhereBuilder {
  constructor() { this.clauses = []; this.params = []; }

  add(sqlWithPlaceholder, value) {
    this.params.push(value);
    this.clauses.push(sqlWithPlaceholder.replace(/\?/g, `$${this.params.length}`));
    return this;
  }

  raw(sql) { this.clauses.push(sql); return this; }

  toSql() { return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : ''; }
}

/**
 * Run a paginated SELECT.
 * @param db       object with query()
 * @param baseSql  "FROM ... JOIN ..." part
 * @param select   column list
 * @param where    WhereBuilder
 * @param orderBy  whitelisted ORDER BY expression
 */
async function runPaginated(db, { select, baseSql, where, orderBy, page, limit }) {
  const whereSql = where.toSql();
  const countRes = await db.query(`SELECT COUNT(*)::int AS count ${baseSql} ${whereSql}`, where.params);
  const n = where.params.length;
  const rowsRes = await db.query(
    `SELECT ${select} ${baseSql} ${whereSql} ORDER BY ${orderBy} LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...where.params, limit, (page - 1) * limit],
  );
  return paginated(rowsRes.rows, countRes.rows[0].count, { page, limit });
}

module.exports = { paginated, WhereBuilder, runPaginated };
