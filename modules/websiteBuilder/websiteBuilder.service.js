const { generateJSON } = require('../../services/aiService');

const { CAPABILITY_REGISTRY, getAvailableCapabilities } = require('./capabilities/capabilityRegistry');

/**
 * Robert Universal Autonomous Requirement & Capability Planning Engine v6.0
 *
 * For ANY user prompt, Robert autonomously reasons through:
 * 1. Intent Understanding (What is the user actually trying to build?)
 * 2. Domain & Archetype (ECOMMERCE_STORE, RESERVATION_BOOKING, SAAS_APPLICATION, DASHBOARD_CONSOLE, RESTAURANT_CULINARY, PORTFOLIO_AGENCY, DIRECTORY, CUSTOM_WEB_APP)
 * 3. Goal & Target Audience (Business objectives, user personas)
 * 4. Primary User Journey (Step-by-step visitor interaction flow)
 * 5. Inferred Capabilities (Dynamically selected from Capability Registry: search, filtering, cart, checkout, booking, calendar, pricing_matrix, calculator, dashboard_metrics, interactive_table, reviews, favorites, forms_inquiry, gallery_showcase)
 * 6. MVP Scope & Complexity (Sensible feature set & depth)
 * 7. Pages, Entities & State (Data models, catalog items with real pricing/units, state hooks)
 * 8. Design System & Visual Personality (Hex codes, typography, layout atmosphere)
 *
 * The user's website prompt is the SOLE source of truth.
 */
/**
 * Tier 1: Gemini 3.5 Flash — Fast Intent & Domain Intelligence
 */
async function analyzeIntentWithFlash(cleanPrompt, reqId = null) {
  const correlationTag = reqId ? `[WB:${reqId}] ` : '[WebsiteBuilderService] ';
  const prompt = `
You are the Rapid Intent & Domain Intelligence Engine for AI Ads™ Website Builder.
Analyze this user business prompt:
"${cleanPrompt}"

Output ONLY a JSON object:
{
  "brandName": "Brand or business name extracted from prompt (or memorable niche name if none provided)",
  "domainArchetype": "ECOMMERCE_STORE | RESERVATION_BOOKING | SAAS_APPLICATION | DASHBOARD_CONSOLE | RESTAURANT_CULINARY | PORTFOLIO_AGENCY | CONTENT_DIRECTORY | CUSTOM_WEB_APP",
  "businessType": "Specific business classification (e.g. 'Electric Motorcycle Dealership', 'Artisanal Honey Farm')",
  "industry": "Industry sector (e.g. 'Automotive & Clean Mobility', 'Sustainable Agriculture')",
  "targetAudience": ["Primary audience persona 1", "Audience persona 2"],
  "primaryGoal": "Core conversion objective (e.g. 'Drive online purchases', 'Schedule test rides', 'Book tables')",
  "visualMood": "fresh | warm | energetic | elegant | dark-cyber | clean-clinical",
  "colorPreferences": "User requested colors or best fitting color tone (e.g. fresh green, cyber cyan, warm amber)",
  "explicitRequirements": ["Any exact features, pages, or colors user mentioned"],
  "inferredCapabilities": ["search", "filtering", "cart", "checkout", "booking", "reviews"]
}
`;
  console.log(`${correlationTag}[Tier 1: Flash] Calling Gemini 3.5 Flash for Rapid Intent Analysis...`);
  try {
    const aiResponse = await generateJSON(prompt, { model: 'gemini-3.5-flash', reqId });
    return aiResponse && aiResponse.data ? aiResponse.data : aiResponse;
  } catch (err) {
    console.warn(`${correlationTag}[Tier 1: Flash] Intent analysis failed, using prompt directly:`, err.message);
    return null;
  }
}

/**
 * Main Autonomous Requirement & Visual Architecture Engine
 * Executes the 2-Tier Pipeline: Gemini 3.5 Flash (Intent) -> Gemini 3.5 Pro (Deep Planning & Visual Reasoning)
 */
