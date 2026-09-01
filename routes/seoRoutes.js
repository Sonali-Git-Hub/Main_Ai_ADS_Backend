/**
 * SEO Intelligence Routes
 * AI-powered keyword clustering, single keyword regeneration, and SEO brief generation
 */
const express = require('express');
const router = express.Router();
const { generateSeoBrief, generateKeywordClusters, regenerateSingleKeyword } = require('../modules/seo/vertex.service');

// Try to load Content model for saving briefs to DB
let Content = null;
try {
  Content = require('../models/Content');
} catch (e) {
  console.log('Content model not available for SEO brief persistence');
}

// ─── POST /api/seo/keywords/cluster ────────────────────────────────────────────
// Generate AI-powered keyword clusters from seed keyword + brand context
router.post('/keywords/cluster', async (req, res) => {
  try {
    const { seedKeyword, brandName, industry, contentPillars, existingBrandKeywords, competitorLandscape, positioningSummary, targetAudience, count } = req.body;

    if (!seedKeyword) {
      return res.status(400).json({ success: false, error: 'seedKeyword is required' });
    }

    console.log(`🔍 SEO Keyword Cluster request (Brand + Competitor Gap): "${seedKeyword}" for brand "${brandName || 'Unknown'}"`);

    const result = await generateKeywordClusters({
      seedKeyword,
      brandName: brandName || 'Brand',
      industry: industry || 'General',
      contentPillars: contentPillars || [],
      existingBrandKeywords: existingBrandKeywords || [],
      competitorLandscape: competitorLandscape || [],
      positioningSummary: positioningSummary || '',
      targetAudience: targetAudience || 'General Audience',
      count: count || 8
    });

    res.json(result);
  } catch (err) {
    console.error('SEO Keyword Cluster Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/seo/keywords/regenerate ─────────────────────────────────────────
// Regenerate a single keyword using AI (avoiding duplicates)
router.post('/keywords/regenerate', async (req, res) => {
  try {
    const { brandName, industry, seedKeyword, existingKeywords, targetAudience } = req.body;

    console.log(`🔄 SEO Single Keyword Regen for "${brandName || 'Brand'}"`);

    const result = await regenerateSingleKeyword({
      brandName: brandName || 'Brand',
      industry: industry || 'General',
      seedKeyword: seedKeyword || '',
      existingKeywords: existingKeywords || [],
      targetAudience: targetAudience || 'General Audience'
    });

    res.json(result);
  } catch (err) {
    console.error('SEO Keyword Regenerate Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/seo/brief/generate ──────────────────────────────────────────────
// Generate a comprehensive AI-powered SEO brief
router.post('/brief/generate', async (req, res) => {
  try {
    const { primaryKeyword, keyword, industry, targetAudience, workspaceId, model, intent, brandName, contentPillars, brandVoice } = req.body;

    const kw = primaryKeyword || keyword;
    if (!kw) {
      return res.status(400).json({ success: false, error: 'primaryKeyword or keyword is required' });
    }

    console.log(`📝 SEO Brief generation: "${kw}" for brand "${brandName || 'Unknown'}"`);

    const brief = await generateSeoBrief({
      keyword: kw,
      intent: intent || 'Commercial',
      targetAudience: targetAudience || 'Enterprise Leaders',
      brandName: brandName || '',
      industry: industry || '',
      contentPillars: contentPillars || [],
      brandVoice: brandVoice || ''
    });

    // Persist to DB if Content model available
    if (Content) {
      try {
        await Content.create({
          title: brief.suggestedTitles?.[0] || kw,
          type: 'SEO_BRIEF',
          briefData: brief,
          author: `${brief.model || 'Gemini'} SEO Engine`,
          status: 'APPROVED'
        });
        console.log(`🍃 SEO Brief Saved to MongoDB Atlas: "${brief.primaryKeyword}"`);
      } catch (dbErr) {
        console.log('SEO Brief DB Save Note:', dbErr.message);
      }
    }

    res.json({ success: true, brief });
  } catch (err) {
    console.error('SEO Brief Generation Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
