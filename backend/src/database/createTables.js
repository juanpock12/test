
const pool = require("../db");

async function createTables() {
  try {
    console.log("Creating CampusBites tables...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        image_url TEXT,
        opening_time TIME,
        closing_time TIME,
        is_open BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL
          REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
        category VARCHAR(100),
        image_url TEXT,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
      ON menu_items(restaurant_id);
    `);

    console.log("Tables created successfully!");
  } catch (error) {
    console.error("Error creating tables:", error.message);
  } finally {
    await pool.end();
  }
}

createTables();
