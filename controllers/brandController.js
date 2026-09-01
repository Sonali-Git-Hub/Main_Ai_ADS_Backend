/**
 * Brand Intelligence Controller
 * Deep AI analysis of brand identity from URL, document, or manual input.
 */
const mongoose = require('mongoose');
const BrandProfile = require('../models/BrandProfile');
const Workspace = require('../models/Workspace');
const { generate, generateJSON } = require('../services/aiService');
const { generateBrandDNA } = require('../modules/workspace/brandIntelligence.service');
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

// ─── Centralized Preview → BrandProfile Persistence Mapper ───────────────────
function mapPreviewToBrandProfile(brandDna, workspaceId) {
  const finalBrandName = brandDna.brandName || brandDna.companyName || 'Brand Workspace';
  const websiteUrl = brandDna.domainUrl || brandDna.website || '';

  return {
    workspaceId: workspaceId ? workspaceId.toString() : '',
    companyName: finalBrandName,
    brandName: finalBrandName,
    parentCompany: brandDna.parentCompany || null,
    parentCompanyProvenance: brandDna.parentCompanyProvenance || null,
    website: websiteUrl,
    domainUrl: websiteUrl,
    logoUrl: brandDna.logoUrl || brandDna.faviconUrl || '',
    brandColors: brandDna.brandColors || [],
    brandColorsProvenance: brandDna.brandColorsProvenance || null,
    industryCategory: brandDna.industryCategory || brandDna.industry || null,
    industryProvenance: brandDna.industryProvenance || null,
    secondaryIndustries: brandDna.secondaryIndustries || [],
    businessType: brandDna.businessType || null,
    businessTypeProvenance: brandDna.businessTypeProvenance || null,
    headquarters: brandDna.headquarters || null,
    headquartersProvenance: brandDna.headquartersProvenance || null,
    companyDescription: brandDna.companyDescription || '',
    companyDescriptionProvenance: brandDna.companyDescriptionProvenance || null,
    tagline: brandDna.tagline || null,
    taglineProvenance: brandDna.taglineProvenance || null,
    missionStatement: brandDna.missionStatement || null,
    missionStatementProvenance: brandDna.missionStatementProvenance || null,
    vision: brandDna.vision || null,
    visionProvenance: brandDna.visionProvenance || null,
    targetAudience: brandDna.targetAudience || [],
    targetAudienceProvenance: brandDna.targetAudienceProvenance || null,
    coreProductsServices: brandDna.coreProductsServices || [],
    coreProductsServicesProvenance: brandDna.coreProductsServicesProvenance || null,
    contentPillars: brandDna.contentPillars || [],
    brandValues: brandDna.brandValues || [],
    dosAndDonts: brandDna.dosAndDonts || {
      dos: brandDna.doWords || (brandDna.dosAndDonts?.dos || []),
      donts: brandDna.dontWords || (brandDna.dosAndDonts?.donts || [])
    },
    doWords: brandDna.doWords || (brandDna.dosAndDonts?.dos || []),
    dontWords: brandDna.dontWords || (brandDna.dosAndDonts?.donts || []),
    brandVoice: {
      tone: brandDna.brandVoiceTone?.toneKeywords?.join(', ') || brandDna.brandVoice || 'Professional & Authoritative',
      dos: brandDna.doWords || (brandDna.dosAndDonts?.dos || []),
      donts: brandDna.dontWords || (brandDna.dosAndDonts?.donts || [])
    },
    brandVoiceTone: brandDna.brandVoiceTone || null,
    contactInfo: brandDna.contactInfo || null,
    contactInfoProvenance: brandDna.contactInfoProvenance || null,
    extractedBrandSummary: brandDna.companyDescription || '',
    structuredIdentity: {
      brand_name: finalBrandName,
      industry: brandDna.industryCategory || null,
      target_audience: Array.isArray(brandDna.targetAudience) ? brandDna.targetAudience.join(', ') : (brandDna.targetAudience || ''),
      tone: brandDna.brandVoiceTone?.toneKeywords?.join(', ') || 'Professional & Authoritative',
      products_services: brandDna.coreProductsServices || [],
      brand_values: brandDna.brandValues || [],
      content_angles: brandDna.contentPillars || [],
      color_palette: brandDna.brandColors || [],
      goal: brandDna.tagline || brandDna.missionStatement || null,
      mission_statement: brandDna.missionStatement || null,
      tagline: brandDna.tagline || null,
    },
    aiConfidence: brandDna.confidenceScore || 85,
    companyInformation: {
      name: finalBrandName,
      website: websiteUrl,
      headquarters: brandDna.headquarters || null,
      parentCompany: brandDna.parentCompany || null
    },
    brandIdentity: {
      tagline: brandDna.tagline || null,
      mission: brandDna.missionStatement || null,
      vision: brandDna.vision || null
    },
    products: { list: brandDna.coreProductsServices || [] },
    competitors: { list: brandDna.competitorLandscape || [] },
    extractedClaims: brandDna.extractedClaims || [],
    approvedClaims: brandDna.approvedClaims || [],
    pagesEvidence: brandDna.pagesEvidence || [],
    analysisStatus: brandDna.analysisStatus || 'SUCCESS'
  };
}

// ─── POST /api/brand/analyze ──────────────────────────────────────────────────
exports.analyzeBrand = async (req, res) => {
  try {
    const { workspaceId, websiteUrl, companyName } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'workspaceId is required' });
    }

    if (!websiteUrl) {
      return res.status(400).json({ success: false, error: 'websiteUrl is required for Brand DNA analysis' });
    }

    console.log(`[Brand Intelligence] Running Evidence-First Brand DNA analysis for: ${websiteUrl}`);
    const brandDna = await generateBrandDNA(websiteUrl, companyName || '');

    const brandData = mapPreviewToBrandProfile(brandDna, workspaceId);
    const finalBrandName = brandData.brandName || companyName || 'Brand Workspace';

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
        brandName: finalBrandName,
        faviconUrl: brandDna.logoUrl || '',
        brandColors: brandDna.brandColors || [],
        targetAudience: brandDna.targetAudience || [],
        missionStatement: brandDna.missionStatement || null,
        tagline: brandDna.tagline || null,
        industryCategory: brandDna.industryCategory || null,
        headquarters: brandDna.headquarters || null,
        parentCompany: brandDna.parentCompany || null
      });
    }

    console.log(`✅ Evidence-First Brand Intelligence Analysis Complete: "${finalBrandName}" (status: ${brandDna.analysisStatus})`);
    res.json({
      success: true,
      profile,
      brandDna
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

module.exports.mapPreviewToBrandProfile = mapPreviewToBrandProfile;
