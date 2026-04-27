/**
 * JWT Authentication Middleware
 * Protects admin routes with Bearer token auth
 */
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'quizforge_dev_secret_change_in_production';

/**
 * Generate JWT for an admin user
 */
const generateToken = (admin) => {
  return jwt.sign(
    { id: admin._id, email: admin.email, tenantId: admin.tenantId, role: admin.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Middleware — requires valid JWT in Authorization header
 * Sets req.admin with the authenticated admin user
 */
const requireAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authenticated. Please login.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: 'Account not found or deactivated.' });
    }

    req.admin = admin;
    // Override tenantId from JWT to prevent tenant spoofing
    req.tenantId = admin.tenantId;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
    }
    res.status(500).json({ success: false, error: 'Auth error.' });
  }
};

/**
 * Optional auth — doesn't block request if no token, but sets req.admin if present
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = await Admin.findById(decoded.id);
    }
  } catch {
    // Silently continue without auth
  }
  next();
};

module.exports = { generateToken, requireAuth, optionalAuth, JWT_SECRET };
