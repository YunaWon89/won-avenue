/**
 * Opening hours, Asia/Seoul time. opens_at / closes_at NULL = open around the clock;
 * closes_at earlier than opens_at means the restaurant closes after midnight (e.g. 16:00-04:00).
 * Use with the restaurants table aliased as "r".
 */
const NOW_SEOUL = "(NOW() AT TIME ZONE 'Asia/Seoul')::time";
const OPEN_SQL = `(r.opens_at IS NULL OR r.closes_at IS NULL
  OR (r.opens_at <= r.closes_at AND ${NOW_SEOUL} >= r.opens_at AND ${NOW_SEOUL} < r.closes_at)
  OR (r.opens_at > r.closes_at AND (${NOW_SEOUL} >= r.opens_at OR ${NOW_SEOUL} < r.closes_at)))`;

module.exports = { OPEN_SQL };
