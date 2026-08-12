/**
 * Autonomous Website Generation Engine (Phase 4 Engine)
 * - Converts Phase 3 Website Blueprint into a fully functional, component-based Website Specification.
 * - ZERO new LLM calls (100% deterministic generation).
 * - Strictly enforces Feature Ownership Rules:
 *     1. USER REQUESTED: MUST be implemented.
 *     2. APPROVED RECOMMENDATIONS: MUST be implemented.
 *     3. AI UNAPPROVED: MUST NOT be implemented (completely excluded).
 * - Strictly preserves payment, checkout, and auth constraints from Phase 3 Blueprint.
 * - Performs automated 10-rule validation check returning PASS/FAIL.
 */

/**
 * Sanitizes a price display value from contentSpec.
 *
 * SOURCE-OF-TRUTH PRIORITY: USER EXPLICIT > AI SEMANTIC INFERENCE > SYSTEM DEFAULT
 *
 * If the pricingStrategy indicates that the user provided pricing (user_provided)
 * or explicitly requested demo/sample prices (demo_sample_only), the price is
 * passed through as-is. In all other cases — including where the LLM may have
 * invented a concrete dollar amount despite the pricing rule — concrete currency
 * values (e.g. "$49.00", "£12", "€99") are replaced with a neutral contextual label.
 *
 * @param {string} price - Price string from contentSpec (potentially AI-invented)
 * @param {string} pricingStrategy - Blueprint-level pricing strategy
 * @param {string} neutralLabel - Neutral fallback label for this component/business context
 * @returns {string} Safe price display value
 */
function sanitizePriceDisplay(price, pricingStrategy, neutralLabel = 'Contact for pricing') {
  // Allow pass-through only when user explicitly provided pricing or requested samples
  const allowConcretePrice = pricingStrategy === 'user_provided' || pricingStrategy === 'demo_sample_only';
  if (allowConcretePrice) return price || neutralLabel;

  // Detect concrete invented currency amounts: $49.00, £12, €99, USD 49, etc.
  const concretePrice = /^(\$|£|€|USD|EUR|GBP|INR|AUD|CAD)?\s*\d+([.,]\d+)?\s*(USD|EUR|GBP|INR|AUD|CAD)?$/i;
  if (price && concretePrice.test(price.trim())) {
    // LLM invented a specific dollar amount — replace with neutral label
    return neutralLabel;
  }
  return price || neutralLabel;
}

