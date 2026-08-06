require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Workspace = require('./models/Workspace');

const Content = require('./models/Content');
const Calendar = require('./models/Calendar');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { scrapeDomainUrl, parseBrandDocument, generateBrandDNA } = require('./modules/workspace/scraper.service');
const { verifyContentClaims } = require('./modules/factCheck/factCheck.service');
const { generateSeoBrief, generateSocialPosts, generateBlogArticle, transformRepurposeContent } = require('./modules/seo/vertex.service');
const { getCreditBalance, deductCredits, topUpCredits, setSubscriptionTier } = require('./modules/creative/credit.service');
const { generateWebsiteCode } = require('./modules/websiteBuilder/websiteBuilder.service');

const app = express();
const PORT = process.env.PORT || 5000;


// Connect to MongoDB Atlas Cloud
connectDB();

app.use(cors());
app.use(express.json());

// Memory Store Fallback
let memoryWorkspaces = [];


let memoryContentStore = [
  {
    id: 'cnt_001',
    workspaceId: 'ws_001',
    title: 'How AI Ads Transforms Agency Content Production Velocity',
    type: 'BLOG',
    status: 'APPROVED',
    wordCount: 2150,
    author: 'Senior Copywriter',
    approver: 'Client Marketing Director',
    factCheck: { passed: true, score: 100, status: 'VERIFIED' },
    createdAt: '2026-07-22T10:00:00Z',
    scheduledDate: '2026-07-28'
  }
];

let memoryCalendar = [
  { id: 'cal_1', title: 'SEO Pillar Launch: Content Velocity', date: '2026-07-27', platform: 'Blog', pillar: 'Enterprise AI', status: 'SCHEDULED', owner: 'SEO Lead' },
  { id: 'cal_2', title: 'LinkedIn Carousel: Brand DNA 101', date: '2026-07-28', platform: 'LinkedIn', pillar: 'Brand Governance', status: 'APPROVED', owner: 'Senior Copywriter' }
];

// --- API ENDPOINTS ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'AI Ads Enterprise Backend API v1.0', timestamp: new Date().toISOString() });
});

// 1. Workspace / Brand DNA Endpoints (MongoDB Atlas Integration)
app.get('/api/workspace/list', async (req, res) => {
  try {
    const dbWorkspaces = await Workspace.find().sort({ createdAt: -1 });
    if (dbWorkspaces && dbWorkspaces.length > 0) {
      return res.json({ success: true, workspaces: dbWorkspaces });
    }
  } catch (err) {
    console.log('MongoDB Read Fallback to Memory Workspaces:', err.message);
  }
  res.json({ success: true, workspaces: memoryWorkspaces });
});

app.post('/api/workspace/create', async (req, res) => {
  const { domainUrl, brandName } = req.body;
  if (!domainUrl) return res.status(400).json({ success: false, error: 'Domain URL is required' });

  const scraped = await scrapeDomainUrl(domainUrl);
  
  const workspaceData = {
    brandName: brandName || scraped.brandName || 'New Brand',
    domainUrl: scraped.domainUrl,
    logoUrl: scraped.logoUrl || scraped.faviconUrl,
    brandColors: scraped.brandColors,
    targetAudience: scraped.targetAudience,
    brandVoiceTone: scraped.brandVoiceTone,
    competitorLandscape: scraped.competitorLandscape,
    contentPillars: scraped.contentPillars,
    socialMediaPresence: scraped.socialMediaPresence,
    faviconUrl: scraped.faviconUrl,
    contactInfo: scraped.contactInfo,
    industryCategory: scraped.industryCategory,
    missionStatement: scraped.missionStatement,
    tagline: scraped.tagline,
    approvedClaims: (scraped.approvedClaims || []).map(c => 
      typeof c === 'string' ? { claimText: c, sourceUrl: scraped.domainUrl, verified: true } : c
    ),
    restrictedClaims: scraped.tabooTopics || scraped.restrictedClaims || [],
    priorityKeywords: scraped.priorityKeywords || []
  };


  let savedWorkspace = { id: `ws_${Date.now()}`, ...workspaceData };

  try {
    const dbCreated = await Workspace.create(workspaceData);
    savedWorkspace = dbCreated;
    console.log(`🍃 Brand DNA Saved to MongoDB Atlas: ${savedWorkspace.brandName}`);
  } catch (dbErr) {
    console.log('MongoDB Write Note:', dbErr.message);
    memoryWorkspaces.unshift(savedWorkspace);
  }

  res.json({ success: true, workspace: savedWorkspace, scrapedDetails: scraped });
});

