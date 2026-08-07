/**
 * Auto-Pilot Controller — End-to-End Campaign Generator
 * Uses Server-Sent Events (SSE) to stream real-time progress to the frontend.
 * 
 * Flow: Brand URL → SEO Intelligence → Strategy → Calendar → Content → Approvals
 */
const mongoose = require('mongoose');
const BrandProfile = require('../models/BrandProfile');
const Workspace = require('../models/Workspace');
const Campaign = require('../models/Campaign');
const CampaignPost = require('../models/CampaignPost');
const Content = require('../models/Content');
const { generate, generateJSON } = require('../services/aiService');
const axios = require('axios');
const cheerio = require('cheerio');

// ─── Helper: Scrape URL ───────────────────────────────────────────────────────
const scrapeUrl = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIAdsBot/1.0)' },
    });
    const $ = cheerio.load(response.data);
    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href') || '';
    const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 3000);
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
      url, title: ogTitle || title, description: ogDesc || metaDesc,
      bodyText, favicon: favicon.startsWith('http') ? favicon : `${url}/${favicon}`,
      socialLinks: socials,
    };
  } catch {
    return { url, title: '', description: '', bodyText: '', favicon: '', socialLinks: {} };
  }
};

// ─── Helper: Get Brand Context String ─────────────────────────────────────────
const getBrandContext = async (workspaceId) => {
  if (!workspaceId) return '';
  try {
    const brand = await BrandProfile.findOne({ workspaceId });
    if (brand && brand.structuredIdentity) return JSON.stringify(brand.structuredIdentity, null, 2);
  } catch {}
  return '';
};

