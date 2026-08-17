/**
 * Campaign Controller
 * Full CRUD + AI-powered campaign planning, post generation, and scheduling.
 */
const Campaign = require('../models/Campaign');
const CampaignPost = require('../models/CampaignPost');
const Workspace = require('../models/Workspace');
const BrandProfile = require('../models/BrandProfile');
const { generate, generateJSON } = require('../services/aiService');

// ─── Utility: Calculate Publishing Dates ─────────────────────────────────────
const calculatePublishingDates = (startDate, endDate, frequency) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const dates = [];
  const normalizedFreq = (frequency || '').trim().toLowerCase();

  if (normalizedFreq === 'daily') {
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
  } else if (normalizedFreq.endsWith('per week') || normalizedFreq === 'weekly') {
    let countPerWeek = 1;
    if (normalizedFreq.startsWith('2x')) countPerWeek = 2;
    else if (normalizedFreq.startsWith('3x')) countPerWeek = 3;
    else if (normalizedFreq.startsWith('4x')) countPerWeek = 4;
    else if (normalizedFreq.startsWith('5x')) countPerWeek = 5;

    let currentWeekStart = new Date(start);
    while (currentWeekStart <= end) {
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      const actualEnd = currentWeekEnd > end ? end : currentWeekEnd;
      const daysInThisWeek = Math.ceil((actualEnd - currentWeekStart) / (1000 * 60 * 60 * 24)) + 1;
      const step = daysInThisWeek / countPerWeek;
      for (let i = 0; i < countPerWeek; i++) {
        const offset = Math.floor(i * step + step / 2);
        if (offset < daysInThisWeek) {
          const d = new Date(currentWeekStart);
          d.setDate(currentWeekStart.getDate() + offset);
          if (d <= end) dates.push(d);
        }
      }
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
  } else if (normalizedFreq === 'bi weekly' || normalizedFreq === 'biweekly') {
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 14);
    }
  } else if (normalizedFreq === 'monthly') {
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
  }

  // Unique dates only
  const seen = {};
  return dates.filter((d) => {
    const key = d.toISOString().split('T')[0];
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).sort((a, b) => a - b);
};

