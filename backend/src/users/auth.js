const jwt = require('jsonwebtoken');

// Prototype secret. In production this would come from AWS Secrets Manager.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

// Checks the request has a valid token and attaches the user to the request
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Login required' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Only lets through users with one of the allowed roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this' });
    }
    next();
  };
}

module.exports = { JWT_SECRET, authenticate, requireRole };