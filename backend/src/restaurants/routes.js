
const express = require('express');
const { authenticate, requireRole } = require('../users/auth');
const restaurants = require('./service');

const router = express.Router();

// Handle errors consistently
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Check that an ID is a valid positive integer
const getId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  return id;
};

// Browse all restaurants
router.get('/', handle(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const openOnly = req.query.openOnly === 'true';

  const result = await restaurants.listRestaurants(search, openOnly);
  res.json(result);
}));

// View one restaurant
router.get('/:id', handle(async (req, res) => {
  const id = getId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Invalid restaurant ID' });
  }

  const restaurant = await restaurants.getRestaurant(id);

  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  res.json(restaurant);
}));

// View a restaurant's menu
router.get('/:id/menu', handle(async (req, res) => {
  const id = getId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Invalid restaurant ID' });
  }

  const result = await restaurants.listMenu(id);
  res.json(result);
}));

module.exports = router;
