const express = require('express');
const cors = require('cors');
const { scrapeDomainUrl } = require('./modules/workspace/scraper.service');
const { verifyContentClaims } = require('./modules/factCheck/factCheck.service');
const { generateSeoBrief, generateSocialPosts, generateBlogArticle, transformRepurposeContent } = require('./modules/seo/vertex.service');
const { getCreditBalance, deductCredits, topUpCredits, setSubscriptionTier } = require('./modules/creative/credit.service');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Memory Store for live demo state
let activeWorkspaces = [
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

let contentStore = [
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
  },
  {
    id: 'cnt_002',
    workspaceId: 'ws_001',
    title: '5 Steps to Build Bulletproof Brand DNA in 2026',
    type: 'SOCIAL',
    platform: 'LinkedIn',
    status: 'INTERNAL_REVIEW',
    author: 'Brand Strategist',
    factCheck: { passed: true, score: 95, status: 'VERIFIED' },
    createdAt: '2026-07-24T14:30:00Z',
    scheduledDate: '2026-07-29'
  }
];

let calendarEntries = [
  { id: 'cal_1', title: 'SEO Pillar Launch: Content Velocity', date: '2026-07-27', platform: 'Blog', pillar: 'Enterprise AI', status: 'SCHEDULED', owner: 'SEO Lead' },
  { id: 'cal_2', title: 'LinkedIn Carousel: Brand DNA 101', date: '2026-07-28', platform: 'LinkedIn', pillar: 'Brand Governance', status: 'APPROVED', owner: 'Senior Copywriter' },
  { id: 'cal_3', title: 'Reel Script: Stop Fragmentation', date: '2026-07-30', platform: 'Instagram', pillar: 'Social Studio Ops', status: 'DRAFT', owner: 'Content Writer' }
];

// --- API ENDPOINTS ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'AI Ads Enterprise Backend API v1.0', timestamp: new Date().toISOString() });
});

// 1. Workspace / Brand DNA Endpoints
app.get('/api/workspace/list', (req, res) => {
  res.json({ success: true, workspaces: activeWorkspaces });
});

app.post('/api/workspace/create', async (req, res) => {
  const { domainUrl, brandName } = req.body;
  if (!domainUrl) return res.status(400).json({ success: false, error: 'Domain URL is required' });

  const scraped = await scrapeDomainUrl(domainUrl);
  const newWorkspace = {
    id: `ws_${Date.now()}`,
    brandName: brandName || scraped.brandName || 'New Brand',
    domainUrl: scraped.domainUrl,
    logoUrl: scraped.logoUrl,
    brandColors: scraped.brandColors,
    metaDescription: scraped.metaDescription,
    positioningSummary: scraped.positioningSummary,
    voiceGuidelines: { formalityScore: 3, toneKeywords: ['Professional', 'Clear'], taboos: [] },
    approvedClaims: scraped.approvedClaims,
    restrictedClaims: scraped.restrictedClaims,
    priorityKeywords: scraped.priorityKeywords,
    contentPillars: ['Product Insights', 'Industry Trends', 'Case Studies']
  };

  activeWorkspaces.unshift(newWorkspace);
  res.json({ success: true, workspace: newWorkspace, scrapedDetails: scraped });
});

app.put('/api/workspace/:id', (req, res) => {
  const { id } = req.params;
  const index = activeWorkspaces.findIndex(w => w.id === id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Workspace not found' });

  activeWorkspaces[index] = { ...activeWorkspaces[index], ...req.body };
  res.json({ success: true, workspace: activeWorkspaces[index] });
});

// 2. SEO Intelligence Endpoints
app.post('/api/seo/brief/generate', async (req, res) => {
  const brief = await generateSeoBrief(req.body);
  res.json({ success: true, brief });
});

// 3. Content Studio Generation & Fact Check
app.post('/api/content/social/generate', async (req, res) => {
  const socialData = await generateSocialPosts(req.body);
  res.json({ success: true, data: socialData });
});

app.post('/api/content/blog/draft', async (req, res) => {
  const draft = await generateBlogArticle(req.body);
  const activeWorkspace = activeWorkspaces[0];
  
  // Auto fact-checking pass (Decision Gate 1)
  const factCheckResult = verifyContentClaims(
    draft.content, 
    activeWorkspace.approvedClaims, 
    activeWorkspace.restrictedClaims
  );

  const newPost = {
    id: `cnt_${Date.now()}`,
    workspaceId: activeWorkspace.id,
    title: draft.title,
    type: 'BLOG',
    content: draft.content,
    status: factCheckResult.passed ? 'INTERNAL_REVIEW' : 'RED_FLAG_CITATION_NEEDED',
    wordCount: draft.wordCount,
    author: 'Gemini 3.5 Editorial Engine',
    factCheck: factCheckResult,
    createdAt: new Date().toISOString()
  };

  contentStore.unshift(newPost);
  res.json({ success: true, draft: newPost, factCheck: factCheckResult });
});

app.post('/api/content/fact-check', (req, res) => {
  const { content, approvedClaims = [], restrictedClaims = [] } = req.body;
  const result = verifyContentClaims(content, approvedClaims, restrictedClaims);
  res.json({ success: true, factCheck: result });
});

// 4. Repurposing Engine
app.post('/api/repurpose/transform', async (req, res) => {
  const { sourceAsset } = req.body;
  const result = await transformRepurposeContent(sourceAsset || { title: "Enterprise Brand Growth" });
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

// 6. Calendar & Approvals
app.get('/api/calendar/entries', (req, res) => {
  res.json({ success: true, entries: calendarEntries });
});

app.post('/api/calendar/entries', (req, res) => {
  const newEntry = { id: `cal_${Date.now()}`, ...req.body, status: req.body.status || 'DRAFT' };
  calendarEntries.unshift(newEntry);
  res.json({ success: true, entry: newEntry });
});

app.get('/api/approvals/queue', (req, res) => {
  res.json({ success: true, queue: contentStore });
});

app.patch('/api/approvals/status', (req, res) => {
  const { contentId, status, reviewerComment } = req.body;
  const item = contentStore.find(c => c.id === contentId);
  if (!item) return res.status(404).json({ success: false, error: 'Content item not found' });

  item.status = status;
  if (reviewerComment) item.reviewerComment = reviewerComment;

  res.json({ success: true, item });
});

app.listen(PORT, () => {
  console.log(`AI Ads Backend API running on http://localhost:${PORT}`);
});
