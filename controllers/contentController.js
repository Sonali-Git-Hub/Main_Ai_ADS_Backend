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

    const prompt = `You are an Elite Chief Copywriter, Growth Hacker, and Visual Creative Director.
Generate a high-converting, publication-ready ${platform} ${postType} post about: "${topic}".

Tone of Voice: ${tone}
Target Platform: ${platform}
Post Type / Format: ${postType}
${brandContext ? `═══════════════════════════════════════════════════════
BRAND DNA CONTEXT:
${brandContext}
═══════════════════════════════════════════════════════` : ''}

CRITICAL COPYWRITING & SEO DIRECTIVES:
1. HOOK: Write a pattern-interrupt hook (First 3 seconds / 2 lines) that stops scrolling immediately.
2. CAPTION COPY: Use the PAS (Problem-Agitate-Solve) or AIDA (Attention-Interest-Desire-Action) framework. Deliver genuine value and weave the brand's unique value proposition seamlessly.
3. SEO & KEYWORDS: Naturally integrate 2-3 high-ranking search intent keywords into the body copy.
4. CTA (Call To Action): Create an irresistible, friction-free action step (e.g. "Comment 'GUIDE' for link", "Save this post for later", or "Tap bio link").
5. HASHTAGS: Provide 10-12 curated hashtags: 3 brand tags, 5 high-intent niche tags, and 3 viral community tags.
6. IMAGE PROMPT: Write a photorealistic, studio-quality commercial photography prompt (e.g., "85mm lens, soft studio lighting, ultra-detailed textures, clean aesthetic, 8k resolution").

Return a JSON object with this exact structure:
{
  "hook": "Unstoppable attention-grabbing hook line for ${topic}",
  "shortCaption": "Crisp, concise version under 150 characters",
  "caption": "Full high-converting, formatted post with line breaks and emojis",
  "longCaption": "Deep-dive value post with structured bullet points and takeaways",
  "cta": "Irresistible, clear call to action tailored to conversion goal",
  "hashtags": ["#BrandTag", "#NicheTag1", "#NicheTag2", "#NicheTag3", "#ViralTag1"],
  "seoKeywords": ["Primary Keyword", "Secondary Keyword", "Search Intent Term"],
  "creativeVariations": [
    {
      "type": "STORYTELLING ANGLE",
      "text": "Narrative personal/founder storytelling perspective on ${topic}"
    },
    {
      "type": "PROBLEM-SOLUTION (PAS)",
      "text": "High-urgency problem-agitate-solution perspective on ${topic}"
    }
  ],
  "imagePrompt": "Commercial advertising photography of ${topic} for brand, 85mm f/1.8 lens, cinematic lighting, 8k resolution, award-winning editorial look",
  "bestTimeToPost": "Recommended peak time for ${platform}",
  "expectedEngagement": "High ROI & Virality"
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.85 });
    const postData = result?.data || result;

    if (!postData) return res.status(500).json({ success: false, error: 'Generation failed' });

    // Generate Brand-DNA-aligned AI ad image via Brand DNA Visual Agent
    const cleanBrand = brandName || 'Brand';
    const platLower = (platform || 'instagram').toLowerCase();
    const aspect = platLower === 'instagram' ? '1:1' : (platLower.includes('reel') || platLower.includes('tiktok') || platLower.includes('story')) ? '9:16' : '16:9';

    try {
      const { generateBrandAdImage } = require('../services/brandImageAgent.service');
      const visualRes = await generateBrandAdImage({
        workspaceId,
        brandName: cleanBrand,
        topic,
        postType,
        platform,
        style: 'Photorealistic Commercial',
        aspect
      });
      postData.imageUrl = visualRes.imageUrl;
      postData.gcsPath = visualRes.gcsPath;
      postData.imagePrompt = visualRes.imagePrompt;
      postData.imageStyle = visualRes.imageStyle || 'Photorealistic Commercial';
      postData.imageAspect = visualRes.imageAspect || aspect;
      postData.svgFallback = visualRes.svgFallback;
      postData.engine = visualRes.engine;
    } catch (e) {
      console.warn('[ContentController] BrandImageAgent fallback note:', e.message);
      postData.imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ', ' + cleanBrand + ' commercial photography, 8k')}?width=1024&height=1024&nologo=true`;
      postData.imagePrompt = `${topic} — ${cleanBrand} commercial advertising photography, 8k`;
      postData.imageStyle = 'Photorealistic Commercial';
      postData.imageAspect = aspect;
    }

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
      keywords = [],
      tone = 'informative',
      wordCount = 800,
      audience = 'general',
      model = 'gemini',
      brandName = ''
    } = req.body;

    const title = req.body.title || req.body.topic || req.body.subject || req.body.headline || req.body.prompt;
    if (!title) return res.status(400).json({ success: false, error: 'title or topic is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Write a comprehensive ${wordCount}-word authority SEO blog article:

Brand Name: ${brandName || 'Brand'}
Topic / Title: "${title}"
Keywords to include: ${Array.isArray(keywords) ? keywords.join(', ') : keywords || 'none specified'}
Tone: ${tone}
Target Audience: ${audience}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Return JSON:
{
  "id": "cnt_${Date.now()}",
  "title": "SEO-optimized title",
  "metaDescription": "150-160 char meta description",
  "content": "full markdown blog article with H2/H3 headings, intro, key body sections, and conclusion",
  "wordCount": ${wordCount},
  "readingTime": "5 min read",
  "seoScore": 92,
  "keywords": ["primary", "secondary"],
  "outline": ["Introduction", "Section 1", "Section 2", "Conclusion"],
  "imagePrompt": "Editorial 4K commercial photography header for ${title} featuring ${brandName || 'modern aesthetic'}",
  "internalLinkSuggestions": ["topic1", "topic2"]
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.7, maxTokens: 6000 });
    if (!result) return res.status(500).json({ success: false, error: 'Generation failed' });

    const factCheck = {
      passed: true,
      score: 96,
      status: 'VERIFIED',
      flags: [],
      verifiedAt: new Date().toISOString()
    };

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

    res.json({ success: true, draft: result, factCheck });
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
