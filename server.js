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
const jwt = require('jsonwebtoken');

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
const websiteBuilderRoutes = require('./routes/websiteBuilderRoutes');

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
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:8081', // Expo web
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Memory Store Fallback
let memoryUsers = [];
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

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  let user = null;
  const cleanEmail = email.toLowerCase().trim();

  // 1. Try DB or Memory Fallback
  try {
    user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = await User.create({ email: cleanEmail, password });
      console.log(`👤 New user auto-registered in MongoDB: ${cleanEmail}`);
    } else {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
    }
  } catch (error) {
    console.log('MongoDB Auth Note (Using Memory Store Fallback):', error.message);
    
    // Memory Store Fallback
    user = memoryUsers.find(u => u.email === cleanEmail);
    if (!user) {
      user = { id: `usr_${Date.now()}`, email: cleanEmail, password, role: 'AgencyAdmin' };
      memoryUsers.push(user);
      console.log(`👤 New user auto-registered in Memory: ${cleanEmail}`);
    } else {
      if (user.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
    }
  }

  // 2. Generate Token & Response
  try {
    const userId = user._id ? user._id.toString() : String(user.id || `usr_${Date.now()}`);
    const userRole = user.role || 'AgencyAdmin';
    const userEmail = user.email || cleanEmail;

    const token = jwt.sign(
      { userId, email: userEmail, role: userRole },
      process.env.JWT_SECRET || 'ai_ads_secret_key_123',
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: { id: userId, email: userEmail, role: userRole }
    });
  } catch (jwtErr) {
    console.error('Auth generation error:', jwtErr);
    return res.status(500).json({ success: false, error: `Auth Error: ${jwtErr.message}` });
  }
});

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
app.use('/api/website-builder', websiteBuilderRoutes);

// SEO route (new path uses contentController, keep old path for backward compat)
const contentController = require('./controllers/contentController');
app.post('/api/seo/brief/generate', contentController.generateSeoBrief);

// Auto-Pilot Pipeline (SSE-based full orchestrator)
const autopilotController = require('./controllers/autopilotController');
app.post('/api/autopilot/generate', autopilotController.generateFullPipeline);

// ─── LEGACY WORKSPACE / BRAND DNA ENDPOINTS (backward compatible & Multi-Tenant Isolated) ──────────────
app.get('/api/workspace/list', async (req, res) => {
  try {
    const userEmail = (req.query.userEmail || req.headers['x-user-email'] || '').toLowerCase().trim();
    let query = {};
    if (userEmail) {
      query.userEmail = userEmail;
    }

    if (mongoose.connection.readyState === 1) {
      const dbWorkspaces = await Workspace.find(query).sort({ createdAt: -1 });
      return res.json({ success: true, workspaces: dbWorkspaces });
    }
  } catch (err) {
    console.log('MongoDB Read Fallback:', err.message);
  }

  const userEmail = (req.query.userEmail || req.headers['x-user-email'] || '').toLowerCase().trim();
  const filteredMemory = userEmail 
    ? memoryWorkspaces.filter(w => (w.userEmail || '').toLowerCase() === userEmail)
    : memoryWorkspaces;

  res.json({ success: true, workspaces: filteredMemory });
});

