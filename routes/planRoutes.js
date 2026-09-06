const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Workspace = require('../models/Workspace');

// Official Platform Subscription Plans Database Seed Data
const DEFAULT_PLANS = [
  {
    planId: 'base',
    name: 'Starter',
    badge: 'Starter',
    subtitle: 'Core AI text generation & 150 monthly visual credits for solo creators',
    priceUSD: 9.99,
    priceINR: 799,
    prices: {
      INR: { primary: '₹799', period: '/month', secondary: '($9.99/mo)' },
      USD: { primary: '$9.99', period: '/month', secondary: '(₹799/mo)' },
      EUR: { primary: '€8.99', period: '/month', secondary: '($9.99/mo)' },
      GBP: { primary: '£7.99', period: '/month', secondary: '($9.99/mo)' },
      CAD: { primary: 'CA$12.99', period: '/month', secondary: '($9.99/mo)' },
      AUD: { primary: 'A$14.99', period: '/month', secondary: '($9.99/mo)' },
      AED: { primary: 'AED 36.99', period: '/month', secondary: '($9.99/mo)' },
    },
    billingCycle: 'monthly',
    imageCredits: 150,
    textGenerations: '1,000 Gens / mo',
    description: 'Core AI text generation & 150 monthly visual credits for solo creators',
    isPopular: false,
    order: 1,
    features: [
      '150 Monthly Visual Credits (AI Image & Ad Creative Generator)',
      '1,000 Text Generations / mo (Social Posts, Blogs, Emails & Ads)',
      '3 Brand DNA Workspaces (Website Scraper & Tone Ingestion)',
      '30-Day Marketing Roadmap Generator (Strategy Hub)',
      'SEO Intelligence (Keyword Clusters & Content Briefs)',
      'Content Studio (Social Copy, Blogs & Sales Copy Generators)',
      'AISA™ Copilot AI Assistant & Drag-and-Drop Calendar'
    ]
  },
  {
    planId: 'professional',
    name: 'Pro / Growth',
    badge: 'Growth Tier',
    subtitle: 'Multi-brand DNA, 450 visual credits, Campaign Builder & Approvals Desk',
    priceUSD: 29.99,
    priceINR: 2399,
    prices: {
      INR: { primary: '₹2,399', period: '/month', secondary: '($29.99/mo)' },
      USD: { primary: '$29.99', period: '/month', secondary: '(₹2,399/mo)' },
      EUR: { primary: '€26.99', period: '/month', secondary: '($29.99/mo)' },
      GBP: { primary: '£22.99', period: '/month', secondary: '($29.99/mo)' },
      CAD: { primary: 'CA$39.99', period: '/month', secondary: '($29.99/mo)' },
      AUD: { primary: 'A$44.99', period: '/month', secondary: '($29.99/mo)' },
      AED: { primary: 'AED 109.99', period: '/month', secondary: '($29.99/mo)' },
    },
    billingCycle: 'monthly',
    imageCredits: 450,
    textGenerations: '3,000 Gens / mo',
    description: 'Multi-brand DNA, 450 visual credits, Campaign Builder & Approvals Desk',
    isPopular: false,
    order: 2,
    features: [
      '450 Monthly Visual Credits (Creative Studio + Aspect Controls)',
      '3,000 Text Generations / mo (Full Content & Copy Suite)',
      '10 Brand DNA Workspaces (Multi-Brand Tone & Scraping)',
      'Campaign Builder (Multi-Channel Planner & Post Generator)',
      'AI Website Builder (Brief Analyzer & Full-Page HTML Code)',
      'Approvals Desk (Content Review Queue & Workflows)',
      'Asset Library & Performance Dashboard (KPI Metrics)'
    ]
  },
  {
    planId: 'agency_pro',
    name: 'Agency / Scale',
    badge: 'Most Popular',
    subtitle: 'Unlimited multi-client workspaces & 1,200 visual credits',
    priceUSD: 79.99,
    priceINR: 6399,
    prices: {
      INR: { primary: '₹6,399', period: '/month', secondary: '($79.99/mo)' },
      USD: { primary: '$79.99', period: '/month', secondary: '(₹6,399/mo)' },
      EUR: { primary: '€72.99', period: '/month', secondary: '($79.99/mo)' },
      GBP: { primary: '£62.99', period: '/month', secondary: '($79.99/mo)' },
      CAD: { primary: 'CA$109.99', period: '/month', secondary: '($79.99/mo)' },
      AUD: { primary: 'A$119.99', period: '/month', secondary: '($79.99/mo)' },
      AED: { primary: 'AED 289.99', period: '/month', secondary: '($79.99/mo)' },
    },
    billingCycle: 'monthly',
    imageCredits: 1200,
    textGenerations: '8,000 Gens / mo',
    description: 'Unlimited multi-client workspaces & 1,200 visual credits',
    isPopular: true,
    order: 3,
    features: [
      '1,200 Monthly Visual Credits (4x Visual Variation Engine)',
      '8,000 Text Generations / mo (High-Volume Strategy & Copy)',
      'Unlimited Multi-Client Workspaces & Brand DNA Ingestion',
      'AI Web Builder + Hero Visuals (Code + 2x Hero Visual Generator)',
      'Full Approvals Desk Queue & Workflow Management',
      'Media Asset Library with Cloud Storage'
    ]
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    badge: 'Enterprise',
    subtitle: 'High-volume generation, 3,000 visual credits & unlimited AI text generation',
    priceUSD: 199.99,
    priceINR: 15999,
    prices: {
      INR: { primary: '₹15,999', period: '/month', secondary: '($199.99/mo)' },
      USD: { primary: '$199.99', period: '/month', secondary: '(₹15,999/mo)' },
      EUR: { primary: '€179.99', period: '/month', secondary: '($199.99/mo)' },
      GBP: { primary: '£159.99', period: '/month', secondary: '($199.99/mo)' },
      CAD: { primary: 'CA$269.99', period: '/month', secondary: '($199.99/mo)' },
      AUD: { primary: 'A$299.99', period: '/month', secondary: '($199.99/mo)' },
      AED: { primary: 'AED 729.99', period: '/month', secondary: '($199.99/mo)' },
    },
    billingCycle: 'monthly',
    imageCredits: 3000,
    textGenerations: 'Unlimited',
    description: 'High-volume generation, 3,000 visual credits & unlimited AI text generation',
    isPopular: false,
    order: 4,
    features: [
      '3,000 Monthly Visual Credits (High-Volume Ad & Visual Gen)',
      'UNLIMITED Text Generations (Uncapped AI Content Engine)',
      'Unlimited Brand Workspaces & Priority Processing',
      'AI Web Builder with Live Chat Edit (Real-Time Code Tweaking)',
      'All Core Platform Modules Included (Strategy, SEO, Content, Web & Ads)'
    ]
  }
];

