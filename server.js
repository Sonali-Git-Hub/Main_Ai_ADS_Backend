// AI Ads Enterprise Server - gcloud ADC Auth Reloaded
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
const { mapPreviewToBrandProfile } = require('./controllers/brandController');
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
const adminRoutes = require('./routes/adminRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const accountRoutes = require('./routes/accountRoutes');
const seoRoutes = require('./routes/seoRoutes');

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

// ─── Real-Time Terminal Action, Request, Warning & Error Logger Middleware ─────
const SystemSetting = require('./models/SystemSetting');

app.use((req, res, next) => {
  const start = Date.now();
  const time = new Date().toLocaleTimeString();

  // Increment persistent platform API Hit Counter for all non-admin /api user requests
  if (req.originalUrl.startsWith('/api') && !req.originalUrl.startsWith('/api/admin') && !req.originalUrl.startsWith('/api/telemetry')) {
    SystemSetting.findOneAndUpdate(
      { key: 'total_api_hits' },
      { $inc: { value: 1 } },
      { upsert: true, setDefaultsOnInsert: true }
    ).catch(() => { });
  }

  // Log incoming route hit immediately
  const bodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];
  const payloadSummary = bodyKeys.length > 0 ? ` | Body: [${bodyKeys.join(', ')}]` : '';
  console.log(`\x1b[36m⚡ [ROUTE HIT] ${time} ${req.method} ${req.originalUrl}${payloadSummary}\x1b[0m`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    if (status >= 500) {
      console.error(`\x1b[31m❌ [ROUTE ERROR ${status}] ${time} ${req.method} ${req.originalUrl} (${duration}ms)\x1b[0m`);
    } else if (status >= 400) {
      console.warn(`\x1b[33m⚠️ [ROUTE WARN ${status}] ${time} ${req.method} ${req.originalUrl} (${duration}ms)\x1b[0m`);
    } else {
      console.log(`\x1b[32m✅ [ROUTE ${status} OK] ${time} ${req.method} ${req.originalUrl} (${duration}ms)\x1b[0m`);
    }
  });
  next();
});

// ─── API Router Mounting ───────────────────────────────────────────────────────
app.use('/api/chat', chatRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/website-builder', websiteBuilderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/account', accountRoutes);

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
    if (user) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
      }
    }
  } catch (error) {
    console.log('MongoDB Auth Note (Checking Memory Store):', error.message);
  }

  // If not found in Mongo DB, check Memory Store
  if (!user) {
    user = memoryUsers.find(u => u.email === cleanEmail);
    if (user) {
      if (user.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
      }
    }
  }

  // If account does NOT exist (or was deleted), reject login!
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'Account not found. Your account may have been deleted or does not exist. Please click "Create Account" to register.'
    });
  }

  // 2. Generate Token & Response
  try {
    const userId = user._id ? user._id.toString() : String(user.id || `usr_${Date.now()}`);
    let userRole = user.role || 'AgencyAdmin';
    const userEmail = user.email || cleanEmail;

    // Force SuperAdmin for the specific admin email
    if (userEmail === 'admin@aiads.com') {
      userRole = 'SuperAdmin';

      // Optionally update it in DB so future queries see it
      if (user._id && user.role !== 'SuperAdmin') {
        user.role = 'SuperAdmin';
        await user.save().catch(e => console.log('Failed to save SuperAdmin role', e.message));
      }
    }

    const token = jwt.sign(
      { userId, email: userEmail, role: userRole },
      process.env.JWT_SECRET || 'ai_ads_secret_key_123',
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: userId,
        email: userEmail,
        name: user.name || userEmail.split('@')[0],
        avatar: user.avatar || '',
        accentColor: user.accentColor || 'indigo',
        appearance: user.appearance || 'light',
        role: userRole
      }
    });
  } catch (jwtErr) {
    console.error('Auth generation error:', jwtErr);
    return res.status(500).json({ success: false, error: `Auth Error: ${jwtErr.message}` });
  }
});

// Register Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ success: false, error: 'Email, password, and confirm password are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, error: 'Passwords do not match. Please check and try again.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  let user = null;

  try {
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please Sign In.' });
    }
    user = await User.create({ email: cleanEmail, password, name: cleanEmail.split('@')[0], appearance: 'light' });
    console.log(`👤 New user registered in MongoDB: ${cleanEmail}`);
  } catch (error) {
    console.log('MongoDB Register Note (Using Memory Store Fallback):', error.message);
    const existing = memoryUsers.find(u => u.email === cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please Sign In.' });
    }
    user = { id: `usr_${Date.now()}`, email: cleanEmail, password, name: cleanEmail.split('@')[0], avatar: '', accentColor: 'indigo', appearance: 'light', role: 'AgencyAdmin' };
    memoryUsers.push(user);
    console.log(`👤 New user registered in Memory: ${cleanEmail}`);
  }

  try {
    const userId = user._id ? user._id.toString() : String(user.id || `usr_${Date.now()}`);
    const userRole = user.role || 'AgencyAdmin';
    const token = jwt.sign(
      { userId, email: cleanEmail, role: userRole },
      process.env.JWT_SECRET || 'ai_ads_secret_key_123',
      { expiresIn: '7d' }
    );

    // Send Welcome & Account Creation Confirmation Email
    try {
      const { sendWelcomeEmail } = require('./services/emailService');
      sendWelcomeEmail({
        email: cleanEmail,
        userName: cleanEmail.split('@')[0]
      }).catch(err => console.warn('Welcome email error:', err.message));
    } catch (e) { }

    return res.json({
      success: true,
      token,
      user: {
        id: userId,
        email: cleanEmail,
        name: user.name || cleanEmail.split('@')[0],
        avatar: user.avatar || '',
        accentColor: user.accentColor || 'indigo',
        appearance: user.appearance || 'light',
        role: userRole
      }
    });
  } catch (jwtErr) {
    return res.status(500).json({ success: false, error: `Auth Error: ${jwtErr.message}` });
  }
});

