const { generateJSON } = require('../../services/aiService');

/**
 * Robert Requirement Analysis Engine v5.0 — True Generative Architecture
 *
 * Robert does NOT use industry templates. He reasons from the user's specific
 * business to produce a deep, contextual website strategy including:
 * - Business-specific page architecture
 * - Per-page recommended sections with component types
 * - contentSpec per section (actual business-specific content)
 * - Imagery requirements
 * - Pricing strategy (never invents $49/$89/$129 generically)
 * - CTA strategy derived from the actual user journey
 *
 * This strategy flows through Phase 3 Blueprint → Phase 4 Generator → Renderer.
 */
async function analyzeRequirement(userPrompt, brandContext = {}, reqId = null) {
  const correlationTag = reqId ? `[WB:${reqId}] ` : '[WebsiteBuilderService] ';
  if (!userPrompt || !userPrompt.trim()) {
    console.warn(`${correlationTag}Requirement analysis aborted: prompt is empty.`);
    throw new Error('User prompt is required for requirement analysis.');
  }

  const cleanPrompt = userPrompt.trim();
  console.log(`${correlationTag}Starting LLM requirement analysis... Prompt length: ${cleanPrompt.length}`);

  const systemPrompt = `
You are Robert, an elite Generative AI Web Architect and Business Strategist on the AI Ads platform.

Your mission: Deeply analyze the user's specific business concept and generate a COMPLETE, UNIQUE website strategy — not a generic template, not a keyword-matched plan, but a genuinely tailored architecture derived from the user's explicit intent and business domain.

=============================================================
CORE PRINCIPLE: USER PROMPT IS THE PRIMARY SOURCE OF TRUTH
=============================================================
1. Explicit user instructions ALWAYS take highest priority.
2. If the user specified colors (e.g., "red and cream", "bright rainbow colors", "mostly green", "minimal black and white", "black with gold accents", "pastel", "neon", "earthy terracotta"):
   - You MUST generate exact matching hex codes in designPreferences (e.g. Red #DC2626 & Cream #FFFBEB for 'red and cream'; Green #16A34A for 'mostly green'; Black #000000 & White #FFFFFF for 'black and white').
   - You MUST set designPreferences.sources.primaryColor = "user_explicit" and designPreferences.sources.theme = "user_explicit".
   - NEVER overwrite explicit user color instructions with generic blue/purple (#6366F1 or #3B82F6)!
3. If the user specified visual style (e.g., "warm and handmade", "dark futuristic", "bright playful", "minimal black and white", "luxury gold", "cinematic", "editorial", "retro", "fun for kids"):
   - Derive the theme, typography, cards, and tone to faithfully match that requested aesthetic.
   - Set designPreferences.sources.theme = "user_explicit".
4. Determine specificityLevel:
   - "LOW": Very brief prompt (e.g. "Create a website"). Take high creative freedom to propose a complete polished niche.
   - "MEDIUM": Topic prompt (e.g. "Create a website for a bakery"). Infer realistic structure and relevant offerings without bloat.
   - "HIGH": Specific prompt with features/colors/pages. Execute explicit instructions strictly; do NOT invent unrequested complex integrations.

=============================================================
ABSOLUTE RULES — NEVER BREAK THESE
=============================================================
RULE 0 — BRAND NAME IS SACRED (READ THIS FIRST):
  ✓ The user's prompt is the PRIMARY source of truth for the brand/business name.
  ✓ If the user prompt says "called X", "named X", "for X" — output EXACTLY "X" as brandName.
  ✓ Examples:
     "called Kuro Ramen" → brandName = "Kuro Ramen"
     "named NOVA Atelier" → brandName = "NOVA Atelier"
     "for LedgerAI" → brandName = "LedgerAI"
     "called Casa Verde" → brandName = "Casa Verde"
  ✗ NEVER rename "Kuro Ramen" to "Upscale Artisanal Ramen Restaurant"
  ✗ NEVER rename "NOVA Atelier" to "Luxury Premium Fashion Store"
  ✗ The brandName is the NAME the user chose, NOT a description of what the business is.
  ✗ businessType is always SEPARATE from brandName — never use one as the other.

RULE 1 — NO GENERIC PLACEHOLDER CONTENT:
  ✗ NEVER use "Starter Package", "Professional Kit", "Deluxe Edition"
  ✗ NEVER use "$49", "$89", "$129" as generic catalog pricing
  ✗ NEVER use "Welcome to {BusinessName}" as a hero headline
  ✗ NEVER use "Lightning Fast Performance", "Enterprise-Grade Security", "AI Automation" generically
  ✓ ALWAYS generate content specific to THIS exact business concept

RULE 2 — NO INDUSTRY TEMPLATES:
  ✗ DO NOT route "restaurant" → restaurant template
  ✗ DO NOT route "SaaS" → SaaS template
  ✓ REASON about this specific business — its audience, goals, offerings, user journeys

RULE 3 — PRICING RULES (CRITICAL):
  ✓ If user provided pricing in prompt: use it exactly
  ✓ If user said "demo" or "sample prices": invent realistic industry-appropriate pricing
  ✓ If user did NOT mention pricing: use "Contact for pricing", "Get a quote", "Starting from..." — NEVER invent generic $49/$89/$129

RULE 4 — DYNAMIC PAGE ARCHITECTURE & COMPONENT SELECTION:
  ✓ Select page names and components appropriate to the domain and user request
  ✓ Available component types: HeroBanner, HeroSplit, HeroMinimal, ItemCatalogGrid, RestaurantMenuCard, PortfolioGallery, PricingPlansGrid, FeatureGrid, HowItWorksGrid, TestimonialsCarousel, GuideAccordion, ContactInquiryForm, CustomOrderForm, BookingForm, DemoRequestForm, LocationHoursCard, CallToActionBanner, ServicesGrid, StatsCounter, TeamGrid, ContentSectionCard, ComparisonTable, AmenitiesGrid, RoomGallery, PropertyGrid, TimelineSection, NewsletterSignup, InteractiveExplorer, ExperimentQuestTracker, InteractiveQuizApp, InteractiveCartStore, ReservationBookingApp

RULE 5 — APPLICATION VS MARKETING WEBSITE CLASSIFICATION (CRITICAL):
  ✓ Classify appType as "interactive_app" IF prompt mentions: "app", "platform", "interactive", "track progress", "choose experiments", "activities", "learning portal", "dashboard", "quiz", "explore topics".
  ✓ For "interactive_app": Generate interactive application pages (e.g. "Topics", "Experiments", "Progress Tracker", "Activities") and use interactive component types (InteractiveExplorer, ExperimentQuestTracker, InteractiveQuizApp).
  ✓ For "interactive_app": DO NOT force pricing plans, testimonials carousel, or generic marketing FAQs unless explicitly requested.
  ✓ Classify appType as "marketing_website" for restaurants, boutiques, agencies, and traditional websites. Use domain-specific pages (e.g. Menu, Story, Location for restaurants; Collection, Lookbook, Cart for fashion).

=============================================================
USER BUSINESS PROMPT:
"${cleanPrompt}"
=============================================================

=============================================================
GENERATE THE FOLLOWING JSON — BE SPECIFIC AND BUSINESS-TAILORED
=============================================================
{
  "brandName": "The EXACT brand/business name extracted from the user prompt. If they said 'called Kuro Ramen', output 'Kuro Ramen'. NEVER generalize to a description.",
  "appType": "interactive_app | marketing_website",
  "userIntent": {
    "rawPrompt": "${cleanPrompt.replace(/"/g, '\\"')}",
    "domain": "Inferred or explicit business domain",
    "businessType": "Inferred or explicit business classification",
    "websitePurpose": "Primary goal of the website",
    "specificityLevel": "LOW | MEDIUM | HIGH",
    "explicitRequirements": ["List of features, colors, pages or rules explicitly requested by user"],
    "designIntent": {
      "style": ["Style descriptors extracted or inferred"],
      "colors": ["Colors extracted or inferred"],
      "typography": ["Font direction"],
      "tone": ["Tone tags"],
      "visualDirection": "Detailed visual style rationale",
      "layoutDirection": "Layout guidance"
    },
    "contentIntent": {
      "products": ["Products mentioned or inferred"],
      "services": ["Services mentioned or inferred"],
      "sections": ["Requested section types"],
      "messaging": ["Key taglines or messaging"]
    },
    "functionalityIntent": ["Requested capabilities"],
    "pageIntent": [
      { "name": "Page Name", "intent": "Purpose of this page" }
    ],
    "imageryIntent": [
      { "placement": "hero | section | card", "subject": "Subject of image", "style": "Visual style" }
    ],
    "constraints": ["User constraints if any"],
    "exclusions": ["Explicitly excluded features"]
  },
  "industry": "Specific industry (e.g. 'Artisan Confectionery & Gifting')",
  "businessType": "Specific business type (e.g. 'Boutique Handmade Chocolate & Cake Shop')",
  "websiteType": "What KIND of website",
  "businessNiche": "Single sentence: unique value proposition",
  "targetAudience": ["Specific user personas"],
  "uniqueValueProposition": "What the business offers that others don't",
  "primaryGoal": "Primary website goal",
  "contentTone": "Tone of voice",
  "userRequestedFeatures": ["Features explicitly mentioned in user prompt"],
  "aiRecommendedFeatures": ["Smart recommendations specific to this business"],
  "proposedPages": [
    {
      "name": "Exact page name",
      "slug": "url-slug",
      "purpose": "What this page achieves",
      "userJourney": "What a visitor achieves on this page",
      "source": "user_requested | ai_recommended",
      "recommendedSections": [
        {
          "type": "ComponentType (from the list above)",
          "title": "Descriptive section title specific to this business",
          "purpose": "What this section achieves",
          "contentSpec": {
            "IMPORTANT": "Fill in business-specific content for this component type."
          }
        }
      ]
    }
  ],
  "contentStrategy": {
    "heroContent": {
      "headline": "Specific compelling headline",
      "subheadline": "Supporting value proposition text"
    },
    "keyOfferings": [
      {
        "name": "Offering name",
        "category": "Category",
        "priceDisplay": "RULE: Only use a concrete price (e.g. '$29') if the user explicitly stated pricing in their prompt. If user did NOT mention pricing, use: 'Contact for pricing', 'View options', 'Enquire for rates', or 'Starting from [range]' — NEVER invent a specific $ amount.",
        "description": "Specific description"
      }
    ],
    "imageryStyle": "Specific imagery description",
    "imageryRequirements": [
      { "placement": "hero | section | card", "subject": "Image subject", "style": "Visual style", "aspectRatio": "16:9 | 4:3 | 1:1" }
    ],
    "pricingStrategy": "contact_for_pricing | range_with_starting_from | fixed_tiers | demo_sample_only | user_provided",
    "pricingNote": "Explanation of pricing approach",
    "primaryCTA": "Primary CTA text",
    "secondaryCTA": "Secondary CTA text",
    "ctaStrategyRationale": "Rationale for CTAs"
  },
  "designPreferences": {
    "theme": "Specific descriptive theme name reflecting user requested style or domain",
    "primaryColor": "#HexColor — EXACTLY MATCHING USER PROMPT IF SPECIFIED, else domain-appropriate hex",
    "secondaryColor": "#HexColor",
    "accentColor": "#HexColor",
    "backgroundColor": "#HexColor",
    "typography": "Font family (e.g. Playfair Display, Space Grotesk, Inter, Outfit, Montserrat, Plus Jakarta Sans, Fredoka)",
    "headingTypography": "Heading font",
    "cardStyle": "minimal-border | warm-organic | dark-neon | framed-gallery | clean-flat | glassmorphic",
    "buttonStyle": "pill | sharp | gradient | bordered | ghost",
    "heroStyle": "split-left | centered-headline | full-banner | minimal-grid | immersive-full",
    "spacingDensity": "compact | comfortable | spacious",
    "visualTone": "minimal | rich | editorial | energetic | elegant | playful | bold | sophisticated",
    "sources": {
      "theme": "user_explicit | semantic_inference | ai_generated",
      "primaryColor": "user_explicit | semantic_inference | ai_generated",
      "typography": "user_explicit | semantic_inference | ai_generated",
      "visualTone": "user_explicit | semantic_inference | ai_generated"
    }
  },
  "paymentSpec": {
    "paymentRequired": false,
    "status": "not_requested | user_requested | recommended",
    "supportedMethods": [],
    "recommendation": "Explanation"
  },
  "checkoutSpec": {
    "checkoutRequired": false,
    "status": "not_requested | user_requested | recommended",
    "recommendation": "Explanation"
  },
  "functionalRequirements": {
    "authRequired": false,
    "contactForms": true,
    "bookingRequired": false,
    "reservationRequired": false,
    "filteringRequired": false,
    "searchRequired": false
  },
  "isIncompletePrompt": false,
  "followUpQuestions": [],
  "assumptions": [],
  "visualDesignSpec": {
    "colorMood": "warm-earthy | cool-modern | dark-premium | bright-energetic | neutral-elegant | dramatic-bold | japanese-minimal | earthy-artisan | neon-tech",
    "heroStyle": "fullscreen-cinematic | split-image | minimal-text | immersive-overlay | editorial-grid | centered-headline",
    "layoutPersonality": "immersive | structured | minimal | editorial | catalog | cinematic",
    "imageryKeywords": ["Specific imagery subject 1", "Specific imagery subject 2", "Specific imagery subject 3"],
    "fontPairing": "serif-editorial | sans-modern | display-bold | mixed-editorial | japanese-inspired | rounded-friendly",
    "atmosphereNotes": "One sentence describing the intended visual atmosphere and feel of this website. Be specific to this business."
  }
}
`;

  try {
    console.log(`${correlationTag}Calling aiService.generateJSON with model: gemini-3.5-flash...`);
    const aiResponse = await generateJSON(systemPrompt, { model: 'gemini-3.5-flash', reqId });

    const requirementData = aiResponse && aiResponse.data ? aiResponse.data : aiResponse;
    const modelUsed = aiResponse && aiResponse.model ? aiResponse.model : 'gemini-3.5-flash';

    if (requirementData && requirementData.industry && requirementData.businessType) {
      console.log(`${correlationTag}LLM JSON response received & parsed successfully. Business: "${requirementData.businessType}", Industry: "${requirementData.industry}".`);
      const normalized = normalizeRequirementSchema(requirementData);

      // Safety net: if AI failed to return brandName, extract it from the raw prompt
      if (!normalized.brandName) {
        const extractedName = extractBrandNameFromPrompt(cleanPrompt);
        if (extractedName) {
          normalized.brandName = extractedName;
          console.log(`${correlationTag}Brand name safety-net activated: extracted "${extractedName}" from raw prompt.`);
        }
      } else {
        console.log(`${correlationTag}Brand name preserved: "${normalized.brandName}"`);
      }

      return {
        ...normalized,
        analysisMetadata: {
          analysisSource: 'llm',
          model: modelUsed,
          provider: 'ai-service',
          confidence: 0.98
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

  return {
    userIntent,
    brandName: (json.brandName && typeof json.brandName === 'string' && json.brandName.trim().length > 0)
      ? json.brandName.trim()
      : null, // will be resolved in normalizeRequirementSchema post-processing
    appType: ['interactive_app', 'marketing_website'].includes(json.appType)
      ? json.appType
      : (userIntent.rawPrompt.toLowerCase().includes('app') || userIntent.rawPrompt.toLowerCase().includes('platform') || userIntent.rawPrompt.toLowerCase().includes('interactive') || userIntent.rawPrompt.toLowerCase().includes('track'))
        ? 'interactive_app'
        : 'marketing_website',
    industry: json.industry || 'General Business',
    businessType: json.businessType || 'Custom Business Web App',
    websiteType: json.websiteType || 'Business Website',
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
function buildConservativeFallback(userPrompt, reqId = null, reason = 'AI service unavailable') {
  const correlationTag = reqId ? `[WB:${reqId}] ` : '[WebsiteBuilderService] ';
  console.log(`${correlationTag}Generating domain-inferred fallback response. Reason: ${reason}`);

  const p = userPrompt.toLowerCase();

  // Extract business name if mentioned
  const nameMatch = userPrompt.match(/called\s+["']?([A-Za-z0-9\s&]+)["']?/i) ||
                    userPrompt.match(/named\s+["']?([A-Za-z0-9\s&]+)["']?/i);
  const businessName = nameMatch ? nameMatch[1].trim() : 'Our Business';

  let industry = 'General Business';
  let businessType = 'Custom Web Project';
  let websiteType = 'Business Website';
  let businessNiche = '';
  let proposedPages = [];
  let contentStrategy = null;
  let designPreferences = {
    theme: 'Modern Sleek Minimalist',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    typography: 'Inter',
    cardStyle: 'clean-flat',
    buttonStyle: 'pill',
    heroStyle: 'split-left',
    spacingDensity: 'comfortable',
    visualTone: 'professional'
  };

  if (p.includes('mobile') || p.includes('phone') || p.includes('smartphone')) {
    industry = 'Technology & Consumer Electronics';
    businessType = 'Mobile Phone Manufacturer & Retailer';
    websiteType = 'Product Showcase & Specification Web App';
    businessNiche = 'Consumer electronics retailer specializing in smartphones and mobile devices';
    proposedPages = [
      {
        name: 'Home', slug: 'home', purpose: 'Brand statement, flagship device hero & technology highlights', source: 'user_requested',
        recommendedSections: [
          { type: 'HeroBanner', title: 'Brand Hero', purpose: 'Flagship device hero showcase', contentSpec: { headline: `The Future of Mobile — Only at ${businessName}`, subheadline: 'Experience next-generation smartphones built for performance, style, and durability.' } },
          { type: 'FeatureGrid', title: 'Technology Highlights', purpose: 'Key tech differentiators', contentSpec: { features: [{ icon: 'Zap', title: 'Pro Camera System', description: 'Triple-lens 108MP system with AI scene recognition and night mode.' }, { icon: 'Shield', title: '5G Ultra-Fast Connectivity', description: 'Blazing 5G speeds with intelligent band switching for seamless coverage.' }, { icon: 'Heart', title: 'All-Day Battery Life', description: '5000mAh battery with 65W fast charge — from 0 to 100% in 40 minutes.' }, { icon: 'Star', title: 'Edge-to-Edge Display', description: '6.7" AMOLED ProMotion 120Hz display — cinema in your pocket.' }] } },
          { type: 'ItemCatalogGrid', title: 'Featured Devices', purpose: 'Showcase top smartphone models', contentSpec: { items: [{ id: 'item_1', name: `${businessName} Pro Max`, category: 'Flagship', priceDisplay: 'Contact for pricing', description: 'Top-of-the-line flagship with Pro camera, ceramic build, and satellite connectivity.', badge: 'Flagship' }, { id: 'item_2', name: `${businessName} Ultra S`, category: 'Mid-Range', priceDisplay: 'Contact for pricing', description: 'Performance meets value — 5G, 90Hz display, and 48MP camera.', badge: 'Best Seller' }, { id: 'item_3', name: `${businessName} Lite`, category: 'Entry', priceDisplay: 'Contact for pricing', description: 'Compact, reliable, and affordable. Perfect first smartphone.', badge: 'Popular' }], searchable: true } },
          { type: 'TestimonialsCarousel', title: 'Customer Experiences', purpose: 'Social proof and reviews', contentSpec: { testimonials: [{ quote: `Switched to ${businessName} last year and haven't looked back. The camera quality is unreal.`, author: 'Priya Sharma', role: 'Content Creator', rating: 5 }, { quote: 'Battery life alone is worth the upgrade. Outstanding build quality.', author: 'James Okafor', role: 'Business Professional', rating: 5 }] } },
          { type: 'CallToActionBanner', title: 'Shop CTA', purpose: 'Drive device exploration', contentSpec: { headline: `Find Your Perfect ${businessName} Device`, subheadline: 'Compare specs, explore deals, and discover your next phone.', actionLabel: 'Browse All Devices' } }
        ]
      },
      { name: 'Phones & Devices', slug: 'phones-devices', purpose: 'Complete smartphone catalog with specs and filters', source: 'user_requested', recommendedSections: [{ type: 'ItemCatalogGrid', title: 'Device Catalog', purpose: 'Full device catalog with filtering', contentSpec: { items: [{ id: 'p1', name: `${businessName} Pro Max`, category: 'Flagship', priceDisplay: 'Contact for pricing', description: 'The ultimate flagship.', badge: 'New' }, { id: 'p2', name: `${businessName} Ultra S`, category: 'Mid-Range', priceDisplay: 'Contact for pricing', description: 'The everyday powerhouse.', badge: 'Popular' }, { id: 'p3', name: `${businessName} Lite`, category: 'Entry Level', priceDisplay: 'Contact for pricing', description: 'Accessible performance.', badge: 'Value' }], searchable: true } }] },
      { name: 'Compare Specs', slug: 'compare-specs', purpose: 'Side-by-side device specification comparison', source: 'ai_recommended', recommendedSections: [{ type: 'ComparisonTable', title: 'Specs Comparison', purpose: 'Compare device models', contentSpec: { columns: ['Specification', `${businessName} Pro Max`, `${businessName} Ultra S`, `${businessName} Lite`], rows: [{ feature: 'Display', a: '6.7" AMOLED 120Hz', b: '6.5" AMOLED 90Hz', c: '6.1" LCD 60Hz' }, { feature: 'Camera', a: '108MP Triple', b: '64MP Dual', c: '32MP Single' }, { feature: 'Battery', a: '5000mAh 65W', b: '4500mAh 45W', c: '4000mAh 18W' }, { feature: 'Connectivity', a: '5G + WiFi 6E', b: '5G + WiFi 6', c: '4G + WiFi 5' }] } }] },
      { name: 'Support & Contact', slug: 'support-contact', purpose: 'Customer support, warranty enquiries and store contact', source: 'user_requested', recommendedSections: [{ type: 'GuideAccordion', title: 'Support FAQs', purpose: 'Common support questions', contentSpec: { items: [{ question: 'What warranty do devices come with?', answer: '12-month manufacturer warranty included with every device. Extended warranty available on request.' }, { question: 'Can I trade in my old phone?', answer: 'Yes — bring your old device in-store for a trade-in assessment and upgrade credit.' }, { question: 'Do you offer repairs?', answer: 'Authorized service centre on-site for all screen, battery and hardware repairs.' }] } }, { type: 'ContactInquiryForm', title: 'Contact Form', purpose: 'Enquiry form for sales and support', contentSpec: { fields: [{ label: 'Your Name', type: 'text', placeholder: 'Full name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Device Model', type: 'text', placeholder: 'e.g. Hello Pro Max' }, { label: 'Message', type: 'textarea', placeholder: 'How can we help you?' }], submitLabel: 'Submit Enquiry' } }, { type: 'LocationHoursCard', title: 'Store Location', purpose: 'Store hours and contact info', contentSpec: { address: '123 Tech Boulevard, Innovation District', operatingHours: 'Mon–Sat: 10:00 AM – 8:00 PM | Sun: 11:00 AM – 6:00 PM', phone: '+1 (800) 555-0100', email: `hello@${businessName.toLowerCase().replace(/\s/g, '')}.com` } }] }
    ];
    contentStrategy = {
      heroContent: { headline: `The Future of Mobile — Only at ${businessName}`, subheadline: 'Discover premium smartphones engineered for the modern world.' },
      keyOfferings: [{ name: `${businessName} Pro Max`, category: 'Flagship', priceDisplay: 'Contact for pricing', description: 'Top-of-the-line flagship device.' }],
      imageryStyle: 'clean product photography on white or dark backgrounds with device lifestyle shots',
      imageryRequirements: [{ placement: 'hero', subject: 'Hero smartphone device', style: 'clean product shot dark background', aspectRatio: '16:9' }],
      pricingStrategy: 'contact_for_pricing',
      pricingNote: 'Device pricing not specified by user — using enquiry-based pricing model',
      primaryCTA: 'Browse All Devices',
      secondaryCTA: 'Compare Models',
      ctaStrategyRationale: 'Drive catalog exploration first, with comparison and purchase inquiry as secondary journey'
    };
    designPreferences = { theme: 'Sleek Tech Modern Minimalist', primaryColor: '#0A84FF', secondaryColor: '#1D1D1F', accentColor: '#30D158', backgroundColor: '#1D1D1F', typography: 'SF Pro', headingTypography: 'SF Pro Display', cardStyle: 'minimal-border', buttonStyle: 'pill', heroStyle: 'centered-headline', spacingDensity: 'comfortable', visualTone: 'bold' };

  } else if (p.includes('restaurant') || p.includes('bistro') || p.includes('dining') || p.includes('italian') || p.includes('food') || p.includes('eatery') || p.includes('café') || p.includes('cafe')) {
    industry = 'Food & Beverage';
    businessType = 'Restaurant & Dining Experience';
    websiteType = 'Restaurant Portal & Reservation System';
    businessNiche = 'Full-service restaurant offering authentic dining experiences';
    const cuisine = p.includes('italian') ? 'Italian' : p.includes('indian') ? 'Indian' : p.includes('chinese') ? 'Chinese' : p.includes('french') ? 'French' : 'Contemporary';
    proposedPages = [
      { name: 'Home', slug: 'home', purpose: 'Immersive brand welcome, signature dish spotlight & reservation CTA', source: 'user_requested', recommendedSections: [{ type: 'HeroBanner', title: 'Restaurant Hero', purpose: 'Atmospheric welcome hero', contentSpec: { headline: `Authentic ${cuisine} Cuisine — Reserve Your Table`, subheadline: `Experience the finest ${cuisine.toLowerCase()} flavours crafted from traditional recipes at ${businessName}.` } }, { type: 'StatsCounter', title: 'Restaurant Highlights', purpose: 'Trust indicators', contentSpec: { stats: [{ value: '12+', label: 'Years of Culinary Excellence' }, { value: '200+', label: 'Dishes on Our Menu' }, { value: '4.9★', label: 'Average Guest Rating' }, { value: '50,000+', label: 'Happy Diners Served' }] } }, { type: 'TestimonialsCarousel', title: 'Guest Reviews', purpose: 'Social proof from real diners', contentSpec: { testimonials: [{ quote: `${businessName} is hands down the best ${cuisine.toLowerCase()} restaurant in the city. The pasta was sublime.`, author: 'Sarah M.', role: 'Food Blogger', rating: 5 }, { quote: 'Perfect for a romantic dinner. The ambiance and service were exceptional.', author: 'Raj & Priya K.', role: 'Anniversary Dinner Guests', rating: 5 }] } }, { type: 'CallToActionBanner', title: 'Reserve Table CTA', purpose: 'Primary reservation CTA', contentSpec: { headline: 'Reserve Your Table Today', subheadline: 'Book online and secure your preferred date and time.', actionLabel: 'Make a Reservation' } }] },
      { name: 'Menu', slug: 'menu', purpose: `Full ${cuisine} menu with categorized dishes, descriptions and pricing`, source: 'user_requested', recommendedSections: [{ type: 'RestaurantMenuCard', title: 'Our Menu', purpose: 'Full menu display with categories', contentSpec: { categories: ['Starters', 'Mains', 'Desserts', 'Drinks & Wine'], items: [{ name: 'Bruschetta Classica', category: 'Starters', priceDisplay: 'Contact for menu pricing', description: `Traditional ${cuisine.toLowerCase()} starter — grilled sourdough with seasonal toppings.`, tag: 'Chef Favourite' }, { name: 'Signature Main Course', category: 'Mains', priceDisplay: 'Contact for menu pricing', description: `House ${cuisine.toLowerCase()} speciality crafted from traditional family recipes.`, tag: 'House Special' }, { name: 'Artisan Dessert', category: 'Desserts', priceDisplay: 'Contact for menu pricing', description: 'Handcrafted dessert made in-house daily.', tag: 'Must Try' }] } }] },
      { name: 'Reservations', slug: 'reservations', purpose: 'Online table booking form and private dining enquiries', source: 'ai_recommended', recommendedSections: [{ type: 'BookingForm', title: 'Table Reservation', purpose: 'Reservation booking form', contentSpec: { fields: [{ label: 'Full Name', type: 'text', placeholder: 'Your name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' }, { label: 'Date & Time', type: 'datetime-local', placeholder: '' }, { label: 'Number of Guests', type: 'select', placeholder: '2 Guests' }, { label: 'Special Requests', type: 'textarea', placeholder: 'Dietary requirements, occasion, seating preferences...' }], submitLabel: 'Confirm Reservation' } }, { type: 'LocationHoursCard', title: 'Find Us', purpose: 'Restaurant location and hours', contentSpec: { address: '45 Dining Quarter, Restaurant Row', operatingHours: 'Tue–Sun: 12:00 PM – 10:30 PM | Closed Mondays', phone: '+1 (800) 555-0200', email: `reservations@${businessName.toLowerCase().replace(/\s/g, '')}.com` } }] },
      { name: 'Our Story', slug: 'our-story', purpose: 'Restaurant history, chef biography and culinary philosophy', source: 'ai_recommended', recommendedSections: [{ type: 'ContentSectionCard', title: 'Our Culinary Story', purpose: 'Brand story and chef biography', contentSpec: { headline: `The ${businessName} Story`, body: `Born from a deep love of authentic ${cuisine.toLowerCase()} cuisine, ${businessName} was founded with one simple belief: exceptional food demands exceptional ingredients. Our head chef brings decades of culinary tradition to every dish, honouring recipes passed down through generations while embracing the freshest seasonal produce.` } }, { type: 'TestimonialsCarousel', title: 'Press & Recognition', purpose: 'Media mentions and awards', contentSpec: { testimonials: [{ quote: `"One of the finest ${cuisine.toLowerCase()} restaurants we have visited. Impeccable from start to finish."`, author: 'City Food Guide', role: 'Restaurant Review', rating: 5 }] } }] }
    ];
    contentStrategy = { heroContent: { headline: `Authentic ${cuisine} Cuisine — Reserve Your Table`, subheadline: `Experience traditional flavours and warm hospitality at ${businessName}.` }, keyOfferings: [{ name: 'Dining Experience', category: 'Main Service', priceDisplay: 'Contact for menu pricing', description: 'Full table dining with curated cuisine.' }], imageryStyle: 'warm atmospheric food photography with soft candlelit restaurant interior shots', imageryRequirements: [{ placement: 'hero', subject: 'Restaurant interior or signature dish', style: 'warm atmospheric editorial', aspectRatio: '16:9' }], pricingStrategy: 'contact_for_pricing', pricingNote: 'Menu pricing not specified — showing enquiry model', primaryCTA: 'Make a Reservation', secondaryCTA: 'View Menu', ctaStrategyRationale: 'Restaurant conversion goal is table reservation' };
    designPreferences = { theme: 'Warm Bistro Amber & Crimson', primaryColor: '#B45309', secondaryColor: '#7C2D12', accentColor: '#FEF3C7', backgroundColor: '#1C0A00', typography: 'Playfair Display', headingTypography: 'Playfair Display', cardStyle: 'warm-organic', buttonStyle: 'rounded', heroStyle: 'full-banner', spacingDensity: 'comfortable', visualTone: 'rich' };

  } else if (p.includes('saas') || p.includes('software') || p.includes('platform') || p.includes('accounting') || p.includes('cloud') || p.includes('startup') || p.includes('ai app') || p.includes('productivity')) {
    industry = 'SaaS & Enterprise Software';
    businessType = 'SaaS Software Platform';
    websiteType = 'SaaS Product Landing & Conversion Portal';
    businessNiche = 'Cloud-based software solution solving a specific business problem';
    proposedPages = [
      { name: 'Home', slug: 'home', purpose: 'Hero value prop, key benefits and conversion CTA', source: 'user_requested', recommendedSections: [{ type: 'HeroBanner', title: 'Product Hero', purpose: 'Value proposition hero', contentSpec: { headline: `${businessName} — Work Smarter, Not Harder`, subheadline: 'The intelligent platform that automates your workflow, surfaces insights instantly, and scales with your business.' } }, { type: 'StatsCounter', title: 'Platform Scale', purpose: 'Credibility indicators', contentSpec: { stats: [{ value: '50,000+', label: 'Active Teams' }, { value: '99.9%', label: 'Platform Uptime' }, { value: '10x', label: 'Average Efficiency Gain' }, { value: '4.8★', label: 'G2 Rating' }] } }, { type: 'FeatureGrid', title: 'Key Capabilities', purpose: 'Core platform features', contentSpec: { features: [{ icon: 'Zap', title: 'AI-Powered Automation', description: 'Automate repetitive tasks with context-aware workflows that learn from your team.' }, { icon: 'Shield', title: 'Bank-Grade Security', description: 'SOC 2 Type II certified. End-to-end encryption. GDPR compliant.' }, { icon: 'Globe', title: 'Real-Time Collaboration', description: 'Your entire team, working in sync — wherever they are in the world.' }, { icon: 'Star', title: 'Actionable Analytics', description: 'Dashboards that surface the metrics that actually drive your decisions.' }] } }, { type: 'TestimonialsCarousel', title: 'Customer Success Stories', purpose: 'Social proof from real customers', contentSpec: { testimonials: [{ quote: `${businessName} saved our team 15 hours per week. The ROI was clear within the first month.`, author: 'Michaela Chen', role: 'Head of Operations, Scale Ventures', rating: 5 }, { quote: 'Finally, a platform that actually does what it promises. Onboarding was seamless.', author: 'David Osei', role: 'CTO, FinBridge', rating: 5 }] } }, { type: 'CallToActionBanner', title: 'Conversion CTA', purpose: 'Drive demo or trial signup', contentSpec: { headline: 'See Why 50,000+ Teams Choose ' + businessName, subheadline: 'Book a live demo or start your free 14-day trial today.', actionLabel: 'Book a Free Demo' } }] },
      { name: 'Features', slug: 'features', purpose: 'Deep dive into platform capabilities and technical features', source: 'user_requested', recommendedSections: [{ type: 'FeatureGrid', title: 'Platform Features', purpose: 'Full feature breakdown', contentSpec: { features: [{ icon: 'Zap', title: 'Workflow Automation', description: 'Build no-code automation flows in minutes.' }, { icon: 'Shield', title: 'Enterprise Security', description: 'Role-based access, SSO, audit logs.' }, { icon: 'Globe', title: 'API & Integrations', description: 'Connect to 500+ tools via native integrations and REST API.' }, { icon: 'Star', title: 'Advanced Reporting', description: 'Custom dashboards, scheduled reports, and data export.' }] } }, { type: 'HowItWorksGrid', title: 'How It Works', purpose: 'Step-by-step workflow guide', contentSpec: { steps: [{ step: '01', title: 'Connect Your Data Sources', description: 'Integrate your existing tools and import your data in minutes.' }, { step: '02', title: 'Configure Your Workflows', description: 'Use our visual builder to design automation flows specific to your process.' }, { step: '03', title: 'Monitor & Optimize', description: 'Real-time dashboards surface performance insights automatically.' }, { step: '04', title: 'Scale With Confidence', description: 'Enterprise-grade infrastructure grows with your team and usage.' }] } }] },
      { name: 'Pricing', slug: 'pricing', purpose: 'Transparent pricing tiers and feature comparison matrix', source: 'ai_recommended', recommendedSections: [{ type: 'PricingPlansGrid', title: 'Pricing Plans', purpose: 'Tiered pricing selection', contentSpec: { plans: [{ name: 'Starter', priceDisplay: 'Contact for pricing', period: '/month', description: 'Essential tools for small teams just getting started.', features: ['Up to 5 users', 'Core automation', 'Standard support', 'Basic analytics'], isPopular: false }, { name: 'Growth', priceDisplay: 'Contact for pricing', period: '/month', description: 'Advanced features for scaling teams.', features: ['Unlimited users', 'Advanced automation', 'Priority support', 'Custom dashboards', 'API access'], isPopular: true }, { name: 'Enterprise', priceDisplay: 'Contact for pricing', period: '/month', description: 'Custom infrastructure and dedicated support.', features: ['Custom contracts', 'Dedicated account manager', '99.99% SLA', 'Custom security', 'On-premise option'], isPopular: false }] } }] },
      { name: 'Book Demo', slug: 'book-demo', purpose: 'Live product demonstration request and sales qualification', source: 'user_requested', recommendedSections: [{ type: 'DemoRequestForm', title: 'Book Your Demo', purpose: 'Demo booking form', contentSpec: { fields: [{ label: 'Full Name', type: 'text', placeholder: 'Your name' }, { label: 'Work Email', type: 'email', placeholder: 'you@company.com' }, { label: 'Company Name', type: 'text', placeholder: 'Your company' }, { label: 'Team Size', type: 'select', placeholder: '1-10 employees' }, { label: 'What are you hoping to achieve?', type: 'textarea', placeholder: 'Tell us about your main challenge...' }], submitLabel: 'Schedule My Demo' } }] }
    ];
    contentStrategy = { heroContent: { headline: `${businessName} — Work Smarter, Not Harder`, subheadline: 'The intelligent platform that automates your workflow and surfaces insights instantly.' }, keyOfferings: [{ name: 'Platform Subscription', category: 'SaaS', priceDisplay: 'Contact for pricing', description: 'Full platform access with automation, analytics and support.' }], imageryStyle: 'clean product UI screenshots, abstract data visualizations, and professional team lifestyle photography', imageryRequirements: [{ placement: 'hero', subject: 'Product dashboard or interface', style: 'clean product screenshot mockup on dark background', aspectRatio: '16:9' }], pricingStrategy: 'contact_for_pricing', pricingNote: 'SaaS pricing not specified — using enquiry/demo conversion model', primaryCTA: 'Book a Free Demo', secondaryCTA: 'View Features', ctaStrategyRationale: 'SaaS conversion is driven by demos and trials' };
    designPreferences = { theme: 'Dark Cyber Precision Tech', primaryColor: '#6366F1', secondaryColor: '#06B6D4', accentColor: '#8B5CF6', backgroundColor: '#0F172A', typography: 'Space Grotesk', headingTypography: 'Space Grotesk', cardStyle: 'glassmorphic', buttonStyle: 'gradient', heroStyle: 'centered-headline', spacingDensity: 'comfortable', visualTone: 'bold' };

  } else if (p.includes('photo') || p.includes('portfolio') || p.includes('photographer') || p.includes('creative') || p.includes('artist') || p.includes('studio')) {
    industry = 'Creative & Media';
    businessType = 'Photography Portfolio & Creative Studio';
    websiteType = 'Creative Portfolio Showcase & Booking Portal';
    const artistName = nameMatch ? nameMatch[1].trim() : 'Our Studio';
    proposedPages = [
      { name: 'Home', slug: 'home', purpose: 'Strong visual first impression and quick-access portfolio preview', source: 'user_requested', recommendedSections: [{ type: 'HeroSplit', title: 'Portfolio Hero', purpose: 'Visual hero with selected featured work', contentSpec: { headline: `${artistName} Photography — Vision Beyond the Frame`, subheadline: 'Commercial, editorial and portrait photography based in the heart of the city.' } }, { type: 'PortfolioGallery', title: 'Selected Works', purpose: 'Curated portfolio preview', contentSpec: { categories: ['All Works', 'Editorial', 'Portraits', 'Commercial', 'Events'], items: [{ title: 'Vogue Editorial — Autumn Collection', category: 'Editorial', year: '2025', description: 'High-fashion editorial story for Vogue Digital. Art direction & photography.' }, { title: 'Brand Campaign — Luxe Cosmetics', category: 'Commercial', year: '2025', description: 'Full brand identity photography campaign for luxury skincare launch.' }, { title: 'Rooftop Portrait Series', category: 'Portraits', year: '2025', description: 'Natural light portrait series capturing authentic human moments.' }, { title: 'Product Launch Event', category: 'Events', year: '2024', description: 'Corporate event coverage for technology brand launch in NYC.' }] } }, { type: 'CallToActionBanner', title: 'Booking CTA', purpose: 'Drive session inquiries', contentSpec: { headline: 'Ready to Create Something Extraordinary?', subheadline: 'Available for commercial, editorial and personal portrait sessions.', actionLabel: 'Book a Session' } }] },
      { name: 'Portfolio', slug: 'portfolio', purpose: 'Full filterable portfolio gallery across all categories', source: 'user_requested', recommendedSections: [{ type: 'PortfolioGallery', title: 'Portfolio Gallery', purpose: 'Full portfolio with category filtering', contentSpec: { categories: ['All Works', 'Editorial', 'Portraits', 'Commercial', 'Weddings', 'Events'], items: [{ title: 'Vogue Editorial — Autumn', category: 'Editorial', year: '2025', description: 'Fashion editorial photography.' }, { title: 'Luxe Cosmetics Campaign', category: 'Commercial', year: '2025', description: 'Commercial brand photography.' }, { title: 'Rooftop Portraits', category: 'Portraits', year: '2025', description: 'Natural light portrait series.' }, { title: 'Garden Wedding — Tuscany', category: 'Weddings', year: '2024', description: 'Intimate garden wedding in Tuscany.' }] } }] },
      { name: 'About', slug: 'about', purpose: `${artistName}'s biography, creative philosophy and career highlights`, source: 'ai_recommended', recommendedSections: [{ type: 'ContentSectionCard', title: 'About ' + artistName, purpose: 'Photographer bio', contentSpec: { headline: 'About ' + artistName, body: `${artistName} is a commercial and editorial photographer with over a decade of experience working with leading brands, publications and private clients. With a background in fine art and a passion for authentic human moments, each project is approached as a unique visual story.` } }, { type: 'StatsCounter', title: 'Career Highlights', purpose: 'Career statistics', contentSpec: { stats: [{ value: '10+', label: 'Years Experience' }, { value: '500+', label: 'Clients Worldwide' }, { value: '80+', label: 'Publications Featured' }, { value: '20+', label: 'Industry Awards' }] } }] },
      { name: 'Services', slug: 'services', purpose: 'Photography service packages and session formats', source: 'ai_recommended', recommendedSections: [{ type: 'ServicesGrid', title: 'Photography Services', purpose: 'Service packages listing', contentSpec: { services: [{ title: 'Commercial Photography', description: 'Product, brand, and campaign photography for businesses and agencies. Full studio and on-location capability.', priceDisplay: 'Starting from $1,200' }, { title: 'Portrait Sessions', description: 'Individual, couple or family portrait sessions. Indoor studio or outdoor natural light.', priceDisplay: 'Starting from $350' }, { title: 'Event Coverage', description: 'Corporate events, product launches, conferences and private celebrations.', priceDisplay: 'Contact for pricing' }, { title: 'Editorial Projects', description: 'Magazine editorial, lookbook and fashion photography for brands and publications.', priceDisplay: 'Contact for pricing' }] } }] },
      { name: 'Book a Session', slug: 'book-session', purpose: 'Session inquiry and availability booking form', source: 'user_requested', recommendedSections: [{ type: 'BookingForm', title: 'Book a Session', purpose: 'Session inquiry form', contentSpec: { fields: [{ label: 'Full Name', type: 'text', placeholder: 'Your name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Session Type', type: 'select', placeholder: 'Commercial Photography' }, { label: 'Preferred Date', type: 'datetime-local', placeholder: '' }, { label: 'Project Brief', type: 'textarea', placeholder: 'Tell us about your project...' }], submitLabel: 'Send Inquiry' } }, { type: 'GuideAccordion', title: 'Session FAQs', purpose: 'Common booking questions', contentSpec: { items: [{ question: 'How far in advance should I book?', answer: 'We recommend booking at least 2-4 weeks in advance, especially for weekends and peak seasons.' }, { question: 'What is your cancellation policy?', answer: 'Sessions may be rescheduled up to 48 hours before the booking. Deposits are non-refundable but transferable.' }, { question: 'Do you travel for sessions?', answer: 'Yes — we cover international travel for commercial projects and destination weddings. Please enquire for travel pricing.' }] } }] }
    ];
    contentStrategy = { heroContent: { headline: `${artistName} Photography — Vision Beyond the Frame`, subheadline: 'Commercial, editorial and portrait photography with a unique perspective.' }, keyOfferings: [{ name: 'Commercial Photography', category: 'Services', priceDisplay: 'Starting from $1,200', description: 'Full brand photography campaign.' }], imageryStyle: 'editorial, high-contrast, black and white or moody colour palette photography', imageryRequirements: [{ placement: 'hero', subject: 'Signature editorial or portrait photograph', style: 'editorial full-bleed', aspectRatio: '3:2' }], pricingStrategy: 'range_with_starting_from', pricingNote: 'Photography pricing uses starting-from rates as packages vary', primaryCTA: 'Book a Session', secondaryCTA: 'View Portfolio', ctaStrategyRationale: 'Portfolio sites convert through inquiry and session booking' };
    designPreferences = { theme: 'Elegant Editorial Monochrome', primaryColor: '#1A1A1A', secondaryColor: '#F0EDE8', accentColor: '#D4A853', backgroundColor: '#FAFAF8', typography: 'Outfit', headingTypography: 'Playfair Display', cardStyle: 'framed-gallery', buttonStyle: 'bordered', heroStyle: 'full-banner', spacingDensity: 'spacious', visualTone: 'editorial' };

  } else if (p.includes('bakery') || p.includes('cake') || p.includes('pastry') || p.includes('sweet') || p.includes('confection') || p.includes('chocolate') || p.includes('candy')) {
    industry = 'Artisan Food & Confectionery';
    businessType = 'Artisan Bakery & Confectionery Shop';
    websiteType = 'Confectionery Showcase & Custom Order Portal';
    proposedPages = [
      { name: 'Home', slug: 'home', purpose: 'Warm showcase hero, signature treat highlights and custom order CTA', source: 'user_requested', recommendedSections: [{ type: 'HeroBanner', title: 'Welcome Hero', purpose: 'Bakery brand hero', contentSpec: { headline: `Handcrafted with Love at ${businessName}`, subheadline: 'Artisan pastries, celebration cakes and bespoke confections made fresh daily from the finest ingredients.' } }, { type: 'ItemCatalogGrid', title: 'Today\'s Specialities', purpose: 'Featured treats showcase', contentSpec: { items: [{ id: 'c1', name: 'Signature Celebration Cake', category: 'Celebration Cakes', priceDisplay: 'Contact for pricing', description: 'Multi-tier custom-designed cakes for weddings, birthdays and milestones.', badge: 'Custom' }, { id: 'c2', name: 'Croissant au Beurre', category: 'Daily Pastries', priceDisplay: 'Contact for pricing', description: 'Classic French butter croissant — flaky, golden and baked fresh each morning.', badge: 'Fresh Daily' }, { id: 'c3', name: 'Artisan Chocolate Box', category: 'Gifting', priceDisplay: 'Contact for pricing', description: 'Handcrafted selection of truffles, pralines and ganaches in our signature gift box.', badge: 'Gift Ready' }], searchable: false } }, { type: 'TestimonialsCarousel', title: 'Happy Customers', purpose: 'Customer testimonials', contentSpec: { testimonials: [{ quote: `The wedding cake from ${businessName} was absolutely stunning. Our guests are still talking about it.`, author: 'Emma & James R.', role: 'Wedding Clients', rating: 5 }, { quote: 'The most beautiful birthday cake I have ever ordered. Tasted even better than it looked!', author: 'Anya P.', role: 'Birthday Order', rating: 5 }] } }, { type: 'CallToActionBanner', title: 'Custom Order CTA', purpose: 'Drive custom cake enquiries', contentSpec: { headline: 'Planning Something Special?', subheadline: 'Every occasion deserves a uniquely crafted cake. Tell us your vision.', actionLabel: 'Request a Custom Order' } }] },
      { name: 'Our Menu', slug: 'our-menu', purpose: 'Full menu of pastries, cakes, chocolates and daily specials', source: 'user_requested', recommendedSections: [{ type: 'RestaurantMenuCard', title: 'Bakery Menu', purpose: 'Full menu display', contentSpec: { categories: ['Daily Pastries', 'Celebration Cakes', 'Artisan Chocolates', 'Gifting'], items: [{ name: 'Croissant au Beurre', category: 'Daily Pastries', priceDisplay: 'Contact for pricing', description: 'Classic French butter croissant — baked fresh each morning.', tag: 'Fresh Daily' }, { name: 'Pain au Chocolat', category: 'Daily Pastries', priceDisplay: 'Contact for pricing', description: 'Dark chocolate wrapped in flaky laminated pastry.', tag: 'Popular' }, { name: 'Signature Birthday Cake', category: 'Celebration Cakes', priceDisplay: 'Contact for pricing', description: 'Customisable multi-tier birthday cake with hand-finished sugar work.', tag: 'Custom Order' }, { name: 'Truffle Gift Box', category: 'Artisan Chocolates', priceDisplay: 'Contact for pricing', description: '12-piece handcrafted chocolate truffle selection in our signature gift box.', tag: 'Gift Ready' }] } }] },
      { name: 'Custom Orders', slug: 'custom-orders', purpose: 'Bespoke cake and custom confectionery order enquiry form', source: 'user_requested', recommendedSections: [{ type: 'CustomOrderForm', title: 'Custom Order Form', purpose: 'Bespoke cake and treat order form', contentSpec: { fields: [{ label: 'Your Name', type: 'text', placeholder: 'Full name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' }, { label: 'Occasion', type: 'select', placeholder: 'Wedding Cake' }, { label: 'Date Required', type: 'datetime-local', placeholder: '' }, { label: 'Number of Servings', type: 'text', placeholder: 'e.g. 50 portions' }, { label: 'Design Ideas & Special Requests', type: 'textarea', placeholder: 'Describe your vision, dietary requirements, allergies, flavours...' }], submitLabel: 'Submit Custom Order Enquiry' } }, { type: 'GuideAccordion', title: 'Order FAQs', purpose: 'Custom order questions', contentSpec: { items: [{ question: 'How far in advance should I order a custom cake?', answer: 'We recommend placing custom cake orders at least 2 weeks in advance, and 4-6 weeks for wedding cakes.' }, { question: 'Do you accommodate dietary requirements?', answer: 'Yes — we offer gluten-free, vegan and nut-free options. Please specify all requirements in your order form.' }, { question: 'Can I pick up my order or do you deliver?', answer: 'Collection is available from our bakery. Local delivery can be arranged for an additional fee — please enquire.' }] } }] },
      { name: 'About & Visit', slug: 'about-visit', purpose: 'Bakery story, location, hours and contact details', source: 'ai_recommended', recommendedSections: [{ type: 'ContentSectionCard', title: 'Our Bakery Story', purpose: 'Brand story', contentSpec: { headline: `The ${businessName} Story`, body: `Founded on a passion for traditional baking craft, ${businessName} has been creating handcrafted pastries, cakes and confections since our very first morning. Every product is made in small batches using premium, ethically sourced ingredients — because great baking begins with great ingredients.` } }, { type: 'LocationHoursCard', title: 'Visit Us', purpose: 'Location and hours', contentSpec: { address: '12 Artisan Lane, Bakery Quarter', operatingHours: 'Tue–Sat: 7:00 AM – 6:00 PM | Sun: 8:00 AM – 2:00 PM | Closed Mondays', phone: '+1 (800) 555-0300', email: `orders@${businessName.toLowerCase().replace(/\s/g, '')}.com` } }] }
    ];
    contentStrategy = { heroContent: { headline: `Handcrafted with Love at ${businessName}`, subheadline: 'Artisan pastries and celebration cakes made fresh daily from the finest ingredients.' }, keyOfferings: [{ name: 'Custom Celebration Cake', category: 'Cakes', priceDisplay: 'Contact for pricing', description: 'Bespoke cakes for every occasion.' }], imageryStyle: 'warm macro food photography with natural light, wooden surfaces and floral props', imageryRequirements: [{ placement: 'hero', subject: 'Artisan cakes and pastries', style: 'warm flat-lay or close-up food photography', aspectRatio: '16:9' }], pricingStrategy: 'contact_for_pricing', pricingNote: 'Bakery pricing not specified — using enquiry model', primaryCTA: 'Request a Custom Order', secondaryCTA: 'View Menu', ctaStrategyRationale: 'Bakery conversion is driven by custom order enquiries' };
    designPreferences = { theme: 'Warm Pastel Artisan', primaryColor: '#D97706', secondaryColor: '#EC4899', accentColor: '#FEF3C7', backgroundColor: '#FFFBF5', typography: 'Plus Jakarta Sans', headingTypography: 'Playfair Display', cardStyle: 'warm-organic', buttonStyle: 'pill', heroStyle: 'split-left', spacingDensity: 'comfortable', visualTone: 'playful' };

  } else if (p.includes('hotel') || p.includes('resort') || p.includes('lodging') || p.includes('hospitality') || p.includes('luxury') || p.includes('villa') || p.includes('retreat')) {
    industry = 'Hospitality & Tourism';
    businessType = 'Luxury Hotel & Resort';
    websiteType = 'Hotel Showcase & Booking Enquiry Portal';
    proposedPages = [
      { name: 'Home', slug: 'home', purpose: 'Immersive visual welcome, rooms preview and booking CTA', source: 'user_requested', recommendedSections: [{ type: 'HeroBanner', title: 'Hotel Hero', purpose: 'Immersive property hero', contentSpec: { headline: `Experience ${businessName} — Where Luxury Meets Tranquility`, subheadline: 'An extraordinary retreat where every detail is designed for your comfort, relaxation and delight.' } }, { type: 'StatsCounter', title: 'Property Highlights', purpose: 'Trust indicators', contentSpec: { stats: [{ value: '5★', label: 'Luxury Rating' }, { value: '80+', label: 'Exclusive Rooms & Suites' }, { value: '4.9★', label: 'Guest Satisfaction Score' }, { value: '3', label: 'Signature Restaurants' }] } }, { type: 'AmenitiesGrid', title: 'World-Class Amenities', purpose: 'Hotel amenity highlights', contentSpec: { amenities: [{ name: 'Infinity Pool', description: 'Panoramic views from our rooftop infinity pool, open sunrise to midnight.', icon: 'Droplets' }, { name: 'Spa & Wellness', description: 'Full-service spa with signature treatments, sauna and steam rooms.', icon: 'Heart' }, { name: 'Fine Dining', description: 'Three signature restaurants serving curated local and international cuisine.', icon: 'Star' }, { name: 'Private Beach', description: 'Exclusive beach access with complimentary sun loungers and water sports.', icon: 'Sun' }] } }, { type: 'TestimonialsCarousel', title: 'Guest Reviews', purpose: 'Verified guest testimonials', contentSpec: { testimonials: [{ quote: `${businessName} exceeded every expectation. The service was impeccable and the property breathtaking.`, author: 'Catherine L.', role: 'Honeymooning Guest', rating: 5 }, { quote: 'The most luxurious stay we have ever experienced. We are already planning our return visit.', author: 'Richard & Sophia T.', role: 'Anniversary Stay', rating: 5 }] } }, { type: 'CallToActionBanner', title: 'Booking CTA', purpose: 'Drive reservation enquiry', contentSpec: { headline: 'Ready for an Unforgettable Stay?', subheadline: 'Book your escape today and experience the finest in luxury hospitality.', actionLabel: 'Enquire & Reserve' } }] },
      { name: 'Rooms & Suites', slug: 'rooms-suites', purpose: 'Complete room category showcase with descriptions and enquiry', source: 'user_requested', recommendedSections: [{ type: 'ItemCatalogGrid', title: 'Room Categories', purpose: 'Room types with details', contentSpec: { items: [{ id: 'r1', name: 'Deluxe Ocean View Room', category: 'Rooms', priceDisplay: 'Contact for rates', description: 'Elegantly furnished room with private balcony and sweeping ocean panorama. King bed, marble bathroom, butler service.', badge: 'Ocean View' }, { id: 'r2', name: 'Grand Suite', category: 'Suites', priceDisplay: 'Contact for rates', description: 'Expansive 2-bedroom suite with private lounge, jacuzzi and dedicated concierge. Perfect for celebrations.', badge: 'Featured' }, { id: 'r3', name: 'Garden Villa', category: 'Villas', priceDisplay: 'Contact for rates', description: 'Private garden villa with plunge pool, outdoor shower and full butler service. Ultimate privacy.', badge: 'Exclusive' }], searchable: false } }] },
      { name: 'Experiences', slug: 'experiences', purpose: 'Curated experiences, excursions and in-hotel activities', source: 'ai_recommended', recommendedSections: [{ type: 'ServicesGrid', title: 'Curated Experiences', purpose: 'Hotel experiences and activities', contentSpec: { services: [{ title: 'Sunrise Yoga & Meditation', description: 'Begin each morning with a guided sunrise yoga session on our clifftop terrace.', priceDisplay: 'Complimentary for guests' }, { title: 'Private Sunset Sailing', description: 'Exclusive 2-hour sunset sailing excursion with champagne and canapés.', priceDisplay: 'Starting from $280/couple' }, { title: 'Spa & Wellness Day', description: 'Full-day spa programme including signature massage, facial and hydrotherapy.', priceDisplay: 'Starting from $380/person' }, { title: 'Culinary Masterclass', description: 'Private cooking class with our executive chef exploring local cuisine traditions.', priceDisplay: 'Starting from $150/person' }] } }] },
      { name: 'Dining', slug: 'dining', purpose: 'Hotel restaurants, bars and in-room dining overview', source: 'ai_recommended', recommendedSections: [{ type: 'ContentSectionCard', title: 'Dining at ' + businessName, purpose: 'Dining overview', contentSpec: { headline: 'An Extraordinary Dining Journey', body: `From our signature rooftop restaurant with panoramic views to our beach bar and private in-room dining service, ${businessName} offers a complete culinary experience curated by our award-winning executive chef. Every meal is a story told through the finest local and international ingredients.` } }, { type: 'RestaurantMenuCard', title: 'Signature Dishes', purpose: 'Sample menu highlights', contentSpec: { categories: ['Breakfast', 'Lunch & Light', 'Dinner — Signature', 'Bar & Cocktails'], items: [{ name: 'Ocean Harvest Platter', category: 'Dinner — Signature', priceDisplay: 'Contact for menu pricing', description: 'Seasonal seafood platter with local catch, citrus aioli and artisan bread.', tag: 'Chef Signature' }, { name: 'Tropical Sunrise Breakfast', category: 'Breakfast', priceDisplay: 'Complimentary for guests', description: 'Fresh tropical fruits, artisan pastries, eggs your way and premium coffees.', tag: 'Included' }] } }] },
      { name: 'Reserve', slug: 'reserve', purpose: 'Room reservation enquiry form and contact information', source: 'user_requested', recommendedSections: [{ type: 'BookingForm', title: 'Reserve Your Stay', purpose: 'Reservation enquiry form', contentSpec: { fields: [{ label: 'Full Name', type: 'text', placeholder: 'Your full name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' }, { label: 'Check-In Date', type: 'datetime-local', placeholder: '' }, { label: 'Check-Out Date', type: 'datetime-local', placeholder: '' }, { label: 'Room Type Preference', type: 'select', placeholder: 'Deluxe Ocean View Room' }, { label: 'Number of Guests', type: 'text', placeholder: '2 Adults' }, { label: 'Special Requests', type: 'textarea', placeholder: 'Anniversary, dietary requirements, accessibility needs...' }], submitLabel: 'Request Reservation' } }, { type: 'LocationHoursCard', title: 'Property Location', purpose: 'Hotel address and contact', contentSpec: { address: 'Coastal Road, Luxury Hospitality District', operatingHours: 'Reception: Open 24 Hours | Check-in: 3:00 PM | Check-out: 12:00 PM', phone: '+1 (800) 555-0400', email: `reservations@${businessName.toLowerCase().replace(/\s/g, '')}.com` } }] }
    ];
    contentStrategy = { heroContent: { headline: `Experience ${businessName} — Where Luxury Meets Tranquility`, subheadline: 'An extraordinary retreat where every detail is designed for your comfort.' }, keyOfferings: [{ name: 'Luxury Room Stay', category: 'Accommodation', priceDisplay: 'Contact for rates', description: 'Premium ocean view rooms and private villas.' }], imageryStyle: 'luxury editorial hospitality photography — sweeping coastal views, elegantly appointed rooms, and lifestyle guest photography', imageryRequirements: [{ placement: 'hero', subject: 'Hotel exterior or infinity pool with ocean view', style: 'luxury editorial wide-angle', aspectRatio: '16:9' }], pricingStrategy: 'contact_for_pricing', pricingNote: 'Hotel rates not specified — using enquiry-based model', primaryCTA: 'Enquire & Reserve', secondaryCTA: 'View Rooms', ctaStrategyRationale: 'Hotel conversion is through reservation enquiry' };
    designPreferences = { theme: 'Coastal Luxury Premium', primaryColor: '#0C4A6E', secondaryColor: '#D4A853', accentColor: '#F0F9FF', backgroundColor: '#FFFFFF', typography: 'Playfair Display', headingTypography: 'Playfair Display', cardStyle: 'minimal-border', buttonStyle: 'bordered', heroStyle: 'immersive-full', spacingDensity: 'spacious', visualTone: 'elegant' };

  } else if (p.includes('real estate') || p.includes('property') || p.includes('realtor') || p.includes('estate agent') || p.includes('homes for sale') || p.includes('apartments')) {
    industry = 'Real Estate & Property';
    businessType = 'Real Estate Agency';
    websiteType = 'Property Listings & Agency Portal';
    proposedPages = [
      { name: 'Home', slug: 'home', purpose: 'Agency hero, featured property showcase and contact CTA', source: 'user_requested', recommendedSections: [{ type: 'HeroBanner', title: 'Agency Hero', purpose: 'Real estate agency hero', contentSpec: { headline: `Find Your Perfect Property with ${businessName}`, subheadline: 'Expert property guidance, exclusive listings and a dedicated team to find your ideal home.' } }, { type: 'StatsCounter', title: 'Agency Track Record', purpose: 'Credibility statistics', contentSpec: { stats: [{ value: '2,500+', label: 'Properties Sold' }, { value: '98%', label: 'Client Satisfaction Rate' }, { value: '15+', label: 'Years of Market Experience' }, { value: '50+', label: 'Expert Agents' }] } }, { type: 'CallToActionBanner', title: 'Search CTA', purpose: 'Drive property enquiry', contentSpec: { headline: 'Let\'s Find Your Next Home', subheadline: 'Browse our exclusive listings or speak directly with one of our property specialists.', actionLabel: 'Browse Properties' } }] },
      { name: 'Properties', slug: 'properties', purpose: 'Full searchable property listings catalog', source: 'user_requested', recommendedSections: [{ type: 'ItemCatalogGrid', title: 'Available Properties', purpose: 'Property listings grid', contentSpec: { items: [{ id: 'p1', name: 'Modern City Apartment — 2 Bed', category: 'Apartments', priceDisplay: 'Contact for pricing', description: 'Contemporary 2-bedroom apartment in the heart of the city. Floor-to-ceiling windows, roof terrace and concierge.', badge: 'New Listing' }, { id: 'p2', name: 'Suburban Family Home — 4 Bed', category: 'Houses', priceDisplay: 'Contact for pricing', description: 'Spacious 4-bedroom family home in a sought-after suburban neighbourhood. Large garden, double garage.', badge: 'Featured' }, { id: 'p3', name: 'Luxury Penthouse — 3 Bed', category: 'Penthouses', priceDisplay: 'Contact for pricing', description: 'Exceptional penthouse with panoramic skyline views, private terrace and premium finishes throughout.', badge: 'Premium' }], searchable: true } }] },
      { name: 'Contact an Agent', slug: 'contact-agent', purpose: 'Property enquiry form and agent contact details', source: 'user_requested', recommendedSections: [{ type: 'ContactInquiryForm', title: 'Speak to an Agent', purpose: 'Property enquiry form', contentSpec: { fields: [{ label: 'Full Name', type: 'text', placeholder: 'Your name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' }, { label: 'Property Interest', type: 'select', placeholder: 'Buying a property' }, { label: 'Budget Range', type: 'text', placeholder: 'e.g. $300,000 – $500,000' }, { label: 'Message', type: 'textarea', placeholder: 'Tell us what you are looking for...' }], submitLabel: 'Speak to an Agent' } }, { type: 'LocationHoursCard', title: 'Our Office', purpose: 'Agency office location', contentSpec: { address: '100 Property Lane, Business District', operatingHours: 'Mon–Fri: 9:00 AM – 6:00 PM | Sat: 10:00 AM – 4:00 PM', phone: '+1 (800) 555-0500', email: `enquiries@${businessName.toLowerCase().replace(/\s/g, '')}.com` } }] }
    ];
    contentStrategy = { heroContent: { headline: `Find Your Perfect Property with ${businessName}`, subheadline: 'Expert guidance and exclusive listings across residential and commercial real estate.' }, keyOfferings: [{ name: 'Property Purchase Guidance', category: 'Service', priceDisplay: 'Contact for pricing', description: 'Expert buyer representation from search to completion.' }], imageryStyle: 'clean architectural property photography with bright natural light interiors and exterior lifestyle shots', imageryRequirements: [{ placement: 'hero', subject: 'Luxury property exterior or bright interior', style: 'clean architectural photography', aspectRatio: '16:9' }], pricingStrategy: 'contact_for_pricing', pricingNote: 'Property pricing is listing-specific — using enquiry model', primaryCTA: 'Browse Properties', secondaryCTA: 'Contact an Agent', ctaStrategyRationale: 'Real estate conversion is through agent contact and property enquiry' };
    designPreferences = { theme: 'Clean Professional Real Estate', primaryColor: '#1E3A5F', secondaryColor: '#D4A853', accentColor: '#F8F9FA', backgroundColor: '#FFFFFF', typography: 'Plus Jakarta Sans', headingTypography: 'Plus Jakarta Sans', cardStyle: 'minimal-border', buttonStyle: 'pill', heroStyle: 'split-left', spacingDensity: 'comfortable', visualTone: 'sophisticated' };

  } else if (p.includes('fitness') || p.includes('coach') || p.includes('gym') || p.includes('workout') || p.includes('trainer') || p.includes('personal trainer') || p.includes('yoga') || p.includes('pilates')) {
    industry = 'Health & Fitness';
    businessType = 'Personal Fitness Coaching & Training';
    websiteType = 'Fitness Coaching Landing Page & Booking Portal';
    const coachName = nameMatch ? nameMatch[1].trim() : 'Your Coach';
    proposedPages = [
      {
        name: 'Home', slug: 'home', purpose: 'High-converting single landing page with full coach narrative and booking', source: 'user_requested',
        recommendedSections: [
          { type: 'HeroBanner', title: 'Coach Hero', purpose: 'Bold motivational hero', contentSpec: { headline: `Transform Your Body & Mind with ${coachName}`, subheadline: 'Expert personal coaching that delivers real, lasting results. Your transformation starts today.' } },
          { type: 'StatsCounter', title: 'Results That Speak', purpose: 'Coaching credibility statistics', contentSpec: { stats: [{ value: '500+', label: 'Clients Transformed' }, { value: '10+', label: 'Years Coaching Experience' }, { value: '95%', label: 'Goal Achievement Rate' }, { value: '4.9★', label: 'Average Client Rating' }] } },
          { type: 'ServicesGrid', title: 'Coaching Programs', purpose: 'Training program offerings', contentSpec: { services: [{ title: '1-on-1 Personal Training', description: 'Fully personalised training sessions tailored to your body, goals and fitness level. In-person or virtual.', priceDisplay: 'Contact for pricing' }, { title: '12-Week Transformation', description: 'Structured 12-week program combining training, nutrition and mindset coaching for maximum results.', priceDisplay: 'Contact for pricing' }, { title: 'Online Coaching', description: 'Flexible remote coaching with customised workout plans, weekly check-ins and 24/7 messaging support.', priceDisplay: 'Contact for pricing' }] } },
          { type: 'TestimonialsCarousel', title: 'Client Transformations', purpose: 'Real client results', contentSpec: { testimonials: [{ quote: `${coachName} completely transformed how I think about fitness. Lost 15kg in 16 weeks and kept it off.`, author: 'Marcus T.', role: 'Online Coaching Client', rating: 5 }, { quote: 'Best investment I have ever made in my health. The programme is challenging but incredibly effective.', author: 'Aisha K.', role: '12-Week Transformation Client', rating: 5 }, { quote: 'I have trained with many coaches. None compare to the level of expertise and commitment I received here.', author: 'Daniel W.', role: '1-on-1 Training Client', rating: 5 }] } },
          { type: 'GuideAccordion', title: 'Frequently Asked Questions', purpose: 'Common coaching questions', contentSpec: { items: [{ question: 'Do I need prior fitness experience to start?', answer: 'Absolutely not. All programs are tailored to your current fitness level, starting from exactly where you are.' }, { question: 'How quickly can I see results?', answer: 'Most clients notice significant changes within the first 4 weeks. Visible transformation is typically achieved within 8-12 weeks with consistency.' }, { question: 'Is online coaching as effective as in-person?', answer: 'Yes — with the right structure and accountability. Our online program includes custom programming, video feedback and regular check-ins to ensure results.' }] } },
          { type: 'BookingForm', title: 'Book Free Consultation', purpose: 'Free consultation booking form', contentSpec: { fields: [{ label: 'Full Name', type: 'text', placeholder: 'Your name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Phone', type: 'tel', placeholder: '+1 (000) 000-0000' }, { label: 'Current Fitness Level', type: 'select', placeholder: 'Beginner' }, { label: 'Primary Goal', type: 'textarea', placeholder: 'Describe your main fitness goal...' }], submitLabel: 'Book Free Consultation' } }
        ]
      }
    ];
    contentStrategy = { heroContent: { headline: `Transform Your Body & Mind with ${coachName}`, subheadline: 'Expert personal coaching that delivers real, lasting results.' }, keyOfferings: [{ name: '1-on-1 Personal Training', category: 'Coaching', priceDisplay: 'Contact for pricing', description: 'Personalised training sessions.' }], imageryStyle: 'high-energy fitness lifestyle photography — training sessions, transformation photos, outdoor training', imageryRequirements: [{ placement: 'hero', subject: 'Coach training or athlete workout', style: 'high-contrast energetic lifestyle photography', aspectRatio: '16:9' }], pricingStrategy: 'contact_for_pricing', pricingNote: 'Coaching pricing not specified — using consultation booking model', primaryCTA: 'Book Free Consultation', secondaryCTA: 'View Programs', ctaStrategyRationale: 'Fitness coaching converts through free consultation bookings' };
    designPreferences = { theme: 'High Energy Athletic Dark', primaryColor: '#CCFF00', secondaryColor: '#EF4444', accentColor: '#1A1A1A', backgroundColor: '#111111', typography: 'Montserrat', headingTypography: 'Montserrat', cardStyle: 'dark-neon', buttonStyle: 'sharp', heroStyle: 'full-banner', spacingDensity: 'compact', visualTone: 'energetic' };

  } else {
    // Generic fallback for any other business
    proposedPages = [
      { name: 'Home', slug: 'home', purpose: 'Business overview, hero value proposition and primary CTA', source: 'user_requested', recommendedSections: [{ type: 'HeroBanner', title: 'Welcome Hero', purpose: 'Business introduction hero', contentSpec: { headline: `${businessName} — Excellence in Every Detail`, subheadline: 'Dedicated to delivering outstanding service and value for every client we serve.' } }, { type: 'FeatureGrid', title: 'Why Choose Us', purpose: 'Key differentiators', contentSpec: { features: [{ icon: 'Star', title: 'Proven Expertise', description: 'Years of industry experience delivering exceptional outcomes for our clients.' }, { icon: 'Heart', title: 'Client-First Approach', description: 'Your goals drive our work. We are dedicated to your success at every step.' }, { icon: 'Shield', title: 'Trusted & Reliable', description: 'Consistent quality, transparent communication and dependable delivery.' }, { icon: 'Zap', title: 'Results-Focused', description: 'We measure our success by the real outcomes we create for your business.' }] } }, { type: 'TestimonialsCarousel', title: 'Client Testimonials', purpose: 'Social proof', contentSpec: { testimonials: [{ quote: `${businessName} delivered exactly what they promised — and more. Highly recommended.`, author: 'Alexandra D.', role: 'Verified Client', rating: 5 }] } }, { type: 'CallToActionBanner', title: 'Contact CTA', purpose: 'Drive enquiry', contentSpec: { headline: 'Ready to Get Started?', subheadline: 'Get in touch today and let us discuss how we can help you achieve your goals.', actionLabel: 'Get in Touch' } }] },
      { name: 'Services', slug: 'services', purpose: 'Full overview of service offerings and pricing', source: 'ai_recommended', recommendedSections: [{ type: 'ServicesGrid', title: 'Our Services', purpose: 'Service catalog', contentSpec: { services: [{ title: 'Core Service', description: 'Our primary offering, tailored to your specific requirements.', priceDisplay: 'Contact for pricing' }, { title: 'Premium Service', description: 'Enhanced delivery with additional support and priority access.', priceDisplay: 'Contact for pricing' }, { title: 'Custom Solutions', description: 'Bespoke solutions designed around your unique needs.', priceDisplay: 'Contact for pricing' }] } }] },
      { name: 'Contact', slug: 'contact', purpose: 'Contact form, location and operating hours', source: 'user_requested', recommendedSections: [{ type: 'ContactInquiryForm', title: 'Contact Us', purpose: 'Enquiry form', contentSpec: { fields: [{ label: 'Your Name', type: 'text', placeholder: 'Full name' }, { label: 'Email', type: 'email', placeholder: 'you@email.com' }, { label: 'Message', type: 'textarea', placeholder: 'How can we help you?' }], submitLabel: 'Send Enquiry' } }, { type: 'LocationHoursCard', title: 'Our Location', purpose: 'Location and contact details', contentSpec: { address: 'Contact us for our address', operatingHours: 'Mon–Fri: 9:00 AM – 6:00 PM', phone: '+1 (800) 555-0000', email: `hello@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` } }] }
    ];
    contentStrategy = { heroContent: { headline: `${businessName} — Excellence in Every Detail`, subheadline: 'Dedicated to delivering outstanding value for every client.' }, keyOfferings: [{ name: 'Core Service', category: 'Services', priceDisplay: 'Contact for pricing', description: 'Tailored to your requirements.' }], imageryStyle: 'clean professional business photography', imageryRequirements: [{ placement: 'hero', subject: 'Professional business or team', style: 'clean professional', aspectRatio: '16:9' }], pricingStrategy: 'contact_for_pricing', pricingNote: 'Pricing not specified — using enquiry model', primaryCTA: 'Get in Touch', secondaryCTA: 'View Services', ctaStrategyRationale: 'Enquiry-based conversion model' };
  }

  // Dynamic intent-aware color extraction for fallback
  let primaryColor = designPreferences.primaryColor || '#0A84FF';
  let secondaryColor = designPreferences.secondaryColor || '#1D1D1F';
  let colorSource = 'semantic_inference';

  if (p.includes('red') && (p.includes('cream') || p.includes('white'))) {
    primaryColor = '#DC2626';
    secondaryColor = '#FFFBEB';
    colorSource = 'user_explicit';
  } else if (p.includes('green')) {
    primaryColor = '#16A34A';
    secondaryColor = '#14532D';
    colorSource = 'user_explicit';
  } else if (p.includes('gold') || p.includes('yellow')) {
    primaryColor = '#D4AF37';
    secondaryColor = '#121212';
    colorSource = 'user_explicit';
  } else if (p.includes('black') && (p.includes('white') || p.includes('monochrome'))) {
    primaryColor = '#000000';
    secondaryColor = '#FFFFFF';
    colorSource = 'user_explicit';
  } else if (p.includes('rainbow') || p.includes('playful') || p.includes('balloon')) {
    primaryColor = '#FF3B30';
    secondaryColor = '#FF9500';
    colorSource = 'user_explicit';
  }

  designPreferences.primaryColor = primaryColor;
  designPreferences.secondaryColor = secondaryColor;
  designPreferences.sources = {
    theme: colorSource,
    primaryColor: colorSource,
    typography: 'semantic_inference',
    visualTone: 'semantic_inference'
  };

  const wordCount = userPrompt.trim().split(/\s+/).length;
  const specificityLevel = wordCount < 4 ? 'LOW' : wordCount < 12 ? 'MEDIUM' : 'HIGH';

  const userIntent = {
    rawPrompt: userPrompt,
    domain: industry,
    businessType,
    websitePurpose: 'Present services and drive conversions',
    specificityLevel,
    explicitRequirements: [userPrompt],
    designIntent: { style: [designPreferences.visualTone], colors: [primaryColor], typography: [designPreferences.typography], tone: [designPreferences.visualTone] },
    contentIntent: { products: [], services: [], sections: [] },
    functionalityIntent: [],
    pageIntent: proposedPages.map(pg => ({ name: pg.name, intent: pg.purpose })),
    imageryIntent: [],
    constraints: [],
    exclusions: []
  };

  return {
    userIntent,
    industry,
    businessType,
    websiteType,
    businessNiche,
    targetAudience: ['Target Customers', 'Primary Audience'],
    uniqueValueProposition: `${businessName} delivers exceptional quality and service`,
    primaryGoal: 'Drive customer enquiries and conversions',
    contentTone: 'professional and approachable',
    userRequestedFeatures: [userPrompt],
    aiRecommendedFeatures: ['Contact & Enquiry Form', 'Customer Testimonials', 'Location & Hours'],
    proposedPages,
    contentStrategy,
    paymentSpec: { paymentRequired: false, status: 'not_requested', supportedMethods: [], recommendation: 'Enable payment if online purchasing is required' },
    checkoutSpec: { checkoutRequired: false, status: 'not_requested', recommendation: 'Enable checkout if direct purchasing is added' },
    designPreferences,
    functionalRequirements: { authRequired: p.includes('login') || p.includes('account'), contactForms: true, bookingRequired: false, reservationRequired: false, filteringRequired: false, searchRequired: false },
    isIncompletePrompt: userPrompt.split(' ').length <= 5,
    followUpQuestions: ['What is the primary action you want website visitors to take?'],
    assumptions: ['Generated domain-inferred fallback — LLM service was temporarily unavailable'],
    analysisMetadata: { analysisSource: 'fallback', model: 'none', provider: 'system-fallback', confidence: 0.5, note: `LLM unavailable (${reason}); business-aware fallback returned` }
  };
}

module.exports = { analyzeRequirement };