app.post('/api/workspace/upload-doc', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const { domainUrl = 'https://custombrand.com', brandName = 'Custom Brand' } = req.body;
    const parsedDoc = await parseBrandDocument(req.file.buffer, req.file.mimetype, req.file.originalname);
    const brandDna = await generateBrandDNA(domainUrl, brandName, parsedDoc);

    const savedWorkspace = {
      id: `ws_${Date.now()}`,
      brandName: brandDna.brandName,
      domainUrl: brandDna.domainUrl,
      logoUrl: brandDna.faviconUrl,
      brandColors: brandDna.brandColors,
      industryCategory: brandDna.industryCategory,
      tagline: brandDna.tagline,
      missionStatement: brandDna.missionStatement,
      targetAudience: brandDna.targetAudience,
      brandVoiceTone: brandDna.brandVoiceTone,
      competitorLandscape: brandDna.competitorLandscape,
      contentPillars: brandDna.contentPillars,
      socialMediaPresence: brandDna.socialMediaPresence,
      approvedClaims: brandDna.approvedClaims.map(c => ({ claimText: typeof c === 'string' ? c : c.claimText, verified: true })),
      restrictedClaims: brandDna.tabooTopics,
      confidenceScore: brandDna.confidenceScore,
      sourceReasoning: brandDna.sourceReasoning,
      crawledSources: brandDna.crawledSources,
      createdAt: new Date().toISOString()
    };

    memoryWorkspaces.unshift(savedWorkspace);
    res.json({ success: true, workspace: savedWorkspace, documentDetails: parsedDoc });
  } catch (err) {
    console.log('Document upload parse error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.put('/api/workspace/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let updated = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      updated = await Workspace.findByIdAndUpdate(id, req.body, { new: true });
    }
    if (!updated) {
      updated = await Workspace.findOneAndUpdate({ id }, req.body, { new: true });
    }
    if (!updated && req.body.domainUrl) {
      updated = await Workspace.findOneAndUpdate({ domainUrl: req.body.domainUrl }, req.body, { new: true });
    }
    if (updated) {
      console.log(`🍃 Brand DNA Memory Updated & Saved in MongoDB Atlas for: ${updated.brandName}`);
      return res.json({ success: true, workspace: updated });
    }
  } catch (e) {
    console.log('MongoDB Update Note:', e.message);
  }

  const index = memoryWorkspaces.findIndex(w => w.id === id || w._id === id);
  if (index !== -1) {
    memoryWorkspaces[index] = { ...memoryWorkspaces[index], ...req.body };
    return res.json({ success: true, workspace: memoryWorkspaces[index] });
  }
  res.status(404).json({ success: false, error: 'Workspace not found' });
});


app.delete('/api/workspace/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Workspace.findByIdAndDelete(id);
    if (!deleted) {
      await Workspace.deleteOne({ id });
    }
    console.log(`🗑️ Brand Workspace Deleted from MongoDB Atlas: ID ${id}`);
  } catch (e) {
    console.log('MongoDB Delete Note:', e.message);
  }
  memoryWorkspaces = memoryWorkspaces.filter(w => w.id !== id && w._id?.toString() !== id);
  res.json({ success: true, message: 'Workspace deleted successfully' });
});

// Brand Intelligence API Endpoints
app.get('/api/brand/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  try {
    let found = null;
    if (mongoose.Types.ObjectId.isValid(workspaceId)) {
      found = await Workspace.findById(workspaceId);
    }
    if (!found) {
      found = await Workspace.findOne({ id: workspaceId });
    }
    if (found) {
      return res.json({ success: true, profile: found });
    }
  } catch (e) {
    console.log('MongoDB Brand Get Error:', e.message);
  }

  const memoryFound = memoryWorkspaces.find(w => w.id === workspaceId || w._id?.toString() === workspaceId);
  if (memoryFound) {
    return res.json({ success: true, profile: memoryFound });
  }

  res.json({ success: true, profile: null });
});

