const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Workspace = require('../models/Workspace');

// Default initial plans database seed data (50% Profit Margin Model)
const DEFAULT_PLANS = [
  {
    planId: 'starter',
    name: 'Starter',
    priceUSD: 9.99,
    priceINR: 799,
    billingCycle: 'monthly',
    imageCredits: 150,
    textGenerations: '1,000 Gens',
    description: 'Perfect for small business owners and creators launching their initial AI marketing & brand campaigns.',
    badge: 'Starter',
    isPopular: false,
    order: 1,
    features: [
      '150 Visual Ad Image Credits / month',
      '1,000 Text Copies, Blogs & Ad Copies',
      'Full Strategy Hub & 30-Day Marketing Roadmap',
      'Single Card Strategy Content Regenerator',
      'SEO Keyword Clustering & Content Briefs',
      'AI Website Builder (15 Pages)',
      '500 AISA Chat Copilot Messages',
      '1 Active Brand Workspace'
    ]
  },
  {
    planId: 'pro',
    name: 'Pro / Growth',
    priceUSD: 29.99,
    priceINR: 2399,
    billingCycle: 'monthly',
    imageCredits: 450,
    textGenerations: '3,000 Gens',
    description: 'Ideal for growing DTC brands and marketing managers scaling cross-channel traffic and conversions.',
    badge: 'Most Popular',
    isPopular: true,
    order: 2,
    features: [
      '450 Visual Ad Image Credits / month',
      '3,000 Text Copies, Blogs & Ad Copies',
      'Full Strategy Hub & Card Regenerator',
      'Advanced SEO Intent Clustering & Briefs',
      'AI Website Builder (50 Pages + Live Chat Edits)',
      '1,500 AISA Chat Copilot Messages',
      'Multi-Brand DNA Memory (3 Brand Workspaces)',
      'Approvals Desk & Review Queue'
    ]
  },
  {
    planId: 'agency',
    name: 'Agency / Scale',
    priceUSD: 79.99,
    priceINR: 6399,
    billingCycle: 'monthly',
    imageCredits: 1200,
    textGenerations: '8,000 Gens',
    description: 'Built for agencies and high-volume marketing teams managing multiple client brands simultaneously.',
    badge: 'Best for Agencies',
    isPopular: false,
    order: 3,
    features: [
      '1,200 Visual Ad Image Credits / month',
      '8,000 Text Copies, Blogs & Ad Copies',
      'Full Strategy Hub & Unlimited Card Regen',
      'Enterprise SEO Intent Clusters & Briefs',
      'AI Website Builder (150 Pages + Live Chat Edits)',
      '5,000 AISA Chat Copilot Messages',
      'Multi-Brand Workspaces (10 Brands)',
      'Team RBAC & Client Approvals Desk',
      'Centralized Asset Library'
    ]
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    priceUSD: 199.99,
    priceINR: 15999,
    billingCycle: 'monthly',
    imageCredits: 3000,
    textGenerations: 'Unlimited',
    description: 'Tailored for large organizations requiring custom SLAs, unlimited copy generation, and high volume image assets.',
    badge: 'Enterprise',
    isPopular: false,
    order: 4,
    features: [
      '3,000 Visual Ad Image Credits / month',
      'Unlimited Text Copies, Blogs & Ad Copies',
      'Unlimited Strategy Hub 30-Day Roadmaps',
      'Unlimited SEO Intent Clusters & Briefs',
      'Unlimited AI Website Builder Pages',
      'Unlimited AISA Copilot Assistant',
      'Unlimited Brand DNA Memory Stores',
      'Dedicated Account Manager & 24/7 SLA'
    ]
  }
];

// ─── Memory Fallback Store ──────────────────────────────────────────────────
let memoryPlans = [...DEFAULT_PLANS];

// Helper: Seed plans into database if empty
const ensurePlansSeeded = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const count = await Plan.countDocuments();
      if (count === 0) {
        console.log('[Plans Engine] Seeding subscription plans into MongoDB...');
        await Plan.insertMany(DEFAULT_PLANS);
      }
    }
  } catch (err) {
    console.warn('[Plans Engine] MongoDB plan seed note:', err.message);
  }
};

// ─── GET /api/plans ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await ensurePlansSeeded();
    let plans = [];
    if (mongoose.connection.readyState === 1) {
      plans = await Plan.find({}).sort({ order: 1 });
    }
    if (!plans || plans.length === 0) {
      plans = memoryPlans;
    }
    res.json({ success: true, plans });
  } catch (err) {
    console.error('[Get Plans Error]:', err.message);
    res.json({ success: true, plans: memoryPlans });
  }
});

// ─── POST /api/plans/subscribe ──────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  const { workspaceId, planId } = req.body || {};
  try {
    await ensurePlansSeeded();
    let targetPlan = null;

    if (mongoose.connection.readyState === 1) {
      targetPlan = await Plan.findOne({ planId });
    }
    if (!targetPlan) {
      targetPlan = memoryPlans.find(p => p.planId === planId) || memoryPlans[0];
    }

    if (workspaceId && mongoose.Types.ObjectId.isValid(workspaceId) && mongoose.connection.readyState === 1) {
      await Workspace.findByIdAndUpdate(workspaceId, {
        subscriptionTier: targetPlan.name,
        visualCredits: targetPlan.imageCredits
      });
    }

    res.json({
      success: true,
      message: `Successfully subscribed to ${targetPlan.name} plan.`,
      plan: targetPlan
    });
  } catch (err) {
    console.error('[Subscribe Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