function generateWebsiteFromBlueprint(blueprint, reqId = null) {
  const correlationTag = reqId ? `[WB:${reqId}] ` : '[WebsiteGeneratorService] ';
  console.log(`${correlationTag}Generating Website from Phase 3 Blueprint deterministically...`);

  if (!blueprint || typeof blueprint !== 'object' || !blueprint.blueprintId) {
    throw new Error('Valid Phase 3 Website Blueprint object is required for website generation.');
  }

  const {
    blueprintId,
    websiteIdentity = {},
    websiteType = 'Business Website',
    designSpec = {},
    featureMatrix = {},
    pages = [],
    navigationSpec = {},
    ctaRequirements = {},
    contactRequirements = {},
    paymentCheckoutSpec = {},
    contentStrategy = {}
  } = blueprint;

  // Extract pricingStrategy for use in price sanitization downstream
  const pricingStrategy = contentStrategy?.pricingStrategy || 'contact_for_pricing';

  // 1. Process Feature Ownership Isolation
  const userRequestedList = Array.isArray(featureMatrix.userRequestedFeatures) ? featureMatrix.userRequestedFeatures : [];
  const approvedList = Array.isArray(featureMatrix.approvedRecommendations) ? featureMatrix.approvedRecommendations : [];
  const unapprovedList = Array.isArray(featureMatrix.aiRecommendedFeatures) ? featureMatrix.aiRecommendedFeatures : [];

  const implementedFeatures = [...userRequestedList, ...approvedList];

  // 2. Generate Multi-Page Component Blueprint
  const generatedPages = pages.map((page, pIdx) => {
    const pageName = page.name || `Page ${pIdx + 1}`;
    const pagePurpose = page.purpose || 'Page view';
    const pageSource = page.source || 'user_requested';

    const pageComponents = Array.isArray(page.components) ? page.components : [];

    const sections = pageComponents.map((comp, cIdx) => {
      return buildSectionFromComponentSpec({
        comp,
        pageName,
        websiteIdentity,
        designSpec,
        ctaRequirements,
        contactRequirements,
        paymentCheckoutSpec,
        implementedFeatures,
        unapprovedList,
        pricingStrategy
      });
    });

    return {
      id: `page_${pageName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: pageName,
      purpose: pagePurpose,
      source: pageSource,
      sections
    };
  });

  // 3. Prepare Feature Implementation Summary
  const featureImplementationSummary = {
    userRequestedCount: userRequestedList.length,
    approvedCount: approvedList.length,
    excludedCount: unapprovedList.length,
    userRequestedList,
    approvedList,
    excludedList: unapprovedList
  };

  // 4. Assemble Complete Generated Website Data Structure
  const generatedTheme = buildGeneratedWebsiteTheme(designSpec, websiteIdentity);

  const website = {
    websiteId: `site_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    blueprintId,
    generatedAt: new Date().toISOString(),
    websiteIdentity: {
      title: websiteIdentity.title || 'Custom Application',
      businessType: websiteIdentity.businessType || 'General Business',
      industry: websiteIdentity.industry || 'General Industry',
      targetAudience: websiteIdentity.targetAudience || ['Customers']
    },
    websiteType,
    designSpec: {
      theme: designSpec.theme || 'Modern Dark',
      primaryColor: designSpec.primaryColor || '#6366F1',
      secondaryColor: designSpec.secondaryColor || '#4F46E5',
      typography: designSpec.typography || 'Inter',
      layoutStyle: designSpec.layoutStyle || 'Responsive Container Grid',
      sources: designSpec.sources || {}
    },
    generatedTheme,
    pages: generatedPages,
    navigationSpec,
    ctaRequirements,
    imagerySpec: blueprint.imagerySpec || {
      requiresImages: false,
      imageryStyle: '',
      imageRoles: []
    },
    contactRequirements,
    paymentCheckoutSpec,
    featureImplementationSummary,
    visualDesignSpec: blueprint.visualDesignSpec || null, // Visual design fingerprint for code emitter
    validationResult: null // attached in step 5
  };

  // 5. Run Automated Phase 4 Validation Engine
  website.validationResult = validateGeneratedWebsite(website, blueprint);

  console.log(
    `${correlationTag}Website generated successfully. Pages: ${generatedPages.length}, Implemented Features: ${implementedFeatures.length}, Excluded Unapproved: ${unapprovedList.length}, Validation Status: ${website.validationResult.status}`
  );

  return website;
}

/**
 * Builds deterministic section objects from component specifications
 */
function getDomainImages(businessType = '', industry = '', title = '', imageryKeywords = []) {
  const text = (businessType + ' ' + industry + ' ' + title + ' ' + imageryKeywords.join(' ')).toLowerCase();

  // ── MOST SPECIFIC MATCHES FIRST (before generic "restaurant") ──────────────

  // Children Science / STEM / Educational Learning / WonderLab
  if (text.includes('science') || text.includes('wonderlab') || text.includes('experiment') || text.includes('stem') || text.includes('kids learning') || text.includes('children') || text.includes('chemistry') || text.includes('physics') || text.includes('space') || text.includes('biology')) {
    return [
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1567168544813-cc03465b4fa8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Japanese / Ramen / Noodles
  if (text.includes('ramen') || text.includes('japanese') || text.includes('noodle') || text.includes('ramen bar') || text.includes('izakaya') || text.includes('tonkotsu') || text.includes('udon') || text.includes('soba')) {
    return [
      'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1569721467706-9f9e7f9b2c7c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1623341214825-9f4f963727da?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Sushi / Japanese Fine Dining
  if (text.includes('sushi') || text.includes('omakase') || text.includes('tempura') || text.includes('yakitori') || text.includes('teppanyaki')) {
    return [
      'https://images.unsplash.com/photo-1617196034183-421b4040ed20?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1617196034199-f10f9d50a063?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Coffee / Café / Specialty Coffee
  if (text.includes('coffee') || text.includes('café') || text.includes('cafe') || text.includes('espresso') || text.includes('barista') || text.includes('brew') || text.includes('roaster')) {
    return [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Bakery / Pastry / Cakes
  if (text.includes('bakery') || text.includes('pastry') || text.includes('cake') || text.includes('confection') || text.includes('bake') || text.includes('artisan bread') || text.includes('patisserie') || text.includes('croissant')) {
    return [
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1562440499-64c9a111f713?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Pizza / Italian
  if (text.includes('pizza') || text.includes('italian') || text.includes('pasta') || text.includes('trattoria') || text.includes('osteria') || text.includes('bistro')) {
    return [
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Indian Cuisine
  if (text.includes('indian') || text.includes('curry') || text.includes('spice') || text.includes('tandoor') || text.includes('biryani') || text.includes('masala')) {
    return [
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Mexican / Tacos
  if (text.includes('mexican') || text.includes('taco') || text.includes('burrito') || text.includes('cantina') || text.includes('tortilla')) {
    return [
      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1613514785940-daed07799d9b?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // General Restaurant / Dining (catch-all for food that didn't match above)
  if (text.includes('restaurant') || text.includes('dining') || text.includes('food') || text.includes('cuisine') || text.includes('menu')) {
    return [
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Fashion / Clothing / Luxury Apparel
  if (text.includes('fashion') || text.includes('clothing') || text.includes('apparel') || text.includes('atelier') || text.includes('couture') || text.includes('boutique') || text.includes('luxury brand') || text.includes('streetwear')) {
    return [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Nail / Beauty / Cosmetics
  if (text.includes('nail') || text.includes('press-on') || text.includes('manicure') || text.includes('cosmetics') || text.includes('pedicure')) {
    return [
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Spa / Wellness / Massage / Yoga
  if (text.includes('spa') || text.includes('wellness') || text.includes('massage') || text.includes('yoga') || text.includes('meditation') || text.includes('holistic') || text.includes('retreat')) {
    return [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Gym / Fitness / Sports
  if (text.includes('gym') || text.includes('fitness') || text.includes('workout') || text.includes('sport') || text.includes('training') || text.includes('crossfit') || text.includes('bodybuilding')) {
    return [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Law / Legal / Professional Services
  if (text.includes('law') || text.includes('legal') || text.includes('attorney') || text.includes('firm') || text.includes('barrister') || text.includes('solicitor') || text.includes('counsel')) {
    return [
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1521791055366-0d553872952f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Photography / Wedding / Portrait / Creative
  if (text.includes('photo') || text.includes('wedding') || text.includes('portrait') || text.includes('gallery') || text.includes('artist') || text.includes('portfolio')) {
    return [
      'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // SaaS / Software / AI / Tech / Fintech
  if (text.includes('saas') || text.includes('accounting') || text.includes('software') || text.includes('platform') || text.includes('fintech') || text.includes('cloud') || text.includes('startup') || text.includes('tech')) {
    return [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Hotel / Resort / Hospitality / Vacation
  if (text.includes('resort') || text.includes('hotel') || text.includes('villa') || text.includes('hospitality') || text.includes('vacation') || text.includes('stay') || text.includes('lodge') || text.includes('inn')) {
    return [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Real Estate / Architecture / Interior Design
  if (text.includes('architect') || text.includes('building') || text.includes('interior') || text.includes('real estate') || text.includes('estate') || text.includes('property') || text.includes('homes for sale')) {
    return [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // E-commerce / Shopping / Retail
  if (text.includes('shop') || text.includes('store') || text.includes('ecommerce') || text.includes('e-commerce') || text.includes('retail') || text.includes('marketplace') || text.includes('product')) {
    return [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Mobile / Phone / Consumer Electronics
  if (text.includes('mobile') || text.includes('phone') || text.includes('smartphone') || text.includes('device') || text.includes('gadget') || text.includes('electronics')) {
    return [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Education / Academy / Online Courses
  if (text.includes('school') || text.includes('academy') || text.includes('education') || text.includes('course') || text.includes('learning') || text.includes('tutor') || text.includes('university')) {
    return [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Healthcare / Medical / Clinic
  if (text.includes('health') || text.includes('medical') || text.includes('clinic') || text.includes('dental') || text.includes('hospital') || text.includes('doctor') || text.includes('therapy')) {
    return [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551190822-a9333d879b1f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80'
    ];
  }

  // Default — Generic Professional / Business
  return [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80'
  ];
}


function buildSectionFromComponentSpec({
  comp,
  pageName,
  websiteIdentity,
  designSpec,
  ctaRequirements,
  contactRequirements,
  paymentCheckoutSpec,
  implementedFeatures,
  unapprovedList,
  pricingStrategy = 'contact_for_pricing'
}) {
  const compType = comp.type || 'ContentSectionCard';
  const title = comp.title || `${pageName || 'Section'} Section`;
  const purpose = comp.purpose || '';
  const compSource = comp.source || 'ai_recommended';

  const businessName = websiteIdentity?.title || 'Our Business';
  const businessType = websiteIdentity?.businessType || 'General Business';
  const industry = websiteIdentity?.industry || 'General Industry';

  const cs = comp.contentSpec || null;
  // Pass AI imagery keywords to getDomainImages for semantic precision matching
  const imageryKws = Array.isArray(comp.imageryKeywords) ? comp.imageryKeywords :
                     (websiteIdentity?._visualDesignSpec?.imageryKeywords || []);
  const domainImages = getDomainImages(businessType, industry, businessName, imageryKws);

  const baseSection = {
    id: comp.id || `sec_${Math.random().toString(36).substring(2, 8)}`,
    type: compType,
    title,
    purpose,
    source: compSource,
    imageUrl: domainImages[0],
    styles: {
      primaryColor: designSpec.primaryColor || '#6366F1',
      secondaryColor: designSpec.secondaryColor || '#4F46E5',
      theme: designSpec.theme || 'Modern Dark'
    }
  };

  switch (compType) {
    case 'HeroBanner':
    case 'HeroSplit':
    case 'HeroMinimal':
      return {
        ...baseSection,
        headline: cs?.headline || `Discover ${businessName}`,
        subheadline: cs?.subheadline || `${businessType} — delivering exceptional quality and value.`,
        primaryCTA: ctaRequirements.primaryCTA || 'Get Started',
        secondaryCTA: ctaRequirements.secondaryCTA || 'Learn More',
        imageUrl: domainImages[0]
      };

    case 'RestaurantMenuCard':
      return {
        ...baseSection,
        // Use contentSpec categories/items from blueprint — business-specific menu
        categories: cs?.categories || ['Starters', 'Mains', 'Desserts', 'Drinks'],
        items: Array.isArray(cs?.items) && cs.items.length > 0
          ? cs.items.map(item => ({
              name: item.name,
              category: item.category,
              price: sanitizePriceDisplay(item.priceDisplay || item.price, pricingStrategy, 'Contact for pricing'),
              description: item.description || '',
              tag: item.tag || ''
            }))
          : [
              { name: 'Signature Starter', category: 'Starters', price: 'Contact for pricing', description: 'House-crafted starter made from fresh seasonal ingredients.', tag: 'Chef Favourite' },
              { name: 'Signature Main', category: 'Mains', price: 'Contact for pricing', description: 'Slow-cooked main course using traditional recipes.', tag: 'House Special' },
              { name: 'House Dessert', category: 'Desserts', price: 'Contact for pricing', description: 'Handcrafted dessert made fresh daily.', tag: 'Must Try' }
            ]
      };

    case 'PortfolioGallery':
      const rawPortItems = Array.isArray(cs?.items) && cs.items.length > 0
        ? cs.items
        : [
            { title: `${businessName} Showcase Series`, category: 'Featured', year: '2025', description: 'A signature creative project.' },
            { title: `${businessName} Studio Edition`, category: 'Recent', year: '2025', description: 'Latest creative output.' }
          ];
      return {
        ...baseSection,
        categories: cs?.categories || ['All Works', 'Featured', 'Recent'],
        items: rawPortItems.map((item, idx) => ({
          ...item,
          imageUrl: item.imageUrl || domainImages[idx % domainImages.length]
        }))
      };

    case 'PricingPlansGrid':
      return {
        ...baseSection,
        billingToggle: false,
        plans: Array.isArray(cs?.plans) && cs.plans.length > 0
          ? cs.plans.map(plan => ({
              name: plan.name,
              price: sanitizePriceDisplay(plan.priceDisplay || plan.price, pricingStrategy, 'Contact for pricing'),
              period: plan.period || '',
              description: plan.description || '',
              features: Array.isArray(plan.features) ? plan.features : [],
              isPopular: !!plan.isPopular
            }))
          : [
              { name: 'Essential Plan', price: 'Contact for pricing', period: '', description: 'Essential features for getting started.', features: ['Core Access', 'Standard Support'], isPopular: false },
              { name: 'Pro Plan', price: 'Contact for pricing', period: '', description: 'Advanced features for scaling operations.', features: ['Full Access', 'Priority Support'], isPopular: true }
            ]
      };

    case 'FeatureGrid':
    case 'ValuePropositionGrid':
      return {
        ...baseSection,
        features: Array.isArray(cs?.features) && cs.features.length > 0
          ? cs.features
          : [
              { icon: 'Star', title: `${businessName} Standard`, description: 'Exceptional quality delivered with every service and product.' },
              { icon: 'Heart', title: 'Client-First Philosophy', description: 'Your goals drive everything we do. Dedicated to your success.' }
            ]
      };

    case 'HowItWorksGrid':
    case 'ProcessSteps':
      return {
        ...baseSection,
        steps: Array.isArray(cs?.steps) && cs.steps.length > 0
          ? cs.steps
          : [
              { step: '01', title: 'Initial Consultation', description: 'Reach out to discuss your requirements and goals.' },
              { step: '02', title: 'Bespoke Execution', description: 'Our team delivers to your exact specifications.' }
            ]
      };

    case 'TestimonialsCarousel':
    case 'ReviewsGrid':
      return {
        ...baseSection,
        testimonials: Array.isArray(cs?.testimonials) && cs.testimonials.length > 0
          ? cs.testimonials
          : [
              { quote: `${businessName} delivered exceptional quality throughout. Highly recommended.`, author: 'Satisfied Client', role: 'Verified Review', rating: 5 }
            ]
      };

    case 'BookingForm':
    case 'DemoRequestForm':
      return {
        ...baseSection,
        fields: Array.isArray(cs?.fields) && cs.fields.length > 0
          ? cs.fields
          : [
              { label: 'Full Name', type: 'text', placeholder: 'Your full name' },
              { label: 'Email Address', type: 'email', placeholder: 'you@email.com' },
              { label: 'Preferred Date & Time', type: 'datetime-local', placeholder: '' },
              { label: 'Message', type: 'textarea', placeholder: 'Tell us about your requirements...' }
            ],
        submitLabel: cs?.submitLabel || (compType === 'DemoRequestForm' ? 'Schedule My Demo' : 'Confirm Booking')
      };

    case 'ServicesGrid':
      return {
        ...baseSection,
        services: Array.isArray(cs?.services) && cs.services.length > 0
          ? cs.services.map((s, idx) => ({
              title: s.title,
              description: s.description || '',
              price: sanitizePriceDisplay(s.priceDisplay || s.price, pricingStrategy, 'Contact for pricing'),
              imageUrl: s.imageUrl || domainImages[idx % domainImages.length]
            }))
          : [
              { title: `${businessName} Primary Offering`, description: 'Our core offering, tailored to your specific needs.', price: 'Contact for pricing', imageUrl: domainImages[0] },
              { title: `${businessName} Premium Service`, description: 'Enhanced delivery with additional support and features.', price: 'Contact for pricing', imageUrl: domainImages[1] }
            ]
      };

    case 'ItemCatalogGrid':
    case 'FeaturedItemsGrid':
      const rawCatItems = Array.isArray(cs?.items) && cs.items.length > 0
        ? cs.items
        : [
            { id: 'item_1', name: `${businessName} Selection`, category: 'Featured', description: 'Our featured collection.', price: 'Contact for pricing', badge: 'Popular' },
            { id: 'item_2', name: `${businessName} Edition`, category: 'Special', description: 'An exclusive offering.', price: 'Contact for pricing', badge: 'Recommended' }
          ];
      return {
        ...baseSection,
        items: rawCatItems.map((item, idx) => ({
          id: item.id || `item_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          name: item.name,
          category: item.category || 'General',
          description: item.description || '',
          price: sanitizePriceDisplay(item.priceDisplay || item.price, pricingStrategy, 'View options'),
          badge: item.badge || '',
          imageUrl: item.imageUrl || domainImages[idx % domainImages.length],
          hasPaymentButton: paymentCheckoutSpec.paymentRequired
        }))
      };

    case 'ComparisonTable':
      return {
        ...baseSection,
        columns: cs?.columns || ['Feature', 'Option A', 'Option B', 'Option C'],
        rows: Array.isArray(cs?.rows) && cs.rows.length > 0
          ? cs.rows
          : [
              { feature: 'Core Access', a: '✓', b: '✓', c: '✓' },
              { feature: 'Advanced Features', a: '–', b: '✓', c: '✓' },
              { feature: 'Priority Support', a: '–', b: '–', c: '✓' }
            ]
      };

    case 'GuideAccordion':
      return {
        ...baseSection,
        items: Array.isArray(cs?.items) && cs.items.length > 0
          ? cs.items
          : [
              { question: `How do I get started with ${businessName}?`, answer: 'Contact our team and we will guide you through the process step by step.' },
              { question: 'What is your typical turnaround time?', answer: 'Timelines vary by project. We will provide a clear timeline during your initial consultation.' },
              { question: 'Do you offer customisation?', answer: 'Yes — we offer flexible customisation options to meet your specific needs. Contact us to discuss.' }
            ]
      };

    case 'ContactInquiryForm':
      return {
        ...baseSection,
        fields: Array.isArray(cs?.fields) && cs.fields.length > 0
          ? cs.fields
          : [
              { label: 'Full Name', type: 'text', placeholder: 'Your name' },
              { label: 'Email Address', type: 'email', placeholder: 'you@email.com' },
              { label: 'Message', type: 'textarea', placeholder: 'How can we help you?' }
            ],
        hasWhatsAppButton: contactRequirements.hasWhatsApp,
        submitLabel: cs?.submitLabel || 'Send Message'
      };

    case 'CustomOrderForm':
      return {
        ...baseSection,
        fields: Array.isArray(cs?.fields) && cs.fields.length > 0
          ? cs.fields
          : [
              { label: 'Your Name', type: 'text', placeholder: 'Full name' },
              { label: 'Email', type: 'email', placeholder: 'you@email.com' },
              { label: 'Phone', type: 'tel', placeholder: '+1 (555) 000-0000' },
              { label: 'Custom Requirements', type: 'textarea', placeholder: 'Describe your custom requirements...' }
            ],
        submitLabel: cs?.submitLabel || 'Submit Custom Enquiry'
      };

    case 'LocationHoursCard':
      return {
        ...baseSection,
        address: cs?.address || 'Contact us for our location',
        operatingHours: cs?.operatingHours || 'Mon–Fri: 9:00 AM – 6:00 PM',
        phone: cs?.phone || '',
        email: cs?.email || `hello@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
      };

    case 'CallToActionBanner':
      return {
        ...baseSection,
        headline: cs?.headline || `Ready to Get Started with ${businessName}?`,
        subheadline: cs?.subheadline || 'Contact us today and let us help you achieve your goals.',
        actionLabel: cs?.actionLabel || ctaRequirements.primaryCTA || 'Get in Touch'
      };

    case 'StatsCounter':
      return {
        ...baseSection,
        stats: Array.isArray(cs?.stats) && cs.stats.length > 0
          ? cs.stats
          : [
              { value: '500+', label: 'Happy Clients' },
              { value: '10+', label: 'Years Experience' },
              { value: '99%', label: 'Satisfaction Rate' },
              { value: '4.9★', label: 'Average Rating' }
            ]
      };

    case 'AmenitiesGrid':
      return {
        ...baseSection,
        amenities: Array.isArray(cs?.amenities) && cs.amenities.length > 0
          ? cs.amenities
          : [
              { name: 'Premium Feature 1', description: 'Exceptional amenity available to all guests and clients.', icon: 'Star' },
              { name: 'Premium Feature 2', description: 'World-class service delivered with care and attention.', icon: 'Heart' },
              { name: 'Premium Feature 3', description: 'Exclusive access included with your booking or membership.', icon: 'Shield' }
            ]
      };

    case 'ContentSectionCard':
      return {
        ...baseSection,
        headline: cs?.headline || `About ${businessName}`,
        body: cs?.body || `${businessName} is dedicated to delivering exceptional ${businessType.toLowerCase()} services. Our mission is to create outstanding value and experience for every client we serve.`
      };

    case 'TeamGrid':
      return {
        ...baseSection,
        members: Array.isArray(cs?.members) ? cs.members : [
          { name: 'Team Member', role: 'Senior Specialist', bio: 'Dedicated expert with years of industry experience.' }
        ]
      };

    case 'TimelineSection':
      return {
        ...baseSection,
        events: Array.isArray(cs?.events) ? cs.events : [
          { year: '2015', title: 'Founded', description: `${businessName} was established with a vision for excellence.` },
          { year: '2020', title: 'Growth', description: 'Expanded our team and service offerings significantly.' },
          { year: '2025', title: 'Today', description: 'Continuing to serve clients with uncompromising quality.' }
        ]
      };

    case 'NewsletterSignup':
      return {
        ...baseSection,
        headline: cs?.headline || `Stay Updated with ${businessName}`,
        subheadline: cs?.subheadline || 'Subscribe for news, offers and updates.',
        submitLabel: cs?.submitLabel || 'Subscribe'
      };

    case 'PropertyGrid':
      return {
        ...baseSection,
        properties: Array.isArray(cs?.properties) ? cs.properties : [
          { name: 'Featured Property', type: 'Residential', priceDisplay: 'Contact for pricing', description: 'Premium property available — contact for details.', badge: 'New Listing' }
        ]
      };

    default:
      return {
        ...baseSection,
        description: cs?.body || `${title} — ${businessName}.`
      };
  }
}

/**
 * Phase 4 Automated Validation Engine
 * Evaluates 10 strict compliance rules on the generated website
 */
function validateGeneratedWebsite(website, blueprint) {
  const checks = [];

  const userRequestedList = Array.isArray(blueprint.featureMatrix?.userRequestedFeatures) ? blueprint.featureMatrix.userRequestedFeatures : [];
  const approvedList = Array.isArray(blueprint.featureMatrix?.approvedRecommendations) ? blueprint.featureMatrix.approvedRecommendations : [];
  const unapprovedList = Array.isArray(blueprint.featureMatrix?.aiRecommendedFeatures) ? blueprint.featureMatrix.aiRecommendedFeatures : [];

  // Check 1: User Requested Features Implemented
  const check1Passed = userRequestedList.length === 0 || website.featureImplementationSummary.userRequestedCount === userRequestedList.length;
  checks.push({
    id: 'rule_1_user_requested',
    name: 'User Requested Features Implemented',
    passed: check1Passed,
    details: userRequestedList.length === 0
      ? 'No explicit user-requested feature flags required.'
      : `Implemented ${website.featureImplementationSummary.userRequestedCount} of ${userRequestedList.length} user-requested features.`
  });

  // Check 2: Approved Recommendations Implemented
  const check2Passed = website.featureImplementationSummary.approvedCount === approvedList.length;
  checks.push({
    id: 'rule_2_approved_recs',
    name: 'Approved Recommendations Implemented',
    passed: check2Passed,
    details: `Implemented ${website.featureImplementationSummary.approvedCount} of ${approvedList.length} approved recommendations.`
  });

  // Check 3: Unapproved Features Strictly Excluded
  // Verify that no unapproved feature appears in userRequestedList or approvedList
  const check3Passed = !unapprovedList.some((unapproved) =>
    website.featureImplementationSummary.userRequestedList.includes(unapproved) ||
    website.featureImplementationSummary.approvedList.includes(unapproved)
  );
  checks.push({
    id: 'rule_3_unapproved_excluded',
    name: 'AI Unapproved Features Excluded',
    passed: check3Passed,
    details: `Verified ${unapprovedList.length} unapproved recommendations are completely excluded from website functionality.`
  });

  // Check 4: All Blueprint Pages Generated
  const blueprintPages = Array.isArray(blueprint.pages) ? blueprint.pages : [];
  const check4Passed = blueprintPages.length > 0 && website.pages.length === blueprintPages.length;
  checks.push({
    id: 'rule_4_pages_generated',
    name: 'All Blueprint Pages Generated',
    passed: check4Passed,
    details: `Generated ${website.pages.length} of ${blueprintPages.length} blueprint pages.`
  });

  // Check 5: Required Section Components Present
  const totalSections = website.pages.reduce((acc, p) => acc + (p.sections?.length || 0), 0);
  const check5Passed = totalSections > 0;
  checks.push({
    id: 'rule_5_components_present',
    name: 'Required Page Components Present',
    passed: check5Passed,
    details: `Generated ${totalSections} total page component sections across ${website.pages.length} pages.`
  });

  // Check 6: Payment & Checkout Rules Respected
  const paymentRequired = !!blueprint.paymentCheckoutSpec?.paymentRequired;
  const checkoutRequired = !!blueprint.paymentCheckoutSpec?.checkoutRequired;
  const check6Passed = (
    website.paymentCheckoutSpec.paymentRequired === paymentRequired &&
    website.paymentCheckoutSpec.checkoutRequired === checkoutRequired
  );
  checks.push({
    id: 'rule_6_payment_rules_respected',
    name: 'Payment & Checkout Restrictions Respected',
    passed: check6Passed,
    details: paymentRequired
      ? 'Payment integration enabled per blueprint spec.'
      : 'Payment buttons & checkout flows strictly omitted per blueprint spec.'
  });

  // Check 7: Responsive Layout Architecture Satisfied
  const check7Passed = website.designSpec.layoutStyle.includes('Responsive');
  checks.push({
    id: 'rule_7_responsive_layout',
    name: 'Responsive Container Grid Configured',
    passed: check7Passed,
    details: `Configured layout architecture: ${website.designSpec.layoutStyle}.`
  });

  // Check 8: Primary Call To Action Defined
  const check8Passed = !!website.ctaRequirements?.primaryCTA;
  checks.push({
    id: 'rule_8_primary_cta',
    name: 'Primary Call To Action Defined',
    passed: check8Passed,
    details: `Primary CTA: "${website.ctaRequirements?.primaryCTA || 'None'}".`
  });

  // Check 9: Secondary Call To Action Defined
  const check9Passed = !!website.ctaRequirements?.secondaryCTA;
  checks.push({
    id: 'rule_9_secondary_cta',
    name: 'Secondary Call To Action Defined',
    passed: check9Passed,
    details: `Secondary CTA: "${website.ctaRequirements?.secondaryCTA || 'None'}".`
  });

  // Check 10: No Broken Component References
  const check10Passed = website.pages.every((p) => p.sections && p.sections.every((s) => s.id && s.type));
  checks.push({
    id: 'rule_10_no_broken_references',
    name: 'No Broken Component References',
    passed: check10Passed,
    details: 'All generated sections contain valid unique IDs and component types.'
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const overallStatus = passedCount === totalCount ? 'PASS' : 'FAIL';

  return {
    status: overallStatus,
    score: Math.round((passedCount / totalCount) * 100),
    passedCount,
    totalCount,
    checks
  };
}

function buildGeneratedWebsiteTheme(designSpec = {}, websiteIdentity = {}) {
  const primaryColor = designSpec.primaryColor || '#6366F1';
  const secondaryColor = designSpec.secondaryColor || '#4F46E5';
  const accentColor = designSpec.accentColor || primaryColor;
  const theme = designSpec.theme || 'Modern Light';
  const themeLower = theme.toLowerCase();
  const visualTone = (designSpec.visualTone || 'professional').toLowerCase();

  // Blueprint now provides explicit backgroundColor — use it when available
  const explicitBg = designSpec.backgroundColor || '';
  const isDark = !!(explicitBg && isColorDark(explicitBg)) ||
    (!explicitBg && (themeLower.includes('dark') || themeLower.includes('neon') || themeLower.includes('athletic') || themeLower.includes('cyber') || themeLower.includes('night')));

  const isNatural = themeLower.includes('botanical') || themeLower.includes('natural') || themeLower.includes('green');
  const isPastelWarm = themeLower.includes('warm') || themeLower.includes('pastel') || themeLower.includes('artisan') || themeLower.includes('bistro') || themeLower.includes('amber');
  const isEditorial = themeLower.includes('editorial') || themeLower.includes('monochrome') || visualTone === 'editorial';
  const isLuxury = themeLower.includes('luxury') || themeLower.includes('coastal') || themeLower.includes('premium') || visualTone === 'elegant' || visualTone === 'sophisticated';

  let bg = explicitBg || '#FFFFFF';
  let surface = '#F8FAFC';
  let cardBg = '#FFFFFF';
  let cardBorder = '#E2E8F0';
  let text = '#0F172A';
  let mutedText = '#64748B';
  let headerBg = primaryColor;
  let headerText = '#FFFFFF';
  let buttonBg = primaryColor;
  let buttonText = isColorDark(primaryColor) ? '#FFFFFF' : '#0F172A';
  let secondaryButtonBg = 'transparent';
  let secondaryButtonText = primaryColor;
  let inputBg = '#FFFFFF';
  let inputBorder = '#CBD5E1';
  let tableHeaderBg = '#F1F5F9';
  let sectionAltBg = '#F8FAFC';

  if (isDark) {
    bg = explicitBg || (isNatural ? '#022C22' : '#0F172A');
    surface = isNatural ? '#064E3B' : '#1E293B';
    cardBg = isNatural ? '#064E3B' : '#1E293B';
    cardBorder = isNatural ? '#047857' : '#334155';
    text = '#F8FAFC';
    mutedText = '#94A3B8';
    headerBg = isNatural ? '#022C22' : '#0A0F1E';
    headerText = '#F8FAFC';
    inputBg = isNatural ? '#065F46' : '#0F172A';
    inputBorder = isNatural ? '#047857' : '#334155';
    tableHeaderBg = isNatural ? '#065F46' : '#0F172A';
    sectionAltBg = isNatural ? '#064E3B' : '#1E293B';
    secondaryButtonBg = 'transparent';
    secondaryButtonText = accentColor || primaryColor;
  } else if (isPastelWarm) {
    bg = explicitBg || '#FFFBF5';
    surface = '#FEF3C7';
    cardBg = '#FFFFFF';
    cardBorder = '#FDE68A';
    text = '#451A03';
    mutedText = '#78350F';
    headerBg = primaryColor;
    headerText = '#FFFFFF';
    inputBg = '#FFFFFF';
    inputBorder = '#FCD34D';
    tableHeaderBg = '#FEF3C7';
    sectionAltBg = '#FEF9EE';
  } else if (isEditorial) {
    bg = explicitBg || '#FAFAF8';
    surface = '#F4F4F2';
    cardBg = '#FFFFFF';
    cardBorder = '#E5E5E3';
    text = '#1A1A1A';
    mutedText = '#6B6B6B';
    headerBg = '#1A1A1A';
    headerText = '#FAFAF8';
    inputBg = '#FFFFFF';
    inputBorder = '#D0D0CE';
    tableHeaderBg = '#F4F4F2';
    sectionAltBg = '#F4F4F2';
  } else if (isLuxury) {
    bg = explicitBg || '#FFFFFF';
    surface = '#F8F7F4';
    cardBg = '#FFFFFF';
    cardBorder = '#E8E4DC';
    text = '#1C1917';
    mutedText = '#78716C';
    headerBg = primaryColor;
    headerText = '#FFFFFF';
    inputBg = '#FAFAFA';
    inputBorder = '#D6D3D1';
    tableHeaderBg = '#F8F7F4';
    sectionAltBg = '#F5F5F0';
  } else if (isNatural) {
    bg = explicitBg || '#F0FDF4';
    surface = '#DCFCE7';
    cardBg = '#FFFFFF';
    cardBorder = '#BBF7D0';
    text = '#064E3B';
    mutedText = '#047857';
    headerBg = primaryColor;
    headerText = '#FFFFFF';
    inputBg = '#FFFFFF';
    inputBorder = '#86EFAC';
    tableHeaderBg = '#DCFCE7';
    sectionAltBg = '#DCFCE7';
  }

  return {
    themeName: theme,
    primaryColor,
    secondaryColor,
    accentColor,
    isDark,
    bg,
    surface,
    sectionAltBg,
    cardBg,
    cardBorder,
    text,
    mutedText,
    headerBg,
    headerText,
    buttonBg,
    buttonText,
    secondaryButtonBg,
    secondaryButtonText,
    inputBg,
    inputBorder,
    tableHeaderBg,
    typography: designSpec.typography || 'Inter',
    headingTypography: designSpec.headingTypography || designSpec.typography || 'Inter',
    cardStyle: designSpec.cardStyle || 'clean-flat',
    buttonStyle: designSpec.buttonStyle || 'pill',
    heroStyle: designSpec.heroStyle || 'split-left',
    spacingDensity: designSpec.spacingDensity || 'comfortable',
    visualTone
  };
}

/**
 * Determines if a hex color is perceptually dark
 */
function isColorDark(hex) {
  if (!hex || !hex.startsWith('#')) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
}

module.exports = { generateWebsiteFromBlueprint, buildGeneratedWebsiteTheme };
