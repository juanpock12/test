// Orders API, mounted at /api/orders in server.js
const express = require('express');
const { authenticate, requireRole } = require('../users/auth');
const orders = require('./service');

const router = express.Router();

// Turns service errors into clean JSON responses, like the users routes do
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof orders.OrderError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

const orderId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new orders.OrderError(400, 'Invalid order id');
  return id;
};

const version = (v) => (v === undefined || v === null ? null : Number.isInteger(v) ? v : NaN);

// Customer: place an order (payment is simulated straight away)
router.post('/', authenticate, requireRole('customer'), handle(async (req, res) => {
  res.status(201).json(await orders.placeOrder(req.user.id, req.body));
}));

// Customer: my orders (order history)
router.get('/mine', authenticate, requireRole('customer'), handle(async (req, res) => {
  res.json(await orders.listForCustomer(req.user.id));
}));

// Restaurant: incoming orders (paid only)
router.get('/restaurant', authenticate, requireRole('restaurant'), handle(async (req, res) => {
  res.json(await orders.listForRestaurant(req.user.id));
}));

// Anyone logged in: my notifications
router.get('/notifications', authenticate, handle(async (req, res) => {
  res.json(await orders.listNotifications(req.user.id));
}));

router.post('/notifications/read', authenticate, handle(async (req, res) => {
  await orders.markNotificationsRead(req.user.id);
  res.json({ ok: true });
}));

// One order (only its customer or its restaurant can see it)
router.get('/:id', authenticate, handle(async (req, res) => {
  res.json(await orders.getOrderFor(req.user, orderId(req)));
}));

// Customer: retry a failed payment
router.post('/:id/pay', authenticate, requireRole('customer'), handle(async (req, res) => {
  res.json(await orders.retryPayment(req.user.id, orderId(req), req.body.paymentMethod));
}));

// Restaurant: move to the next status (RECEIVED -> PREPARING -> READY -> COMPLETED)
router.patch('/:id/status', authenticate, requireRole('restaurant'), handle(async (req, res) => {
  const v = version(req.body.expectedVersion);
  if (Number.isNaN(v)) return res.status(400).json({ error: 'expectedVersion must be a whole number' });
  res.json(await orders.advanceStatus(req.user.id, orderId(req), v));
}));

// Restaurant: reject a new order (simulated refund)
router.post('/:id/reject', authenticate, requireRole('restaurant'), handle(async (req, res) => {
  const v = version(req.body.expectedVersion);
  if (Number.isNaN(v)) return res.status(400).json({ error: 'expectedVersion must be a whole number' });
  res.json(await orders.rejectOrder(req.user.id, orderId(req), req.body.reason, v));
}));

module.exports = router;
