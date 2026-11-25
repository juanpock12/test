// Orders service: business rules for placing, paying and progressing orders.
// Stands in for the "Orders Service (ECS Fargate)" in our AWS architecture.
//
//   ORDER_PLACED -> [order-events topic] -+-> payments-queue      -> simulated payment
//                                         +-> notifications-queue -> in-app notifications
const crypto = require('crypto');
const pool = require('../db');
const { OrderEventTopic } = require('./eventBus');

const PAYMENT_METHODS = ['CAMPUS_CARD', 'TEST_CARD', 'TEST_CARD_DECLINED'];
const NEXT_STATUS = { RECEIVED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' };
const STATUS_LABELS = {
  PENDING_PAYMENT: 'Awaiting payment', PAYMENT_FAILED: 'Payment failed', RECEIVED: 'Received',
  PREPARING: 'Preparing', READY: 'Ready for pickup', COMPLETED: 'Completed', REJECTED: 'Rejected (refunded)',
};

class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const topic = new OrderEventTopic();

// ---------- reads ----------
const ORDER_SELECT = `
  SELECT o.id, o.customer_id, o.restaurant_id, o.status, o.total_cents, o.paid, o.version,
         o.created_at, o.updated_at,
         COALESCE(NULLIF(r.name, ''), r.email) AS restaurant_name,
         COALESCE(NULLIF(c.name, ''), c.email) AS customer_name,
         COALESCE((SELECT json_agg(json_build_object('menuItemId', i.menu_item_id, 'name', i.name,
                     'unitPriceCents', i.unit_price_cents, 'qty', i.qty) ORDER BY i.id)
                   FROM order_items i WHERE i.order_id = o.id), '[]') AS items
    FROM orders o
    JOIN users r ON r.id = o.restaurant_id
    JOIN users c ON c.id = o.customer_id`;

async function getOrder(orderId) {
  const r = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  return r.rows[0] || null;
}

async function getOrderFor(user, orderId) {
  const order = await getOrder(orderId);
  // Same "not found" answer for someone else's order, so ids can't be probed
  const mine =
    order &&
    ((user.role === 'customer' && String(order.customer_id) === String(user.id)) ||
      (user.role === 'restaurant' && String(order.restaurant_id) === String(user.id)));
  if (!mine) throw new OrderError(404, 'Order not found');
  return order;
}

async function listForCustomer(customerId) {
  const r = await pool.query(`${ORDER_SELECT} WHERE o.customer_id = $1 ORDER BY o.created_at DESC, o.id DESC`, [customerId]);
  return r.rows;
}

// Restaurants never see orders that have not been paid
async function listForRestaurant(restaurantId) {
  const r = await pool.query(
    `${ORDER_SELECT} WHERE o.restaurant_id = $1 AND o.status NOT IN ('PENDING_PAYMENT', 'PAYMENT_FAILED')
     ORDER BY o.created_at DESC, o.id DESC`,
    [restaurantId]
  );
  return r.rows;
}

// ---------- customer actions ----------
async function placeOrder(customerId, body) {
  const { restaurantId, items, paymentMethod, idempotencyKey } = body || {};

  // Input validation
  if (!restaurantId) throw new OrderError(400, 'restaurantId is required');
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    throw new OrderError(400, 'Order must contain between 1 and 20 items');
  }
  for (const it of items) {
    if (!Number.isInteger(it.menuItemId) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20) {
      throw new OrderError(400, 'Each item needs a menuItemId and a quantity from 1 to 20');
    }
  }
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new OrderError(400, 'Unknown payment method');
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw new OrderError(400, 'idempotencyKey is required');
  }

  // Same key = same order (a double-click never creates two orders)
  const existing = await pool.query('SELECT id, customer_id FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
  if (existing.rows[0]) {
    if (String(existing.rows[0].customer_id) !== String(customerId)) throw new OrderError(409, 'Duplicate request');
    return getOrder(existing.rows[0].id);
  }

  // Prices always come from the database, never from the browser
  const ids = items.map((it) => it.menuItemId);
  const menu = await pool.query(
    'SELECT id, restaurant_id, name, price_cents, available FROM menu_items WHERE id = ANY($1::int[])',
    [ids]
  );
  const byId = new Map(menu.rows.map((m) => [m.id, m]));
  let totalCents = 0;
  const lines = items.map((it) => {
    const m = byId.get(it.menuItemId);
    if (!m) throw new OrderError(400, 'An item in your basket no longer exists');
    if (String(m.restaurant_id) !== String(restaurantId)) throw new OrderError(400, 'All items must come from one restaurant');
    if (!m.available) throw new OrderError(409, `${m.name} has just sold out`);
    totalCents += m.price_cents * it.qty;
    return { menu_item_id: m.id, name: m.name, unit_price_cents: m.price_cents, qty: it.qty };
  });

  // Order + its items in ONE statement, so it is all-or-nothing
  const inserted = await pool.query(
    `WITH o AS (
       INSERT INTO orders (customer_id, restaurant_id, status, total_cents, idempotency_key)
       VALUES ($1, $2, 'PENDING_PAYMENT', $3, $4)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id
     ), i AS (
       INSERT INTO order_items (order_id, menu_item_id, name, unit_price_cents, qty)
       SELECT o.id, x.menu_item_id, x.name, x.unit_price_cents, x.qty
         FROM o, json_to_recordset($5::json) AS x(menu_item_id int, name text, unit_price_cents int, qty int)
       RETURNING 1
     )
     SELECT id FROM o`,
    [customerId, restaurantId, totalCents, idempotencyKey, JSON.stringify(lines)]
  );
  if (!inserted.rows[0]) {
    // A parallel double-click won the race: return that order
    const again = await pool.query('SELECT id FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
    return getOrder(again.rows[0].id);
  }

  const order = await getOrder(inserted.rows[0].id);
  await topic.publish({ type: 'ORDER_PLACED', order, method: paymentMethod });
  return getOrder(order.id);
}

async function retryPayment(customerId, orderId, paymentMethod) {
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new OrderError(400, 'Unknown payment method');
  const order = await getOrderFor({ role: 'customer', id: customerId }, orderId);
  if (order.paid) return order;
  if (order.status !== 'PAYMENT_FAILED') throw new OrderError(409, 'This order is not waiting for payment');
  await pool.query(
    "UPDATE orders SET status = 'PENDING_PAYMENT', version = version + 1, updated_at = now() WHERE id = $1",
    [orderId]
  );
  await topic.publish({ type: 'ORDER_PLACED', order: await getOrder(orderId), method: paymentMethod });
  return getOrder(orderId);
}

// ---------- restaurant actions ----------
async function advanceStatus(restaurantId, orderId, expectedVersion) {
  const r = await pool.query(
    `UPDATE orders
        SET status = CASE status WHEN 'RECEIVED' THEN 'PREPARING' WHEN 'PREPARING' THEN 'READY'
                                 WHEN 'READY' THEN 'COMPLETED' END,
            version = version + 1, updated_at = now()
      WHERE id = $1 AND restaurant_id = $2 AND status IN ('RECEIVED', 'PREPARING', 'READY')
        AND ($3::int IS NULL OR version = $3::int)
      RETURNING id`,
    [orderId, restaurantId, expectedVersion ?? null]
  );
  if (!r.rows[0]) await explainFailedUpdate(restaurantId, orderId, expectedVersion, NEXT_STATUS);
  const order = await getOrder(orderId);
  const from = Object.keys(NEXT_STATUS).find((k) => NEXT_STATUS[k] === order.status);
  await topic.publish({ type: 'ORDER_STATUS_CHANGED', order, from });
  return order;
}

async function rejectOrder(restaurantId, orderId, reason, expectedVersion) {
  const why = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 200) : 'The restaurant could not accept your order.';
  // Reject + simulated refund in one statement
  const r = await pool.query(
    `WITH u AS (
       UPDATE orders SET status = 'REJECTED', paid = FALSE, version = version + 1, updated_at = now()
        WHERE id = $1 AND restaurant_id = $2 AND status = 'RECEIVED'
          AND ($3::int IS NULL OR version = $3::int)
        RETURNING id, total_cents
     ), p AS (
       INSERT INTO payments (order_id, transaction_id, method, amount_cents, result)
       SELECT u.id, 'refund_' || u.id, COALESCE((SELECT method FROM payments WHERE order_id = u.id
                                                  AND result = 'SUCCEEDED' LIMIT 1), 'TEST_CARD'),
              u.total_cents, 'REFUNDED'
         FROM u
       RETURNING 1
     )
     SELECT id FROM u`,
    [orderId, restaurantId, expectedVersion ?? null]
  );
  if (!r.rows[0]) await explainFailedUpdate(restaurantId, orderId, expectedVersion, { RECEIVED: 'REJECTED' });
  const order = await getOrder(orderId);
  await topic.publish({ type: 'ORDER_REJECTED', order, reason: why });
  return order;
}

