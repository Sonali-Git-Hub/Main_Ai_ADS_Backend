require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const Workspace = require('./models/Workspace');
const Content = require('./models/Content');
const Calendar = require('./models/Calendar');

const { scrapeDomainUrl } = require('./modules/workspace/scraper.service');
const { verifyContentClaims } = require('./modules/factCheck/factCheck.service');
const { generateSeoBrief, generateSocialPosts, generateBlogArticle, transformRepurposeContent } = require('./modules/seo/vertex.service');
const { getCreditBalance, deductCredits, topUpCredits, setSubscriptionTier } = require('./modules/creative/credit.service');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas Cloud
connectDB();

app.use(cors());
app.use(express.json());

// Memory Store Fallback
let memoryWorkspaces = [
  {
    id: 'ws_001',
    brandName: 'UWO AI Ads',
    domainUrl: 'https://aiads.uwo.ai',
    logoUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=UWO',
    brandColors: ['#6366F1', '#8B5CF6', '#06B6D4', '#0F172A'],
    metaDescription: 'Governed AI-native content marketing, SEO and social-media operations platform.',
    positioningSummary: 'UWO AI Ads is the premier operating system for agencies and enterprise marketing teams to plan, create, govern, approve, publish, and scale digital content.',
    voiceGuidelines: { formalityScore: 4, toneKeywords: ['Authoritative', 'Evidence-Based', 'Innovative', 'Direct'], taboos: ['Guaranteed ranking', 'Low effort', 'Spam'] },
    approvedClaims: [
      { claimText: 'Reduces long-form SEO draft turnaround time to under 12 seconds', sourceUrl: 'https://uwo.ai/benchmarks', verified: true },
      { claimText: 'Governed multi-brand workspace with RBAC role control', sourceUrl: 'https://uwo.ai/governance', verified: true }
    ],
    restrictedClaims: ['Guaranteed #1 Google ranking', '100% viral outcome guaranteed'],
    priorityKeywords: ['AI Content Marketing', 'Brand DNA', 'SEO Intelligence', 'Campaign Operations'],
    contentPillars: ['Enterprise AI', 'SEO Clustering', 'Brand Governance', 'Social Studio Ops']
  }
];

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
    positioningSummary: scraped.positioningSummary,
    metaDescription: scraped.metaDescription,
    approvedClaims: scraped.approvedClaims,
    restrictedClaims: scraped.restrictedClaims,
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

app.put('/api/workspace/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Workspace.findByIdAndUpdate(id, req.body, { new: true });
    if (updated) return res.json({ success: true, workspace: updated });
  } catch (e) {
    console.log('MongoDB Update Note:', e.message);
  }
  
  const index = memoryWorkspaces.findIndex(w => w.id === id);
  if (index !== -1) {
    memoryWorkspaces[index] = { ...memoryWorkspaces[index], ...req.body };
    return res.json({ success: true, workspace: memoryWorkspaces[index] });
  }
  res.status(404).json({ success: false, error: 'Workspace not found' });
});

// 2. SEO Intelligence Endpoints (MongoDB Saved)
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

app.listen(PORT, () => {
  console.log(`AI Ads Backend API running on http://localhost:${PORT}`);
});
