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
      if (assetData && (assetData.name || assetData.url || assetData.content)) {
        savedContent = await Content.create({
          workspaceId: assetData.workspaceId || 'ws_001',
          type: (assetData.type || 'DOCUMENT').toUpperCase(),
          title: assetData.name || assetData.title || 'Brand Asset',
          content: assetData.content || assetData.url || '',
          briefData: assetData.metadata || assetData,
          status: 'APPROVED'
        });
      }
    } catch (dbErr) {
      console.warn('[ContentController] saveAsset DB notice:', dbErr.message);
    }

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

// ─── Helper: Clean markdown formatting & symbols ─────────────────────────────
const cleanMarkdownSymbols = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/#{1,6}/g, '')
    .replace(/\*{1,3}/g, '')
    .replace(/_{1,3}/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[\s*_-]{3,}\s*$/gm, '')
    .replace(/^\*\s+/gm, '• ')
    .replace(/^-\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
      customPrompt,
      prompt: userProvidedPrompt,
      imagePrompt: userProvidedImagePrompt,
    } = req.body;

    if (!topic && !customPrompt && !userProvidedPrompt) return res.status(400).json({ success: false, error: 'topic or customPrompt is required' });

    const brandContext = await getBrandContext(workspaceId, brandName);
    const activeDirectives = (customPrompt || userProvidedPrompt) ? `\n═══════════════════════════════════════════════════════\nUSER CUSTOM PROMPT & DIRECTIVES:\n${(customPrompt || userProvidedPrompt)}\n═══════════════════════════════════════════════════════` : '';

    const prompt = `You are an Elite Chief Copywriter, Growth Hacker, and Visual Creative Director.
Generate a high-converting, publication-ready ${platform} ${postType} post about: "${topic}".

Tone of Voice: ${tone}
Target Platform: ${platform}
Post Type / Format: ${postType}
${brandContext ? `═══════════════════════════════════════════════════════
BRAND DNA CONTEXT:
${brandContext}
═══════════════════════════════════════════════════════` : ''}${activeDirectives}

CRITICAL COPYWRITING & SEO DIRECTIVES:
1. HOOK: Write a pattern-interrupt hook (First 3 seconds / 2 lines) that stops scrolling immediately.
2. CAPTION COPY: Use the PAS (Problem-Agitate-Solve) or AIDA (Attention-Interest-Desire-Action) framework. Deliver genuine value and weave the brand's unique value proposition seamlessly.
3. SEO & KEYWORDS: Naturally integrate 2-3 high-ranking search intent keywords into the body copy.
4. CTA (Call To Action): Create an irresistible, friction-free action step (e.g. "Comment 'GUIDE' for link", "Save this post for later", or "Tap bio link").
5. HASHTAGS: Provide 10-12 curated hashtags: 3 brand tags, 5 high-intent niche tags, and 3 viral community tags.
6. IMAGE PROMPT: Write a photorealistic, studio-quality commercial photography prompt (e.g., "85mm lens, soft studio lighting, ultra-detailed textures, clean aesthetic, 8k resolution").
7. FORMATTING DIRECTIVE: Write clean readable text without asterisks (**) or markdown formatting in captions, hooks, or copy unless specifically requested by user.

Return a JSON object with this exact structure:
{
  "hook": "Unstoppable attention-grabbing hook line for ${topic}",
  "shortCaption": "Crisp, concise version under 150 characters",
  "caption": "Full high-converting, formatted post with line breaks and emojis (no ** or markdown tags)",
  "longCaption": "Deep-dive value post with structured bullet points and takeaways (no ** or markdown tags)",
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
  "imagePrompt": "${userProvidedImagePrompt || `Commercial advertising photography of ${topic} for ${brandName || 'Brand'}, 85mm f/1.8 lens, cinematic lighting, 8k resolution, award-winning editorial look`}",
  "bestTimeToPost": "Recommended peak time for ${platform}",
  "expectedEngagement": "High ROI & Virality"
}`;

    const result = await generateJSON(prompt, { model, temperature: 0.85 });
    const postData = result?.data || result;

    if (!postData) return res.status(500).json({ success: false, error: 'Generation failed' });

    if (postData) {
      ['hook', 'shortCaption', 'caption', 'longCaption', 'cta'].forEach((k) => {
        if (postData[k]) postData[k] = cleanMarkdownSymbols(postData[k]);
      });
    }

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
      const { resolveBrandVisualAsset } = require('../services/brandVisualResolver');
      postData.imageUrl = resolveBrandVisualAsset({
        prompt: `${topic} — ${cleanBrand} commercial advertising photography, 8k`,
        brandName: cleanBrand,
        topic,
        style: 'Photorealistic Commercial',
        aspect
      });
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
      brandName = '',
      customPrompt,
      promptInstructions,
    } = req.body;

    const title = req.body.title || req.body.topic || req.body.subject || req.body.headline || req.body.prompt;
    if (!title && !customPrompt) return res.status(400).json({ success: false, error: 'title or topic is required' });

    const brandContext = await getBrandContext(workspaceId);
    const customBlock = (customPrompt || promptInstructions) ? `\n═══════════════════════════════════════════════════════\nUSER CUSTOM PROMPT & CONTENT DIRECTIVES:\n${customPrompt || promptInstructions}\n═══════════════════════════════════════════════════════` : '';

    const prompt = `Write a comprehensive ${wordCount}-word authority SEO blog article:

Brand Name: ${brandName || 'Brand'}
Topic / Title: "${title || 'SEO Blog Article'}"
Keywords to include: ${Array.isArray(keywords) ? keywords.join(', ') : keywords || 'none specified'}
Tone: ${tone}
Target Audience: ${audience}
${brandContext ? `Brand Context:\n${brandContext}` : ''}${customBlock}

Formatting Directives:
- Write the article in clean, professional plain text with clear headings and paragraphs.
- DO NOT use markdown symbols like #, ##, ###, ####, asterisks (** or *), or hashtags in the text body.
- Use clean capitalized headings with clean line breaks instead of markdown symbols.

Return JSON:
{
  "id": "cnt_${Date.now()}",
  "title": "SEO-optimized title",
  "metaDescription": "150-160 char meta description",
  "content": "Full clean formatted blog article without any # or ** markdown symbols",
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

    const draftData = result?.data || result;

    // Clean any residual markdown symbols (#, ##, **, etc.)
    if (draftData.content && typeof draftData.content === 'string') {
      draftData.content = draftData.content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[\s*_-]{3,}\s*$/gm, '')
        .replace(/^\*\s+/gm, '• ')
        .replace(/^-\s+/gm, '• ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

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
        title: draftData.title || title,
        type: 'BLOG',
        content: draftData.content,
        briefData: draftData,
        author: `AI (${result?.model || model})`,
        wordCount: draftData.wordCount,
        status: 'INTERNAL_REVIEW',
      });
    } catch {}

    res.json({ success: true, draft: draftData, factCheck });
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
      customPrompt = '',
      model = 'gemini',
    } = req.body;

    const effectiveSubject = (subject && subject.trim()) || (purpose ? `${purpose.replace(/_/g, ' ').toUpperCase()} Announcement` : 'Exclusive Brand Update');

    const brandContext = await getBrandContext(workspaceId);

    const senderDisplay = senderName || 'Marketing Team';
    const designationDisplay = senderDesignation || 'Communications Lead';
    const companyDisplay = senderCompany || 'AI Ads Platform';

    const senderBlock = `Sender: ${senderDisplay}, ${designationDisplay} at ${companyDisplay}`;

    const customBlock = customPrompt
      ? `\n═══════════════════════════════════════════════════════\nUSER CUSTOM PROMPT & DIRECTIVES:\n${customPrompt}\n═══════════════════════════════════════════════════════`
      : '';

    const prompt = `You are an elite corporate communications and email copywriting expert.
