/**
 * Brand Intelligence Controller
 * Deep AI analysis of brand identity from URL, document, or manual input.
 */
const mongoose = require('mongoose');
const BrandProfile = require('../models/BrandProfile');
const Workspace = require('../models/Workspace');
const { generate, generateJSON } = require('../services/aiService');
const axios = require('axios');
const cheerio = require('cheerio');

// ─── Scrape brand info from URL ───────────────────────────────────────────────
const scrapeBrandUrl = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIAdsBot/1.0)' },
    });
    const $ = cheerio.load(response.data);

    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href') || '';
    const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 3000);

    // Social links
    const socials = {};
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('instagram.com')) socials.instagram = href;
      if (href.includes('linkedin.com')) socials.linkedin = href;
      if (href.includes('twitter.com') || href.includes('x.com')) socials.twitter = href;
      if (href.includes('facebook.com')) socials.facebook = href;
      if (href.includes('youtube.com')) socials.youtube = href;
    });

    return {
      url,
      title: ogTitle || title,
      description: ogDesc || metaDesc,
      bodyText,
      favicon: favicon.startsWith('http') ? favicon : `${url}/${favicon}`,
      socialLinks: socials,
    };
  } catch (err) {
    return { url, title: '', description: '', bodyText: '', favicon: '', socialLinks: {} };
  }
};

// ─── POST /api/brand/analyze ──────────────────────────────────────────────────
exports.analyzeBrand = async (req, res) => {
  try {
    const { workspaceId, websiteUrl, companyName, manualDescription, model = 'gemini' } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'workspaceId is required' });
    }

    let scrapedData = {};
    if (websiteUrl) {
      console.log(`[Brand Intelligence] Scraping ${websiteUrl}...`);
      scrapedData = await scrapeBrandUrl(websiteUrl);
    }

    const brandInput = manualDescription || scrapedData.bodyText || scrapedData.description || '';
    const brandName = companyName || scrapedData.title || 'Unknown Brand';

    if (!brandInput && !websiteUrl) {
      return res.status(400).json({ success: false, error: 'Provide websiteUrl or manualDescription' });
    }

    const prompt = `You are an expert brand strategist. Analyze this brand and return a comprehensive brand intelligence report.

Brand: ${brandName}
Website: ${websiteUrl || 'Not provided'}
Content: ${brandInput.substring(0, 2500)}

Return a JSON object with these exact keys:
{
  "brand_name": "...",
  "industry": "...",
  "target_audience": "description of primary audience",
  "tone": "brand voice tone (e.g. Professional, Friendly, Bold)",
  "cta_style": "preferred CTA style",
  "products_services": ["product1", "product2"],
  "brand_values": ["value1", "value2"],
  "content_angles": ["angle1", "angle2", "angle3"],
  "color_palette": ["#color1", "#color2"],
  "platform_focus": ["instagram", "linkedin"],
  "posting_frequency": "daily|weekly|3x per week",
  "goal": "main business goal",
  "mission_statement": "...",
  "tagline": "...",
  "competitor_landscape": ["competitor1", "competitor2"],
  "unique_selling_points": ["usp1", "usp2"],
  "content_dos": ["do1", "do2"],
  "content_donts": ["dont1", "dont2"],
  "ai_confidence": 85
}`;

    console.log(`[Brand Intelligence] Running AI analysis for "${brandName}"...`);
    const analysisResult = await generateJSON(prompt, { model, temperature: 0.6 });

    if (!analysisResult) {
      return res.status(500).json({ success: false, error: 'AI analysis failed. Please try again.' });
    }

    // Update or create BrandProfile
    const brandData = {
      workspaceId,
      companyName: brandName,
      website: websiteUrl || '',
      extractedBrandSummary: brandInput.substring(0, 500),
      structuredIdentity: {
        brand_name: analysisResult.brand_name || brandName,
        industry: analysisResult.industry || '',
        target_audience: analysisResult.target_audience || '',
        tone: analysisResult.tone || '',
        cta_style: analysisResult.cta_style || '',
        products_services: analysisResult.products_services || [],
        brand_values: analysisResult.brand_values || [],
        content_angles: analysisResult.content_angles || [],
        color_palette: analysisResult.color_palette || [],
        platform_focus: analysisResult.platform_focus || ['instagram', 'linkedin'],
        posting_frequency: analysisResult.posting_frequency || 'daily',
        goal: analysisResult.goal || '',
      },
      socialMediaLinks: scrapedData.socialLinks || {},
      brandColors: analysisResult.color_palette || [],
      logoUrl: scrapedData.favicon || '',
      aiConfidence: analysisResult.ai_confidence || 85,
      // Intelligence sections
      companyInformation: { name: brandName, website: websiteUrl, description: brandInput.substring(0, 300) },
      brandIdentity: { tone: analysisResult.tone, tagline: analysisResult.tagline, mission: analysisResult.mission_statement },
      brandPersonality: { values: analysisResult.brand_values, usps: analysisResult.unique_selling_points },
      brandVoice: { style: analysisResult.tone, dos: analysisResult.content_dos, donts: analysisResult.content_donts },
      targetAudienceSection: { description: analysisResult.target_audience },
      products: { list: analysisResult.products_services },
      contentStrategy: { angles: analysisResult.content_angles, goal: analysisResult.goal, platforms: analysisResult.platform_focus },
      competitors: { list: analysisResult.competitor_landscape },
    };

    delete brandData._id;
    delete brandData.__v;

    let query = { workspaceId };
    if (mongoose.Types.ObjectId.isValid(workspaceId)) {
      query = { $or: [{ workspaceId }, { _id: workspaceId }] };
    }

    const profile = await BrandProfile.findOneAndUpdate(
      query,
      { $set: brandData },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Also update workspace if valid ObjectId
    if (mongoose.Types.ObjectId.isValid(workspaceId)) {
      await Workspace.findByIdAndUpdate(workspaceId, {
        brandName: brandName,
        faviconUrl: scrapedData.favicon || '',
        brandColors: analysisResult.color_palette || [],
        targetAudience: analysisResult.target_audience || '',
        brandVoiceTone: analysisResult.tone || '',
        contentPillars: analysisResult.content_angles || [],
        missionStatement: analysisResult.mission_statement || '',
        tagline: analysisResult.tagline || '',
        industryCategory: analysisResult.industry || '',
      });
    }

    console.log(`✅ Brand Intelligence Analysis Complete: "${brandName}" (confidence: ${analysisResult.ai_confidence}%)`);
    res.json({
      success: true,
      profile,
      analysis: analysisResult,
      scrapedData: { title: scrapedData.title, favicon: scrapedData.favicon, socialLinks: scrapedData.socialLinks },
    });
  } catch (err) {
    console.error('[Brand Intelligence] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/brand/:workspaceId ──────────────────────────────────────────────
exports.getBrandProfile = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, profile: null, memoryMode: true });
    }

    let profile = await BrandProfile.findOne({ workspaceId });
    if (!profile && mongoose.Types.ObjectId.isValid(workspaceId)) {
      profile = await BrandProfile.findById(workspaceId);
    }
    if (!profile) return res.json({ success: true, profile: null });
    res.json({ success: true, profile });
  } catch (err) {
    console.warn('[BrandController] DB Profile fetch fallback:', err.message);
    res.json({ success: true, profile: null, fallback: true });
  }
};

