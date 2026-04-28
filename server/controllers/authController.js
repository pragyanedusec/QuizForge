/**
 * Auth Controller
 * Handles admin registration, login, and profile
 */
const Admin = require('../models/Admin');
const { generateToken } = require('../middleware/auth');

/**
 * Register a new admin
 * POST /auth/register
 */
exports.register = async (req, res) => {
  try {
    if (process.env.ALLOW_ADMIN_REGISTRATION !== 'true') {
      return res.status(403).json({
        success: false,
        error: 'Admin registration is disabled. Ask an existing admin to create your account.',
      });
    }

    const { email, password, name, tenantId = 'default' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Email, password, and name are required' });
    }

    // Check if admin exists
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const admin = await Admin.create({ email, password, name, tenantId });
    const token = generateToken(admin);

    res.status(201).json({
      success: true,
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name, tenantId: admin.tenantId, role: admin.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Login admin
 * POST /auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email, isActive: true }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin);

    res.json({
      success: true,
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name, tenantId: admin.tenantId, role: admin.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get current admin profile
 * GET /auth/me
 */
exports.getMe = async (req, res) => {
  res.json({
    success: true,
    admin: { id: req.admin._id, email: req.admin.email, name: req.admin.name, tenantId: req.admin.tenantId, role: req.admin.role },
  });
};
