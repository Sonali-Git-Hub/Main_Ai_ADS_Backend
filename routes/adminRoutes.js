const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const adminController = require('../controllers/adminController');

// ─── Admin Auth Middleware ──────────────────────────────────────────────────────
// Verifies JWT and ensures user has admin-level role (AgencyAdmin or admin).
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No auth token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ai_ads_secret_key_123');

    // Check role from token
    const allowedRoles = ['admin', 'AgencyAdmin', 'SuperAdmin'];
    if (decoded.role && allowedRoles.includes(decoded.role)) {
      req.user = decoded;
      return next();
    }

    // Fallback: check DB for role
    const user = await User.findById(decoded.userId);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    req.user = { userId: user._id.toString(), email: user.email, role: user.role };
    next();
  } catch (err) {
    console.error('[AdminAuth] Error:', err.message);
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

// ─── Routes ────────────────────────────────────────────────────────────────────
router.get('/dashboard-summary', adminAuth, adminController.getDashboardSummary);
router.get('/users-stats', adminAuth, adminController.getAllUserStats);
router.get('/user/:id', adminAuth, adminController.getUserDetail);

module.exports = router;
