
const pool = require('../db');

// Get all restaurants


async function listRestaurants(search = '', openOnly = false) {
  const result = await pool.query(
    `SELECT
       u.id,
       COALESCE(NULLIF(u.name, ''), u.email) AS name,
       COUNT(m.id)::integer AS menu_item_count,
       COUNT(m.id) FILTER (
         WHERE m.available = true
       )::integer AS available_item_count
     FROM users u
     JOIN menu_items m ON m.restaurant_id = u.id
     WHERE u.role = 'restaurant'
       AND (
         $1 = ''
         OR u.name ILIKE '%' || $1 || '%'
         OR u.email ILIKE '%' || $1 || '%'
       )
     GROUP BY u.id, u.name, u.email
     HAVING (
       $2 = false
       OR COUNT(m.id) FILTER (WHERE m.available = true) > 0
     )
     ORDER BY name`,
    [search, openOnly]
  );

  return result.rows;
}



// Get one restaurant by ID
async function getRestaurant(id) {
  const result = await pool.query(
    `SELECT
       id,
       name,
       description,
       image_url,
       opening_time,
       closing_time,
       is_open
     FROM restaurants
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

// Get the menu for one restaurant account
async function listMenu(restaurantId) {
  const result = await pool.query(
    `SELECT
       m.id,
       m.restaurant_id,
       m.name,
       m.description,
       m.price_cents,
       m.available,
       COALESCE(NULLIF(u.name, ''), u.email) AS restaurant_name
     FROM menu_items m
     JOIN users u ON u.id = m.restaurant_id
     WHERE m.restaurant_id = $1
       AND u.role = 'restaurant'
     ORDER BY m.name`,
    [restaurantId]
  );

  return result.rows;
}


module.exports = {
  listRestaurants,
  getRestaurant,
  listMenu,
};