// ─── PUT /api/brand/:workspaceId ──────────────────────────────────────────────
exports.updateBrandProfile = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Strip immutable Mongo metadata fields to prevent E11000 duplicate key error
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Helper to sanitize color arrays and handle object/JSON string fallbacks cleanly
    const sanitizeColors = (arr) => {
      if (!arr) return [];
      if (typeof arr === 'string') {
        try {
          arr = JSON.parse(arr);
        } catch (e) {
          return [arr];
        }
      }
      if (!Array.isArray(arr)) return [];
      return arr.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.hex || item.color || item.code || '#6366F1';
        return String(item);
      });
    };

    if (updateData.brandColors) {
      updateData.brandColors = sanitizeColors(updateData.brandColors);
    }
    if (updateData.structuredIdentity) {
      if (updateData.structuredIdentity.color_palette) {
        updateData.structuredIdentity.color_palette = sanitizeColors(updateData.structuredIdentity.color_palette);
      }
    }

    let query = { workspaceId };
    if (mongoose.Types.ObjectId.isValid(workspaceId)) {
      query = { $or: [{ workspaceId }, { _id: workspaceId }] };
    }

    const profile = await BrandProfile.findOneAndUpdate(
      query,
      { $set: updateData },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    res.json({ success: true, profile });
  } catch (err) {
    console.error('[Update Brand Profile Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/brand/regenerate-section ───────────────────────────────────────
exports.regenerateSection = async (req, res) => {
  try {
    const { workspaceId, section, customInstruction } = req.body;
    if (!workspaceId || !section) {
      return res.status(400).json({ success: false, error: 'workspaceId and section are required' });
    }

    const profile = await BrandProfile.findOne({ workspaceId });
    if (!profile) return res.status(404).json({ success: false, error: 'Brand profile not found' });

    const brandContext = JSON.stringify(profile.structuredIdentity || {}, null, 2);

    const sectionPrompts = {
      contentStrategy: `Regenerate a comprehensive content strategy for this brand. ${customInstruction || ''}
Brand Context: ${brandContext}
Return JSON: { "angles": ["angle1", "angle2"], "goal": "...", "platforms": ["instagram"], "themes": ["theme1"] }`,
      brandVoice: `Define the brand voice and communication style. ${customInstruction || ''}
Brand Context: ${brandContext}
Return JSON: { "style": "...", "dos": ["do1"], "donts": ["dont1"], "examples": ["example1"] }`,
      targetAudience: `Define the target audience segments. ${customInstruction || ''}
Brand Context: ${brandContext}
Return JSON: { "primary": "...", "secondary": "...", "demographics": {...}, "psychographics": [...] }`,
      swot: `Perform a SWOT analysis. ${customInstruction || ''}
Brand Context: ${brandContext}
Return JSON: { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] }`,
    };

    const sectionPrompt = sectionPrompts[section] || `Regenerate the ${section} section for this brand.
Brand Context: ${brandContext}
${customInstruction || ''}
Return a JSON object with the relevant data.`;

    const result = await generateJSON(sectionPrompt, { temperature: 0.75 });
    if (!result) return res.status(500).json({ success: false, error: 'AI regeneration failed' });

    const updateField = {};
    updateField[section === 'contentStrategy' ? 'contentStrategy' :
      section === 'brandVoice' ? 'brandVoice' :
      section === 'targetAudience' ? 'targetAudienceSection' :
      section] = result;

    await BrandProfile.findOneAndUpdate({ workspaceId }, updateField);
    res.json({ success: true, section, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