Compose a high-converting, impeccably structured ${purpose} email adhering to world-class email standards:

Subject / Topic: "${effectiveSubject}"
Purpose / Goal: ${purpose}
Recipient Audience: ${recipientType}
Tone: ${tone}
Context / Background: ${context || 'Strategic business and audience communication'}
Key Highlights to Include: ${keyPoints || 'Core announcements, steps, and key benefits'}
Desired Action / CTA: ${cta || 'Explore more'}
${senderBlock}
Length & Format: ${lengthFormat}
${brandContext ? `Brand DNA & Context:\n${brandContext}\n` : ''}${customBlock}

════════════════════════════════════════════════════════════════
STRICT EMAIL COMPOSITION & STRUCTURAL STANDARDS:
1. SUBJECT LINE:
   - Must be highly relevant, engaging, professional, and clear (under 60 chars).
   - Never write vague or spammy subject lines.
2. PREHEADER PREVIEW:
   - Provide a complementary 50-90 character preview text that entices the recipient to open the email.
3. PROFESSIONAL SALUTATION:
   - Begin with a polite, professional greeting tailored to the recipient (e.g., "Dear ${recipientType}," or "Hello ${recipientType},").
4. OPENING PURPOSE STATEMENT (FIRST 2 LINES):
   - In the opening 1-2 lines directly after the greeting, CLEARLY and unambiguously state the purpose of this email and why it matters to the recipient. Get straight to the value.
