/**
 * Content Generation Controller
 * AI-powered content: social posts, blog articles, email, ad copy, SEO briefs.
 */
const { generate, generateJSON } = require('../services/aiService');
const BrandProfile = require('../models/BrandProfile');
const Content = require('../models/Content');

const Workspace = require('../models/Workspace');

// ─── POST /api/content/save-asset ─────────────────────────────────────────────
exports.saveAsset = async (req, res) => {
  try {
    const assetData = req.body;
    let savedContent = null;
    try {
      if (assetData && (assetData.name || assetData.url)) {
        savedContent = await Content.create({
          workspaceId: assetData.workspaceId,
          type: assetData.type || 'DOCUMENT',
          title: assetData.name || 'Brand Asset',
          body: assetData.content || assetData.url || '',
          metadata: assetData.metadata || {}
        });
      }
    } catch (dbErr) {}

    res.json({ success: true, asset: savedContent || assetData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Helper: Get brand context ────────────────────────────────────────────────
const getBrandContext = async (workspaceId, directBrandName = '') => {
  let context = '';
  if (workspaceId) {
    try {
      const ws = await Workspace.findById(workspaceId);
      if (ws) {
        context += `Brand Name: ${ws.brandName}\nDomain: ${ws.domainUrl}\nIndustry: ${ws.industryCategory}\nTagline: ${ws.tagline || ''}\nMission: ${ws.missionStatement || ''}\nPositioning: ${ws.positioningSummary || ''}\nContent Pillars: ${(ws.contentPillars || []).join(', ')}\nTarget Audience: ${(ws.targetAudience || []).join(', ')}\n`;
      }
      const brand = await BrandProfile.findOne({ workspaceId });
      if (brand && brand.structuredIdentity) context += '\n' + JSON.stringify(brand.structuredIdentity, null, 2);
    } catch {}
  }
  if (!context && directBrandName) {
    context = `Brand Name: ${directBrandName}`;
  }
  return context;
};

// ─── POST /api/content/social/generate ───────────────────────────────────────
exports.generateSocialPost = async (req, res) => {
  try {
    const {
      workspaceId,
      brandName,
      platform = 'instagram',
      topic,
      tone = 'Professional',
      postType = 'educational',
      includeHashtags = true,
      includeCTA = true,
      model = 'gemini',
    } = req.body;

    if (!topic) return res.status(400).json({ success: false, error: 'topic is required' });

    const brandContext = await getBrandContext(workspaceId, brandName);

    const prompt = `You are a world-class social media strategist and copywriter.
Write a highly engaging ${platform} ${postType} post about: "${topic}".

Tone: ${tone}
${brandContext ? `BRAND CONTEXT (MANDATORY TO REFLECT IN POST):
${brandContext}` : ''}

CRITICAL RULES:
1. Ensure the post is 100% tailored to the brand, products, tone, and audience described in Brand Context.
2. DO NOT use generic software or unrelated placeholder topics unless specified.

Return JSON with exact keys:
{
  "hook": "punchy attention-grabbing hook line for ${topic}",
  "shortCaption": "short concise caption (under 150 chars)",
  "caption": "full engaging caption tailored specifically to the brand",
  "longCaption": "extended detailed post caption with value points",
  "cta": "strong call to action matching the brand goals",
  "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3"],
  "creativeVariations": [
    {
      "type": "STORYTELLING ANGLE",
      "text": "narrative storytelling perspective on ${topic}"
    },
    {
      "type": "PROBLEM-SOLUTION",
      "text": "problem-solution perspective on ${topic}"
    }
  ],
  "imagePrompt": "detailed photography & visual prompt for generating brand image",
  "bestTimeToPost": "e.g. 9-11 AM EST",
  "expectedEngagement": "High"
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.85 });
    const postData = result?.data || result;

    if (!postData) return res.status(500).json({ success: false, error: 'Generation failed' });

    // Save to Content collection
    try {
      await Content.create({
        workspaceId,
        title: `${platform}: ${topic}`,
        type: 'SOCIAL',
        platform,
        content: postData.caption || postData.shortCaption || '',
        briefData: postData,
        author: `AI (${result?.model || model})`,
        status: 'INTERNAL_REVIEW',
      });
    } catch (saveErr) {
      console.warn('[ContentController] DB Save notice:', saveErr.message);
    }

    res.json({ success: true, platform, topic, data: postData, model: result?.model || model });
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
      context = '',
      tone = 'professional',
      keyPoints = '',
      cta = '',
      senderName = '',
      senderDesignation = '',
      senderCompany = '',
      lengthFormat = 'detailed',
      model = 'gemini',
    } = req.body;

    const effectiveSubject = (subject && subject.trim()) || (purpose ? `${purpose.replace(/_/g, ' ').toUpperCase()} Announcement` : 'Exclusive Brand Update');

    const brandContext = await getBrandContext(workspaceId);

    const senderBlock = senderName
      ? `Sender: ${senderName}${senderDesignation ? ', ' + senderDesignation : ''}${senderCompany ? ' at ' + senderCompany : ''}`
      : '';

    const prompt = `Write a compelling ${purpose} email with the following specifications:

Subject / Topic: "${effectiveSubject}"
Purpose: ${purpose}
Recipients / Audience: ${recipientType}
Tone: ${tone}
Context / Background: ${context || 'General brand communication'}
Key Points to Include: ${keyPoints || 'Brand highlights and value proposition'}
Desired CTA: ${cta || 'Engage with the brand'}
${senderBlock}
Length & Format: ${lengthFormat}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON:
{
  "subject": "compelling email subject line",
  "preheader": "preview text under 100 chars",
  "body": "full email body content (plain text with line breaks, NOT HTML)",
  "headline": "main headline inside the email",
  "cta": "primary call to action button text",
  "ctaUrl": "#your-link",
  "openRateTip": "tip to improve open rate",
  "closingLine": "warm sign-off line before sender signature",
  "ps": "optional P.S. line for urgency or bonus offer"
}`;

    let emailData = null;
    try {
      const result = await generateJSON(prompt, { model, temperature: 0.8 });
      if (result) {
        emailData = result?.data || result;
      }
    } catch (aiErr) {
      console.warn('AI provider failed for email generation, using smart fallback template:', aiErr.message);
    }

    if (!emailData || !emailData.subject) {
      const companyStr = senderCompany || 'AI Ads Platform';
      const keyPointsList = keyPoints 
        ? keyPoints.split(',').map(p => `• ${p.trim()}`).join('\n')
        : `• Exclusive updates & feature enhancements\n• Tailored strategy insights for ${recipientType}\n• Seamless integration with your marketing workflow`;

      emailData = {
        subject: effectiveSubject,
        preheader: `Important update regarding ${effectiveSubject}`,
        headline: `Special Announcement: ${effectiveSubject}`,
        body: `Hi ${recipientType || 'there'},\n\nWe are excited to share an important update regarding ${effectiveSubject}.\n\n${context ? context + '\n\n' : ''}Key Highlights:\n${keyPointsList}\n\nOur team at ${companyStr} is dedicated to providing you with the highest quality experience and results.\n\n${cta ? 'Take Action: ' + cta : 'Click below to explore more details.'}\n\nBest regards,\n${senderName || 'The Marketing Team'}${senderDesignation ? '\n' + senderDesignation : ''}${senderCompany ? '\n' + senderCompany : ''}`,
        cta: cta || 'Explore Now',
        ctaUrl: '#',
        openRateTip: 'Pro Tip: Personalize subject lines with the subscriber\'s name to increase open rates by up to 26%.',
        closingLine: 'Warm regards,',
        ps: `P.S. Have questions? Reply directly to this email and our team at ${companyStr} will be happy to help!`
      };
    }

    res.json({ success: true, email: emailData });
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