app.put('/api/brand/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  const updates = req.body;
  try {
    let updated = null;
    if (mongoose.Types.ObjectId.isValid(workspaceId)) {
      updated = await Workspace.findByIdAndUpdate(workspaceId, updates, { new: true });
    }
    if (!updated) {
      updated = await Workspace.findOneAndUpdate({ id: workspaceId }, updates, { new: true });
    }
    if (!updated && updates.domainUrl) {
      updated = await Workspace.findOneAndUpdate({ domainUrl: updates.domainUrl }, updates, { new: true });
    }
    if (updated) {
      console.log(`🍃 Brand DNA Profile Updated in MongoDB Atlas for: ${updated.brandName}`);
      return res.json({ success: true, profile: updated, message: 'Brand Profile saved successfully' });
    }
  } catch (e) {
    console.log('MongoDB Brand Update Note:', e.message);
  }

  const index = memoryWorkspaces.findIndex(w => w.id === workspaceId || w._id?.toString() === workspaceId);
  if (index !== -1) {
    memoryWorkspaces[index] = { ...memoryWorkspaces[index], ...updates };
    return res.json({ success: true, profile: memoryWorkspaces[index], message: 'Brand Profile saved in memory' });
  }

  return res.json({ success: true, profile: updates, message: 'Brand Profile saved' });
});

