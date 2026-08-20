const User = require('../models/User');
const BrandProfile = require('../models/BrandProfile');
const GeneratedPost = require('../models/GeneratedPost');
const Workspace = require('../models/Workspace');

// ─── GET /api/admin/users-stats ────────────────────────────────────────────────
// Returns a summary of all users with their subscription, credits, brand count, generation count.
const getAllUserStats = async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });

    const stats = await Promise.all(
      users.map(async (u) => {
        const userId = u._id.toString();

        // Count workspaces (brands) owned by this user
        let brandCount = 0;
        try {
          brandCount = await Workspace.countDocuments({ userEmail: u.email });
        } catch (e) {
          // BrandProfile fallback — some brands might be keyed by workspace
          try {
            brandCount = await BrandProfile.countDocuments({});
          } catch (e2) {}
        }

        // Count generated posts
        let generationCount = 0;
        try {
          // GeneratedPost is linked by workspaceId, so we find this user's workspaces first
          const userWorkspaces = await Workspace.find({ userEmail: u.email }).select('_id');
          const wsIds = userWorkspaces.map(w => w._id.toString());
          if (wsIds.length > 0) {
            generationCount = await GeneratedPost.countDocuments({ workspaceId: { $in: wsIds } });
          }
        } catch (e) {}

        return {
          id: userId,
          name: u.name || '',
          email: u.email,
          role: u.role || 'AgencyAdmin',
          plan: u.plan || 'free',
          credits: u.credits ?? 500,
          isBlocked: u.isBlocked || false,
          isVerified: u.isVerified || false,
          brandCount,
          generationCount,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        };
      })
    );

    return res.json({ success: true, data: stats, total: stats.length });
  } catch (err) {
    console.error('[Admin] getAllUserStats error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/admin/user/:id ───────────────────────────────────────────────────
// Returns detailed info for a single user including brands and generation history.
const getUserDetail = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Fetch user's workspaces (brands)
    let brands = [];
    try {
      brands = await Workspace.find({ userEmail: u.email }).sort({ createdAt: -1 });
    } catch (e) {}

    // Fetch all generated posts across all workspaces
    let generations = [];
    try {
      const wsIds = brands.map(b => b._id.toString());
      if (wsIds.length > 0) {
        generations = await GeneratedPost.find({ workspaceId: { $in: wsIds } })
          .sort({ createdAt: -1 })
          .limit(100);
      }
    } catch (e) {}

    return res.json({
      success: true,
      data: {
        user: {
          id: u._id.toString(),
          name: u.name || '',
          email: u.email,
          role: u.role || 'AgencyAdmin',
          plan: u.plan || 'free',
          credits: u.credits ?? 500,
          isBlocked: u.isBlocked || false,
          isVerified: u.isVerified || false,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        },
        brands,
        generations,
      },
    });
  } catch (err) {
    console.error('[Admin] getUserDetail error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/admin/dashboard-summary ──────────────────────────────────────────
// Quick aggregate numbers for the admin dashboard header cards.
const getDashboardSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const totalBrands = await Workspace.countDocuments({});
    const totalGenerations = await GeneratedPost.countDocuments({});

    // Plan distribution
    const planCounts = await User.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    const planDistribution = {};
    planCounts.forEach((p) => {
      planDistribution[p._id || 'free'] = p.count;
    });

    return res.json({
      success: true,
      data: {
        totalUsers,
        totalBrands,
        totalGenerations,
        planDistribution,
      },
    });
  } catch (err) {
    console.error('[Admin] getDashboardSummary error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllUserStats,
  getUserDetail,
  getDashboardSummary,
};
