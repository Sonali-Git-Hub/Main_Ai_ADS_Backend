/**
 * Content Generation Controller
 * AI-powered content: social posts, blog articles, email, ad copy, SEO briefs.
 */
const { generate, generateJSON } = require('../services/aiService');
const BrandProfile = require('../models/BrandProfile');
const Content = require('../models/Content');

// ─── Helper: Get brand context ────────────────────────────────────────────────
const getBrandContext = async (workspaceId) => {
  if (!workspaceId) return '';
  try {
    const brand = await BrandProfile.findOne({ workspaceId });
    if (brand && brand.structuredIdentity) return JSON.stringify(brand.structuredIdentity, null, 2);
  } catch {}
  return '';
};

// ─── POST /api/content/social/generate ───────────────────────────────────────
exports.generateSocialPost = async (req, res) => {
  try {
    const {
      workspaceId,
      platform = 'instagram',
      topic,
      tone = 'Professional',
      postType = 'educational',
      includeHashtags = true,
      includeCTA = true,
      model = 'gemini',
    } = req.body;

    if (!topic) return res.status(400).json({ success: false, error: 'topic is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Write a compelling ${platform} ${postType} post about: "${topic}"

Tone: ${tone}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON with exact keys:
{
  "hook": "punchy headline or hook line (e.g. Upgrade Your Style with Discounts on Bottoms!)",
  "shortCaption": "short concise caption (under 150 chars, e.g. Grab your trendy bottoms now at unbeatable prices! #ZaraStyle)",
  "caption": "full detailed long caption (e.g. Discover our latest collection of bottoms with amazing discounts...)",
  "longCaption": "full detailed long caption",
  "cta": "engaging call to action (e.g. Hurry, grab yours now before they are gone!)",
  "hashtags": ${includeHashtags ? '["#Discounts", "#BottomsSale", "#FashionStyle"]' : '[]'},
  "creativeVariations": [
    {
      "type": "STORYTELLING ANGLE",
      "text": "Storytelling perspective (e.g. Imagine stepping out in style with the latest bottoms...)"
    },
    {
      "type": "PROBLEM-SOLUTION",
      "text": "Problem-solution perspective (e.g. Struggling to find fashion-forward bottoms that fit your budget?...)"
    }
  ],
  "imagePrompt": "detailed visual description for AI image generation",
  "bestTimeToPost": "e.g. 9-11 AM",
  "expectedEngagement": "high"
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.85 });
    if (!result) return res.status(500).json({ success: false, error: 'Generation failed' });

    // Save to Content collection
    try {
      await Content.create({
        workspaceId,
        title: `${platform}: ${topic}`,
        type: 'SOCIAL',
        platform,
        content: result.caption,
        briefData: result,
        author: `AI (${model})`,
        status: 'INTERNAL_REVIEW',
      });
    } catch {}

    res.json({ success: true, platform, topic, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/content/blog/draft ────────────────────────────────────────────
exports.generateBlogDraft = async (req, res) => {
  try {
    const {
      workspaceId,
      title,
      keywords = [],
      tone = 'informative',
      wordCount = 800,
      audience = 'general',
      model = 'gemini',
    } = req.body;

    if (!title) return res.status(400).json({ success: false, error: 'title is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Write a comprehensive ${wordCount}-word blog article:

Title: "${title}"
Keywords to include: ${keywords.join(', ') || 'none specified'}
Tone: ${tone}
Target Audience: ${audience}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON:
{
  "title": "SEO-optimized title",
  "metaDescription": "150-160 char meta description",
  "content": "full markdown blog article with H2/H3 headings",
  "wordCount": ${wordCount},
  "readingTime": "X min read",
  "seoScore": 85,
  "keywords": ["primary", "secondary"],
  "outline": ["Introduction", "Section 1", "Conclusion"],
  "internalLinkSuggestions": ["topic1", "topic2"]
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.7, maxTokens: 6000 });
    if (!result) return res.status(500).json({ success: false, error: 'Generation failed' });

    try {
      await Content.create({
        workspaceId,
        title: result.title || title,
        type: 'BLOG',
        content: result.content,
        briefData: result,
        author: `AI (${model})`,
        wordCount: result.wordCount,
        status: 'INTERNAL_REVIEW',
      });
    } catch {}

    res.json({ success: true, draft: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/content/email/generate ────────────────────────────────────────
exports.generateEmailCopy = async (req, res) => {
  try {
    const {
      workspaceId,
      subject,
      purpose = 'newsletter',
      recipientType = 'subscribers',
      model = 'gemini',
    } = req.body;

    if (!subject) return res.status(400).json({ success: false, error: 'subject is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Write a compelling ${purpose} email:
Subject: "${subject}"
Recipients: ${recipientType}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON:
{
  "subject": "email subject line",
  "preheader": "preview text under 100 chars",
  "body": "full email HTML body",
  "cta": "primary call to action text",
  "ctaUrl": "#your-link",
  "openRateTip": "tip to improve open rate"
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.8 });
    if (!result) return res.status(500).json({ success: false, error: 'Generation failed' });

    res.json({ success: true, email: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/content/ad-copy/generate ──────────────────────────────────────
exports.generateAdCopy = async (req, res) => {
  try {
    const {
      workspaceId,
      product,
      adPlatform = 'google',
      objective = 'conversions',
      model = 'gemini',
    } = req.body;

    if (!product) return res.status(400).json({ success: false, error: 'product is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Write ${adPlatform} ad copy for: "${product}"
Objective: ${objective}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON:
{
  "headlines": ["headline1 (max 30 chars)", "headline2", "headline3"],
  "descriptions": ["description1 (max 90 chars)", "description2"],
  "callToActions": ["CTA1", "CTA2"],
  "longFormAd": "full Facebook/Instagram ad copy",
  "shortAd": "Twitter/X ad under 280 chars",
  "keyBenefits": ["benefit1", "benefit2"]
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.85 });
    if (!result) return res.status(500).json({ success: false, error: 'Generation failed' });

    res.json({ success: true, adPlatform, product, adCopy: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/content/repurpose ──────────────────────────────────────────────
exports.repurposeContent = async (req, res) => {
  try {
    const {
      workspaceId,
      sourceContent,
      sourceType = 'blog',
      targetFormats = ['instagram', 'linkedin', 'twitter'],
      model = 'gemini',
    } = req.body;

    if (!sourceContent) return res.status(400).json({ success: false, error: 'sourceContent is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Transform this ${sourceType} content into multiple formats:

Source Content:
${sourceContent.substring(0, 2000)}

Target Formats: ${targetFormats.join(', ')}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON with one key per format:
{
  "instagram": { "caption": "...", "hashtags": ["#tag"], "story": "story text" },
  "linkedin": { "post": "professional LinkedIn post", "article_intro": "..." },
  "twitter": { "tweet": "under 280 chars", "thread": ["tweet1", "tweet2"] },
  "email": { "subject": "...", "body": "..." },
  "youtube": { "title": "...", "description": "...", "tags": ["tag1"] }
}

Only include the requested formats in your response.`;

    const result = await generateJSON(prompt, { model, temperature: 0.8 });
    if (!result) return res.status(500).json({ success: false, error: 'Generation failed' });

    res.json({ success: true, sourceType, targetFormats, repurposed: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/content/fact-check ────────────────────────────────────────────
exports.factCheckContent = async (req, res) => {
  try {
    const { content, approvedClaims = [], restrictedClaims = [] } = req.body;
    if (!content) return res.status(400).json({ success: false, error: 'content is required' });

    // Rule-based check first
    let issues = [];
    const lowerContent = content.toLowerCase();

    for (const restricted of restrictedClaims) {
      if (lowerContent.includes(restricted.toLowerCase())) {
        issues.push({ type: 'restricted', text: restricted, severity: 'high' });
      }
    }

    const passed = issues.filter((i) => i.severity === 'high').length === 0;
    const score = Math.max(0, 100 - (issues.length * 15));

    res.json({
      success: true,
      factCheck: {
        passed,
        score,
        issues,
        status: passed ? 'VERIFIED' : 'NEEDS_REVIEW',
        approvedClaimsMatched: approvedClaims.filter((c) => lowerContent.includes(c.toLowerCase())).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/seo/brief/generate ─────────────────────────────────────────────
exports.generateSeoBrief = async (req, res) => {
  try {
    const { workspaceId, primaryKeyword, industry, targetAudience, model = 'gemini' } = req.body;
    if (!primaryKeyword) return res.status(400).json({ success: false, error: 'primaryKeyword is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Create a comprehensive SEO content brief for keyword: "${primaryKeyword}"
Industry: ${industry || 'general'}
Target Audience: ${targetAudience || 'general'}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON:
{
  "primaryKeyword": "...",
  "secondaryKeywords": ["kw1", "kw2", "kw3"],
  "suggestedTitles": ["title1", "title2", "title3"],
  "metaDescription": "150-160 chars",
  "contentOutline": ["H2: Section1", "H2: Section2"],
  "wordCountTarget": 1500,
  "searchIntent": "informational|transactional|navigational",
  "competitorTopics": ["topic1", "topic2"],
  "faqSuggestions": ["Q1?", "Q2?"],
  "internalLinkOpportunities": ["topic1", "topic2"]
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.6 });
    if (!result) return res.status(500).json({ success: false, error: 'Generation failed' });

    res.json({ success: true, brief: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