// ─── SSE Helper ───────────────────────────────────────────────────────────────
const sendSSE = (res, step, status, message, data = null) => {
  const payload = { step, status, message, timestamp: new Date().toISOString() };
  if (data) payload.data = data;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

// ─── POST /api/autopilot/generate (SSE Stream) ───────────────────────────────
exports.generateFullPipeline = async (req, res) => {
  const { workspaceId, brandUrl, days = 30, frequency = 'daily', model = 'gemini' } = req.body;

  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'workspaceId is required' });
  }
  if (!brandUrl) {
    return res.status(400).json({ success: false, error: 'brandUrl is required' });
  }

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Brand Scraping & Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    sendSSE(res, 1, 'running', '🔍 Scraping brand URL and analyzing identity...');

    const scraped = await scrapeUrl(brandUrl);
    if (aborted) return;

    const brandName = scraped.title || 'Brand';
    const brandInput = scraped.bodyText || scraped.description || '';

    const brandPrompt = `You are an expert brand strategist. Analyze this brand and return a comprehensive brand intelligence report.

Brand: ${brandName}
Website: ${brandUrl}
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
  "posting_frequency": "${frequency}",
  "goal": "main business goal",
  "mission_statement": "...",
  "tagline": "...",
  "competitor_landscape": ["competitor1", "competitor2"],
  "unique_selling_points": ["usp1", "usp2"],
  "content_dos": ["do1", "do2"],
  "content_donts": ["dont1", "dont2"],
  "ai_confidence": 85
}`;

    const brandAnalysis = await generateJSON(brandPrompt, { model, temperature: 0.6 });
    if (!brandAnalysis) throw new Error('Brand analysis failed');
    if (aborted) return;

    // Save brand profile
    const brandData = {
      workspaceId,
      companyName: brandAnalysis.brand_name || brandName,
      website: brandUrl,
      extractedBrandSummary: brandInput.substring(0, 500),
      structuredIdentity: brandAnalysis,
      socialMediaLinks: scraped.socialLinks || {},
      brandColors: brandAnalysis.color_palette || [],
      logoUrl: scraped.favicon || '',
      aiConfidence: brandAnalysis.ai_confidence || 85,
      companyInformation: { name: brandAnalysis.brand_name || brandName, website: brandUrl },
      brandIdentity: { tone: brandAnalysis.tone, tagline: brandAnalysis.tagline, mission: brandAnalysis.mission_statement },
      brandPersonality: { values: brandAnalysis.brand_values, usps: brandAnalysis.unique_selling_points },
      brandVoice: { style: brandAnalysis.tone, dos: brandAnalysis.content_dos, donts: brandAnalysis.content_donts },
      targetAudienceSection: { description: brandAnalysis.target_audience },
      products: { list: brandAnalysis.products_services },
      contentStrategy: { angles: brandAnalysis.content_angles, goal: brandAnalysis.goal, platforms: brandAnalysis.platform_focus },
      competitors: { list: brandAnalysis.competitor_landscape },
    };

    await BrandProfile.findOneAndUpdate(
      { workspaceId },
      { $set: brandData },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Also update workspace
    if (mongoose.Types.ObjectId.isValid(workspaceId)) {
      await Workspace.findByIdAndUpdate(workspaceId, {
        brandName: brandAnalysis.brand_name || brandName,
        faviconUrl: scraped.favicon || '',
        brandColors: brandAnalysis.color_palette || [],
        targetAudience: brandAnalysis.target_audience || '',
        brandVoiceTone: brandAnalysis.tone || '',
        contentPillars: brandAnalysis.content_angles || [],
        missionStatement: brandAnalysis.mission_statement || '',
        tagline: brandAnalysis.tagline || '',
        industryCategory: brandAnalysis.industry || '',
        domainUrl: brandUrl,
      });
    }

    sendSSE(res, 1, 'done', `✅ Brand "${brandAnalysis.brand_name}" analyzed successfully`, {
      brandName: brandAnalysis.brand_name,
      industry: brandAnalysis.industry,
      confidence: brandAnalysis.ai_confidence,
    });

    if (aborted) return;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: SEO Intelligence
    // ═══════════════════════════════════════════════════════════════════════════
    sendSSE(res, 2, 'running', '🔎 Generating SEO intelligence & keyword clusters...');

    const seedKeyword = brandAnalysis.content_angles?.[0] || `${brandAnalysis.brand_name} ${brandAnalysis.industry}`;
    const brandContext = JSON.stringify(brandAnalysis, null, 2);

    const seoPrompt = `Create a comprehensive SEO content brief for keyword: "${seedKeyword}"
Industry: ${brandAnalysis.industry || 'general'}
Target Audience: ${brandAnalysis.target_audience || 'general'}
Brand Context:
${brandContext}

Return JSON:
{
  "primaryKeyword": "...",
  "secondaryKeywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "suggestedTitles": ["title1", "title2", "title3"],
  "metaDescription": "150-160 chars",
  "contentOutline": ["H2: Section1", "H2: Section2", "H2: Section3"],
  "wordCountTarget": 1500,
  "searchIntent": "informational|transactional|navigational",
  "competitorTopics": ["topic1", "topic2"],
  "faqSuggestions": ["Q1?", "Q2?", "Q3?"],
  "topicClusters": [
    {"cluster": "cluster name", "keywords": ["kw1", "kw2"], "contentType": "blog|social|video"},
    {"cluster": "cluster name 2", "keywords": ["kw3", "kw4"], "contentType": "blog|social|video"}
  ]
}`;

    const seoBrief = await generateJSON(seoPrompt, { model, temperature: 0.6 });
    if (!seoBrief) throw new Error('SEO Brief generation failed');
    if (aborted) return;

    sendSSE(res, 2, 'done', `✅ SEO Brief generated — Primary: "${seoBrief.primaryKeyword}"`, {
      primaryKeyword: seoBrief.primaryKeyword,
      secondaryKeywords: seoBrief.secondaryKeywords,
      topicClusters: seoBrief.topicClusters,
    });

    if (aborted) return;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Strategy Generation
    // ═══════════════════════════════════════════════════════════════════════════
    sendSSE(res, 3, 'running', '🎯 Building content strategy from SEO data...');

    const strategyPrompt = `You are a world-class content strategist. Based on the SEO intelligence and brand identity below, create a complete ${days}-day content marketing strategy.

Brand: ${brandAnalysis.brand_name}
Industry: ${brandAnalysis.industry}
Target Audience: ${brandAnalysis.target_audience}
Tone: ${brandAnalysis.tone}
Platforms: ${(brandAnalysis.platform_focus || ['instagram', 'linkedin']).join(', ')}
SEO Primary Keyword: ${seoBrief.primaryKeyword}
SEO Secondary Keywords: ${(seoBrief.secondaryKeywords || []).join(', ')}
Topic Clusters: ${JSON.stringify(seoBrief.topicClusters || [])}
Posting Frequency: ${frequency}
Duration: ${days} days

Return JSON:
{
  "strategyName": "A catchy strategy name",
  "primaryGoal": "Main measurable goal",
  "contentPillars": [
    {"name": "pillar name", "description": "short desc", "percentage": 30},
    {"name": "pillar name 2", "description": "short desc", "percentage": 25}
  ],
  "channelStrategy": [
    {"platform": "Instagram", "postTypes": ["carousel", "reels", "story"], "frequency": "5x/week", "bestTime": "9-11 AM"},
    {"platform": "LinkedIn", "postTypes": ["article", "post"], "frequency": "3x/week", "bestTime": "8-10 AM"}
  ],
  "weeklyThemes": [
    {"week": 1, "theme": "Brand Introduction", "focus": "awareness"},
    {"week": 2, "theme": "Product Deep Dives", "focus": "consideration"}
  ],
  "ctaStrategy": "primary CTA approach",
  "leadMagnet": "lead magnet idea",
  "kpis": ["KPI 1", "KPI 2", "KPI 3"]
}`;

    const strategy = await generateJSON(strategyPrompt, { model, temperature: 0.7 });
    if (!strategy) throw new Error('Strategy generation failed');
    if (aborted) return;

    sendSSE(res, 3, 'done', `✅ Strategy "${strategy.strategyName}" created`, {
      strategyName: strategy.strategyName,
      primaryGoal: strategy.primaryGoal,
      contentPillars: strategy.contentPillars,
      channelStrategy: strategy.channelStrategy,
    });

    if (aborted) return;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Calendar & Post Plan Generation
    // ═══════════════════════════════════════════════════════════════════════════
    sendSSE(res, 4, 'running', `📅 Generating ${days}-day content calendar...`);

    // Calculate number of posts based on frequency
    let postsPerWeek = 7;
    if (frequency === '3x/week' || frequency === '3x') postsPerWeek = 3;
    else if (frequency === '5x/week' || frequency === '5x') postsPerWeek = 5;
    else if (frequency === 'weekly') postsPerWeek = 1;
    const totalPosts = Math.ceil((days / 7) * postsPerWeek);

    const calendarPrompt = `You are a content calendar planner. Create exactly ${totalPosts} social media posts spread over ${days} days for the brand "${brandAnalysis.brand_name}".

Strategy: ${strategy.strategyName}
Content Pillars: ${JSON.stringify(strategy.contentPillars)}
Channel Strategy: ${JSON.stringify(strategy.channelStrategy)}
SEO Keywords: ${(seoBrief.secondaryKeywords || []).join(', ')}
Brand Tone: ${brandAnalysis.tone}
Platforms: ${(brandAnalysis.platform_focus || ['instagram', 'linkedin']).join(', ')}

For each post, assign a date starting from today. Distribute evenly across the ${days} days.

Return JSON:
{
  "posts": [
    {
      "dayNumber": 1,
      "platform": "Instagram",
      "contentType": "carousel|reel|story|post|article|video",
      "topic": "specific post topic",
      "pillar": "which content pillar this belongs to",
      "objective": "awareness|engagement|conversion|education",
      "seoKeyword": "target keyword for this post"
    }
  ]
}

Generate exactly ${totalPosts} posts. Spread them across different platforms and pillars.`;

    const calendarPlan = await generateJSON(calendarPrompt, { model, temperature: 0.75 });
    if (!calendarPlan || !calendarPlan.posts) throw new Error('Calendar generation failed');
    if (aborted) return;

    // Create Campaign in DB
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    let campaign;
    try {
      campaign = await Campaign.create({
        workspaceId,
        name: strategy.strategyName || `${brandAnalysis.brand_name} Auto-Pilot Campaign`,
        status: 'active',
        frequency,
        startDate,
        endDate,
        totalPosts: calendarPlan.posts.length,
      });
    } catch (err) {
      console.log('[AutoPilot] Campaign creation note:', err.message);
      campaign = { _id: new mongoose.Types.ObjectId(), name: strategy.strategyName };
    }

    // Save calendar posts to DB
    const savedPosts = [];
    for (let i = 0; i < calendarPlan.posts.length; i++) {
      const post = calendarPlan.posts[i];
      const postDate = new Date(startDate);
      postDate.setDate(postDate.getDate() + (post.dayNumber - 1));

      try {
        const dbPost = await CampaignPost.create({
          campaignId: campaign._id,
          workspaceId,
          scheduledDate: postDate,
          platform: post.platform,
          contentType: post.contentType,
          topic: post.topic,
          pillar: post.pillar,
          objective: post.objective,
          seoKeyword: post.seoKeyword,
          status: 'planned',
        });
        savedPosts.push(dbPost);
      } catch (err) {
        savedPosts.push({ ...post, _id: new mongoose.Types.ObjectId(), scheduledDate: postDate });
      }
    }

    sendSSE(res, 4, 'done', `✅ Calendar created — ${calendarPlan.posts.length} posts scheduled over ${days} days`, {
      campaignId: campaign._id,
      totalPosts: calendarPlan.posts.length,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    if (aborted) return;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Content Generation (Batch — generate for first 7 posts)
    // ═══════════════════════════════════════════════════════════════════════════
    const batchSize = Math.min(7, calendarPlan.posts.length);
    sendSSE(res, 5, 'running', `✍️ Generating content for first ${batchSize} posts...`);

    const generatedContent = [];
    for (let i = 0; i < batchSize; i++) {
      if (aborted) return;

      const post = calendarPlan.posts[i];
      sendSSE(res, 5, 'running', `✍️ Generating post ${i + 1}/${batchSize}: ${post.topic}`);

      const contentPrompt = `Write a compelling ${post.platform} ${post.contentType} post.

Topic: "${post.topic}"
Platform: ${post.platform}
Content Type: ${post.contentType}
Objective: ${post.objective}
SEO Keyword: ${post.seoKeyword || seoBrief.primaryKeyword}
Brand: ${brandAnalysis.brand_name}
Tone: ${brandAnalysis.tone}
Brand Context: ${brandContext.substring(0, 1000)}

Return JSON:
{
  "caption": "full compelling post caption (200-400 words for LinkedIn/Blog, 100-200 for Instagram/Twitter)",
  "shortCaption": "under 150 chars version",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "cta": "clear call to action",
  "hook": "opening hook line",
  "imagePrompt": "detailed visual description for AI image generation",
  "bestTimeToPost": "optimal posting time"
}`;

      try {
        const content = await generateJSON(contentPrompt, { model, temperature: 0.85 });
        if (content) {
          generatedContent.push({ postIndex: i, ...content, topic: post.topic, platform: post.platform });

          // Update the post in DB with generated content
          if (savedPosts[i] && savedPosts[i]._id) {
            try {
              await CampaignPost.findByIdAndUpdate(savedPosts[i]._id, {
                caption: content.caption,
                hashtags: content.hashtags,
                cta: content.cta,
                hook: content.hook,
                imagePrompt: content.imagePrompt,
                status: 'generated',
              });
            } catch {}
          }

          // Also save to Content collection for Approvals Desk
          try {
            await Content.create({
              workspaceId,
              title: `${post.platform}: ${post.topic}`,
              type: 'SOCIAL',
              platform: post.platform,
              content: content.caption,
              briefData: content,
              author: `AI AutoPilot (${model})`,
              status: 'INTERNAL_REVIEW',
              factCheck: { passed: false, score: 0, status: 'PENDING' },
            });
          } catch {}
        }
      } catch (err) {
        console.log(`[AutoPilot] Content generation failed for post ${i}:`, err.message);
      }
    }

    sendSSE(res, 5, 'done', `✅ ${generatedContent.length} posts content generated and sent to Approvals`, {
      generated: generatedContent.length,
      totalPlanned: calendarPlan.posts.length,
      remaining: calendarPlan.posts.length - generatedContent.length,
    });

    if (aborted) return;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: Creative Prompts Ready
    // ═══════════════════════════════════════════════════════════════════════════
    sendSSE(res, 6, 'running', '🎨 Preparing creative studio image prompts...');

    const imagePrompts = generatedContent
      .filter(c => c.imagePrompt)
      .map((c, i) => ({
        postIndex: i,
        platform: c.platform,
        topic: c.topic,
        imagePrompt: c.imagePrompt,
      }));

    sendSSE(res, 6, 'done', `✅ ${imagePrompts.length} image prompts ready for Creative Studio`, {
      imagePrompts,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FINAL: Complete Summary
    // ═══════════════════════════════════════════════════════════════════════════
    sendSSE(res, 7, 'complete', '🎉 Auto-Pilot Pipeline Complete!', {
      summary: {
        brandName: brandAnalysis.brand_name,
        industry: brandAnalysis.industry,
        strategyName: strategy.strategyName,
        primaryGoal: strategy.primaryGoal,
        seoKeyword: seoBrief.primaryKeyword,
        totalPostsPlanned: calendarPlan.posts.length,
        contentGenerated: generatedContent.length,
        creativesReady: imagePrompts.length,
        campaignId: campaign._id,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      },
      brandAnalysis,
      seoBrief,
      strategy,
    });

    res.end();
  } catch (err) {
    console.error('[AutoPilot] Pipeline Error:', err.message);
    sendSSE(res, 0, 'error', `❌ Pipeline failed: ${err.message}`);
    res.end();
  }
};