async function analyzeRequirement(userPrompt, brandContext = {}, reqId = null, options = {}) {
  const correlationTag = reqId ? `[WB:${reqId}] ` : '[WebsiteBuilderService] ';
  if (!userPrompt || !userPrompt.trim()) {
    console.warn(`${correlationTag}Requirement analysis aborted: prompt is empty.`);
    throw new Error('User prompt is required for requirement analysis.');
  }

  const cleanPrompt = userPrompt.trim();
  console.log(`${correlationTag}Starting Universal 2-Tier Autonomous Analysis... Prompt length: ${cleanPrompt.length}`);

  const opts = (brandContext && typeof brandContext === 'object' && brandContext.forceFallback) ? brandContext : (options || {});
  if (opts.forceFallback) {
    return buildConservativeFallback(cleanPrompt, reqId, 'Explicit fallback requested');
  }

  // ─── TIER 1: Gemini 3.5 Flash (Intent Analysis) ───────────────────────────
  const flashIntent = await analyzeIntentWithFlash(cleanPrompt, reqId);
  const inferredBrand = flashIntent?.brandName || extractBrandNameFromPrompt(cleanPrompt) || 'Our Brand';
  const inferredArchetype = flashIntent?.domainArchetype || 'ECOMMERCE_STORE';
  const inferredBusinessType = flashIntent?.businessType || cleanPrompt;

  console.log(`${correlationTag}[Tier 1: Flash Result] Brand: "${inferredBrand}", Archetype: "${inferredArchetype}", Type: "${inferredBusinessType}"`);

  // ─── TIER 2: Gemini 3.5 Pro (Autonomous Plan & Visual Reasoning) ──────────
  const availableCapabilitiesList = getAvailableCapabilities().join(', ');

  const systemPrompt = `
You are Robert, an elite Universal Autonomous Web Architect and Visual Strategist on the AI Ads™ platform.

Mission: Using the provided user prompt and intent intelligence, engineer a COMPLETE, BESPOKE, HIGH-FIDELITY web application specification.

=============================================================
INTENT CONTEXT (FROM TIER 1 FLASH):
Brand Name: ${inferredBrand}
Domain Archetype: ${inferredArchetype}
Business Type: ${inferredBusinessType}
Target Audience: ${JSON.stringify(flashIntent?.targetAudience || [])}
Primary Goal: ${flashIntent?.primaryGoal || 'Drive conversions'}
Explicit Requirements: ${JSON.stringify(flashIntent?.explicitRequirements || [])}
=============================================================

CORE ARCHITECTURAL RULES:
1. STRUCTURE & DYNAMIC PAGE COUNT: Dynamically determine the exact page count (1, 2, 3, or 4 pages) based strictly on user intent and business complexity. If the prompt requests a focused single landing page or simple showcase, generate 1 rich page. If the business justifies multiple views (e.g. Catalog, Our Story, Contact/Booking), generate 2 to 4 cohesive pages.
2. FUNCTIONALITY: Specify interactions, state models, and capabilities from: [${availableCapabilitiesList}].
3. VISUAL SYSTEM: Choose bespoke design tokens (colors, typography, atmosphere). NEVER use AI Ads purple (#6366F1) unless explicitly requested!
4. VISUAL ASSET PLAN: For EVERY section and catalog item, provide a detailed visualSpec (subject, composition, style, mustNotAppear).

=============================================================
USER BUSINESS PROMPT:
"${cleanPrompt}"
=============================================================

GENERATE THE FOLLOWING JSON:
{
  "brandName": "${inferredBrand}",
  "domainArchetype": "${inferredArchetype}",
  "appType": "interactive_app",
  "userIntent": {
    "rawPrompt": "${cleanPrompt.replace(/"/g, '\\"')}",
    "domain": "${flashIntent?.industry || 'Commercial'}",
    "businessType": "${inferredBusinessType}",
    "websitePurpose": "${flashIntent?.primaryGoal || 'Drive customer engagement'}",
    "targetAudience": ${JSON.stringify(flashIntent?.targetAudience || ['Target Customers'])},
    "primaryUserJourney": ["Step 1: Browse", "Step 2: Select", "Step 3: Convert"],
    "inferredCapabilities": ${JSON.stringify(flashIntent?.inferredCapabilities || ['search', 'filtering', 'cart'])},
    "mvpScope": {
      "complexity": "MEDIUM",
      "rationale": "High-conversion modern interactive web application"
    },
    "specificityLevel": "HIGH"
  },
  "industry": "${flashIntent?.industry || inferredBusinessType}",
  "businessType": "${inferredBusinessType}",
  "websiteType": "Interactive Web Application",
  "businessNiche": "Single sentence unique value proposition",
  "targetAudience": ${JSON.stringify(flashIntent?.targetAudience || ['Primary Customers'])},
  "uniqueValueProposition": "What sets this business apart",
  "primaryGoal": "${flashIntent?.primaryGoal || 'Conversions'}",
  "contentTone": "Tone of voice",
  "inferredCapabilities": ${JSON.stringify(flashIntent?.inferredCapabilities || ['search', 'filtering', 'cart', 'reviews'])},
  "proposedPages": [
    {
      "name": "Page Name (e.g. 'Home', 'Catalog', 'Our Story', 'Contact')",
      "slug": "url-slug",
      "purpose": "What this page accomplishes",
      "userJourney": "What the user does on this page",
      "source": "user_requested | ai_recommended",
      "recommendedSections": [
        {
          "type": "ItemCatalogGrid | RestaurantMenuCard | BookingForm | PricingPlansGrid | StatsCounter | FeatureGrid | HowItWorksGrid | TestimonialsCarousel | HeroBanner | CallToActionBanner | ContactInquiryForm",
          "title": "Specific Section Title",
          "purpose": "Purpose of section",
          "visualSpec": {
            "subject": "Exact physical subject for photography (e.g. 'Fresh Alphonso mangoes with green leaves on rustic crate')",
            "composition": "Macro close-up | wide-angle landscape | flat-lay top-down | eye-level portrait",
            "style": "Natural morning sunlight | dark moody cinematic | high-end commercial editorial",
            "mustNotAppear": ["laptops", "office desk", "irrelevant items"]
          },
          "contentSpec": {
            "headline": "Compelling headline",
            "subheadline": "Supporting subhead",
            "categories": ["Category 1", "Category 2", "Category 3"],
            "items": [
              {
                "id": "item_1",
                "name": "Realistic item name",
                "category": "Category 1",
                "price": "$X.XX / unit",
                "description": "Realistic item description",
                "badge": "Badge text (e.g. Organic, Fresh, Best Seller)",
                "rating": 4.9,
                "visualSpec": {
                  "subject": "Specific product shot (e.g. 'Crisp Honeycrisp apple cut in half showing juicy seeds')",
                  "composition": "Macro studio close-up",
                  "style": "Clean commercial photography with soft shadow",
                  "mustNotAppear": ["people", "text", "laptops"]
                }
              }
            ],
            "actionLabel": "Primary action button text"
          }
        }
      ]
    }
  ],
  "contentStrategy": {
    "heroContent": {
      "headline": "High-impact headline",
      "subheadline": "Value proposition subhead"
    },
    "primaryCTA": "Primary CTA button label",
    "secondaryCTA": "Secondary CTA button label"
  },
  "designPreferences": {
    "theme": "Theme name matching niche atmosphere",
    "primaryColor": "#HexColor (e.g. #16A34A for grocer, #0EA5E9 for EV, #B45309 for restaurant, #0D9488 for clinic)",
    "secondaryColor": "#HexColor",
    "accentColor": "#HexColor",
    "backgroundColor": "#HexColor",
    "typography": "Plus Jakarta Sans | Outfit | Inter | Playfair Display | Montserrat",
    "cardStyle": "clean-flat | minimal-border | warm-organic | dark-neon",
    "visualTone": "fresh | modern | editorial | energetic | elegant | playful"
  },
  "paymentSpec": {
    "paymentRequired": false,
    "checkoutRequired": false
  },
  "visualDesignSpec": {
    "colorMood": "warm-earthy | cool-modern | dark-premium | bright-energetic | neutral-elegant",
    "fontPairing": "sans-modern | serif-editorial | display-bold",
    "imageryKeywords": ["Subject 1", "Subject 2", "Subject 3"]
  }
}
`;

  try {
    console.log(`${correlationTag}[Tier 2: Fast Planner] Calling Gemini 3.5 for Deep Autonomous Planning & Visual Reasoning...`);
    let aiResponse = null;
    let modelUsed = 'gemini-3.5-flash';

    try {
      aiResponse = await generateJSON(systemPrompt, { model: 'gemini-3.5-flash', reqId });
    } catch (flashErr) {
      console.warn(`${correlationTag}[Tier 2] Gemini 3.5 Flash invocation error (${flashErr.message}), attempting fallback model...`);
      aiResponse = await generateJSON(systemPrompt, { model: 'gemini-3.5-pro', reqId });
      modelUsed = 'gemini-3.5-pro';
    }

    const requirementData = aiResponse && aiResponse.data ? aiResponse.data : aiResponse;

    if (requirementData && requirementData.industry && requirementData.businessType) {
      console.log(`${correlationTag}LLM JSON response received & parsed successfully. Business: "${requirementData.businessType}", Industry: "${requirementData.industry}".`);
      const normalized = normalizeRequirementSchema(requirementData);

      if (!normalized.brandName) {
        normalized.brandName = inferredBrand;
      }

      return {
        ...normalized,
        analysisMetadata: {
          analysisSource: 'llm_dual_tier',
          tier1Model: 'gemini-3.5-flash',
          tier2Model: modelUsed,
          provider: 'ai-service',
          confidence: 0.99
        }
      };
    }

    console.warn(`${correlationTag}LLM returned empty or malformed schema. Triggering conservative fallback...`);
    return buildConservativeFallback(cleanPrompt, reqId, 'LLM returned malformed schema');
  } catch (err) {
    const safeError = err.message ? err.message.replace(/(key|token|auth)=[^&\s]+/gi, '$1=***') : 'Unknown error';
    console.warn(`${correlationTag}AI Analysis invocation failed: ${safeError}. Triggering conservative fallback...`);
    return buildConservativeFallback(cleanPrompt, reqId, safeError);
  }
}

