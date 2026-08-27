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
    let cleanUrlObj;
    try {
      cleanUrlObj = new URL(url);
    } catch (e) {
      cleanUrlObj = new URL('https://' + url);
    }
    const rootDomain = cleanUrlObj.hostname.replace(/^www\./i, '');
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`;

    const response = await axios.get(cleanUrlObj.href, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIAdsBot/1.0)' },
    });
    const $ = cheerio.load(response.data);

    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 3000);

    // Find header/nav logo or apple-touch-icon/favicon
    let foundLogo = $('header img[src*="logo" i], nav img[src*="logo" i], img[class*="logo" i], img[alt*="logo" i]').first().attr('src') || '';
    if (foundLogo) {
      if (foundLogo.startsWith('//')) foundLogo = 'https:' + foundLogo;
      else if (!foundLogo.startsWith('http')) foundLogo = `${cleanUrlObj.origin}/${foundLogo.replace(/^\//, '')}`;
    }

    let favicon = $('link[rel="apple-touch-icon"], link[rel*="icon"]').first().attr('href') || '';
    if (favicon) {
      if (favicon.startsWith('//')) favicon = 'https:' + favicon;
      else if (!favicon.startsWith('http')) favicon = `${cleanUrlObj.origin}/${favicon.replace(/^\//, '')}`;
    }

    const finalLogo = foundLogo || favicon || googleFaviconUrl;

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
      url: cleanUrlObj.href,
      title: ogTitle || title,
      description: ogDesc || metaDesc,
      bodyText,
      favicon: finalLogo,
      socialLinks: socials,
    };
  } catch (err) {
    const rootDomain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    return {
      url,
      title: '',
      description: '',
      bodyText: '',
      favicon: `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`,
      socialLinks: {}
    };
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
    
    // Clean up scraped title to extract clean candidate brand name
    let cleanCandidate = companyName || '';
    if (!cleanCandidate && scrapedData.title) {
      cleanCandidate = scrapedData.title.split('|')[0].split('-')[0].split(':')[0].trim();
    }
    const brandName = cleanCandidate || companyName || scrapedData.title || 'Unknown Brand';

    if (!brandInput && !websiteUrl) {
      return res.status(400).json({ success: false, error: 'Provide websiteUrl or manualDescription' });
    }

    const prompt = `You are a world-class Brand Identity & Market Intelligence Analyst.
Analyze the following scraped website data and return a highly accurate Brand Intelligence JSON object.

Website URL: ${websiteUrl || 'Not provided'}
Raw Page Title: ${scrapedData.title || ''}
Candidate Brand Name: ${brandName}
Content Description: ${brandInput.substring(0, 2500)}

CRITICAL INSTRUCTIONS FOR HIGH ACCURACY:
1. "brand_name": Extract the exact, official, full brand name (e.g. "U.S. Polo Assn.", "Nike", "Apple"). NEVER truncate or shorten multi-word brand names to a single letter like "U" or "A". Preserve standard dots and abbreviations (e.g. "U.S.").
2. "industry": Determine the precise primary business industry (e.g. "Apparel & Fashion", "Technology & Software", "E-Commerce", "Food & Beverage"). Base this strictly on what the website actually sells. (If the website sells polo shirts, jeans, and apparel, the industry MUST be "Apparel & Fashion", NOT "Telecommunications").

Return a valid JSON object with these exact keys:
{
  "brand_name": "Official Full Brand Name",
  "industry": "Primary Business Industry",
  "target_audience": "description of primary target audience",
  "tone": "brand voice tone (e.g. Classic, Premium, Bold, Friendly)",
  "cta_style": "preferred CTA style",
  "products_services": ["product1", "product2"],
  "brand_values": ["value1", "value2"],
  "content_angles": ["angle1", "angle2"],
  "color_palette": ["#color1", "#color2"],
  "platform_focus": ["instagram", "linkedin"],
  "posting_frequency": "daily",
  "goal": "main business goal",
  "mission_statement": "...",
  "tagline": "...",
  "competitor_landscape": ["competitor1", "competitor2"],
  "unique_selling_points": ["usp1", "usp2"],
  "content_dos": ["do1", "do2"],
  "content_donts": ["dont1", "dont2"],
  "ai_confidence": 95
}`;

    console.log(`[Brand Intelligence] Running AI analysis for "${brandName}"...`);
    const analysisResult = (await generateJSON(prompt, { model, temperature: 0.3 })) || {};

    // Synthesize rich, accurate brand identity defaults if AI returns sparse fields
    const finalBrandName = analysisResult.brand_name || brandName || 'Brand Workspace';
    const finalIndustry = analysisResult.industry || (
      brandName.toLowerCase().includes('polo') || brandName.toLowerCase().includes('apparel') || brandName.toLowerCase().includes('fashion')
        ? 'Apparel, Fashion & Retail'
        : 'Consumer Products & Services'
    );
    const finalAudience = analysisResult.target_audience || (
      `Fashion-conscious consumers and shoppers seeking authentic, high-quality ${finalIndustry} offerings from ${finalBrandName}.`
    );
    const finalProducts = (analysisResult.products_services && analysisResult.products_services.length > 0)
      ? analysisResult.products_services
      : [
          `${finalBrandName} Core Collection`,
          `Premium ${finalIndustry} Offerings`,
          `Seasonal New Arrivals & Bestsellers`
        ];
    const finalPillars = (analysisResult.content_angles && analysisResult.content_angles.length > 0)
      ? analysisResult.content_angles
      : [
          `${finalBrandName} | Official Brand Identity & Heritage`,
          `Authentic Premium Craftsmanship & Quality`,
          `Trending Styles & Seasonal Collections`,
          `Customer Satisfaction & Product Excellence`
        ];
    const finalValues = (analysisResult.brand_values && analysisResult.brand_values.length > 0)
      ? analysisResult.brand_values
      : ['Authenticity & Heritage', 'Premium Quality', 'Customer Trust'];

    // Update or create BrandProfile
    const brandData = {
      workspaceId,
      companyName: finalBrandName,
      website: websiteUrl || '',
      extractedBrandSummary: brandInput.substring(0, 500),
      structuredIdentity: {
        brand_name: finalBrandName,
        industry: finalIndustry,
        target_audience: finalAudience,
        tone: analysisResult.tone || 'Classic, Premium & Authoritative',
        cta_style: analysisResult.cta_style || 'Shop Official Collection',
        products_services: finalProducts,
        brand_values: finalValues,
        content_angles: finalPillars,
        color_palette: (analysisResult.color_palette && analysisResult.color_palette.length > 0) ? analysisResult.color_palette : ['#0F172A', '#2563EB'],
        platform_focus: analysisResult.platform_focus || ['instagram', 'linkedin'],
        posting_frequency: analysisResult.posting_frequency || 'daily',
        goal: analysisResult.goal || `Drive official online sales and engagement for ${finalBrandName}`,
        mission_statement: analysisResult.mission_statement || `To deliver exceptional ${finalIndustry} quality and style to customers worldwide.`,
        tagline: analysisResult.tagline || `${finalBrandName} | Official Heritage & Style`,
      },
      socialMediaLinks: scrapedData.socialLinks || {},
      brandColors: (analysisResult.color_palette && analysisResult.color_palette.length > 0) ? analysisResult.color_palette : ['#0F172A', '#2563EB'],
      logoUrl: scrapedData.favicon || '',
      aiConfidence: analysisResult.ai_confidence || 88,
      // Intelligence sections
      companyInformation: { name: finalBrandName, website: websiteUrl, description: brandInput.substring(0, 300) },
      brandIdentity: { tone: analysisResult.tone || 'Classic & Premium', tagline: analysisResult.tagline, mission: analysisResult.mission_statement },
      brandPersonality: { values: finalValues, usps: analysisResult.unique_selling_points || [analysisResult.tagline, `Authentic ${finalIndustry} quality`] },
      brandVoice: { style: analysisResult.tone || 'Classic & Premium', dos: analysisResult.content_dos || [`Highlight ${finalBrandName} quality`], donts: analysisResult.content_donts || ['Avoid unverified claims'] },
      targetAudienceSection: { description: finalAudience },
      products: { list: finalProducts },
      contentStrategy: { angles: finalPillars, goal: analysisResult.goal || `Grow ${finalBrandName} audience`, platforms: analysisResult.platform_focus || ['instagram', 'linkedin'] },
      competitors: { list: analysisResult.competitor_landscape || [] },
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
