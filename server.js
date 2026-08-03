require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { createServer } = require('http');

// ─── Models ────────────────────────────────────────────────────────────────────
const Workspace = require('./models/Workspace');
const Content = require('./models/Content');
const Calendar = require('./models/Calendar');
const Campaign = require('./models/Campaign');
const CampaignPost = require('./models/CampaignPost');
const BrandProfile = require('./models/BrandProfile');
const ChatSession = require('./models/ChatSession');
const User = require('./models/User');
const GeneratedPost = require('./models/GeneratedPost');
const { Notification, Reminder, CreditLog } = require('./models/NotificationReminder');

// ─── Original Modules (existing scraper + seo + creative) ─────────────────────
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { scrapeDomainUrl, parseBrandDocument, generateBrandDNA } = require('./modules/workspace/scraper.service');
const { verifyContentClaims } = require('./modules/factCheck/factCheck.service');
const { generateSeoBrief, generateSocialPosts, generateBlogArticle, transformRepurposeContent } = require('./modules/seo/vertex.service');
const { getCreditBalance, deductCredits, topUpCredits, setSubscriptionTier } = require('./modules/creative/credit.service');

// ─── New Route Modules ─────────────────────────────────────────────────────────
const chatRoutes = require('./routes/chatRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const brandRoutes = require('./routes/brandRoutes');
const contentRoutes = require('./routes/contentRoutes');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// ─── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8081', // Expo web
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Memory fallbacks (for original module compatibility) ──────────────────────
let memoryWorkspaces = [];
let memoryContentStore = [];
let memoryCalendar = [];

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'AI Ads Enterprise Backend API v2.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    features: [
      'workspace/brand-dna',
      'brand-intelligence',
      'campaigns',
      'campaign-posts',
      'ai-chat',
      'content-generation',
      'seo',
      'creative-studio',
      'calendar',
      'approvals',
    ],
  });
});

// ─── NEW FEATURE ROUTES ────────────────────────────────────────────────────────
app.use('/api/chat', chatRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/content', contentRoutes);

// SEO route (new path uses contentController, keep old path for backward compat)
const contentController = require('./controllers/contentController');
app.post('/api/seo/brief/generate', contentController.generateSeoBrief);

// ─── LEGACY WORKSPACE / BRAND DNA ENDPOINTS (backward compatible) ──────────────
app.get('/api/workspace/list', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const dbWorkspaces = await Workspace.find().sort({ createdAt: -1 });
      if (dbWorkspaces && dbWorkspaces.length > 0) return res.json({ success: true, workspaces: dbWorkspaces });
    }
  } catch (err) {
    console.log('MongoDB Read Fallback:', err.message);
  }
  res.json({ success: true, workspaces: memoryWorkspaces });
});