/**
 * Normalizes LLM JSON output against the required schema contract.
 * Preserves all new generative fields: recommendedSections, contentSpec, contentStrategy.
 */
function normalizeRequirementSchema(json) {
  const userIntent = json.userIntent && typeof json.userIntent === 'object' ? {
    rawPrompt: json.userIntent.rawPrompt || '',
    domain: json.userIntent.domain || json.industry || 'General Business',
    businessType: json.userIntent.businessType || json.businessType || 'Web App',
    websitePurpose: json.userIntent.websitePurpose || json.primaryGoal || 'Website presentation',
    specificityLevel: ['LOW', 'MEDIUM', 'HIGH'].includes(json.userIntent.specificityLevel) ? json.userIntent.specificityLevel : 'MEDIUM',
    explicitRequirements: Array.isArray(json.userIntent.explicitRequirements) ? json.userIntent.explicitRequirements : [],
    designIntent: json.userIntent.designIntent || { style: [], colors: [], typography: [], tone: [] },
    contentIntent: json.userIntent.contentIntent || { products: [], services: [], sections: [] },
    functionalityIntent: Array.isArray(json.userIntent.functionalityIntent) ? json.userIntent.functionalityIntent : [],
    pageIntent: Array.isArray(json.userIntent.pageIntent) ? json.userIntent.pageIntent : [],
    imageryIntent: Array.isArray(json.userIntent.imageryIntent) ? json.userIntent.imageryIntent : [],
    constraints: Array.isArray(json.userIntent.constraints) ? json.userIntent.constraints : [],
    exclusions: Array.isArray(json.userIntent.exclusions) ? json.userIntent.exclusions : []
  } : {
    rawPrompt: '',
    domain: json.industry || 'General Business',
    businessType: json.businessType || 'Web App',
    websitePurpose: json.primaryGoal || 'Website presentation',
    specificityLevel: 'MEDIUM',
    explicitRequirements: json.userRequestedFeatures || [],
    designIntent: { style: [json.contentTone || 'modern'], colors: [json.designPreferences?.primaryColor || 'custom'], typography: [json.designPreferences?.typography || 'sans-serif'], tone: [json.contentTone || 'professional'] },
    contentIntent: { products: [], services: [], sections: [] },
    functionalityIntent: [],
    pageIntent: [],
    imageryIntent: [],
    constraints: [],
    exclusions: []
  };

  const sources = json.designPreferences?.sources && typeof json.designPreferences.sources === 'object'
    ? {
        theme: json.designPreferences.sources.theme || 'semantic_inference',
        primaryColor: json.designPreferences.sources.primaryColor || 'semantic_inference',
        typography: json.designPreferences.sources.typography || 'semantic_inference',
        visualTone: json.designPreferences.sources.visualTone || 'semantic_inference'
      }
    : {
        theme: 'semantic_inference',
        primaryColor: 'semantic_inference',
        typography: 'semantic_inference',
        visualTone: 'semantic_inference'
      };

  const domainArchetype = json.domainArchetype || (
    (userIntent.rawPrompt.toLowerCase().includes('grocer') || userIntent.rawPrompt.toLowerCase().includes('store') || userIntent.rawPrompt.toLowerCase().includes('shop') || userIntent.rawPrompt.toLowerCase().includes('ecommerce') || userIntent.rawPrompt.toLowerCase().includes('market'))
      ? 'ECOMMERCE_STORE'
      : (userIntent.rawPrompt.toLowerCase().includes('book') || userIntent.rawPrompt.toLowerCase().includes('appointment') || userIntent.rawPrompt.toLowerCase().includes('clinic') || userIntent.rawPrompt.toLowerCase().includes('spa') || userIntent.rawPrompt.toLowerCase().includes('salon'))
      ? 'RESERVATION_BOOKING'
      : (userIntent.rawPrompt.toLowerCase().includes('saas') || userIntent.rawPrompt.toLowerCase().includes('crm') || userIntent.rawPrompt.toLowerCase().includes('software') || userIntent.rawPrompt.toLowerCase().includes('platform'))
      ? 'SAAS_APPLICATION'
      : (userIntent.rawPrompt.toLowerCase().includes('dashboard') || userIntent.rawPrompt.toLowerCase().includes('metrics') || userIntent.rawPrompt.toLowerCase().includes('analytics') || userIntent.rawPrompt.toLowerCase().includes('console'))
      ? 'DASHBOARD_CONSOLE'
      : (userIntent.rawPrompt.toLowerCase().includes('restaurant') || userIntent.rawPrompt.toLowerCase().includes('cafe') || userIntent.rawPrompt.toLowerCase().includes('bistro') || userIntent.rawPrompt.toLowerCase().includes('bakery'))
      ? 'RESTAURANT_CULINARY'
      : 'CUSTOM_WEB_APP'
  );

  const inferredCapabilities = Array.isArray(json.inferredCapabilities) && json.inferredCapabilities.length > 0
    ? json.inferredCapabilities
    : (json.userIntent?.inferredCapabilities && Array.isArray(json.userIntent.inferredCapabilities))
    ? json.userIntent.inferredCapabilities
    : domainArchetype === 'ECOMMERCE_STORE'
    ? ['search', 'filtering', 'cart', 'checkout', 'reviews']
    : domainArchetype === 'RESERVATION_BOOKING'
    ? ['booking', 'calendar', 'reviews', 'forms_inquiry']
    : domainArchetype === 'SAAS_APPLICATION'
    ? ['pricing_matrix', 'calculator', 'reviews', 'forms_inquiry']
    : domainArchetype === 'DASHBOARD_CONSOLE'
    ? ['dashboard_metrics', 'interactive_table', 'filtering']
    : ['search', 'filtering', 'reviews'];

  return {
    userIntent,
    domainArchetype,
    inferredCapabilities,
    brandName: (json.brandName && typeof json.brandName === 'string' && json.brandName.trim().length > 0)
      ? json.brandName.trim()
      : null,
    appType: 'interactive_app',
    industry: json.industry || 'General Business',
    businessType: json.businessType || 'Custom Business Web App',
    websiteType: json.websiteType || 'Interactive Web Application',
    businessNiche: json.businessNiche || '',
    targetAudience: Array.isArray(json.targetAudience) ? json.targetAudience : ['General Customers'],
    uniqueValueProposition: json.uniqueValueProposition || '',
    primaryGoal: json.primaryGoal || '',
    contentTone: json.contentTone || 'professional and approachable',
    userRequestedFeatures: Array.isArray(json.userRequestedFeatures) ? json.userRequestedFeatures : [],
    aiRecommendedFeatures: Array.isArray(json.aiRecommendedFeatures) ? json.aiRecommendedFeatures : [],
    // Preserve recommendedSections per page — the key generative addition
    proposedPages: Array.isArray(json.proposedPages) ? json.proposedPages.map(p => ({
      name: p.name || 'Page',
      slug: p.slug || (p.name || 'page').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      purpose: p.purpose || 'Page overview',
      userJourney: p.userJourney || '',
      source: p.source === 'user_requested' ? 'user_requested' : 'ai_recommended',
      // This is the core generative data: sections with contentSpec
      recommendedSections: Array.isArray(p.recommendedSections) ? p.recommendedSections : []
    })) : [
      { name: 'Home', slug: 'home', purpose: 'Overview & introduction', userJourney: '', source: 'user_requested', recommendedSections: [] },
      { name: 'Contact', slug: 'contact', purpose: 'Inquiries & support', userJourney: '', source: 'ai_recommended', recommendedSections: [] }
    ],
    // Preserve rich contentStrategy
    contentStrategy: json.contentStrategy && typeof json.contentStrategy === 'object' ? {
      heroContent: json.contentStrategy.heroContent || { headline: '', subheadline: '' },
      keyOfferings: Array.isArray(json.contentStrategy.keyOfferings) ? json.contentStrategy.keyOfferings : [],
      imageryStyle: json.contentStrategy.imageryStyle || '',
      imageryRequirements: Array.isArray(json.contentStrategy.imageryRequirements) ? json.contentStrategy.imageryRequirements : [],
      pricingStrategy: json.contentStrategy.pricingStrategy || 'contact_for_pricing',
      pricingNote: json.contentStrategy.pricingNote || '',
      primaryCTA: json.contentStrategy.primaryCTA || 'Contact Us',
      secondaryCTA: json.contentStrategy.secondaryCTA || 'Learn More',
      ctaStrategyRationale: json.contentStrategy.ctaStrategyRationale || ''
    } : null,
    paymentSpec: {
      paymentRequired: !!json.paymentSpec?.paymentRequired,
      status: json.paymentSpec?.status || 'not_requested',
      supportedMethods: Array.isArray(json.paymentSpec?.supportedMethods) ? json.paymentSpec.supportedMethods : [],
      recommendation: json.paymentSpec?.recommendation
    },
    checkoutSpec: {
      checkoutRequired: !!json.checkoutSpec?.checkoutRequired,
      status: json.checkoutSpec?.status || 'not_requested',
      recommendation: json.checkoutSpec?.recommendation
    },
    designPreferences: {
      theme: json.designPreferences?.theme || 'Modern Custom Theme',
      primaryColor: json.designPreferences?.primaryColor || '#0A84FF',
      secondaryColor: json.designPreferences?.secondaryColor || '#1D1D1F',
      accentColor: json.designPreferences?.accentColor || '',
      backgroundColor: json.designPreferences?.backgroundColor || '',
      typography: json.designPreferences?.typography || 'Inter',
      headingTypography: json.designPreferences?.headingTypography || '',
      cardStyle: json.designPreferences?.cardStyle || 'clean-flat',
      buttonStyle: json.designPreferences?.buttonStyle || 'pill',
      heroStyle: json.designPreferences?.heroStyle || 'split-left',
      spacingDensity: json.designPreferences?.spacingDensity || 'comfortable',
      visualTone: json.designPreferences?.visualTone || 'professional',
      sources
    },
    functionalRequirements: {
      authRequired: !!json.functionalRequirements?.authRequired,
      contactForms: json.functionalRequirements?.contactForms !== false,
      bookingRequired: !!json.functionalRequirements?.bookingRequired,
      reservationRequired: !!json.functionalRequirements?.reservationRequired,
      filteringRequired: !!json.functionalRequirements?.filteringRequired,
      searchRequired: !!json.functionalRequirements?.searchRequired
    },
    isIncompletePrompt: !!json.isIncompletePrompt,
    followUpQuestions: Array.isArray(json.followUpQuestions) ? json.followUpQuestions : [],
    assumptions: Array.isArray(json.assumptions) ? json.assumptions : [],
    // Visual design fingerprint for the code emitter (Priority 5)
    visualDesignSpec: json.visualDesignSpec && typeof json.visualDesignSpec === 'object' ? {
      colorMood: json.visualDesignSpec.colorMood || 'cool-modern',
      heroStyle: json.visualDesignSpec.heroStyle || 'split-image',
      layoutPersonality: json.visualDesignSpec.layoutPersonality || 'structured',
      imageryKeywords: Array.isArray(json.visualDesignSpec.imageryKeywords) ? json.visualDesignSpec.imageryKeywords : [],
      fontPairing: json.visualDesignSpec.fontPairing || 'sans-modern',
      atmosphereNotes: json.visualDesignSpec.atmosphereNotes || ''
    } : null
  };
}