// Works out WHY an update matched no row, and throws the right error
async function explainFailedUpdate(restaurantId, orderId, expectedVersion, allowedFrom) {
  const order = await getOrder(orderId);
  if (!order || String(order.restaurant_id) !== String(restaurantId)) throw new OrderError(404, 'Order not found');
  if (expectedVersion != null && order.version !== expectedVersion) {
    throw new OrderError(409, 'Someone else updated this order. Refresh and try again.');
  }
  if (!allowedFrom[order.status]) throw new OrderError(400, `Cannot change an order that is "${STATUS_LABELS[order.status]}"`);
  throw new OrderError(409, 'Order changed, please refresh');
}

// ---------- payments consumer (simulated payment provider) ----------
function decidePayment(method, amountCents) {
  return {
    transactionId: 'txn_' + crypto.randomBytes(6).toString('hex'),
    method,
    amountCents,
    result: method === 'TEST_CARD_DECLINED' ? 'FAILED' : 'SUCCEEDED',
  };
}

async function recordPayment(orderId, payment) {
  // Locks the row and skips orders that are already paid -> never charged twice
  const r = await pool.query(
    `WITH cur AS (
       SELECT id FROM orders WHERE id = $1 AND NOT paid AND status = 'PENDING_PAYMENT' FOR UPDATE
     ), p AS (
       INSERT INTO payments (order_id, transaction_id, method, amount_cents, result)
       SELECT id, $2, $3, $4, $5 FROM cur RETURNING 1
     )
     UPDATE orders
        SET paid = ($5 = 'SUCCEEDED'),
            status = CASE WHEN $5 = 'SUCCEEDED' THEN 'RECEIVED' ELSE 'PAYMENT_FAILED' END,
            version = version + 1, updated_at = now()
      WHERE id IN (SELECT id FROM cur)
      RETURNING id`,
    [orderId, payment.transactionId, payment.method, payment.amountCents, payment.result]
  );
  if (!r.rows[0]) return; // already handled
  const order = await getOrder(orderId);
  await topic.publish({ type: payment.result === 'SUCCEEDED' ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_FAILED', order });
}

topic.subscribe('payments-queue', async (event) => {
  if (event.type !== 'ORDER_PLACED') return;
  await recordPayment(event.order.id, decidePayment(event.method, event.order.total_cents));
});

// ---------- notifications consumer ----------
const euro = (cents) => `€${(cents / 100).toFixed(2)}`;

async function notify(userId, orderId, message) {
  await pool.query('INSERT INTO notifications (user_id, order_id, message) VALUES ($1, $2, $3)', [userId, orderId, message]);
}

topic.subscribe('notifications-queue', async (event) => {
  const o = event.order;
  const ref = `#${o.id}`;
  switch (event.type) {
    case 'PAYMENT_SUCCEEDED':
      await notify(o.customer_id, o.id, `Payment successful. Order ${ref} has been sent to ${o.restaurant_name}.`);
      await notify(o.restaurant_id, o.id, `New order ${ref}: ${o.items.length} item(s), ${euro(o.total_cents)}.`);
      break;
    case 'PAYMENT_FAILED':
      await notify(o.customer_id, o.id, `Payment for order ${ref} failed. Please try another payment method.`);
      break;
    case 'ORDER_STATUS_CHANGED':
      await notify(
        o.customer_id,
        o.id,
        o.status === 'READY' ? `Order ${ref} is ready for pickup!` : `Order ${ref} is now: ${STATUS_LABELS[o.status]}.`
      );
      break;
    case 'ORDER_REJECTED':
      await notify(o.customer_id, o.id, `Order ${ref} was rejected: ${event.reason} You have been refunded (simulated).`);
      break;
    default:
      break; // ORDER_PLACED: nothing to tell anyone until payment is decided
  }
});

async function listNotifications(userId) {
  const r = await pool.query(
    'SELECT id, order_id, message, read, created_at FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 30',
    [userId]
  );
  return r.rows;
}

async function markNotificationsRead(userId) {
  await pool.query('UPDATE notifications SET read = TRUE WHERE user_id = $1 AND NOT read', [userId]);
}

module.exports = {
  OrderError, topic, PAYMENT_METHODS,
  getOrderFor, listForCustomer, listForRestaurant, 
  placeOrder, retryPayment, advanceStatus, rejectOrder,
  listNotifications, markNotificationsRead,
};