// Profile Update Endpoint (Persists display name, profile picture, accent color, and theme mode in database)
app.put('/api/auth/profile', async (req, res) => {
  const { email, name, avatar, accentColor, appearance } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    let updatedUser = await User.findOneAndUpdate(
      { email: cleanEmail },
      {
        $set: {
          ...(name !== undefined && { name }),
          ...(avatar !== undefined && { avatar }),
          ...(accentColor !== undefined && { accentColor }),
          ...(appearance !== undefined && { appearance })
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      // Memory store fallback
      let memUser = memoryUsers.find(u => u.email === cleanEmail);
      if (memUser) {
        if (name !== undefined) memUser.name = name;
        if (avatar !== undefined) memUser.avatar = avatar;
        if (accentColor !== undefined) memUser.accentColor = accentColor;
        if (appearance !== undefined) memUser.appearance = appearance;
        updatedUser = memUser;
      }
    }

    console.log(`👤 [PROFILE UPDATED] Saved profile for ${cleanEmail}: name="${name || ''}", accent="${accentColor || ''}", appearance="${appearance || ''}"`);

    return res.json({
      success: true,
      user: {
        id: updatedUser ? (updatedUser._id ? updatedUser._id.toString() : String(updatedUser.id || Date.now())) : `usr_${Date.now()}`,
        email: cleanEmail,
        name: updatedUser?.name || name || cleanEmail.split('@')[0],
        avatar: updatedUser?.avatar || avatar || '',
        accentColor: updatedUser?.accentColor || accentColor || 'indigo',
        appearance: updatedUser?.appearance || appearance || 'light',
        role: updatedUser?.role || 'AgencyAdmin'
      }
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// Product Feedback / Support Ticket Endpoint -> Delivers emails to admin@uwo24.com & saves to DB
app.post('/api/feedback', async (req, res) => {
  const { email, name, feedback, category } = req.body;
  if (!feedback || !feedback.trim()) {
    return res.status(400).json({ success: false, error: 'Feedback message is required.' });
  }

  const senderEmail = (email || 'anonymous@aiads.com').toLowerCase().trim();
  const senderName = name || senderEmail.split('@')[0];

  try {
    // 1. Save ticket into MongoDB SupportTicket collection
    const SupportTicket = require('./models/SupportTicket');
    const ticketCount = await SupportTicket.countDocuments({});
    const ticketId = `TICK-${101 + ticketCount}`;
    await SupportTicket.create({
      ticketId,
      email: senderEmail,
      name: senderName,
      subject: feedback.trim().slice(0, 50) + (feedback.trim().length > 50 ? '...' : ''),
      priority: 'Medium',
      status: 'Open',
      category: category || 'Product Feedback',
      message: feedback.trim(),
    });

    // 2. Dispatch email notification
    const { sendProductFeedbackEmail } = require('./services/emailService');
    await sendProductFeedbackEmail({
      userEmail: senderEmail,
      userName: senderName,
      feedbackText: feedback.trim(),
      category: category || 'Product Feedback'
    }).catch(e => console.error('Email dispatch error (non-fatal):', e.message));

    console.log(`💡 [FEEDBACK RECEIVED] Saved ticket ${ticketId} and dispatched email for ${senderEmail}`);
    return res.json({ success: true, message: 'Feedback successfully recorded & sent.', ticketId });
  } catch (err) {
    console.error('Error recording feedback ticket:', err);
    return res.status(500).json({ success: false, error: 'Failed to record feedback ticket.' });
  }
});

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});

// ─── NEW FEATURE ROUTES ────────────────────────────────────────────────────────
app.use('/api/account', accountRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/website-builder', websiteBuilderRoutes);
app.use('/api/admin', adminRoutes);

// SEO Intelligence routes (AI-powered keyword clustering, regeneration, brief generation)
app.use('/api/seo', seoRoutes);

// Plans & Subscription routes (DB-driven pricing plans & topups)
const planRoutes = require('./routes/planRoutes');
app.use('/api/plans', planRoutes);

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

    try {
      require('./services/telemetryService').recordTelemetryEvent({
        source: 'USER', eventType: 'USER_ACTION', component: 'BrandDnaScraper', action: 'SCRAPE_DOMAIN', page: '/brand-dna'
      });
    } catch (e) { }

    console.log(`🌐 [SCRAPER-PREVIEW] Generating non-persisted Brand DNA preview for: ${domainUrl}`);
    const brandDna = await generateBrandDNA(domainUrl, brandName || '');

    const previewWorkspace = {
      tempId: `preview_${Date.now()}`,
      userEmail: (userEmail || '').toLowerCase().trim(),
      brandName: brandDna.brandName || brandName || 'New Brand',
      companyName: brandDna.companyName || brandDna.brandName,
      parentCompany: brandDna.parentCompany || null,
      parentCompanyProvenance: brandDna.parentCompanyProvenance || null,
      domainUrl: brandDna.domainUrl || domainUrl,
      logoUrl: brandDna.logoUrl || brandDna.faviconUrl || '',
      brandColors: brandDna.brandColors || [],
      brandColorsProvenance: brandDna.brandColorsProvenance || null,
      industry: brandDna.industryCategory || null,
      industryCategory: brandDna.industryCategory || null,
      subIndustry: brandDna.subIndustry || null,
      businessType: brandDna.businessType || null,
      headquarters: brandDna.headquarters || null,
      companyDescription: brandDna.companyDescription || null,
      tagline: brandDna.tagline || null,
      missionStatement: brandDna.missionStatement || null,
      vision: brandDna.vision || null,
      industryProvenance: brandDna.industryProvenance || null,
      secondaryIndustries: brandDna.secondaryIndustries || [],
      businessTypeProvenance: brandDna.businessTypeProvenance || null,
      headquartersProvenance: brandDna.headquartersProvenance || null,
      locations: brandDna.locations || [],
      companyDescriptionProvenance: brandDna.companyDescriptionProvenance || null,
      taglineProvenance: brandDna.taglineProvenance || null,
      missionStatementProvenance: brandDna.missionStatementProvenance || null,
      visionProvenance: brandDna.visionProvenance || null,
      targetAudienceProvenance: brandDna.targetAudienceProvenance || null,
      coreProductsServicesProvenance: brandDna.coreProductsServicesProvenance || null,
      targetAudience: brandDna.targetAudience || [],
      brandVoiceTone: brandDna.brandVoiceTone || { formalityScore: 3, toneKeywords: [] },
      coreProductsServices: brandDna.coreProductsServices || [],
      contentPillars: brandDna.contentPillars || [],
      competitorLandscape: brandDna.competitorLandscape || [],
      brandValues: brandDna.brandValues || [],
      approvedClaims: brandDna.approvedClaims || [],
      extractedClaims: brandDna.extractedClaims || [],
      restrictedClaims: brandDna.restrictedClaims || [],
      socialMediaPresence: brandDna.socialMediaPresence || [],
      faviconUrl: brandDna.faviconUrl || '',
      contactInfo: brandDna.contactInfo || {},
      contactInfoProvenance: brandDna.contactInfoProvenance || null,
      fieldSources: brandDna.fieldSources || {},
      evidenceCitations: brandDna.evidenceCitations || [],
      pagesEvidence: (brandDna.pagesEvidence || []).map(p => ({
        url: p.url,
        pageTitle: p.pageTitle,
        pageType: p.pageType,
        textEvidence: p.textEvidence,
        headings: p.headings,
        metadata: p.metadata,
        hasScreenshot: p.screenshot?.status === 'SUCCESS',
        screenshotStatus: p.screenshot?.status || 'FAILED',
        timestamp: p.screenshot?.timestamp || null
      })),
      confidenceScore: brandDna.confidenceScore || 95,
      analysisStatus: brandDna.analysisStatus || 'SUCCESS',
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

    // 1. Lightweight Workspace Navigation Container (Ownership: Tenant/Workspace UI metadata ONLY)
    const workspaceMetadata = {
      userEmail: cleanEmail,
      brandName: workspaceData.brandName || 'New Brand',
      domainUrl: workspaceData.domainUrl || '',
      logoUrl: workspaceData.logoUrl || workspaceData.faviconUrl || '',
      createdAt: new Date().toISOString()
    };

    let savedWorkspace = null;
    let savedBrandProfile = null;

    if (mongoose.connection.readyState === 1) {
      // Step A: Create or update lightweight Workspace container
      const workspaceDoc = await Workspace.create(workspaceMetadata);
      const workspaceId = workspaceDoc._id.toString();

      savedWorkspace = workspaceDoc;

      // Step B: Map Preview Brand DNA payload to Canonical BrandProfile schema
      const brandProfilePayload = mapPreviewToBrandProfile(workspaceData, workspaceId);

      // Step C: Upsert Canonical BrandProfile (Single Ownership Source of Truth)
      savedBrandProfile = await BrandProfile.findOneAndUpdate(
        { workspaceId },
        { $set: brandProfilePayload },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      console.log(`🔒 Single-Ownership Brand DNA Saved for user [${cleanEmail}]: Workspace [${workspaceId}] -> BrandProfile [${savedBrandProfile.brandName}]`);
    } else {
      savedWorkspace = { id: `ws_${Date.now()}`, ...workspaceMetadata };
      memoryWorkspaces.unshift(savedWorkspace);
      savedBrandProfile = mapPreviewToBrandProfile(workspaceData, savedWorkspace.id);
    }

    res.json({
      success: true,
      workspace: savedWorkspace,
      brandProfile: savedBrandProfile
    });
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
  const { campaignId, campaignName, campaignGoal, targetAudience, platforms, budget, postingFrequency } = req.body || {};

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
    const positioning = workspace.positioningSummary || brandProfile?.structuredIdentity?.positioning || '';
    const mission = workspace.missionStatement || brandProfile?.structuredIdentity?.mission || '';
    const pillars = (workspace.contentPillars && workspace.contentPillars.length > 0)
      ? workspace.contentPillars
      : brandProfile?.structuredIdentity?.content_angles || [];
    const competitors = (workspace.competitorLandscape && workspace.competitorLandscape.length > 0)
      ? workspace.competitorLandscape.join(', ')
      : 'Top industry competitors & alternatives';
    const audienceStr = targetAudience || (workspace.targetAudience || []).join(', ') || brandProfile?.structuredIdentity?.target_audience || 'Target buyers & consumers';

    console.log(`[Strategy Engine] Generating AI Marketing Roadmap for: ${brandName} (${industry})${campaignName ? ` for Campaign: ${campaignName}` : ''}...`);

    const campaignContext = campaignName ? `
═══════════════════════════════════════════════════════
TARGET CAMPAIGN OBJECTIVE (PRIMARY FOCUS):
- Campaign Name: "${campaignName}"
- Primary Goal: "${campaignGoal || 'Growth campaign'}"
${platforms ? `- Platforms: ${Array.isArray(platforms) ? platforms.join(', ') : platforms}` : ''}
${budget ? `- Budget: ₹${budget}` : ''}
${postingFrequency ? `- Posting Frequency: ${postingFrequency}` : ''}
NOTE: Tailor this entire strategy, business goal, lead magnet, funnel, and 30-day content plan directly to achieve this campaign objective!
═══════════════════════════════════════════════════════` : '';

    const prompt = `You are a Chief Marketing Officer (CMO) and Growth Strategist.
Generate a comprehensive, actionable, premium 30-day marketing strategy and roadmap for this brand:${campaignContext}

═══════════════════════════════════════════════════════
BRAND DNA & COMPETITOR CONTEXT:
- Brand Name: "${brandName}"
- Industry / Sector: "${industry}"
- Tagline: "${tagline}"
- Positioning: "${positioning}"
- Mission Statement: "${mission}"
- Content Pillars / Angles: ${pillars.join(', ')}
- Target Audience Personas: ${audienceStr}
- Competitor Landscape: ${competitors}
═══════════════════════════════════════════════════════

CRITICAL GENERATION RULES:
1. Generate specific, authentic marketing assets tailored uniquely to "${brandName}" in "${industry}"${campaignName ? ` to execute campaign "${campaignName}"` : ''}.
2. DO NOT use generic filler text like "The Authority Series", "Pillar 1", or "Key Insights for Brand".
3. Provide realistic channel distribution percentages (e.g. for B2C food/fashion: heavy Instagram, SEO, Email; for B2B tech: heavy LinkedIn, SEO, Email).
4. Generate an array "thirtyDayPlan" of 30 DISTINCT daily content items (Day 1 to 30) with varied creative formats, hooks, and specific topics.
5. NO VIDEO OR REEL GENERATION: We do NOT provide video or reel generation capabilities. DO NOT generate strategy content, titles, or directives for Reels, YouTube Shorts, TikTok, or video production. Exclude video and reels. Generate ONLY content for static image posts, carousels, text posts, SEO blogs, LinkedIn articles/posts, and email newsletters.

Return a JSON object with this exact structure:
{
  "businessGoal": "Specific, measurable 90-day growth goal with metrics tailored to ${brandName}",
  "leadMagnet": "High-converting lead magnet, free guide, template, or interactive tool tailored to ${brandName}",
  "primaryCta": "High-intent primary call-to-action for landing pages and social campaigns",
  "postingFrequency": "Optimal posting frequency based on category (e.g. 'Daily (7x / week)' or '5x / week')",
  "budgetSuggestions": "Strategic budget split between organic SEO, social distribution, and paid retargeting",
  "bestPlatforms": ["Top Platform 1", "Top Platform 2", "Top Platform 3", "Top Platform 4"],
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3", "Pillar 4"],
  "channelMix": [
    { "label": "Channel 1", "pct": 35, "icon": "Globe" },
    { "label": "Channel 2", "pct": 30, "icon": "Linkedin" },
    { "label": "Channel 3", "pct": 20, "icon": "Instagram" },
    { "label": "Channel 4", "pct": 15, "icon": "Mail" }
  ],
  "audience": [
    "Persona 1: Specific demographic, pain point, and buying trigger",
    "Persona 2: Specific demographic, pain point, and buying trigger",
    "Persona 3: Specific demographic, pain point, and buying trigger"
  ],
  "funnel": {
    "awareness": "Top-of-funnel viral hook, organic search, and educational reach strategy for ${brandName}",
    "nurturing": "Middle-of-funnel engagement, case study, and lead capture strategy",
    "conversion": "Bottom-of-funnel direct-response, social proof, and transactional offer strategy"
  },
  "campaignIdeas": [
    { "title": "Campaign 1 Name", "desc": "Compelling campaign concept, target angle, and business outcome" },
    { "title": "Campaign 2 Name", "desc": "Compelling campaign concept, target angle, and business outcome" },
    { "title": "Campaign 3 Name", "desc": "Compelling campaign concept, target angle, and business outcome" }
  ],
  "thirtyDayPlan": [
    {
      "day": 1,
      "platform": "Instagram / LinkedIn / SEO Blog / Email Newsletter / Twitter",
      "topic": "Catchy daily content title (Static Post/Carousel/Blog)",
      "pillar": "Related content pillar",
      "actionItem": "Specific creative image guideline, carousel hook, or text copy prompt for content creator"
    }
  ]
}

Ensure "thirtyDayPlan" contains 30 distinct daily items from day 1 to 30.
Return ONLY valid JSON.`;

    let strategy = null;
    try {
      const aiResponse = await generateJSON(prompt, { temperature: 0.7 });
      strategy = aiResponse?.data || (aiResponse && typeof aiResponse === 'object' && !aiResponse.data ? aiResponse : null);
    } catch (aiErr) {
      console.warn('[Strategy Engine] AI synthesis error, using brand-specific fallback builder:', aiErr.message);
    }

    // ─── GUARANTEED BRAND-SPECIFIC STRATEGY FALLBACK BUILDER ─────────────────────────
    if (!strategy || !Array.isArray(strategy.thirtyDayPlan) || strategy.thirtyDayPlan.length < 10) {
      console.log(`[Strategy Engine] Building rich brand strategy plan for ${brandName}...`);
      const isFood = industry.toLowerCase().includes('food') || industry.toLowerCase().includes('beverage') || brandName.toLowerCase().includes('nestle');
      const isTech = industry.toLowerCase().includes('tech') || industry.toLowerCase().includes('ai') || industry.toLowerCase().includes('software');

      const defaultTopics = (pillars && pillars.length > 0)
        ? pillars
        : (isFood
          ? ['Premium Coffee & Beverages', 'Nutrition & Health Standards', 'Quick Recipes & Cooking Hacks', 'Sustainable Sourcing Proof']
          : ['AI Automation & Velocity', 'Enterprise Data Governance', 'Content Operations Playbook', 'Customer ROI Case Studies']);

      const defaultPlatforms = isFood
        ? ['Instagram Image & Carousel', 'SEO Blogs (Long-Form)', 'LinkedIn Post', 'Email Newsletters']
        : ['LinkedIn & Founder Copy', 'SEO Blogs (Long-Form)', 'Email Newsletters', 'Twitter/X Post'];

      const fallbackPlan = Array.from({ length: 30 }, (_, i) => {
        const day = i + 1;
        const pillar = defaultTopics[i % defaultTopics.length];
        const platform = defaultPlatforms[i % defaultPlatforms.length];
        const week = Math.ceil(day / 7);
        const stage = week === 1 ? 'Awareness' : week === 2 ? 'Consideration' : week === 3 ? 'Engagement' : 'Conversion';

        return {
          day,
          platform,
          topic: `Day ${day}: Master ${pillar} — ${stage} Strategy for ${brandName}`,
          pillar,
          actionItem: `Publish ${platform} highlighting ${pillar} differentiators to outrank competitors and capture customer consideration.`
        };
      });

      strategy = {
        businessGoal: `Scale ${brandName}'s Organic Customer Acquisition & Revenue Pipeline in ${industry}`,
        leadMagnet: `The 2026 ${brandName} Consumer & Executive Buyer's Playbook (Free Digital PDF)`,
        primaryCta: `Explore ${brandName} Official Catalog & Special Offers`,
        postingFrequency: 'Daily (7 posts / week across primary channels)',
        budgetSuggestions: '55% Organic content marketing & SEO / 35% Social acquisition / 10% Retargeting & CRM.',
        bestPlatforms: defaultPlatforms.map(p => p.split('(')[0].trim()),
        contentPillars: defaultTopics,
        channelMix: isFood ? [
          { label: 'Instagram Image & Carousel', pct: 35, icon: 'Instagram', color: 'bg-rose-500' },
          { label: 'SEO Blogs (Long-Form)', pct: 30, icon: 'Globe', color: 'bg-brand-500' },
          { label: 'LinkedIn Article & Post', pct: 20, icon: 'Linkedin', color: 'bg-blue-500' },
          { label: 'Email Newsletters', pct: 15, icon: 'Mail', color: 'bg-amber-500' }
        ] : [
          { label: 'LinkedIn & Founder Copy', pct: 40, icon: 'Linkedin', color: 'bg-blue-500' },
          { label: 'SEO Blogs (Long-Form)', pct: 30, icon: 'Globe', color: 'bg-brand-500' },
          { label: 'Email Newsletters', pct: 20, icon: 'Mail', color: 'bg-amber-500' },
          { label: 'Instagram Post & Carousel', pct: 10, icon: 'Instagram', color: 'bg-rose-500' }
        ],
        audience: [
          `Primary Household Buyers & Category Consumers searching for reliable quality in ${industry}`,
          `Health-conscious & Premium Product Shoppers looking for authentic ingredients and value`,
          `Commercial & Bulk Order Decision-Makers seeking wholesale and subscription convenience`
        ],
        funnel: {
          awareness: `Top-of-funnel educational visual carousels and SEO recipe/trend guides to capture broad search demand for ${brandName}.`,
          nurturing: `Middle-of-funnel customer reviews, comparison proof, and downloadable guide to nurture high-intent prospects.`,
          conversion: `Bottom-of-funnel limited-time offers, direct-to-consumer checkout incentives, and subscription bundles.`
        },
        campaignIdeas: [
          { title: `${brandName} Quality & Origin Spotlight`, desc: `Interactive storytelling showcasing sustainable sourcing and premium ingredients.` },
          { title: `Taste & Performance Challenge`, desc: `User-generated content campaign encouraging consumers to share their daily routine.` },
          { title: `Direct-to-Consumer Subscription Launch`, desc: `Exclusive bundle discount driving recurring subscription orders.` }
        ],
        thirtyDayPlan: fallbackPlan
      };
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

    if (campaignName) {
      strategy.campaignName = campaignName;
      strategy.campaignGoal = campaignGoal || '';
    }
    if (campaignId) {
      strategy.campaignId = campaignId;
      try {
        const Campaign = require('./models/Campaign');
        const CampaignPost = require('./models/CampaignPost');
        if (mongoose.Types.ObjectId.isValid(campaignId)) {
          const existingPosts = await CampaignPost.find({ campaignId }).sort({ date: 1, createdAt: 1 });
          if (existingPosts && existingPosts.length > 0 && Array.isArray(strategy.thirtyDayPlan)) {
            strategy.thirtyDayPlan = strategy.thirtyDayPlan.map((d, idx) => {
              const match = existingPosts[idx];
              if (match) {
                const topic = match.postObjective || match.topic || match.postFor || d.topic;
                return {
                  ...d,
                  day: idx + 1,
                  title: topic,
                  topic: topic,
                  platform: match.platform || d.platform,
                  pillar: match.postFor || match.contentType || d.pillar,
                  actionItem: d.actionItem || match.prompt || match.captionPrompt,
                };
              }
              return d;
            });
          }
          await Campaign.findByIdAndUpdate(campaignId, { aiGeneratedStrategy: strategy });
        }
      } catch (campErr) {
        console.log('Campaign strategy update note:', campErr.message);
      }
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

// ─── POST /api/workspace/:id/regenerate-strategy-card ─────────────────────────
app.post('/api/workspace/:id/regenerate-strategy-card', async (req, res) => {
  const { id } = req.params;
  const { day, currentTopic, currentActionItem, platform, pillar, userDirective } = req.body || {};

  try {
    let workspace = null;
    let brandProfile = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      workspace = await Workspace.findById(id);
      brandProfile = await BrandProfile.findOne({ workspaceId: id });
    }
    if (!workspace) {
      workspace = memoryWorkspaces.find(w => w.id === id || w._id === id) || {};
    }

    const brandName = workspace.brandName || brandProfile?.companyName || 'our brand';
    const industry = workspace.industryCategory || brandProfile?.structuredIdentity?.industry || 'General';

    console.log(`[Strategy Card Engine] Regenerating card for Day ${day || 1} (${brandName}) with directive: "${userDirective || 'None'}"...`);

    const prompt = `You are a Chief Marketing Officer and Strategy Specialist for ${brandName} (${industry}).
Regenerate a single marketing calendar content card for Day ${day || 1} on platform "${platform || 'Social Media'}".

CRITICAL RULE: DO NOT generate video or reel content/directives (we do NOT support video/reel generation). Exclude Reels, YouTube Shorts, and video creation prompts. Focus exclusively on static images, carousels, text posts, SEO blog articles, and email newsletters.

Current Card Context:
- Topic: "${currentTopic || ''}"
- Action Item: "${currentActionItem || ''}"
- Platform: "${platform || 'Instagram'}"
- Content Pillar: "${pillar || 'Brand Strategy'}"

${userDirective ? `CRITICAL USER DIRECTIVE / STRATEGY INPUT: "${userDirective}". Make sure the regenerated topic and actionItem explicitly incorporate this directive without requesting video generation.` : 'Generate a fresh, high-performing alternative strategy topic and action item.'}

Return ONLY a valid JSON object matching this schema exactly:
{
  "topic": "Catchy, clear content title incorporating the strategy input (Static Image/Carousel/Blog format)",
  "actionItem": "Detailed creative image guideline, carousel visual hook, or copy prompt for content creator",
  "pillar": "Relevant content pillar"
}`;

    let updatedCard = null;
    try {
      const aiRes = await generateJSON(prompt, { reqId: `REGEN-CARD-${day}` });
      updatedCard = aiRes?.data || (aiRes && typeof aiRes === 'object' && !aiRes.data ? aiRes : null);
    } catch (aiErr) {
      console.warn('[Strategy Card Engine] AI generation fallback:', aiErr.message);
    }

    if (!updatedCard || !updatedCard.topic) {
      const topicStr = userDirective
        ? (userDirective.length > 60 ? userDirective.slice(0, 60) + '...' : userDirective)
        : `Refreshed Strategy: ${currentTopic || 'Brand Post'}`;
      const actionStr = userDirective
        ? `Create content focusing on: ${userDirective}`
        : `Publish ${platform || 'social'} post with visual focus on ${brandName} value.`;
      updatedCard = {
        topic: topicStr,
        actionItem: actionStr,
        pillar: pillar || 'Brand Strategy'
      };
    }

    return res.json({ success: true, updatedCard });
  } catch (err) {
    console.error(`[Regen Strategy Card Error]:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/workspace/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let updated = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      updated = await Workspace.findByIdAndUpdate(id, req.body, { returnDocument: 'after' });
    }
    if (!updated) {
      updated = await Workspace.findOneAndUpdate({ id }, req.body, { returnDocument: 'after' });
    }
    if (!updated && req.body.domainUrl) {
      updated = await Workspace.findOneAndUpdate({ domainUrl: req.body.domainUrl }, req.body, { returnDocument: 'after' });
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
  } catch (e) { }
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
      updated = await Workspace.findByIdAndUpdate(workspaceId, updates, { returnDocument: 'after' });
    }
    if (!updated) {
      updated = await Workspace.findOneAndUpdate({ id: workspaceId }, updates, { returnDocument: 'after' });
    }
    if (!updated && updates.domainUrl) {
      updated = await Workspace.findOneAndUpdate({ domainUrl: updates.domainUrl }, updates, { returnDocument: 'after' });
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
        updated = await Workspace.findByIdAndUpdate(workspaceId, brandData, { returnDocument: 'after' });
      }
      if (!updated) {
        updated = await Workspace.findOneAndUpdate({ id: workspaceId }, brandData, { returnDocument: 'after' });
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

// SEO brief/generate — handled by seoRoutes (mounted above as /api/seo)

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

function generateCategoryAwareVertexAIVisual(prompt = '', style = 'Glassmorphic Modern 3D', brandName = "Haldiram's") {
  const pLower = prompt.toLowerCase();

  let category = 'LUXURY_HAMPER';
  if (pLower.includes('carousel') || pLower.includes('customization') || pLower.includes('bespoke') || pLower.includes('option') || pLower.includes('slide')) {
    category = 'CAROUSEL_CUSTOMIZATION';
  } else if (pLower.includes('social') || pLower.includes('instagram') || pLower.includes('facebook') || pLower.includes('post') || pLower.includes('caption') || pLower.includes('viral')) {
    category = 'SOCIAL_ENGAGEMENT';
  } else if (pLower.includes('sweet') || pLower.includes('kaju') || pLower.includes('namkeen') || pLower.includes('food') || pLower.includes('flavor') || pLower.includes('taste') || pLower.includes('thali')) {
    category = 'FOOD_SWEETS';
  } else if (pLower.includes('website') || pLower.includes('builder') || pLower.includes('landing') || pLower.includes('page') || pLower.includes('tech') || pLower.includes('digital') || pLower.includes('code')) {
    category = 'WEBSITE_TECH';
  } else if (pLower.includes('seo') || pLower.includes('article') || pLower.includes('blog') || pLower.includes('press') || pLower.includes('newspaper') || pLower.includes('headline')) {
    category = 'SEO_PRESS';
  }

  const titleText = prompt.trim() || 'AI Commercial Campaign Visual';
  const displayTitle = titleText.length > 55 ? titleText.slice(0, 52) + '...' : titleText;
  const bName = brandName || "Haldiram's";

  let bgGradient = '';
  let accentGrad = '';
  let categoryBadge = '';
  let centerPieceSvg = '';

  if (category === 'CAROUSEL_CUSTOMIZATION') {
    bgGradient = '<radialGradient id="bg" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#1E1B4B"/><stop offset="60%" stop-color="#0F172A"/><stop offset="100%" stop-color="#020617"/></radialGradient>';
    accentGrad = '<linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#818CF8"/><stop offset="50%" stop-color="#C084FC"/><stop offset="100%" stop-color="#38BDF8"/></linearGradient>';
    categoryBadge = 'CAROUSEL & BESPOKE CUSTOMIZATION';

    centerPieceSvg = `
      <g filter="url(#shadow)" transform="translate(0, -10)">
        <rect x="580" y="270" width="300" height="380" rx="20" fill="rgba(30, 41, 59, 0.6)" stroke="#818CF8" stroke-width="2" opacity="0.6"/>
        <rect x="200" y="270" width="300" height="380" rx="20" fill="rgba(30, 41, 59, 0.7)" stroke="#C084FC" stroke-width="2" opacity="0.8"/>
        <rect x="340" y="230" width="400" height="440" rx="24" fill="#1E293B" stroke="url(#accent)" stroke-width="4"/>
        <rect x="360" y="255" width="360" height="180" rx="16" fill="rgba(255,255,255,0.06)"/>
        
        <rect x="380" y="470" width="320" height="12" rx="6" fill="#334155"/>
        <circle cx="480" cy="476" r="16" fill="#38BDF8" stroke="#FFF" stroke-width="3" filter="url(#glow)"/>
        <rect x="380" y="520" width="320" height="12" rx="6" fill="#334155"/>
        <circle cx="600" cy="526" r="16" fill="#C084FC" stroke="#FFF" stroke-width="3" filter="url(#glow)"/>

        <circle cx="280" cy="450" r="24" fill="#1E293B" stroke="url(#accent)" stroke-width="2"/>
        <path d="M 285, 440 L 270, 450 L 285, 460" fill="none" stroke="#F8FAFC" stroke-width="3"/>
        <circle cx="800" cy="450" r="24" fill="#1E293B" stroke="url(#accent)" stroke-width="2"/>
        <path d="M 795, 440 L 810, 450 L 795, 460" fill="none" stroke="#F8FAFC" stroke-width="3"/>
        
        <circle cx="500" cy="630" r="6" fill="#38BDF8"/>
        <circle cx="540" cy="630" r="8" fill="#FFF"/>
        <circle cx="580" cy="630" r="6" fill="#38BDF8"/>
      </g>
    `;
  } else if (category === 'SOCIAL_ENGAGEMENT') {
    bgGradient = '<radialGradient id="bg" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#2E1065"/><stop offset="60%" stop-color="#0F172A"/><stop offset="100%" stop-color="#020617"/></radialGradient>';
    accentGrad = '<linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F43F5E"/><stop offset="50%" stop-color="#FB7185"/><stop offset="100%" stop-color="#E11D48"/></linearGradient>';
    categoryBadge = 'SOCIAL MEDIA & VIRAL ENGAGEMENT';

    centerPieceSvg = `
      <g filter="url(#shadow)" transform="translate(0, -20)">
        <rect x="360" y="210" width="360" height="480" rx="36" fill="#0F172A" stroke="url(#accent)" stroke-width="5"/>
        <rect x="380" y="235" width="320" height="430" rx="24" fill="rgba(255,255,255,0.05)"/>
        
        <rect x="490" y="245" width="100" height="14" rx="7" fill="#1E293B"/>

        <rect x="400" y="280" width="280" height="240" rx="16" fill="url(#accent)" opacity="0.8"/>
        <circle cx="540" cy="400" r="50" fill="rgba(255,255,255,0.2)"/>

        <g filter="url(#glow)">
          <path d="M 280, 320 C 280, 300 310, 290 320, 310 C 330, 290 360, 300 360, 320 C 360, 350 320, 370 320, 380 C 320, 370 280, 350 280, 320 Z" fill="#F43F5E"/>
          <circle cx="800" cy="360" r="32" fill="#FB7185"/>
          <path d="M 790, 360 L 810, 360 M 800, 350 L 800, 370" stroke="#FFF" stroke-width="4"/>
          <polygon points="760,260 770,285 795,285 775,300 782,325 760,310 738,325 745,300 725,285 750,285" fill="#FCD34D"/>
        </g>
      </g>
    `;
  } else if (category === 'FOOD_SWEETS') {
    bgGradient = '<radialGradient id="bg" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#451A03"/><stop offset="60%" stop-color="#1A0B2E"/><stop offset="100%" stop-color="#05010B"/></radialGradient>';
    accentGrad = '<linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F59E0B"/><stop offset="50%" stop-color="#D97706"/><stop offset="100%" stop-color="#B45309"/></linearGradient>';
    categoryBadge = 'AUTHENTIC HERITAGE & CULINARY';

    centerPieceSvg = `
      <g filter="url(#shadow)" transform="translate(0, -30)">
        <ellipse cx="540" cy="480" rx="340" ry="180" fill="url(#accent)" stroke="#FCD34D" stroke-width="4" filter="url(#glow)"/>
        <ellipse cx="540" cy="480" rx="300" ry="150" fill="#291605"/>

        <circle cx="360" cy="440" r="45" fill="#F59E0B" stroke="#FFF" stroke-width="3"/>
        <circle cx="720" cy="440" r="45" fill="#F59E0B" stroke="#FFF" stroke-width="3"/>
        <circle cx="540" cy="380" r="55" fill="#D97706" stroke="#FFF" stroke-width="3"/>

        <polygon points="510,480 540,430 570,480 540,530" fill="#F8FAFC" stroke="#F59E0B" stroke-width="2" filter="url(#shadow)"/>
        <polygon points="430,510 460,470 490,510 460,550" fill="#E2E8F0" stroke="#F59E0B" stroke-width="2" filter="url(#shadow)"/>
        <polygon points="590,510 620,470 650,510 620,550" fill="#E2E8F0" stroke="#F59E0B" stroke-width="2" filter="url(#shadow)"/>
      </g>
    `;
  } else if (category === 'WEBSITE_TECH') {
    bgGradient = '<radialGradient id="bg" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#0284C7"/><stop offset="60%" stop-color="#0F172A"/><stop offset="100%" stop-color="#020617"/></radialGradient>';
    accentGrad = '<linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38BDF8"/><stop offset="50%" stop-color="#818CF8"/><stop offset="100%" stop-color="#0EA5E9"/></linearGradient>';
    categoryBadge = 'AI WEBSITE & DIGITAL BUILDER';

    centerPieceSvg = `
      <g filter="url(#shadow)" transform="translate(0, -20)">
        <rect x="240" y="220" width="600" height="440" rx="24" fill="#0F172A" stroke="url(#accent)" stroke-width="4"/>
        <rect x="240" y="220" width="600" height="50" rx="24" fill="#1E293B"/>
        <circle cx="270" cy="245" r="7" fill="#EF4444"/>
        <circle cx="290" cy="245" r="7" fill="#F59E0B"/>
        <circle cx="310" cy="245" r="7" fill="#10B981"/>

        <rect x="340" y="233" width="400" height="24" rx="12" fill="#0F172A"/>

        <rect x="270" y="290" width="260" height="180" rx="16" fill="rgba(56, 189, 248, 0.15)" stroke="#38BDF8" stroke-width="2"/>
        <rect x="550" y="290" width="260" height="180" rx="16" fill="rgba(129, 140, 248, 0.15)" stroke="#818CF8" stroke-width="2"/>
        <rect x="270" y="490" width="540" height="130" rx="16" fill="rgba(255, 255, 255, 0.05)" stroke="url(#accent)" stroke-width="2"/>
      </g>
    `;
  } else if (category === 'SEO_PRESS') {
    bgGradient = '<radialGradient id="bg" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#334155"/><stop offset="60%" stop-color="#0F172A"/><stop offset="100%" stop-color="#020617"/></radialGradient>';
    accentGrad = '<linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F59E0B"/><stop offset="50%" stop-color="#10B981"/><stop offset="100%" stop-color="#3B82F6"/></linearGradient>';
    categoryBadge = 'SEO INTELLIGENCE & PRESS ARTICLES';

    centerPieceSvg = `
      <g filter="url(#shadow)" transform="translate(0, -20)">
        <rect x="280" y="210" width="520" height="460" rx="20" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="4"/>
        <rect x="310" y="240" width="460" height="50" fill="#0F172A"/>
        <text x="540" y="272" fill="#FCD34D" font-family="serif" font-size="24" font-weight="bold" text-anchor="middle">EDITORIAL PRESS RELEASE</text>

        <rect x="310" y="310" width="210" height="140" fill="#E2E8F0"/>
        <rect x="540" y="310" width="230" height="16" fill="#334155"/>
        <rect x="540" y="335" width="230" height="12" fill="#94A3B8"/>
        <rect x="540" y="355" width="230" height="12" fill="#94A3B8"/>
        <rect x="540" y="375" width="180" height="12" fill="#94A3B8"/>

        <path d="M 310, 600 Q 420, 520 540, 560 T 770, 480" fill="none" stroke="#10B981" stroke-width="6" filter="url(#glow)"/>
      </g>
    `;
  } else {
    bgGradient = '<radialGradient id="bg" cx="50%" cy="40%" r="80%"><stop offset="0%" stop-color="#1A0B2E"/><stop offset="60%" stop-color="#0F051D"/><stop offset="100%" stop-color="#05010B"/></radialGradient>';
    accentGrad = '<linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F59E0B"/><stop offset="50%" stop-color="#EF4444"/><stop offset="100%" stop-color="#8B5CF6"/></linearGradient>';
    categoryBadge = 'ROYAL WEDDING & LUXURY GIFTING';

    centerPieceSvg = `
      <g filter="url(#shadow)" transform="translate(0, -30)">
        <ellipse cx="540" cy="640" rx="340" ry="80" fill="rgba(0,0,0,0.5)" filter="url(#glow)"/>
        <ellipse cx="540" cy="620" rx="320" ry="70" fill="url(#cardGlass)" stroke="url(#accent)" stroke-width="3"/>

        <rect x="350" y="320" width="380" height="280" rx="24" fill="#2A1448" stroke="url(#goldRibbon)" stroke-width="4"/>
        <rect x="330" y="300" width="420" height="55" rx="16" fill="url(#goldRibbon)" filter="url(#shadow)"/>
        <rect x="515" y="300" width="50" height="300" fill="url(#goldRibbon)"/>
        <rect x="350" y="430" width="380" height="45" fill="url(#goldRibbon)"/>
        <path d="M 470, 270 C 420, 220 480, 180 540, 260 C 600, 180 660, 220 610, 270 Z" fill="url(#goldRibbon)" filter="url(#glow)"/>
        <circle cx="540" cy="265" r="22" fill="#F59E0B" stroke="#FFF" stroke-width="3"/>
      </g>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="100%" height="100%">
    <defs>
      ${bgGradient}
      ${accentGrad}
      <linearGradient id="goldRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FEF08A"/>
        <stop offset="50%" stop-color="#F59E0B"/>
        <stop offset="100%" stop-color="#B45309"/>
      </linearGradient>
      <linearGradient id="cardGlass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.03)"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="20" stdDeviation="25" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="18" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <rect width="1080" height="1080" fill="url(#bg)"/>

    <circle cx="200" cy="250" r="220" fill="url(#accent)" opacity="0.22" filter="url(#glow)"/>
    <circle cx="880" cy="750" r="260" fill="url(#accent)" opacity="0.18" filter="url(#glow)"/>

    ${centerPieceSvg}

    <rect x="320" y="80" width="440" height="50" rx="25" fill="rgba(15, 23, 42, 0.85)" stroke="url(#accent)" stroke-width="2" filter="url(#shadow)"/>
    <text x="540" y="113" fill="#FCD34D" font-family="'Plus Jakarta Sans', sans-serif" font-size="18" font-weight="800" text-anchor="middle" letter-spacing="2.5">${bName.toUpperCase()} • ${categoryBadge}</text>

    <g transform="translate(90, 710)" filter="url(#shadow)">
      <rect x="0" y="0" width="900" height="280" rx="32" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255, 255, 255, 0.15)" stroke-width="2"/>
      <rect x="0" y="0" width="900" height="280" rx="32" fill="url(#cardGlass)"/>

      <rect x="40" y="35" width="220" height="36" rx="18" fill="url(#accent)"/>
      <text x="150" y="59" fill="#FFFFFF" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="1.5">AI CREATIVE ASSET</text>

      <text x="40" y="125" fill="#F8FAFC" font-family="'Plus Jakarta Sans', sans-serif" font-size="30" font-weight="800">${displayTitle}</text>
      <text x="40" y="175" fill="#94A3B8" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="500">Style: ${style} | 4K HDR Vector Render</text>

      <line x1="40" y1="215" x2="860" y2="215" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

      <text x="40" y="248" fill="#FCD34D" font-family="'Plus Jakarta Sans', sans-serif" font-size="16" font-weight="700">⚡ Powered by Google Cloud Vertex AI (Gemini 3.5 Engine)</text>
      <text x="860" y="248" fill="#64748B" font-family="'Plus Jakarta Sans', sans-serif" font-size="16" font-weight="600" text-anchor="end">1080 x 1080 px</text>
    </g>
  </svg>`;

  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

app.post('/api/creative/credits/tier', (req, res) => {
  const { tier } = req.body;
  const result = setSubscriptionTier(tier);
  res.json({ success: true, ...result });
});

// ─── Pexels API Image Search Endpoint ───
app.get('/api/pexels/search', async (req, res) => {
  try {
    const { query, limit = 15, orientation = 'landscape' } = req.query;
    const { searchPhotos } = require('./services/pexelsService');
    const photos = await searchPhotos(query, { perPage: Number(limit), orientation });
    res.json({ success: true, photos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AI Creative Visual Asset Generation Endpoint (Gemini 3.1 Flash Image + GCS) ───
app.post('/api/creative/visual/generate', async (req, res) => {
  try {
    const {
      workspaceId,
      prompt,
      topic,
      hook,
      brand,
      brandName,
      brandColors,
      industry,
      tagline,
      companyDescription,
      platform,
      style,
      aspect,
      creditCost = 5,
      seed
    } = req.body;

    const deduction = deductCredits(creditCost, `AI Visual Generation: "${topic || hook || prompt || 'Brand Visual'}"`);

    const { generateBrandAdImage } = require('./services/brandImageAgent.service');
    const visualRes = await generateBrandAdImage({
      workspaceId,
      prompt,
      customPrompt: prompt,
      brandName: brandName || brand || 'Brand',
      brandColors,
      industry,
      tagline,
      companyDescription,
      topic: topic || hook || prompt || 'Commercial Brand Campaign',
      postType: 'image',
      platform: platform || 'instagram',
      style: style || 'Photorealistic Commercial',
      aspect: aspect || (platform === 'linkedin' ? '16:9' : (platform === 'story' || platform === 'reel' || platform === 'tiktok') ? '9:16' : '1:1'),
      seed
    });

    console.log(`🖼️ [CREATIVE STUDIO] Generated Brand AI Visual via ${visualRes.engine} -> ${visualRes.imageUrl?.slice(0, 80)}...`);

    return res.json({
      success: true,
      remainingCredits: deduction.newBalance,
      asset: {
        imageUrl: visualRes.imageUrl,
        gcsPath: visualRes.gcsPath,
        imagePrompt: visualRes.imagePrompt,
        brand: visualRes.brandName,
        style: visualRes.imageStyle,
        aspect: visualRes.imageAspect,
        engine: visualRes.engine,
        svgFallback: visualRes.svgFallback
      }
    });
  } catch (err) {
    console.error('[/api/creative/visual/generate] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/calendar/entries', async (req, res) => {
  try {
    const dbEntries = await Calendar.find().sort({ createdAt: -1 });
    if (dbEntries && dbEntries.length > 0) return res.json({ success: true, entries: dbEntries });
  } catch (e) { }
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
  } catch (e) { }
  res.json({ success: true, queue: memoryContentStore });
});

const handleApprovalStatusUpdate = async (req, res) => {
  const { contentId, id, status = 'APPROVED', reviewerComment = '' } = req.body;
  const targetId = contentId || id;

  if (!targetId) {
    return res.status(400).json({ success: false, error: 'contentId or id is required' });
  }

  try {
    // 1. Try finding by MongoDB _id in Content
    let updated = await Content.findByIdAndUpdate(targetId, { status, reviewerComment }, { new: true });
    if (!updated) {
      // 2. Try finding by custom id in Content
      updated = await Content.findOneAndUpdate({ $or: [{ id: targetId }, { _id: targetId }] }, { status, reviewerComment }, { new: true });
    }
    if (!updated) {
      // 3. Try CampaignPost
      updated = await CampaignPost.findOneAndUpdate({ $or: [{ id: targetId }, { _id: targetId }] }, { approvalStatus: status, status }, { new: true });
    }
    if (!updated) {
      // 4. Try GeneratedPost
      updated = await GeneratedPost.findOneAndUpdate({ $or: [{ id: targetId }, { _id: targetId }] }, { status }, { new: true });
    }
    if (updated) {
      return res.json({ success: true, item: updated });
    }
  } catch (e) {
    console.log('[Approvals] DB Lookup Note:', e.message);
  }

  // 5. Memory store lookup
  const memItem = memoryContentStore.find((c) => c.id === targetId || c._id === targetId);
  if (memItem) {
    memItem.status = status;
    if (reviewerComment) memItem.reviewerComment = reviewerComment;
    return res.json({ success: true, item: memItem });
  }

  // Graceful fallback response so UI never breaks on synthetic/mock IDs
  const fallbackItem = {
    id: targetId,
    status: status,
    reviewerComment: reviewerComment || 'Updated via Governance Approvals Desk',
    updatedAt: new Date().toISOString()
  };
  memoryContentStore.unshift(fallbackItem);

  return res.json({ success: true, item: fallbackItem });
};

app.patch('/api/approvals/status', handleApprovalStatusUpdate);
app.post('/api/approvals/status', handleApprovalStatusUpdate);

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const { workspaceId, brandName, userEmail: queryEmail } = req.query;

    let userEmail = (queryEmail || req.headers['x-user-email'] || '').toLowerCase().trim();

    let targetIds = [];
    if (workspaceId) {
      targetIds.push(workspaceId.toString());
    }

    if (!userEmail && workspaceId) {
      try {
        const currentWs = await Workspace.findById(workspaceId).select('userEmail').lean();
        if (currentWs && currentWs.userEmail) {
          userEmail = currentWs.userEmail.toLowerCase().trim();
        }
      } catch (e) { }
    }

    let brandRegex = null;
    if (brandName && brandName.trim()) {
      brandRegex = new RegExp(`^${brandName.trim()}$`, 'i');
      try {
        const matchingWorkspaces = await Workspace.find({
          brandName: brandRegex
        }).select('_id brandName').lean();
        matchingWorkspaces.forEach(w => {
          if (w._id) targetIds.push(w._id.toString());
        });
      } catch (e) { }
    }

    targetIds = [...new Set(targetIds)];

    let filter = {};
    if (targetIds.length > 0 || brandRegex) {
      const orConditions = [];
      if (targetIds.length > 0) {
        orConditions.push({ workspaceId: { $in: targetIds } });
      }
      if (brandRegex) {
        orConditions.push({ brandName: brandRegex });
        orConditions.push({ brand: brandRegex });
        orConditions.push({ 'metadata.brand': brandRegex });
        if (brandName && brandName.trim()) {
          orConditions.push({ campaignName: new RegExp(brandName.trim(), 'i') });
        }
      }
      filter = orConditions.length > 1 ? { $or: orConditions } : orConditions[0];
    }

    // Count strictly for the active user & brand/workspace
    const [
      userBrandsCount,
      totalCampaigns, activeCampaigns, completedCampaigns,
      cpTotal, cpApproved, cpGenerated,
      gpTotal, gpApproved,
      contentTotal, contentApproved,
      blogCount, socialContentCount, emailCount, newspaperCount, adCount
    ] = await Promise.all([
      // Total Brands owned by this specific user
      userEmail
        ? Workspace.countDocuments({ userEmail })
        : Promise.resolve(targetIds.length > 0 ? targetIds.length : 1),
      // Campaign counts
      Campaign.countDocuments(filter),
      Campaign.countDocuments({ ...filter, status: { $in: ['Active', 'ACTIVE', 'running'] } }),
      Campaign.countDocuments({ ...filter, status: { $in: ['Completed', 'COMPLETED', 'finished'] } }),
      // CampaignPost counts (calendar schedule slots)
      CampaignPost.countDocuments(filter),
      CampaignPost.countDocuments({ ...filter, approvalStatus: 'Approved' }),
      CampaignPost.countDocuments({ ...filter, status: 'Generated' }),
      // GeneratedPost counts (quick posts, studio posts saved in DB)
      GeneratedPost.countDocuments(filter),
      GeneratedPost.countDocuments({ ...filter, status: 'approved' }),
      // Content counts (actual generated assets saved in Asset Library / DB)
      Content.countDocuments(filter),
      Content.countDocuments({ ...filter, status: 'APPROVED' }),
      // Individual format breakdown
      Content.countDocuments({ ...filter, type: { $in: ['BLOG', 'SEO_BRIEF', 'blog'] } }),
      Content.countDocuments({ ...filter, type: { $in: ['SOCIAL', 'social', 'CAROUSEL'] } }),
      Content.countDocuments({ ...filter, type: { $in: ['EMAIL', 'email'] } }),
      Content.countDocuments({ ...filter, type: { $in: ['NEWSPAPER', 'newspaper', 'press_release'] } }),
      Content.countDocuments({ ...filter, type: { $in: ['AD', 'ad_copy'] } }),
    ]);

    // Real generated content saved in Asset Library & DB (Content collection + GeneratedPost)
    // NOTE: Does NOT count cpTotal (calendar planned entries) as requested
    const actualSavedContent = contentTotal + gpTotal;
    const totalApproved = cpApproved + gpApproved + contentApproved;

    const totalBlogs = blogCount;
    const totalSocial = gpTotal + socialContentCount;
    const totalEmails = emailCount;
    const totalNewspapers = newspaperCount;
    const totalAds = adCount;

    const totalBrands = (userBrandsCount && userBrandsCount > 0) ? userBrandsCount : 1;

    res.json({
      success: true,
      analytics: {
        brands: {
          total: totalBrands,
          active: totalBrands > 0 ? 1 : 0
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          completed: completedCampaigns || Math.max(0, totalCampaigns - activeCampaigns)
        },
        posts: {
          total: actualSavedContent, // Actual generated content saved in Asset Library & DB
          savedAssets: actualSavedContent,
          approved: totalApproved,
          generated: actualSavedContent,
          campaignPosts: cpTotal,
          generatedPosts: gpTotal,
          contentPosts: contentTotal,
        },
        breakdown: {
          blogs: totalBlogs,
          social: totalSocial,
          emails: totalEmails,
          newspapers: totalNewspapers,
          ads: totalAds,
          totalAssets: actualSavedContent,
        },
        approvalRate: actualSavedContent > 0 ? Math.round((totalApproved / actualSavedContent) * 100) : 0,
      },
    });
  } catch (err) {
    console.error('[Analytics] Error:', err.message);
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

// ─── Global Error & Warning Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`\x1b[31m❌ [GLOBAL ERROR] ${req.method} ${req.originalUrl} (${status}): ${err.message || err}\x1b[0m`);
  if (err.stack) console.error(`\x1b[31m${err.stack}\x1b[0m`);
  res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
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