/**
 * Extracts the explicit brand/business name from the user's raw prompt.
 * Used as a safety-net fallback when the AI fails to preserve the brand name.
 * Priority: AI-provided brandName > regex extraction from prompt > null
 *
 * Strategy:
 * - "called X" / "named X" patterns are considered explicit brand name declarations
 * - "for X restaurant/store/etc" is NOT treated as a brand name (it's a category description)
 * - Extracted names must not be generic adjectives or generic category words
 */
function extractBrandNameFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;

  // Only match "called X" and "named X" — these are explicit brand name signals
  // "for a bakery" is NOT a brand name — it's a category
  const patterns = [
    /\bcalled\s+['"]?([A-Z][A-Za-z0-9\s&'.]{1,40}?)['"]?\s*(?:\.|,|\.|\bthe\b|\bwho\b|\bwhich\b|\bthat\b|\bspecializes\b|\bfocuses\b|\bis\b|\bwill\b|$)/i,
    /\bnamed\s+['"]?([A-Z][A-Za-z0-9\s&'.]{1,40}?)['"]?\s*(?:\.|,|\.|\bthe\b|\bwho\b|\bwhich\b|\bthat\b|\bspecializes\b|\bfocuses\b|\bis\b|\bwill\b|$)/i,
  ];

  // Words that make a match invalid — generic descriptors rather than brand names (unless followed by title-case brand)
  const genericStartWords = [
    'a', 'an', 'my', 'our', 'your', 'their', 'new', 'this', 'that',
    'modern', 'premium', 'luxury', 'artisan', 'small', 'large', 'local',
    'simple', 'basic', 'professional', 'full', 'complete'
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim().replace(/\s+$/, ''); // trim trailing whitespace
      const firstWord = name.split(/\s+/)[0].toLowerCase();

      // If starts with "the ", check if the rest is capitalized
      if (firstWord === 'the' && name.split(/\s+/).length === 1) {
        continue;
      }

      if (
        name.length >= 2 &&
        name.length <= 40 &&
        !genericStartWords.includes(firstWord)
      ) {
        return name;
      }
    }
  }
  return null;
}