app.post('/api/brand/analyze', async (req, res) => {
  const { workspaceId, websiteUrl, companyName } = req.body;
  try {
    const scraped = await scrapeDomainUrl(websiteUrl || 'https://example.com');
    const brandData = {
      brandName: companyName || scraped.brandName || 'Analyzed Brand',
      domainUrl: scraped.domainUrl || websiteUrl,
      logoUrl: scraped.logoUrl || scraped.faviconUrl,
      brandColors: scraped.brandColors,
      targetAudience: scraped.targetAudience,
      brandVoiceTone: scraped.brandVoiceTone,
      contentPillars: scraped.contentPillars,
      industryCategory: scraped.industryCategory,
      missionStatement: scraped.missionStatement,
      tagline: scraped.tagline,
      confidenceScore: 88,
      createdAt: new Date().toISOString()
    };

    if (workspaceId) {
      let updated = null;
      if (mongoose.Types.ObjectId.isValid(workspaceId)) {
        updated = await Workspace.findByIdAndUpdate(workspaceId, brandData, { new: true });
      }
      if (!updated) {
        updated = await Workspace.findOneAndUpdate({ id: workspaceId }, brandData, { new: true });
      }
      if (updated) {
        return res.json({ success: true, profile: updated });
      }
    }
    return res.json({ success: true, profile: brandData });
  } catch (err) {
    console.log('Brand AI Analysis Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/brand/regenerate-section', async (req, res) => {
  const { section } = req.body;
  let sampleData = null;
  if (section === 'targetAudience') {
    sampleData = { description: 'Primary consumers, tech-savvy professionals, and digital enthusiasts seeking premium performance and reliability.' };
  } else if (section === 'contentStrategy') {
    sampleData = ['Empowering through innovation & technology', 'Customer trust & premium product excellence', 'Sustainability & next-gen performance'];
  } else {
    sampleData = { note: `Regenerated ${section} section with AI` };
  }
  res.json({ success: true, data: sampleData });
});

app.post('/api/workspace/:id/generate-strategy', async (req, res) => {
  const { id } = req.params;
  try {
    let ws = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      ws = await Workspace.findById(id);
    }
    if (!ws) {
      ws = await Workspace.findOne({ id });
    }
    if (!ws) {
      ws = memoryWorkspaces.find(w => w.id === id || w._id?.toString() === id) || memoryWorkspaces[0] || {};
    }

    const brandName = ws.brandName || 'Brand';
    const industry = ws.industryCategory || 'Consumer Products';
    const topics = (ws.contentPillars && ws.contentPillars.length > 0)
      ? ws.contentPillars
      : [`${brandName} Product Value`, `Industry Trends in ${industry}`, `Customer Proof & Reviews`, `How-to Guides`];
    const platforms = ['SEO Blog', 'LinkedIn', 'Instagram', 'Email Newsletter'];

    const thirtyDayPlan = Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const pillar = topics[i % topics.length];
      const platform = platforms[i % platforms.length];
      return {
        day,
        title: `Day ${day}: ${pillar} - Key Insights for ${brandName}`,
        topic: `${pillar} Focus: Essential Strategies & Tips`,
        platform,
        pillar,
        status: 'PLANNED',
        action: `Publish ${platform} content highlighting ${brandName}'s core value in ${industry}.`
      };
    });

    const strategy = {
      businessGoal: `Scale ${brandName}'s Organic Lead Pipeline by 250% & Elevate ${industry} Brand Authority`,
      leadMagnet: `${brandName} 2026 Executive Playbook & Buyer's Guide (PDF)`,
      primaryCta: `Discover ${brandName}'s Solutions — Get Started Free Today`,
      postingFrequency: 'Daily',
      budgetSuggestions: '60% Organic content marketing & SEO / 40% Paid micro-targeting & retargeting.',
      bestPlatforms: ['LinkedIn', 'Google SEO Blog', 'Email Newsletter', 'Instagram & Reels'],
      contentPillars: topics,
      campaignIdeas: [
        { title: `${brandName} Authority Series`, desc: `Long-form thought leadership posts demonstrating domain mastery.` },
        { title: `Lead Magnet Opt-In Push`, desc: `Direct-response opt-in push using landing page & email funnel.` },
        { title: `Social Proof Sprint`, desc: `Customer testimonials & case-study carousel posts for trust.` }
      ],
      thirtyDayPlan,
      funnel: {
        awareness: `Pillar-driven content, SEO optimization, and educational hooks to drive top-of-funnel reach for ${brandName}.`,
        nurturing: `Interactive guides, how-to value-bombs, and lead magnet resources to capture email subscribers.`,
        conversion: `Direct sales copy, verified client testimonials, case studies, and primary product benefit pushes.`
      },
      audience: Array.isArray(ws.targetAudience) ? ws.targetAudience : [ws.targetAudience || `Target consumers in ${industry}`]
    };

    if (ws && ws._id && mongoose.Types.ObjectId.isValid(ws._id)) {
      await Workspace.findByIdAndUpdate(ws._id, { currentStrategy: strategy });
    }

    res.json({ success: true, strategy });
  } catch (err) {
    console.log('Strategy Generation Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Autonomous AI Website & App Builder Endpoints
app.post('/api/builder/generate-site', async (req, res) => {
  try {
    const result = await generateWebsiteCode(req.body);
    res.json(result);
  } catch (err) {
    console.log('Website Code Generation Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

let memoryLeads = [];
app.post('/api/builder/submit-lead', async (req, res) => {
  const leadData = { id: `lead_${Date.now()}`, ...req.body, submittedAt: new Date().toISOString() };
  memoryLeads.unshift(leadData);
  console.log(`📩 New Website Lead Captured for ${leadData.brandName || 'Brand'}:`, leadData.email);
  res.json({ success: true, lead: leadData });
});
app.post('/api/seo/brief/generate', async (req, res) => {
  const brief = await generateSeoBrief(req.body);

  try {
    await Content.create({
      title: brief.suggestedTitles[0],
      type: 'SEO_BRIEF',
      briefData: brief,
      author: 'Gemini 3.5 SEO Engine',
      status: 'APPROVED'
    });
    console.log(`🍃 SEO Brief Saved to MongoDB Atlas: "${brief.primaryKeyword}"`);
  } catch (err) {
    console.log('SEO Brief DB Save Note:', err.message);
  }

  res.json({ success: true, brief });
});

// 3. Content Studio Generation & Fact Check (MongoDB Saved)
app.post('/api/content/social/generate', async (req, res) => {
  const socialData = await generateSocialPosts(req.body);
  
  try {
    await Content.create({
      title: `${socialData.platform}: ${socialData.topic}`,
      type: 'SOCIAL',
      content: socialData.caption,
      briefData: socialData,
      author: 'Gemini 3.5 Social Engine',
      status: 'INTERNAL_REVIEW'
    });
  } catch (err) {
    console.log('Social Post DB Save Note:', err.message);
  }

  res.json({ success: true, data: socialData });
});

app.post('/api/content/blog/draft', async (req, res) => {
  const draft = await generateBlogArticle(req.body);
  const activeWorkspace = memoryWorkspaces[0];
  
  // Auto fact-checking pass (Decision Gate 1)
  const factCheckResult = verifyContentClaims(
    draft.content, 
    activeWorkspace.approvedClaims, 
    activeWorkspace.restrictedClaims
  );

  const postData = {
    workspaceId: activeWorkspace.id,
    title: draft.title,
    type: 'BLOG',
    content: draft.content,
    status: factCheckResult.passed ? 'INTERNAL_REVIEW' : 'RED_FLAG_CITATION_NEEDED',
    wordCount: draft.wordCount,
    author: 'Gemini 3.5 Editorial Engine',
    factCheck: factCheckResult
  };

  let savedPost = { id: `cnt_${Date.now()}`, ...postData, createdAt: new Date().toISOString() };

  try {
    const dbPost = await Content.create(postData);
    savedPost = dbPost;
    console.log(`🍃 Blog Article Saved to MongoDB Atlas: "${savedPost.title}"`);
  } catch (err) {
    console.log('Blog Draft DB Save Note:', err.message);
    memoryContentStore.unshift(savedPost);
  }

  res.json({ success: true, draft: savedPost, factCheck: factCheckResult });
});

app.post('/api/content/fact-check', (req, res) => {
  const { content, approvedClaims = [], restrictedClaims = [] } = req.body;
  const result = verifyContentClaims(content, approvedClaims, restrictedClaims);
  res.json({ success: true, factCheck: result });
});

// 4. Repurposing Engine (MongoDB Saved)
app.post('/api/repurpose/transform', async (req, res) => {
  const { sourceAsset } = req.body;
  const result = await transformRepurposeContent(sourceAsset || { title: "Enterprise Brand Growth" });

  try {
    await Content.create({
      title: `Repurposed: ${sourceAsset?.title || 'Brand Asset'}`,
      type: 'REPURPOSE',
      repurposedOutputs: result.outputs,
      author: 'Gemini 3.5 Repurposing Engine',
      status: 'APPROVED'
    });
    console.log(`🍃 Repurposed Asset Saved to MongoDB Atlas.`);
  } catch (err) {
    console.log('Repurpose DB Save Note:', err.message);
  }

  res.json({ success: true, transformed: result });
});

// 5. Creative Studio & Credits
app.get('/api/creative/credits', (req, res) => {
  res.json({ success: true, credits: getCreditBalance() });
});

app.post('/api/creative/visual/generate', (req, res) => {
  const { prompt, aspect = '1:1', style = 'Cyberpunk Glassmorphism', creditCost = 5 } = req.body;
  const deduction = deductCredits(creditCost, `AI Visual Generation: "${prompt || 'Custom Visual'}"`);

  if (!deduction.success) {
    return res.status(400).json(deduction);
  }

  const generatedAsset = {
    id: `asset_${Date.now()}`,
    prompt: prompt || 'Modern enterprise sleek dark aesthetic background gradient',
    imageUrl: `https://picsum.photos/seed/${Date.now()}/800/800`,
    aspect,
    style,
    creditCost,
    createdAt: new Date().toISOString()
  };

  res.json({ success: true, asset: generatedAsset, remainingCredits: deduction.newBalance });
});

app.post('/api/creative/credits/topup', (req, res) => {
  const { credits = 50, packName = '50 Credits Pack' } = req.body;
  const result = topUpCredits(credits, packName);
  res.json({ success: true, ...result });
});

app.post('/api/creative/credits/tier', (req, res) => {
  const { tier } = req.body;
  const result = setSubscriptionTier(tier);
  res.json({ success: true, ...result });
});

// 6. Calendar & Approvals Endpoints (MongoDB Synced)
app.get('/api/calendar/entries', async (req, res) => {
  try {
    const dbEntries = await Calendar.find().sort({ createdAt: -1 });
    if (dbEntries && dbEntries.length > 0) return res.json({ success: true, entries: dbEntries });
  } catch (e) {}
  res.json({ success: true, entries: memoryCalendar });
});

app.post('/api/calendar/entries', async (req, res) => {
  const newEntryData = { ...req.body, status: req.body.status || 'DRAFT' };
  let savedEntry = { id: `cal_${Date.now()}`, ...newEntryData };

  try {
    savedEntry = await Calendar.create(newEntryData);
    console.log(`🍃 Calendar Entry Saved to MongoDB Atlas: "${savedEntry.title}"`);
  } catch (e) {
    memoryCalendar.unshift(savedEntry);
  }

  res.json({ success: true, entry: savedEntry });
});

app.get('/api/approvals/queue', async (req, res) => {
  try {
    const dbQueue = await Content.find().sort({ createdAt: -1 });
    if (dbQueue && dbQueue.length > 0) return res.json({ success: true, queue: dbQueue });
  } catch (e) {}
  res.json({ success: true, queue: memoryContentStore });
});

app.patch('/api/approvals/status', async (req, res) => {
  const { contentId, status, reviewerComment } = req.body;

  try {
    const updated = await Content.findByIdAndUpdate(
      contentId, 
      { status, reviewerComment }, 
      { new: true }
    );
    if (updated) return res.json({ success: true, item: updated });
  } catch (e) {}

  const item = memoryContentStore.find(c => c.id === contentId);
  if (!item) return res.status(404).json({ success: false, error: 'Content item not found' });

  item.status = status;
  if (reviewerComment) item.reviewerComment = reviewerComment;

  res.json({ success: true, item });
});

const server = app.listen(PORT, () => {
  console.log(`AI Ads Backend API running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} is already in use by an existing background process.`);
    console.log(`🔄 Automatically attempting fallback port ${Number(PORT) + 1}...`);
    const fallbackPort = Number(PORT) + 1;
    app.listen(fallbackPort, () => {
      console.log(`AI Ads Backend API running on http://localhost:${fallbackPort}`);
    });
  } else {
    console.error('Server error:', err);
  }
});

