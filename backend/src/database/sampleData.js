
const pool = require("../db");

async function sampleData() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check whether sample restaurants have already been added
    const existing = await client.query(
      "SELECT COUNT(*) FROM restaurants"
    );

    if (Number(existing.rows[0].count) > 0) {
      console.log("Restaurants already exist. No sample data added.");
      await client.query("ROLLBACK");
      return;
    }

    // Add restaurants
    const cafe = await client.query(
      `INSERT INTO restaurants
       (name, description, opening_time, closing_time, is_open)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        "Campus Café",
        "Coffee, sandwiches and fresh lunches.",
        "08:00",
        "17:00",
        true
      ]
    );

    const pizza = await client.query(
      `INSERT INTO restaurants
       (name, description, opening_time, closing_time, is_open)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        "Pizza Corner",
        "Freshly made pizzas and Italian favourites.",
        "11:00",
        "20:00",
        true
      ]
    );

    const green = await client.query(
      `INSERT INTO restaurants
       (name, description, opening_time, closing_time, is_open)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        "Green Kitchen",
        "Healthy meals, salads and vegetarian options.",
        "10:00",
        "16:00",
        true
      ]
    );

    // Add food items belonging to each restaurant
    const menuItems = [
      [cafe.rows[0].id, "Chicken Wrap", "Grilled chicken wrap", 6.50, "Lunch"],
      [cafe.rows[0].id, "Caesar Salad", "Fresh salad with Caesar dressing", 7.00, "Lunch"],
      [cafe.rows[0].id, "Cappuccino", "Freshly brewed coffee with milk", 3.20, "Drinks"],

      [pizza.rows[0].id, "Margherita Pizza", "Tomato, mozzarella and basil", 9.50, "Pizza"],
      [pizza.rows[0].id, "Pepperoni Pizza", "Tomato, mozzarella and pepperoni", 11.00, "Pizza"],
      [pizza.rows[0].id, "Garlic Bread", "Toasted garlic bread", 4.00, "Sides"],

      [green.rows[0].id, "Buddha Bowl", "Rice, vegetables and avocado", 8.50, "Lunch"],
      [green.rows[0].id, "Greek Salad", "Tomatoes, cucumber and feta", 7.50, "Salads"],
      [green.rows[0].id, "Fruit Smoothie", "Fresh mixed fruit smoothie", 4.50, "Drinks"]
    ];

    for (const item of menuItems) {
      await client.query(
        `INSERT INTO menu_items
         (restaurant_id, name, description, price, category)
         VALUES ($1, $2, $3, $4, $5)`,
        item
      );
    }

    await client.query("COMMIT");

    console.log("Sample restaurants and menu items added successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error adding sample data:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

sampleData();