// ─── GET /api/campaigns ───────────────────────────────────────────────────────
exports.listCampaigns = async (req, res) => {
  try {
    const { workspaceId, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (workspaceId) filter.workspaceId = workspaceId;
    if (status) filter.status = status;

    const campaigns = await Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Campaign.countDocuments(filter);

    res.json({ success: true, campaigns, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/campaigns/:id ───────────────────────────────────────────────────
exports.getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/campaigns ──────────────────────────────────────────────────────
exports.createCampaign = async (req, res) => {
  try {
    const {
      workspaceId,
      campaignName,
      campaignGoal,
      startDate,
      endDate,
      postingFrequency,
      platforms,
      budget,
      targetAudience,
    } = req.body;

    if (!workspaceId || !campaignName || !campaignGoal || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'workspaceId, campaignName, campaignGoal, startDate, endDate are required',
      });
    }

    const campaign = await Campaign.create({
      workspaceId,
      campaignName,
      campaignGoal,
      startDate,
      endDate,
      postingFrequency: postingFrequency || 'Daily',
      platforms: platforms || [],
      budget: budget || 0,
      targetAudience: targetAudience || '',
      status: 'Draft',
    });

    console.log(`✅ Campaign Created: "${campaignName}" (${campaign._id})`);
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PUT /api/campaigns/:id ───────────────────────────────────────────────────
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── DELETE /api/campaigns/:id ────────────────────────────────────────────────
exports.deleteCampaign = async (req, res) => {
  try {
    await Campaign.findByIdAndDelete(req.params.id);
    await CampaignPost.deleteMany({ campaignId: req.params.id });
    res.json({ success: true, message: 'Campaign and all posts deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/campaigns/:id/generate-plan ────────────────────────────────────
// AI-powered campaign plan: creates posts for every scheduled date + platform.
// If strategyPlan (from the Strategy module's 30-day plan) is provided in the
// request body, it is used directly to map topics/platforms/pillars per date.
exports.generateCampaignPlan = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

    // Get brand profile for context
    let brandContext = '';
    try {
      const brand = await BrandProfile.findOne({ workspaceId: campaign.workspaceId });
      if (brand && brand.structuredIdentity) {
        brandContext = JSON.stringify(brand.structuredIdentity, null, 2);
      }
    } catch {}

    const dates = calculatePublishingDates(campaign.startDate, campaign.endDate, campaign.postingFrequency);
    const platforms = campaign.platforms.length > 0 ? campaign.platforms : ['instagram'];

    if (dates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid posting dates calculated' });
    }

    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const CAMPAIGN_STAGES = ['Awareness', 'Consideration', 'Conversion', 'Retention'];
    const CONTENT_TYPES = ['Educational', 'Promotional', 'Engagement', 'Behind the Scenes', 'User Story', 'Product Spotlight'];

    // ─── STRATEGY PLAN MODE ────────────────────────────────────────────────────
    // If a 30-day strategy plan is provided (from the Strategy module),
    // use it directly to map topics, platforms, and pillars per posting date.
    const strategyPlan = req.body.strategyPlan; // Array of { day, title, topic, platform, pillar, action }

    if (strategyPlan && Array.isArray(strategyPlan) && strategyPlan.length > 0) {
      console.log(`[Campaign AI] Strategy-driven mode: mapping ${dates.length} dates from ${strategyPlan.length}-day strategy plan...`);

      // Delete existing posts for this campaign
      await CampaignPost.deleteMany({ campaignId: campaign._id });

      const postsToCreate = [];

      for (let i = 0; i < dates.length; i++) {
        const postDate = dates[i];
        const dayName = DAYS[postDate.getDay()];

        // Map each date to the corresponding strategy day (cycle if plan is shorter than dates)
        const strategyIndex = i % strategyPlan.length;
        const stratDay = strategyPlan[strategyIndex];

        // Determine platform: prefer strategy plan platform, fallback to campaign platforms
        let platform = (stratDay.platform || platforms[i % platforms.length] || 'Instagram').toLowerCase();
        // Normalize common platform names
        if (platform.includes('seo') || platform.includes('blog')) platform = 'blog';
        else if (platform.includes('linkedin')) platform = 'linkedin';
        else if (platform.includes('instagram') || platform.includes('reels')) platform = 'instagram';
        else if (platform.includes('email') || platform.includes('newsletter')) platform = 'email';
        else if (platform.includes('youtube') || platform.includes('video')) platform = 'youtube';
        else if (platform.includes('twitter') || platform.includes('x.com')) platform = 'twitter';

        // Determine campaign stage based on position in plan
        const stageIndex = Math.floor((i / dates.length) * CAMPAIGN_STAGES.length);
        const campaignStage = CAMPAIGN_STAGES[Math.min(stageIndex, CAMPAIGN_STAGES.length - 1)];

        // Build content type from pillar
        const pillar = stratDay.pillar || stratDay.topic || '';
        const contentType = pillar.toLowerCase().includes('educat') ? 'Educational'
          : pillar.toLowerCase().includes('promo') ? 'Promotional'
          : pillar.toLowerCase().includes('proof') || pillar.toLowerCase().includes('testimon') ? 'User Story'
          : pillar.toLowerCase().includes('behind') ? 'Behind the Scenes'
          : CONTENT_TYPES[i % CONTENT_TYPES.length];

        const postObjective = stratDay.action || stratDay.topic || stratDay.title || campaign.campaignGoal;
        const topic = stratDay.topic || stratDay.title || campaign.campaignName;

        postsToCreate.push({
          campaignId: campaign._id,
          workspaceId: campaign.workspaceId,
          date: postDate,
          day: dayName,
          platform,
          contentType,
          campaignStage,
          postObjective,
          prompt: `Create a ${platform} post about: ${topic}. Pillar: ${pillar}. Stage: ${campaignStage}.`,
          postType: platform === 'instagram' ? 'Image' : platform === 'youtube' ? 'Video' : platform === 'linkedin' ? 'Article' : 'Image',
          carouselImages: 0,
          postFor: pillar || 'Brand Awareness',
          imagePrompt: `Professional ${platform} visual for: ${topic}`,
          captionPrompt: `Write a compelling ${platform} caption for: "${topic}". Focus on ${pillar}. Campaign stage: ${campaignStage}. Include relevant hashtags.`,
          status: 'Draft',
          bestPostingTime: platform === 'linkedin' ? '9:00 AM' : platform === 'instagram' ? '6:00 PM' : '10:00 AM',
        });
      }

      const createdPosts = await CampaignPost.insertMany(postsToCreate);

      await Campaign.findByIdAndUpdate(campaign._id, {
        totalPosts: createdPosts.length,
        status: 'Active',
        aiGeneratedStrategy: strategyPlan.slice(0, 3),
      });

      console.log(`✅ [Strategy-Driven] Generated ${createdPosts.length} posts for "${campaign.campaignName}" using strategy plan.`);
      return res.json({
        success: true,
        message: `Generated ${createdPosts.length} campaign posts from strategy plan`,
        posts: createdPosts,
        totalDates: dates.length,
        source: 'strategy_plan',
      });
    }

    // ─── GENERIC AI MODE (fallback when no strategy plan is provided) ──────────
    const prompt = `You are a professional social media campaign strategist.
    
Campaign Details:
- Name: ${campaign.campaignName}
- Goal: ${campaign.campaignGoal}
- Duration: ${dates.length} days (${campaign.startDate} to ${campaign.endDate})
- Posting Frequency: ${campaign.postingFrequency}
- Platforms: ${platforms.join(', ')}
- Target Audience: ${campaign.targetAudience || 'General audience'}
- Budget: ${campaign.budget > 0 ? `₹${campaign.budget}` : 'Not specified'}

${brandContext ? `Brand Identity:\n${brandContext}` : ''}

Generate a strategic content plan as a JSON array. Each entry must have:
{
  "date_index": 0, // index into the dates array
  "platform": "instagram",
  "contentType": "Educational",
  "campaignStage": "Awareness",
  "postObjective": "specific objective for this post",
  "postType": "Image", // Image | Carousel | Reel | Story
  "carouselImages": 0, // number if carousel
  "postFor": "Brand Awareness",
  "prompt": "specific AI image generation prompt",
  "captionPrompt": "specific prompt to generate the social media caption",
  "imagePrompt": "detailed visual description for image generation"
}

Create one entry per posting date per platform (${dates.length * platforms.length} total entries).
Vary the campaign stages from Awareness → Consideration → Conversion → Retention.
Make each post unique and strategic.`;

    console.log(`[Campaign AI] Generating plan for ${dates.length} dates × ${platforms.length} platforms...`);
    let entries = null;

    try {
      const aiResponse = await generateJSON(prompt, { temperature: 0.8 });
      entries = aiResponse?.data || (Array.isArray(aiResponse) ? aiResponse : null);
    } catch (aiErr) {
      console.warn('[Campaign AI] AI generation error, using smart strategy fallback generator:', aiErr.message);
    }

    // ─── GUARANTEED 30-DAY FALLBACK PLAN GENERATOR ────────────────────────────
    // If AI provider fails, is rate-limited, or returns non-array output,
    // construct a high-converting, fully customized 30-day campaign plan.
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      console.log(`[Campaign AI] Constructing structured 30-day plan for ${dates.length} dates...`);
      entries = [];
      
      const pillars = ['Brand Identity & Values', 'Product Benefits & Features', 'Social Proof & Testimonials', 'Industry Trends & Insights', 'Special Offer & CTA'];

      for (let i = 0; i < dates.length; i++) {
        for (let p = 0; p < platforms.length; p++) {
          const platform = (platforms[p] || 'instagram').toLowerCase();
          const stageIndex = Math.floor((i / dates.length) * CAMPAIGN_STAGES.length);
          const stage = CAMPAIGN_STAGES[Math.min(stageIndex, CAMPAIGN_STAGES.length - 1)];
          const pillar = pillars[i % pillars.length];
          const contentType = CONTENT_TYPES[i % CONTENT_TYPES.length];

          entries.push({
            date_index: i,
            platform,
            contentType,
            campaignStage: stage,
            postObjective: `${stage} drive for ${campaign.campaignName}: ${pillar}`,
            postType: platform === 'instagram' ? 'Image' : platform === 'youtube' ? 'Video' : platform === 'linkedin' ? 'Article' : 'Image',
            carouselImages: 0,
            postFor: pillar,
            prompt: `High-converting ${platform} content piece for ${campaign.campaignName}. Pillar: ${pillar}. Stage: ${stage}.`,
            captionPrompt: `Write an engaging ${platform} caption for "${campaign.campaignName}" focusing on ${pillar}. Include CTA and hashtags.`,
            imagePrompt: `Clean, modern visual representing ${pillar} for ${campaign.campaignName}`,
          });
        }
      }
    }

    // Delete existing posts for this campaign
    try {
      await CampaignPost.deleteMany({ campaignId: campaign._id });
    } catch (dbErr) {
      console.warn('[Campaign AI] DB delete error:', dbErr.message);
    }

    // Create CampaignPost documents
    const postsToCreate = [];
    for (const entry of entries) {
      const dateIndex = typeof entry.date_index === 'number' ? entry.date_index : 0;
      const postDate = dates[dateIndex] || dates[0] || new Date();
      const dayName = DAYS[postDate.getDay()];

      postsToCreate.push({
        campaignId: campaign._id,
        workspaceId: campaign.workspaceId,
        date: postDate,
        day: dayName,
        platform: (entry.platform || platforms[0] || 'instagram').toLowerCase(),
        contentType: entry.contentType || CONTENT_TYPES[0],
        campaignStage: entry.campaignStage || CAMPAIGN_STAGES[0],
        postObjective: entry.postObjective || campaign.campaignGoal,
        prompt: entry.prompt || `Content plan for ${campaign.campaignName}`,
        postType: entry.postType || 'Image',
        carouselImages: entry.carouselImages || 0,
        postFor: entry.postFor || 'Brand Awareness',
        imagePrompt: entry.imagePrompt || `Visual for ${campaign.campaignName}`,
        captionPrompt: entry.captionPrompt || `Caption for ${campaign.campaignName}`,
        status: 'Draft',
        bestPostingTime: '10:00 AM',
      });
    }

    let createdPosts = [];
    try {
      createdPosts = await CampaignPost.insertMany(postsToCreate);
    } catch (dbErr) {
      console.warn('[Campaign AI] DB insertMany error, using memory fallback:', dbErr.message);
      createdPosts = postsToCreate.map((p, idx) => ({ ...p, _id: `cpost_${Date.now()}_${idx}` }));
    }

    // Update campaign stats
    try {
      await Campaign.findByIdAndUpdate(campaign._id, {
        totalPosts: createdPosts.length,
        aiGeneratedStrategy: entries.slice(0, 3),
        status: 'Active',
      });
    } catch (dbErr) {
      console.warn('[Campaign AI] Campaign update error:', dbErr.message);
    }

    console.log(`✅ Generated ${createdPosts.length} campaign posts for "${campaign.campaignName}"`);
    return res.json({
      success: true,
      message: `Generated ${createdPosts.length} campaign posts`,
      posts: createdPosts,
      totalDates: dates.length,
      totalPlatforms: platforms.length,
    });
  } catch (err) {
    console.error('[Campaign AI] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/campaigns/:id/posts ─────────────────────────────────────────────
exports.getCampaignPosts = async (req, res) => {
  try {
    const { status, platform } = req.query;
    const filter = { campaignId: req.params.id };
    if (status) filter.status = status;
    if (platform) filter.platform = platform;

    const posts = await CampaignPost.find(filter).sort({ date: 1 });
    res.json({ success: true, posts, total: posts.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/campaigns/posts/:postId/generate-content ───────────────────────
// Generate AI caption + image for a single campaign post
exports.generatePostContent = async (req, res) => {
  try {
    const post = await CampaignPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    const { includeImage = false } = req.body;

    // Build context from campaign + brand
    const campaign = await Campaign.findById(post.campaignId);
    let brandContext = '';
    try {
      const brand = await BrandProfile.findOne({ workspaceId: post.workspaceId });
      if (brand && brand.structuredIdentity) {
        brandContext = JSON.stringify(brand.structuredIdentity);
      }
    } catch {}

    // Generate caption
    const captionPrompt = post.captionPrompt || `Write a ${post.platform} caption for a ${post.contentType} post about ${post.postObjective}. 
Campaign: ${campaign?.campaignName || 'Brand Campaign'}. Stage: ${post.campaignStage}.
Include relevant hashtags. Make it engaging and platform-appropriate.
${brandContext ? `Brand context: ${brandContext}` : ''}
Return JSON: { "caption": "...", "hashtags": ["#tag1", "#tag2"], "cta": "..." }`;

    const captionResult = await generateJSON(captionPrompt, { temperature: 0.85 });

    const updateData = {
      caption: captionResult?.caption || '',
      hashtags: captionResult?.hashtags || [],
      cta: captionResult?.cta || '',
      status: 'Generated',
    };

    // TODO: When image generation service is connected, generate image here
    // For now we mark as generated and return placeholder
    if (includeImage && post.imagePrompt) {
      updateData.generatedImage = `https://picsum.photos/seed/${post._id}/800/800`;
    }

    const updatedPost = await CampaignPost.findByIdAndUpdate(req.params.postId, updateData, { returnDocument: 'after' });
    res.json({ success: true, post: updatedPost });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PUT /api/campaigns/posts/:postId ───────────────────────────────────────
exports.updatePost = async (req, res) => {
  try {
    const post = await CampaignPost.findByIdAndUpdate(
      req.params.postId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PATCH /api/campaigns/posts/:postId/status ────────────────────────────────
exports.updatePostStatus = async (req, res) => {
  try {
    const { status, approvalStatus, notes } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (approvalStatus) updateData.approvalStatus = approvalStatus;
    if (notes) updateData.notes = notes;

    const post = await CampaignPost.findByIdAndUpdate(req.params.postId, updateData, { returnDocument: 'after' });
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/campaigns/dates/calculate ──────────────────────────────────────
exports.calculateDates = async (req, res) => {
  try {
    const { startDate, endDate, postingFrequency } = req.body;
    if (!startDate || !endDate || !postingFrequency) {
      return res.status(400).json({ success: false, error: 'startDate, endDate, and postingFrequency are required' });
    }
    const dates = calculatePublishingDates(startDate, endDate, postingFrequency);
    res.json({ success: true, dates: dates.map((d) => d.toISOString().split('T')[0]), count: dates.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