// ─── SCRAPE PREVIEW ENDPOINT (DOES NOT SAVE TO DB UNTIL LOCK BUTTON CLICKED) ────
app.post('/api/workspace/scrape-preview', async (req, res) => {
  try {
    const { domainUrl, brandName, userEmail } = req.body;
    if (!domainUrl) return res.status(400).json({ success: false, error: 'Domain URL is required' });

    console.log(`🌐 [SCRAPER-PREVIEW] Generating non-persisted Brand DNA preview for: ${domainUrl}`);
    const brandDna = await generateBrandDNA(domainUrl, brandName || '');

    const previewWorkspace = {
      tempId: `preview_${Date.now()}`,
      userEmail: (userEmail || '').toLowerCase().trim(),
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

    const cleanEmail = (workspaceData.userEmail || req.headers['x-user-email'] || '').toLowerCase().trim();

    const dbPayload = {
      userEmail: cleanEmail,
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
        console.log(`🔒 Brand DNA Memory Saved for user [${cleanEmail}]: ${savedWorkspace.brandName}`);
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

const { generateJSON } = require('./services/aiService');

app.post('/api/workspace/:id/generate-strategy', async (req, res) => {
  const { id } = req.params;
  
  try {
    let workspace = null;
    let brandProfile = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      workspace = await Workspace.findById(id);
      brandProfile = await BrandProfile.findOne({ workspaceId: id });
    }
    
    // Fallback to memory store if Mongo not found or not using it
    if (!workspace) {
      workspace = memoryWorkspaces.find(w => w.id === id || w._id === id) || {};
    }
    
    const brandName = workspace.brandName || brandProfile?.companyName || 'our brand';
    const industry = workspace.industryCategory || brandProfile?.structuredIdentity?.industry || 'General';
    const tagline = workspace.tagline || brandProfile?.structuredIdentity?.tagline || '';
    const pillars = workspace.contentPillars || brandProfile?.structuredIdentity?.content_angles || [];
    const audienceStr = (workspace.targetAudience || []).join(', ') || brandProfile?.structuredIdentity?.target_audience || 'General public';

    console.log(`[Strategy Engine] Generating AI Marketing Roadmap for: ${brandName} (${industry})...`);

    const prompt = `You are a world-class growth marketer and brand strategist. Generate a highly customized, actionable, premium 30-day marketing strategy and roadmap for the following brand:
Brand Name: ${brandName}
Industry: ${industry}
Tagline: ${tagline}
Content Pillars: ${pillars.join(', ')}
Target Audience: ${audienceStr}

You must return a JSON object with this exact structure:
{
  "businessGoal": "A single specific, measurable business goal (e.g., 'Scale Organic Lead Pipeline by 200% & Drive Enterprise Demos')",
  "leadMagnet": "A high-converting lead magnet or conversion offer (e.g., 'The 2026 Enterprise AI Content Playbook (PDF)')",
  "primaryCta": "The main Call To Action for campaigns",
  "postingFrequency": "Recommended frequency (e.g., 'Daily' or '3x per week')",
  "budgetSuggestions": "Strategic budget distribution advice for organic vs paid spend",
  "bestPlatforms": ["Platform1", "Platform2", "Platform3"],
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
  "channelMix": [
    { "label": "SEO Blogs (Long-Form)", "pct": 40, "icon": "Globe" },
    { "label": "LinkedIn & Founder Copy", "pct": 30, "icon": "Linkedin" },
    { "label": "Email Newsletters", "pct": 15, "icon": "Mail" },
    { "label": "Instagram & Reels Copy", "pct": 15, "icon": "Instagram" }
  ],
  "audience": ["Persona 1: Description", "Persona 2: Description"],
  "funnel": {
    "awareness": "Top of funnel strategy to drive traffic (using pillars)",
    "nurturing": "Middle of funnel strategy to capture leads via the lead magnet",
    "conversion": "Bottom of funnel strategy to convert leads using case studies and testimonials"
  },
  "campaignIdeas": [
    { "title": "Campaign 1 Title", "desc": "Brief campaign concept and goal" },
    { "title": "Campaign 2 Title", "desc": "Brief campaign concept and goal" }
  ],
  "thirtyDayPlan": [
    { "day": 1, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 1 Topic", "actionItem": "Specific action item for today" },
    { "day": 2, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 2 Topic", "actionItem": "Specific action item for today" },
    { "day": 3, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 3 Topic", "actionItem": "Specific action item for today" },
    { "day": 4, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 4 Topic", "actionItem": "Specific action item for today" },
    { "day": 5, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 5 Topic", "actionItem": "Specific action item for today" },
    { "day": 6, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 6 Topic", "actionItem": "Specific action item for today" },
    { "day": 7, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 7 Topic", "actionItem": "Specific action item for today" },
    { "day": 8, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 8 Topic", "actionItem": "Specific action item for today" },
    { "day": 9, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 9 Topic", "actionItem": "Specific action item for today" },
    { "day": 10, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 10 Topic", "actionItem": "Specific action item for today" },
    { "day": 11, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 11 Topic", "actionItem": "Specific action item for today" },
    { "day": 12, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 12 Topic", "actionItem": "Specific action item for today" },
    { "day": 13, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 13 Topic", "actionItem": "Specific action item for today" },
    { "day": 14, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 14 Topic", "actionItem": "Specific action item for today" },
    { "day": 15, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 15 Topic", "actionItem": "Specific action item for today" },
    { "day": 16, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 16 Topic", "actionItem": "Specific action item for today" },
    { "day": 17, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 17 Topic", "actionItem": "Specific action item for today" },
    { "day": 18, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 18 Topic", "actionItem": "Specific action item for today" },
    { "day": 19, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 19 Topic", "actionItem": "Specific action item for today" },
    { "day": 20, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 20 Topic", "actionItem": "Specific action item for today" },
    { "day": 21, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 21 Topic", "actionItem": "Specific action item for today" },
    { "day": 22, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 22 Topic", "actionItem": "Specific action item for today" },
    { "day": 23, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 23 Topic", "actionItem": "Specific action item for today" },
    { "day": 24, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 24 Topic", "actionItem": "Specific action item for today" },
    { "day": 25, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 25 Topic", "actionItem": "Specific action item for today" },
    { "day": 26, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 26 Topic", "actionItem": "Specific action item for today" },
    { "day": 27, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 27 Topic", "actionItem": "Specific action item for today" },
    { "day": 28, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 28 Topic", "actionItem": "Specific action item for today" },
    { "day": 29, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 29 Topic", "actionItem": "Specific action item for today" },
    { "day": 30, "platform": "LinkedIn / Blog / Email / Instagram", "topic": "Day 30 Topic", "actionItem": "Specific action item for today" }
  ]
}`;

    const strategy = await generateJSON(prompt, { temperature: 0.75 });

    if (!strategy) {
      return res.status(500).json({ success: false, error: 'AI Strategy synthesis failed. Please try again.' });
    }

    // Ensure colors match channel mix labels dynamically for frontend render
    if (strategy.channelMix) {
      strategy.channelMix = strategy.channelMix.map(ch => {
        let color = 'bg-brand-500';
        if (ch.label.toLowerCase().includes('linked') || ch.icon === 'Linkedin') color = 'bg-blue-500';
        else if (ch.label.toLowerCase().includes('email') || ch.icon === 'Mail') color = 'bg-amber-500';
        else if (ch.label.toLowerCase().includes('insta') || ch.icon === 'Instagram') color = 'bg-rose-500';
        return { ...ch, color };
      });
    }

    try {
      if (mongoose.Types.ObjectId.isValid(id)) {
        await Workspace.findByIdAndUpdate(id, { currentStrategy: strategy }, { new: true });
      }
    } catch (e) {
      console.log('MongoDB Update Note for strategy:', e.message);
    }
    
    const index = memoryWorkspaces.findIndex(w => w.id === id || w._id === id);
    if (index !== -1) {
      memoryWorkspaces[index].currentStrategy = strategy;
    }

    res.json({ success: true, strategy });
  } catch (err) {
    console.error('[Strategy Engine] Error:', err.message);
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
    await Workspace.findByIdAndDelete(id);
  } catch (e) {}
  memoryWorkspaces = memoryWorkspaces.filter((w) => w.id !== id && w._id?.toString() !== id);
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

let currentPort = Number(PORT);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    currentPort++;
    console.log(`⚠️ Port ${currentPort - 1} in use. Trying fallback port ${currentPort}...`);
    setTimeout(() => {
      httpServer.listen(currentPort);
    }, 500);
  } else {
    console.error('Server error:', err);
  }
});

