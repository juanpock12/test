const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET, authenticate, requireRole } = require('./auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, role, name } = req.body;

  // Input validation
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password and role are required' });
  }
  if (!['customer', 'restaurant'].includes(role)) {
    return res.status(400).json({ error: 'Role must be customer or restaurant' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash the password, never store it as plain text
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      [email, passwordHash, role, name || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    // Same message for "no such user" and "wrong password", so attackers
    // can't tell which emails are registered.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Short-lived token containing the user's id and role
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Any logged-in user can see their own details from the token
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Only restaurants can reach this (proves role checks work)
router.get('/restaurant-only', authenticate, requireRole('restaurant'), (req, res) => {
  res.json({ message: 'Welcome, restaurant!' });
});

// View your own full profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, name, phone FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Update your own profile
router.put('/profile', authenticate, async (req, res) => {
  const { name, phone } = req.body;

  // Input validation
  if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
    return res.status(400).json({ error: 'Name must be text up to 100 characters' });
  }
  if (phone !== undefined && !/^[0-9+ ()-]{6,20}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone number is not valid' });
  }

  try {
    const current = await pool.query('SELECT name, phone FROM users WHERE id = $1', [req.user.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newName = name !== undefined ? name.trim() : current.rows[0].name;
    const newPhone = phone !== undefined ? phone : current.rows[0].phone;

    const result = await pool.query(
      'UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING id, email, role, name, phone',
      [newName, newPhone, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;