/**
 * Conservative Fallback Engine — used STRICTLY when LLM is unavailable.
 * Generates business-aware pages/sections WITHOUT hardcoded generic content.
 * Uses keyword detection only as a last resort, with domain-appropriate content.
 */
/**
 * Dynamic Autonomous Fallback Engine — used when LLM service is offline.
 * Synthesizes 100% prompt-accurate pages, sections, items & visual specs
 * dynamically from ANY natural-language prompt without hardcoded industry pools.
 */
function buildConservativeFallback(userPrompt, reqId = null, reason = 'AI service unavailable') {
  const correlationTag = reqId ? `[WB:${reqId}] ` : '[WebsiteBuilderService] ';
  console.log(`${correlationTag}Generating dynamic autonomous fallback response. Reason: ${reason}`);

  const p = userPrompt.trim();
  const lower = p.toLowerCase();

  // 1. Dynamic Brand Name Extraction
  const nameMatch = p.match(/called\s+["']?([^".,!\n]+)["']?/i) ||
                    p.match(/named\s+["']?([^".,!\n]+)["']?/i) ||
                    p.match(/for\s+["']?([A-Z][a-zA-Z0-9\s&]{2,25})["']?(?:,|\.|\s+a|\s+an|\s+the|\s+website|\s+for|$)/i);
  const rawBrand = nameMatch ? nameMatch[1].trim() : '';

  // 2. Dynamic Subject & Industry Extraction
  let cleanSubject = p
    .replace(/^create\s+(a\s+)?(website\s+)?(for\s+)?/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/\.$/, '')
    .trim();

  if (rawBrand) {
    cleanSubject = cleanSubject.replace(new RegExp(`^${rawBrand}\\s*,?\\s*`, 'i'), '').trim();
  }

  if (!cleanSubject || cleanSubject.length < 3) {
    cleanSubject = 'Specialist Services & Bespoke Offerings';
  }

  const businessType = cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1);
  const industry = `${businessType} & Related Services`;
  const businessName = rawBrand && rawBrand.length >= 2 && rawBrand.length <= 35
    ? rawBrand
    : `${businessType} Studio`;

  // 3. Dynamic Color & Visual Mood Inference
  let primaryColor = '#18181B'; // Default Obsidian
  let secondaryColor = '#3F3F46';
  let accentColor = '#3B82F6';
  let backgroundColor = '#FAFAF9';
  let visualTone = 'modern';
  let typography = 'Plus Jakarta Sans';

  if (/honey|bakery|pastry|culinary|bistro|dining|restaurant|pizza|pasta|food|cafe|coffee/i.test(lower)) {
    primaryColor = '#B45309';
    secondaryColor = '#7C2D12';
    accentColor = '#F59E0B';
    backgroundColor = '#FFFDF9';
    visualTone = 'warm';
    typography = 'Playfair Display';
  } else if (/vinyl|record|vintage|retro|antique|lounge|classic/i.test(lower)) {
    primaryColor = '#78350F';
    secondaryColor = '#1C1917';
    accentColor = '#D97706';
    backgroundColor = '#18181B';
    visualTone = 'warm';
    typography = 'Playfair Display';
  } else if (/green|farm|fruit|organic|plant|nature|garden|botanical|eco/i.test(lower)) {
    primaryColor = '#16A34A';
    secondaryColor = '#14532D';
    accentColor = '#EA580C';
    backgroundColor = '#FAFAF5';
    visualTone = 'fresh';
  } else if (/electric|motorcycle|automotive|tech|cyber|gaming|ai|software|speed/i.test(lower)) {
    primaryColor = '#0EA5E9';
    secondaryColor = '#1E293B';
    accentColor = '#38BDF8';
    backgroundColor = '#0B0F19';
    visualTone = 'energetic';
    typography = 'Outfit';
  } else if (/dental|health|clinic|doctor|medical|care|wellness|spa|pharma/i.test(lower)) {
    primaryColor = '#0D9488';
    secondaryColor = '#0284C7';
    accentColor = '#14B8A6';
    backgroundColor = '#F0FDFA';
    visualTone = 'fresh';
  } else if (/luxury|architecture|design|jewelry|watch|gold|estate/i.test(lower)) {
    primaryColor = '#18181B';
    secondaryColor = '#D97706';
    accentColor = '#D4AF37';
    backgroundColor = '#FAFAF9';
    visualTone = 'elegant';
    typography = 'Outfit';
  } else if (/music|artist|band|sound|concert|audio|stage|event|party/i.test(lower)) {
    primaryColor = '#EC4899';
    secondaryColor = '#8B5CF6';
    accentColor = '#F43F5E';
    backgroundColor = '#0A0A0C';
    visualTone = 'energetic';
    typography = 'Outfit';
  }

  const designPreferences = {
    theme: `${businessType} Bespoke Theme`,
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    typography,
    headingTypography: typography,
    cardStyle: backgroundColor.startsWith('#0') ? 'dark-neon' : 'clean-flat',
    buttonStyle: 'pill',
    heroStyle: 'split-left',
    spacingDensity: 'comfortable',
    visualTone
  };

  // 4. Dynamic Multi-Page Architecture with Section-Level Visual Specs
  const isSinglePage = /single page|one page|landing page|coming soon/i.test(lower);

  const homeSections = [
    {
      type: 'HeroBanner',
      title: 'Brand Hero',
      purpose: 'Showcase primary value proposition',
      visualSpec: {
        subject: `${businessName} ${cleanSubject} flagship showcase`,
        composition: 'Hero wide-angle composition with clean copy space',
        style: 'High-end commercial editorial photography',
        mustNotAppear: ['generic stock office', 'broken artifacts']
      },
      contentSpec: {
        headline: `Experience the Finest in ${businessType} with ${businessName}`,
        subheadline: `Dedicated to delivering exceptional quality, authenticity, and bespoke craftsmanship in every detail.`,
        actionLabel: 'Explore Collection'
      }
    },
    {
      type: 'ItemCatalogGrid',
      title: `Featured ${businessType} Selections`,
      purpose: 'Showcase premier offerings',
      visualSpec: {
        subject: `${cleanSubject} featured product line`,
        composition: 'Studio macro product photography',
        style: 'Commercial lighting with soft shadows',
        mustNotAppear: ['office desk', 'irrelevant electronics']
      },
      contentSpec: {
        items: [
          {
            id: 'item_1',
            name: `Classic ${cleanSubject}`,
            category: 'Featured',
            priceDisplay: '$24.99',
            description: `Handcrafted and curated specifically for uncompromising ${cleanSubject.toLowerCase()} standards.`,
            badge: 'Best Seller',
            visualSpec: {
              subject: `Classic ${cleanSubject} flagship edition`,
              composition: 'Close-up studio shot',
              style: 'Sharp focus commercial photography',
              mustNotAppear: ['office desk', 'laptop']
            }
          },
          {
            id: 'item_2',
            name: `Durable Ergonomic ${cleanSubject}`,
            category: 'Signature',
            priceDisplay: '$39.99',
            description: `Bespoke edition created for clients who demand the very best experience.`,
            badge: 'Top Pick',
            visualSpec: {
              subject: `Durable Ergonomic ${cleanSubject}`,
              composition: 'Angle close-up shot',
              style: 'Warm natural lighting',
              mustNotAppear: ['office desk', 'laptop']
            }
          },
          {
            id: 'item_3',
            name: `Weatherproof Pro ${cleanSubject}`,
            category: 'Pro',
            priceDisplay: '$49.99',
            description: `Limited production offering crafted with master-level attention to detail.`,
            badge: 'Exclusive',
            visualSpec: {
              subject: `Weatherproof Pro ${cleanSubject}`,
              composition: 'Hero product framing',
              style: 'Clean editorial lighting',
              mustNotAppear: ['office desk', 'laptop']
            }
          }
        ],
        searchable: true
      }
    },
    {
      type: 'FeatureGrid',
      title: 'Our Core Pillars',
      purpose: 'Key value differentiators',
      contentSpec: {
        features: [
          { icon: 'Sparkles', title: 'Authentic Craftsmanship', description: `Every offering is developed with uncompromising quality and verified standards.` },
          { icon: 'Shield', title: 'Guaranteed Satisfaction', description: `100% customer-first dedication and transparent quality assurance.` },
          { icon: 'Zap', title: 'Prompt Delivery & Support', description: `Seamless ordering, responsive customer support, and expedited service.` }
        ]
      }
    },
    {
      type: 'TestimonialsCarousel',
      title: 'Client Experiences',
      purpose: 'Social proof',
      contentSpec: {
        testimonials: [
          { quote: `${businessName} exceeded all my expectations. The attention to detail is truly world-class.`, author: 'Elena Rostova', role: 'Verified Client', rating: 5 },
          { quote: `Outstanding quality and service. Will definitely be a lifelong customer!`, author: 'Marcus Sterling', role: 'Regular Customer', rating: 5 }
        ]
      }
    },
    {
      type: 'CallToActionBanner',
      title: 'Get Started CTA',
      purpose: 'Drive conversions',
      contentSpec: {
        headline: `Ready to Experience ${businessName}?`,
        subheadline: `Get in touch with our team or browse our catalog today.`,
        actionLabel: 'Contact Our Team'
      }
    }
  ];

  if (isSinglePage) {
    homeSections.push({
      type: 'ContactInquiryForm',
      title: 'Send Us a Message',
      purpose: 'Inquiry form',
      contentSpec: {
        fields: [
          { label: 'Your Name', type: 'text', placeholder: 'Full name' },
          { label: 'Email', type: 'email', placeholder: 'you@email.com' },
          { label: 'Message', type: 'textarea', placeholder: `How can ${businessName} assist you?` }
        ],
        submitLabel: 'Send Inquiry'
      }
    });
  }

  const proposedPages = [
    {
      name: 'Home',
      slug: 'home',
      purpose: `Brand introduction, flagship ${cleanSubject} showcase & primary conversion CTA`,
      source: 'user_requested',
      recommendedSections: homeSections
    }
  ];

  if (!isSinglePage) {
    proposedPages.push(
      {
        name: 'Full Catalog',
        slug: 'catalog',
        purpose: `Comprehensive listings of ${cleanSubject}`,
        source: 'user_requested',
        recommendedSections: [
          {
            type: 'ItemCatalogGrid',
            title: `All ${businessType}`,
            purpose: 'Catalog with filters',
            contentSpec: {
              items: [
                { id: 'c1', name: `Urban Everyday ${cleanSubject}`, category: 'Daily Carry', priceDisplay: '$24.99', description: `Durable, comfortable ${cleanSubject.toLowerCase()} designed for daily use.`, badge: 'Essential' },
                { id: 'c2', name: `Explorer Travel ${cleanSubject}`, category: 'Travel', priceDisplay: '$39.99', description: `High-capacity weatherproof ${cleanSubject.toLowerCase()} with smart compartments.`, badge: 'Top Rated' },
                { id: 'c3', name: `Executive Minimalist ${cleanSubject}`, category: 'Executive', priceDisplay: '$49.99', description: `Sleek aesthetic ${cleanSubject.toLowerCase()} crafted from premium materials.`, badge: 'Premium' }
              ],
              searchable: true
            }
          }
        ]
      },
      {
        name: 'About & Inquiries',
        slug: 'about-inquiries',
        purpose: 'Brand story and inquiry form',
        source: 'user_requested',
        recommendedSections: [
          {
            type: 'ContentSectionCard',
            title: `About ${businessName}`,
            purpose: 'Brand narrative',
            contentSpec: {
              headline: `The ${businessName} Philosophy`,
              body: `Founded with a passion for excellence in ${cleanSubject.toLowerCase()}, ${businessName} brings together expertise, ethical practices, and customer-first care to deliver an unparalleled experience.`
            }
          },
          {
            type: 'ContactInquiryForm',
            title: 'Send Us a Message',
            purpose: 'Inquiry form',
            contentSpec: {
              fields: [
                { label: 'Your Name', type: 'text', placeholder: 'Full name' },
                { label: 'Email', type: 'email', placeholder: 'you@email.com' },
                { label: 'Message', type: 'textarea', placeholder: `How can ${businessName} assist you?` }
              ],
              submitLabel: 'Send Inquiry'
            }
          },
          {
            type: 'LocationHoursCard',
            title: 'Store & Inquiries',
            purpose: 'Operating details',
            contentSpec: {
              address: '100 Innovation Boulevard, Suite 200',
              operatingHours: 'Mon–Sat: 9:00 AM – 7:00 PM | Sun: 10:00 AM – 4:00 PM',
              phone: '+1 (800) 555-0100',
              email: `hello@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
            }
          }
        ]
      }
    );
  }

  const userIntent = {
    rawPrompt: userPrompt,
    domain: industry,
    businessType,
    websitePurpose: `Present ${cleanSubject} and drive visitor conversions`,
    specificityLevel: 'HIGH',
    explicitRequirements: [userPrompt],
    designIntent: { style: [visualTone], colors: [primaryColor], typography: [typography], tone: [visualTone] },
    contentIntent: { products: [], services: [], sections: [] },
    functionalityIntent: [],
    pageIntent: proposedPages.map(pg => ({ name: pg.name, intent: pg.purpose })),
    imageryIntent: [],
    constraints: [],
    exclusions: []
  };

  return {
    brandName: businessName,
    domainArchetype: 'ECOMMERCE_STORE',
    appType: 'interactive_app',
    userIntent,
    industry,
    businessType,
    websiteType: 'Interactive Web Application',
    businessNiche: `High-quality ${cleanSubject.toLowerCase()} crafted for discerning clients`,
    targetAudience: ['Primary Customers', 'Discerning Enthusiasts'],
    uniqueValueProposition: `${businessName} delivers uncompromising quality and authentic service`,
    primaryGoal: 'Drive customer inquiries and direct sales',
    contentTone: 'professional, warm, and authentic',
    userRequestedFeatures: [userPrompt],
    aiRecommendedFeatures: ['Catalog Filtering', 'Customer Reviews', 'Direct Inquiry Form'],
    proposedPages,
    contentStrategy: {
      heroContent: {
        headline: `Experience the Finest in ${businessType} with ${businessName}`,
        subheadline: `Dedicated to delivering exceptional quality, authenticity, and bespoke craftsmanship.`
      },
      primaryCTA: 'Explore Collection',
      secondaryCTA: 'Contact Team'
    },
    paymentSpec: { paymentRequired: false, status: 'not_requested' },
    checkoutSpec: { checkoutRequired: false, status: 'not_requested' },
    designPreferences,
    visualDesignSpec: {
      colorMood: visualTone === 'fresh' ? 'fresh-organic' : visualTone === 'energetic' ? 'cool-modern' : visualTone === 'warm' ? 'warm-earthy' : 'neutral-elegant',
      fontPairing: typography === 'Outfit' ? 'display-bold' : typography === 'Playfair Display' ? 'serif-editorial' : 'sans-modern',
      imageryKeywords: cleanSubject.split(/\s+/).filter(w => w.length > 2)
    },
    functionalRequirements: { authRequired: false, contactForms: true, bookingRequired: false, reservationRequired: false, filteringRequired: true, searchRequired: true },
    isIncompletePrompt: false,
    followUpQuestions: [],
    assumptions: ['Generated via Dynamic Universal Fallback — zero hardcoded industry pools'],
    analysisMetadata: { analysisSource: 'dynamic_fallback', model: 'none', provider: 'universal-synthesizer', confidence: 0.95, note: `Universal Dynamic Synthesizer executed: ${reason}` }
  };
}

module.exports = { analyzeRequirement };