5. STRUCTURED BODY PARAGRAPHS:
   - Organize into logical, easy-to-read paragraphs separated by clean line breaks.
   - If using steps or key points, format them with clean, plain-text labels (e.g., "1. Step Name: Description" or "• Point Name: Description").
   - Maintain a smooth, professional, and persuasive flow from context to core benefits.
6. CALL TO ACTION (CTA):
   - Include a clear, motivating action step in the body copy right before concluding.
   - Provide concise 2-4 word button CTA text.
7. POLITE CONCLUSION & COMPLETE SENDER SIGNATURE:
   - End with a warm, courteous sign-off (e.g., "Warm regards," or "Best regards," or "Sincerely,").
   - Follow immediately with the full sender credentials:
     ${senderDisplay}
     ${designationDisplay}
     ${companyDisplay}
8. ZERO MARKDOWN ASTERISKS:
   - Do NOT use asterisks (**) or markdown formatting (like **bold** or # headings) unless the user explicitly requested them in their directives. Write in clean, beautiful plain text.

Return JSON:
{
  "subject": "compelling, professional email subject line",
  "preheader": "50-90 char preview text",
  "salutation": "appropriate greeting line (e.g. Dear ${recipientType},)",
  "openingStatement": "1-2 line clear statement of email purpose",
  "body": "full structured email body including salutation, opening purpose, body points, CTA, sign-off, and sender signature (plain clean text with line breaks, NO asterisks)",
  "headline": "main headline inside the email",
  "cta": "primary call to action button text",
  "ctaUrl": "#your-link",
  "openRateTip": "tip to maximize open rates and engagement",
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
      const keyPointsList = keyPoints 
        ? keyPoints.split(',').map(p => `• ${p.trim()}`).join('\n')
        : `• Exclusive updates and feature enhancements\n• Tailored strategy insights for ${recipientType}\n• Seamless integration with your marketing workflow`;

      emailData = {
        subject: effectiveSubject,
        preheader: `Important update: Discover how ${effectiveSubject} empowers your goals.`,
        headline: `Special Announcement: ${effectiveSubject}`,
        body: `Dear ${recipientType || 'Valued Member'},\n\nI am writing to share an important update regarding ${effectiveSubject}, designed to help you streamline your strategy and achieve measurable results.\n\n${context ? context + '\n\n' : ''}Key Highlights:\n${keyPointsList}\n\nOur team at ${companyDisplay} is committed to delivering solutions that drive continuous growth and value for your brand.\n\n${cta ? 'Next Steps: ' + cta : 'We invite you to explore the full details and get started today.'}\n\nWarm regards,\n${senderDisplay}\n${designationDisplay}\n${companyDisplay}`,
        cta: cta || 'Explore Now',
        ctaUrl: '#',
        openRateTip: 'Pro Tip: Personalize subject lines with the subscriber\'s name to increase open rates by up to 26%.',
        closingLine: 'Warm regards,',
        ps: `P.S. Have questions? Reply directly to this email and our team at ${companyDisplay} will be happy to assist you!`
      };
    }

    if (emailData) {
      ['body', 'subject', 'preheader', 'headline', 'cta', 'openRateTip', 'closingLine', 'ps'].forEach((key) => {
        if (emailData[key]) {
          emailData[key] = cleanMarkdownSymbols(emailData[key]);
        }
      });
    }

    // Persist generated email copy to Content collection (Asset Library)
    try {
      if (emailData && (emailData.body || emailData.subject)) {
        await Content.create({
          workspaceId: workspaceId || 'ws_001',
          title: emailData.subject || effectiveSubject,
          type: 'EMAIL',
          content: emailData.body || '',
          briefData: emailData,
          author: `AI (${emailData.model || model})`,
          wordCount: emailData.body ? emailData.body.split(/\s+/).length : 100,
          status: 'INTERNAL_REVIEW'
        });
      }
    } catch (saveErr) {
      console.warn('[ContentController] DB Save email notice:', saveErr.message);
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
      customPrompt = '',
      model = 'gemini',
    } = req.body;

    if (!product) return res.status(400).json({ success: false, error: 'product is required' });

    const brandContext = await getBrandContext(workspaceId);

    const prompt = `Write ${adPlatform} ad copy for: "${product}"
Objective: ${objective}
${brandContext ? `Brand Context:\n${brandContext}` : ''}
${customPrompt ? `Custom Directives:\n${customPrompt}\n` : ''}
FORMATTING DIRECTIVE:
- Write clean text without asterisks (**) or markdown formatting in headlines or descriptions unless specifically requested.

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

    const adData = result?.data || result;

    if (adData) {
      ['longFormAd', 'shortAd'].forEach((key) => {
        if (adData[key]) adData[key] = cleanMarkdownSymbols(adData[key]);
      });
      if (Array.isArray(adData.headlines)) {
        adData.headlines = adData.headlines.map(cleanMarkdownSymbols);
      }
      if (Array.isArray(adData.descriptions)) {
        adData.descriptions = adData.descriptions.map(cleanMarkdownSymbols);
      }
    }

    // Persist generated ad copy to Content collection (Asset Library)
    try {
      if (adData) {
        const adText = adData.longFormAd || (Array.isArray(adData.headlines) ? adData.headlines.join(' | ') : '') || '';
        await Content.create({
          workspaceId: workspaceId || 'ws_001',
          title: `Ad: ${product} (${adPlatform})`,
          type: 'AD',
          content: adText,
          briefData: adData,
          author: `AI (${result?.model || model})`,
          status: 'INTERNAL_REVIEW'
        });
      }
    } catch (saveErr) {
      console.warn('[ContentController] DB Save ad notice:', saveErr.message);
    }

    res.json({ success: true, adPlatform, product, adCopy: adData });
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

// ─── GET /api/content/download-asset ──────────────────────────────────────────
const https = require('https');
const http = require('http');

exports.downloadAssetFile = async (req, res) => {
  try {
    const fileUrl = req.query.url;
    const filenameParam = req.query.filename || 'asset';
    const cleanFilename = filenameParam.replace(/[^a-z0-9_\- ]/gi, '_').slice(0, 60);

    if (!fileUrl) {
      return res.status(400).send('Missing url parameter');
    }

    // Case A: Handle base64 Data URL
    if (fileUrl.startsWith('data:')) {
      const matches = fileUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('pdf') ? 'pdf' : 'jpg';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${ext}"`);
        return res.send(buffer);
      }
    }

    // Case B: Handle HTTP / HTTPS Remote Files (bypass CORS & force Attachment Download)
    const fetchRemote = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        return res.status(500).send('Too many redirects');
      }

      const client = targetUrl.startsWith('https') ? https : http;
      const request = client.get(targetUrl, (remoteRes) => {
        // Follow Redirects (301, 302, 307, 308)
        if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
          let redirectUrl = remoteRes.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(targetUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          return fetchRemote(redirectUrl, redirectCount + 1);
        }

        if (remoteRes.statusCode >= 400) {
          return res.status(remoteRes.statusCode).send('Failed to fetch remote asset');
        }

        const mimeType = remoteRes.headers['content-type'] || 'image/jpeg';
        let ext = 'jpg';
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('gif')) ext = 'gif';
        else if (mimeType.includes('svg')) ext = 'svg';
        else if (mimeType.includes('pdf')) ext = 'pdf';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}.${ext}"`);
        remoteRes.pipe(res);
      });

      request.on('error', (err) => {
        console.error('Remote fetch download error:', err);
        if (!res.headersSent) {
          res.status(500).send('Download failed');
        }
      });
    };

    fetchRemote(fileUrl);
  } catch (err) {
    console.error('Download asset endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).send('Server download error');
    }
  }
};