// ─── SCRAPE PREVIEW ENDPOINT (DOES NOT SAVE TO DB UNTIL LOCK BUTTON CLICKED) ────
app.post('/api/workspace/scrape-preview', async (req, res) => {
  try {
    const { domainUrl, brandName } = req.body;
    if (!domainUrl) return res.status(400).json({ success: false, error: 'Domain URL is required' });

    console.log(`🌐 [SCRAPER-PREVIEW] Generating non-persisted Brand DNA preview for: ${domainUrl}`);
    const brandDna = await generateBrandDNA(domainUrl, brandName || '');

    const previewWorkspace = {
      tempId: `preview_${Date.now()}`,
      brandName: brandDna.brandName || brandName || 'New Brand',
      companyName: brandDna.companyName || brandDna.brandName,
      parentCompany: brandDna.parentCompany || brandDna.brandName,
      domainUrl: brandDna.domainUrl || domainUrl,
      logoUrl: brandDna.faviconUrl || '',
      brandColors: brandDna.brandColors || [],
      industry: brandDna.industryCategory || 'Consumer Products',
      industryCategory: brandDna.industryCategory || 'Consumer Products',
      subIndustry: brandDna.subIndustry || '',
      businessType: brandDna.businessType || 'B2C Direct Brand',
      headquarters: brandDna.headquarters || 'Mumbai, Maharashtra, India',
      companyDescription: brandDna.companyDescription || '',
      tagline: brandDna.tagline || '',
      missionStatement: brandDna.missionStatement || '',
      vision: brandDna.vision || '',
      targetAudience: brandDna.targetAudience || [],
      brandVoiceTone: brandDna.brandVoiceTone || { formalityScore: 3, toneKeywords: [] },
      coreProductsServices: brandDna.coreProductsServices || [],
      contentPillars: brandDna.contentPillars || [],
      competitorLandscape: brandDna.competitorLandscape || [],
      approvedClaims: brandDna.approvedClaims || [],
      restrictedClaims: brandDna.restrictedClaims || [],
      socialMediaPresence: brandDna.socialMediaPresence || {},
      faviconUrl: brandDna.faviconUrl || '',
      contactInfo: brandDna.contactInfo || {},
      fieldSources: brandDna.fieldSources || {},
      evidenceCitations: brandDna.evidenceCitations || {},
      confidenceScore: brandDna.confidenceScore || 95,
      isLockSaved: false // Not saved in DB yet
    };

    res.json({ success: true, workspace: previewWorkspace });
  } catch (err) {
    console.log('Scrape Preview Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SAVE & LOCK BRAND DNA MEMORY ENDPOINT (PERSISTS TO DB ONLY ON LOCK CLICK) ──
app.post('/api/workspace/save-dna', async (req, res) => {
  try {
    const workspaceData = req.body;
    if (!workspaceData || (!workspaceData.brandName && !workspaceData.domainUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid brand workspace payload' });
    }

    const dbPayload = {
      brandName: workspaceData.brandName || 'New Brand',
      companyName: workspaceData.companyName || workspaceData.brandName,
      parentCompany: workspaceData.parentCompany || workspaceData.brandName,
      domainUrl: workspaceData.domainUrl,
      logoUrl: workspaceData.logoUrl || workspaceData.faviconUrl,
      brandColors: workspaceData.brandColors || [],
      industryCategory: workspaceData.industryCategory || workspaceData.industry || 'Consumer Products',
      subIndustry: workspaceData.subIndustry || '',
      businessType: workspaceData.businessType || 'B2C Direct Brand',
      headquarters: workspaceData.headquarters || '',
      companyDescription: workspaceData.companyDescription || '',
      tagline: workspaceData.tagline || '',
      missionStatement: workspaceData.missionStatement || '',
      vision: workspaceData.vision || '',
      targetAudience: workspaceData.targetAudience || [],
      brandVoiceTone: workspaceData.brandVoiceTone || { formalityScore: 3, toneKeywords: [] },
      competitorLandscape: workspaceData.competitorLandscape || [],
      contentPillars: workspaceData.contentPillars || [],
      socialMediaPresence: workspaceData.socialMediaPresence || {},
      faviconUrl: workspaceData.faviconUrl || '',
      contactInfo: workspaceData.contactInfo || {},
      approvedClaims: (workspaceData.approvedClaims || []).map(c => 
        typeof c === 'string' ? { claimText: c, sourceUrl: workspaceData.domainUrl, verified: true } : c
      ),
      restrictedClaims: workspaceData.restrictedClaims || [],
      confidenceScore: workspaceData.confidenceScore || 95,
      isLockSaved: true,
      createdAt: new Date().toISOString()
    };

    let savedWorkspace = { id: `ws_${Date.now()}`, ...dbPayload };
    try {
      if (mongoose.connection.readyState === 1) {
        const dbCreated = await Workspace.create(dbPayload);
        savedWorkspace = dbCreated;
        console.log(`🔒 Brand DNA Memory Saved & Locked to MongoDB Atlas: ${savedWorkspace.brandName}`);
      }
    } catch (dbErr) {
      console.log('MongoDB Write Fallback Note:', dbErr.message);
      memoryWorkspaces.unshift(savedWorkspace);
    }

    res.json({ success: true, workspace: savedWorkspace });
  } catch (err) {
    console.log('Save DNA Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Backward compatibility legacy route for workspace creation
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
    approvedClaims: (scraped.approvedClaims || []).map((c) =>
      typeof c === 'string' ? { claimText: c, sourceUrl: scraped.domainUrl, verified: true } : c
    ),
    restrictedClaims: scraped.tabooTopics || scraped.restrictedClaims || [],
    priorityKeywords: scraped.priorityKeywords || [],
  };

  let savedWorkspace = { id: `ws_${Date.now()}`, ...workspaceData };
  try {
    const dbCreated = await Workspace.create(workspaceData);
    savedWorkspace = dbCreated;
    console.log(`🍃 Brand DNA Saved to MongoDB: ${savedWorkspace.brandName}`);
  } catch (dbErr) {
    console.log('MongoDB Write Note:', dbErr.message);
    memoryWorkspaces.unshift(savedWorkspace);
  }

  res.json({ success: true, workspace: savedWorkspace, scrapedDetails: scraped });
});

app.post('/api/workspace/upload-doc-preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const { domainUrl = 'https://custombrand.com', brandName = 'Custom Brand' } = req.body;
    const parsedDoc = await parseBrandDocument(req.file.buffer, req.file.mimetype, req.file.originalname);
    const brandDna = await generateBrandDNA(domainUrl, brandName, parsedDoc);

    const previewWorkspace = {
      tempId: `preview_${Date.now()}`,
      brandName: brandDna.brandName,
      companyName: brandDna.companyName || brandDna.brandName,
      parentCompany: brandDna.parentCompany || brandDna.brandName,
      domainUrl: brandDna.domainUrl,
      logoUrl: brandDna.faviconUrl,
      brandColors: brandDna.brandColors,
      industryCategory: brandDna.industryCategory,
      businessType: brandDna.businessType,
      headquarters: brandDna.headquarters,
      companyDescription: brandDna.companyDescription,
      tagline: brandDna.tagline,
      missionStatement: brandDna.missionStatement,
      vision: brandDna.vision,
      targetAudience: brandDna.targetAudience,
      brandVoiceTone: brandDna.brandVoiceTone,
      contentPillars: brandDna.contentPillars,
      approvedClaims: (brandDna.approvedClaims || []).map((c) => ({
        claimText: typeof c === 'string' ? c : c.claimText,
        verified: true,
      })),
      restrictedClaims: brandDna.tabooTopics || [],
      confidenceScore: brandDna.confidenceScore || 95,
      isLockSaved: false
    };

    res.json({ success: true, workspace: previewWorkspace, documentDetails: parsedDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/workspace/upload-doc', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
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
      contentPillars: brandDna.contentPillars,
      approvedClaims: brandDna.approvedClaims.map((c) => ({
        claimText: typeof c === 'string' ? c : c.claimText,
        verified: true,
      })),
      restrictedClaims: brandDna.tabooTopics,
      confidenceScore: brandDna.confidenceScore,
      createdAt: new Date().toISOString(),
    };
    memoryWorkspaces.unshift(savedWorkspace);
    res.json({ success: true, workspace: savedWorkspace, documentDetails: parsedDoc });
  } catch (err) {
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
    if (!updated) updated = await Workspace.findOneAndUpdate({ domainUrl: req.body.domainUrl }, req.body, { new: true });
    if (updated) return res.json({ success: true, workspace: updated });
  } catch (e) {
    console.log('MongoDB Update Note:', e.message);
  }
  const index = memoryWorkspaces.findIndex((w) => w.id === id || w._id === id);
  if (index !== -1) {
    memoryWorkspaces[index] = { ...memoryWorkspaces[index], ...req.body };
    return res.json({ success: true, workspace: memoryWorkspaces[index] });
  }
  res.status(404).json({ success: false, error: 'Workspace not found' });
});

app.delete('/api/workspace/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Workspace.findByIdAndDelete(id);
  } catch (e) {}
  memoryWorkspaces = memoryWorkspaces.filter((w) => w.id !== id && w._id?.toString() !== id);
  res.json({ success: true, message: 'Workspace deleted successfully' });
});

// ─── LEGACY CONTENT & CALENDAR ENDPOINTS ──────────────────────────────────────
app.post('/api/content/social/generate-legacy', async (req, res) => {
  const socialData = await generateSocialPosts(req.body);
  res.json({ success: true, data: socialData });
});

app.post('/api/content/blog/draft-legacy', async (req, res) => {
  const draft = await generateBlogArticle(req.body);
  res.json({ success: true, draft });
});

app.post('/api/content/fact-check-legacy', (req, res) => {
  const { content, approvedClaims = [], restrictedClaims = [] } = req.body;
  const result = verifyContentClaims(content, approvedClaims, restrictedClaims);
  res.json({ success: true, factCheck: result });
});

app.post('/api/repurpose/transform', async (req, res) => {
  const { sourceAsset } = req.body;
  const result = await transformRepurposeContent(sourceAsset || { title: 'Enterprise Brand Growth' });
  res.json({ success: true, transformed: result });
});

// ─── CREATIVE STUDIO ──────────────────────────────────────────────────────────
app.get('/api/creative/credits', (req, res) => {
  res.json({ success: true, credits: getCreditBalance() });
});

app.post('/api/creative/visual/generate', (req, res) => {
  const { prompt, aspect = '1:1', style = 'Cyberpunk Glassmorphism', creditCost = 5 } = req.body;
  const deduction = deductCredits(creditCost, `AI Visual Generation: "${prompt || 'Custom Visual'}"`);
  if (!deduction.success) return res.status(400).json(deduction);

  const generatedAsset = {
    id: `asset_${Date.now()}`,
    prompt: prompt || 'Modern enterprise sleek dark aesthetic',
    imageUrl: `https://picsum.photos/seed/${Date.now()}/800/800`,
    aspect,
    style,
    creditCost,
    createdAt: new Date().toISOString(),
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

// ─── CALENDAR & APPROVALS ──────────────────────────────────────────────────────
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
    console.log(`🍃 Calendar Entry Saved: "${savedEntry.title}"`);
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
    const updated = await Content.findByIdAndUpdate(contentId, { status, reviewerComment }, { new: true });
    if (updated) return res.json({ success: true, item: updated });
  } catch (e) {}
  const item = memoryContentStore.find((c) => c.id === contentId);
  if (!item) return res.status(404).json({ success: false, error: 'Content item not found' });
  item.status = status;
  if (reviewerComment) item.reviewerComment = reviewerComment;
  res.json({ success: true, item });
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const filter = workspaceId ? { workspaceId } : {};

    const [totalCampaigns, activeCampaigns, totalPosts, approvedPosts, generatedPosts] = await Promise.all([
      Campaign.countDocuments(filter),
      Campaign.countDocuments({ ...filter, status: 'Active' }),
      CampaignPost.countDocuments(filter),
      CampaignPost.countDocuments({ ...filter, approvalStatus: 'Approved' }),
      CampaignPost.countDocuments({ ...filter, status: 'Generated' }),
    ]);

    res.json({
      success: true,
      analytics: {
        campaigns: { total: totalCampaigns, active: activeCampaigns },
        posts: { total: totalPosts, approved: approvedPosts, generated: generatedPosts },
        approvalRate: totalPosts > 0 ? Math.round((approvedPosts / totalPosts) * 100) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  try {
    const { userId, limit = 20 } = req.query;
    const filter = userId ? { userId } : {};
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── REMINDERS & TASKS ────────────────────────────────────────────────────────
app.get('/api/reminders', async (req, res) => {
  try {
    const { workspaceId, userId } = req.query;
    const filter = {};
    if (workspaceId) filter.workspaceId = workspaceId;
    if (userId) filter.userId = userId;
    const reminders = await Reminder.find(filter).sort({ dueDate: 1 });
    res.json({ success: true, reminders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/reminders', async (req, res) => {
  try {
    const reminder = await Reminder.create(req.body);
    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/reminders/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!reminder) return res.status(404).json({ success: false, error: 'Reminder not found' });
    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/reminders/:id', async (req, res) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GENERATED POSTS ──────────────────────────────────────────────────────────
app.get('/api/posts', async (req, res) => {
  try {
    const { workspaceId, status, platform } = req.query;
    const filter = {};
    if (workspaceId) filter.workspaceId = workspaceId;
    if (status) filter.status = status;
    if (platform) filter.platform = platform;
    const posts = await GeneratedPost.find(filter).sort({ scheduledDate: 1 });
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── START SERVER ──────────────────────────────────────────────────────────────
const server = httpServer.listen(PORT, () => {
  console.log(`\n🚀 AI Ads Enterprise Backend v2.0 running on http://localhost:${PORT}`);
  console.log(`📡 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`\n📋 Active Routes:`);
  console.log(`  POST   /api/chat                    → AI Chat (multi-model)`);
  console.log(`  GET    /api/chat/sessions            → List sessions`);
  console.log(`  GET/POST /api/campaigns              → Campaign CRUD`);
  console.log(`  POST   /api/campaigns/:id/generate-plan → AI campaign planning`);
  console.log(`  POST   /api/brand/analyze            → Brand Intelligence AI`);
  console.log(`  GET    /api/brand/:workspaceId       → Brand profile`);
  console.log(`  POST   /api/content/social/generate  → Social post generation`);
  console.log(`  POST   /api/content/blog/draft       → Blog article generation`);
  console.log(`  POST   /api/content/ad-copy/generate → Ad copy generation`);
  console.log(`  POST   /api/content/repurpose        → Content repurposing`);
  console.log(`  POST   /api/seo/brief/generate       → SEO brief generation`);
  console.log(`  GET    /api/analytics/summary        → Platform analytics`);
  console.log(`  GET    /api/workspace/list           → Workspace list (legacy)`);
  console.log(`  POST   /api/workspace/create         → Create workspace (legacy)\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = Number(PORT) + 1;
    console.log(`⚠️ Port ${PORT} in use. Trying fallback port ${fallbackPort}...`);
    httpServer.listen(fallbackPort, () => {
      console.log(`🚀 AI Ads Backend running on http://localhost:${fallbackPort}`);
    });
  } else {
    console.error('Server error:', err);
  }
});
