// Creates the tables the Orders module needs. Safe to run more than once.
// Run from the backend folder:   node src/orders/setup.js
// Optional sample menu for a restaurant account:
//                                node src/orders/setup.js restaurant@example.com
const pool = require('../db');

async function setup(sampleMenuFor) {
  // Use the same id type as Danielle's users table (SERIAL integer or UUID)
  const t = await pool.query(
    `SELECT format_type(atttypid, atttypmod) AS type
       FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'id'`
  );
  const userId = t.rows[0].type;

  // menu_items belongs to the Restaurants module (Tereza). Created here only if it
  // does not exist yet, with the columns the Orders module reads.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id            SERIAL PRIMARY KEY,
      restaurant_id ${userId} NOT NULL REFERENCES users(id),
      name          TEXT NOT NULL,
      price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
      available     BOOLEAN NOT NULL DEFAULT TRUE
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id              SERIAL PRIMARY KEY,
      customer_id     ${userId} NOT NULL REFERENCES users(id),
      restaurant_id   ${userId} NOT NULL REFERENCES users(id),
      status          TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN
                      ('PENDING_PAYMENT','PAYMENT_FAILED','RECEIVED','PREPARING','READY','COMPLETED','REJECTED')),
      total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
      paid            BOOLEAN NOT NULL DEFAULT FALSE,
      idempotency_key TEXT NOT NULL UNIQUE,
      version         INTEGER NOT NULL DEFAULT 1,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id               SERIAL PRIMARY KEY,
      order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id     INTEGER NOT NULL,
      name             TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      qty              INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 20)
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id             SERIAL PRIMARY KEY,
      order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      transaction_id TEXT NOT NULL,
      method         TEXT NOT NULL,
      amount_cents   INTEGER NOT NULL,
      result         TEXT NOT NULL CHECK (result IN ('SUCCEEDED','FAILED','REFUNDED')),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         SERIAL PRIMARY KEY,
      user_id    ${userId} NOT NULL REFERENCES users(id),
      order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      message    TEXT NOT NULL,
      read       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  await pool.query('CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS orders_restaurant_idx ON orders (restaurant_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id)');
  console.log('Orders tables are ready.');

  if (sampleMenuFor) {
    const r = await pool.query("SELECT id FROM users WHERE email = $1 AND role = 'restaurant'", [sampleMenuFor]);
    if (!r.rows[0]) {
      console.log(`No restaurant account with email ${sampleMenuFor}. Register it first.`);
    } else {
      const existing = await pool.query('SELECT 1 FROM menu_items WHERE restaurant_id = $1 LIMIT 1', [r.rows[0].id]);
      if (existing.rows.length) {
        console.log('That restaurant already has menu items; nothing added.');
      } else {
        await pool.query(
          `INSERT INTO menu_items (restaurant_id, name, price_cents, available) VALUES
             ($1, 'Flat white', 340, true), ($1, 'Chicken wrap', 650, true),
             ($1, 'Veggie soup', 480, true), ($1, 'Blueberry muffin', 280, false)`,
          [r.rows[0].id]
        );
        console.log(`Added 4 sample menu items for ${sampleMenuFor}.`);
      }
    }
  }
}

if (require.main === module) {
  setup(process.argv[2])
    .catch((err) => {
      console.error('Setup failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { setup };
