const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Optional authentication middleware.
 * If Authorization header contains Bearer <token>, verifies token & sets req.user.
 * If no token or invalid token, sets req.user = null and calls next().
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ai_ads_secret_key_123');
      if (decoded && (decoded.userId || decoded.id)) {
        const uId = decoded.userId || decoded.id;
        let user = null;
        try {
          user = await User.findById(uId).select('_id email name role');
        } catch (e) {}

        if (!user && decoded.email) {
          try {
            user = await User.findOne({ email: decoded.email.toLowerCase() }).select('_id email name role');
          } catch (e) {}
        }

        if (user) {
          req.user = {
            _id: user._id,
            userId: user._id.toString(),
            email: user.email,
            name: user.name || user.email.split('@')[0],
            role: user.role
          };
        }
      }
    }
  } catch (err) {
    req.user = null;
  }
  next();
};

/**
 * Required authentication middleware.
 * Mandates valid JWT token and populates req.user. Rejects 401 if missing/invalid.
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required. No auth token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ai_ads_secret_key_123');
    const uId = decoded.userId || decoded.id;
    let user = null;
    try {
      user = await User.findById(uId).select('_id email name role');
    } catch (e) {}

    if (!user && decoded.email) {
      try {
        user = await User.findOne({ email: decoded.email.toLowerCase() }).select('_id email name role');
      } catch (e) {}
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'User account not found.' });
    }

    req.user = {
      _id: user._id,
      userId: user._id.toString(),
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: user.role
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
  }
};

module.exports = {
  optionalAuth,
  requireAuth
};
