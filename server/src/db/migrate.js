const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate({ reset = false } = {}) {
  if (reset) {
    await pool.query(`
      DROP TABLE IF EXISTS reviews, order_items, orders, menu_items, menu_categories, restaurants,
        payment_methods, users, images CASCADE;
      DROP TYPE IF EXISTS payment_status; DROP TYPE IF EXISTS order_type;
      DROP TYPE IF EXISTS order_status; DROP TYPE IF EXISTS user_role;`);
  }
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

if (require.main === module) {
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => { console.log('Migration complete'); return pool.end(); })
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { migrate };
