// End-to-end tests for the Orders API. Needs the backend running (npm start / node server.js).
// Run from the backend folder:   node --test src/orders/orders.api.test.js
// Uses throwaway accounts with random emails (test-...@example.com).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.API_URL || 'http://localhost:3000/api';
const rnd = () => Math.random().toString(36).slice(2, 10);

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function account(role) {
  const email = `test-${role}-${rnd()}@example.com`;
  await call('POST', '/users/register', null, { email, password: 'password123', role, name: `Test ${role}` });
  const r = await call('POST', '/users/login', null, { email, password: 'password123' });
  return { token: r.body.token, id: r.body.user.id, email };
}

let customer, restaurant, otherRestaurant, menu, available;
const order = (extra = {}) => ({
  restaurantId: restaurant.id,
  items: [{ menuItemId: available[0].id, qty: 2 }, { menuItemId: available[1].id, qty: 1 }],
  paymentMethod: 'CAMPUS_CARD',
  idempotencyKey: 'key-' + rnd(),
  ...extra,
});

before(async () => {
  customer = await account('customer');
  restaurant = await account('restaurant');
  otherRestaurant = await account('restaurant');
  // Sample menu for the test restaurant (normally from the Restaurants module)
  const { setup } = require('./setup');
  await setup(restaurant.email);
  const all = await call('GET', '/orders/menu', customer.token);
  menu = all.body.filter((m) => String(m.restaurant_id) === String(restaurant.id));
  available = menu.filter((m) => m.available).sort((a, b) => a.price_cents - b.price_cents);
});

after(() => require('../db').end());

test('must be logged in, and only customers can order', async () => {
  assert.equal((await call('POST', '/orders', null, order())).status, 401);
  assert.equal((await call('POST', '/orders', restaurant.token, order())).status, 403);
});

test('order is paid, total comes from database prices, restaurant is notified', async () => {
  const r = await call('POST', '/orders', customer.token, order());
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'RECEIVED');
  assert.equal(r.body.paid, true);
  assert.equal(r.body.total_cents, available[0].price_cents * 2 + available[1].price_cents);
  const n = await call('GET', '/orders/notifications', restaurant.token);
  assert.ok(n.body.some((x) => x.message.startsWith(`New order #${r.body.id}`)));
});

test('double click with the same key creates only one order', async () => {
  const body = order();
  const [a, b] = await Promise.all([call('POST', '/orders', customer.token, body), call('POST', '/orders', customer.token, body)]);
  assert.equal(a.body.id, b.body.id);
});

test('declined payment -> PAYMENT_FAILED, hidden from restaurant; retry succeeds', async () => {
  const r = await call('POST', '/orders', customer.token, order({ paymentMethod: 'TEST_CARD_DECLINED' }));
  assert.equal(r.body.status, 'PAYMENT_FAILED');
  const q = await call('GET', '/orders/restaurant', restaurant.token);
  assert.ok(!q.body.some((o) => o.id === r.body.id));
  const retry = await call('POST', `/orders/${r.body.id}/pay`, customer.token, { paymentMethod: 'CAMPUS_CARD' });
  assert.equal(retry.body.status, 'RECEIVED');
  assert.equal(retry.body.paid, true);
});

test('restaurant moves status RECEIVED -> PREPARING -> READY -> COMPLETED', async () => {
  const { body: o } = await call('POST', '/orders', customer.token, order());
  for (const s of ['PREPARING', 'READY', 'COMPLETED']) {
    const r = await call('PATCH', `/orders/${o.id}/status`, restaurant.token, {});
    assert.equal(r.body.status, s);
  }
  assert.equal((await call('PATCH', `/orders/${o.id}/status`, restaurant.token, {})).status, 400);
  const n = await call('GET', '/orders/notifications', customer.token);
  assert.ok(n.body.some((x) => x.message === `Order #${o.id} is ready for pickup!`));
});

test('another restaurant cannot see or change the order; stale version is refused', async () => {
  const { body: o } = await call('POST', '/orders', customer.token, order());
  assert.equal((await call('PATCH', `/orders/${o.id}/status`, otherRestaurant.token, {})).status, 404);
  assert.equal((await call('GET', `/orders/${o.id}`, otherRestaurant.token)).status, 404);
  assert.equal((await call('PATCH', `/orders/${o.id}/status`, restaurant.token, { expectedVersion: o.version })).status, 200);
  assert.equal((await call('PATCH', `/orders/${o.id}/status`, restaurant.token, { expectedVersion: o.version })).status, 409);
});

test('reject -> REJECTED with simulated refund and customer told', async () => {
  const { body: o } = await call('POST', '/orders', customer.token, order());
  const r = await call('POST', `/orders/${o.id}/reject`, restaurant.token, { reason: 'Out of milk.' });
  assert.equal(r.body.status, 'REJECTED');
  const n = await call('GET', '/orders/notifications', customer.token);
  assert.ok(n.body.some((x) => x.message.includes('refunded')));
});

test('sold-out items, other restaurants’ items and bad input are refused', async () => {
  const soldOut = menu.find((m) => !m.available);
  assert.equal((await call('POST', '/orders', customer.token, order({ items: [{ menuItemId: soldOut.id, qty: 1 }] }))).status, 409);
  assert.equal((await call('POST', '/orders', customer.token, order({ restaurantId: otherRestaurant.id }))).status, 400);
  assert.equal((await call('POST', '/orders', customer.token, order({ items: [{ menuItemId: available[0].id, qty: 99 }] }))).status, 400);
  assert.equal((await call('POST', '/orders', customer.token, order({ paymentMethod: 'FREE' }))).status, 400);
});

test('customer sees only their own orders', async () => {
  const mine = await call('GET', '/orders/mine', customer.token);
  assert.ok(mine.body.length >= 5);
  assert.ok(mine.body.every((o) => String(o.customer_id) === String(customer.id)));
  const other = await account('customer');
  assert.equal((await call('GET', '/orders/mine', other.token)).body.length, 0);
});