// ─── Memory Fallback Store ──────────────────────────────────────────────────
let memoryPlans = [...DEFAULT_PLANS];

// Helper: Seed/Sync plans into MongoDB database
const ensurePlansSeeded = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Plan.deleteMany({});
      await Plan.insertMany(DEFAULT_PLANS);
      console.log('[Plans Engine] Seeded latest subscription plans & feature checklists into MongoDB!');
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
  const { workspaceId, planId, userEmail } = req.body || {};
  try {
    await ensurePlansSeeded();
    let targetPlan = null;

    if (mongoose.connection.readyState === 1) {
      targetPlan = await Plan.findOne({ planId });
    }
    if (!targetPlan) {
      targetPlan = memoryPlans.find(p => p.planId === planId || (p.planId === 'base' && planId === 'starter')) || memoryPlans[0];
    }

    if (workspaceId && mongoose.Types.ObjectId.isValid(workspaceId) && mongoose.connection.readyState === 1) {
      await Workspace.findByIdAndUpdate(workspaceId, {
        subscriptionTier: targetPlan.name,
        visualCredits: targetPlan.imageCredits
      });
    }

    if (userEmail && mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      await User.findOneAndUpdate({ email: userEmail }, {
        plan: targetPlan.planId,
        credits: targetPlan.imageCredits
      });
    }

    res.json({
      success: true,
      message: `Successfully subscribed to ${targetPlan.name} plan. Database updated!`,
      plan: targetPlan
    });
  } catch (err) {
    console.error('[Subscribe Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
