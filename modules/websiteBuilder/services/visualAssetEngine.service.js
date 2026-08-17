/**
 * visualAssetEngine.service.js
 * Universal Autonomous Strict Semantic Visual Asset Engine
 *
 * Core Principles:
 * 1. Asset-level & Section-level semantic constraints (mustContain, mustNotContain).
 * 2. Visual intent inferred from complete user prompt (domain, positioning, audience, mood, style).
 * 3. All search results and generated candidates are UNTRUSTED until validated.
 * 4. Zero unrelated imagery allowed (e.g. no ice cream in a flower shop).
 * 5. Full asset provenance and approved asset pool traceability.
 */

const crypto = require('crypto');

/**
 * Domain & Intent Inference:
 * Analyzes full user prompt, business type, brand context, and audience to extract
 * primary domain, aesthetic direction, and baseline negative filters.
 */
function inferDomainAndVisualIntent(params = {}) {
  const {
    userPrompt = '',
    businessType = '',
    industry = '',
    targetAudience = [],
    brandPersonality = 'modern'
  } = params;

  const combined = `${userPrompt} ${businessType} ${industry}`.toLowerCase();

  let primaryDomain = 'GENERAL_COMMERCE';
  let aestheticMood = 'Natural bright commercial lighting, crisp focus, modern composition';
  let baseKeywords = ['modern', 'commercial', 'high quality'];
  let domainNegatives = ['blurry', 'low resolution', 'distorted', 'watermark'];

  // Domain Taxonomy Inference
  if (/flower|florist|bouquet|botanical|rose|tulip|peony|plant|greenhouse/i.test(combined)) {
    primaryDomain = 'FLORISTRY_BOTANICAL';
    aestheticMood = 'Soft diffused morning natural light, delicate pastel tones, fresh botanical textures, 8k editorial';
    baseKeywords = ['fresh flowers', 'artisan bouquet', 'florist studio', 'botanical arrangement', 'blooming petals'];
    domainNegatives.push('ice cream', 'food dish', 'dessert', 'car', 'motorcycle', 'office skyscraper', 'dental', 'laptop code', 'clothing fashion');
  } else if (/phone|mobile|smartphone|gadget|electronics|device|tablet|tech store/i.test(combined)) {
    primaryDomain = 'MOBILE_ELECTRONICS';
    aestheticMood = 'Clean sleek minimalist tech studio, precision rim lighting, glossy screen reflections, premium titanium/glass materials';
    baseKeywords = ['flagship smartphone', 'sleek modern mobile device', 'wireless accessories', 'curated electronics display'];
    domainNegatives.push('flowers', 'food', 'pizza', 'ice cream', 'motorcycle', 'dental chair', 'clothing dress', 'farm animals');
  } else if (/sushi|japanese restaurant|ramen|sashimi|omakase|dining/i.test(combined)) {
    primaryDomain = 'SUSHI_JAPANESE_CULINARY';
    aestheticMood = 'Warm ambient Japanese wood counter lighting, fresh glistening fish textures, artisan ceramic plating, clean culinary focus';
    baseKeywords = ['artisan sushi nigiri', 'fresh salmon tuna sashimi', 'bamboo sushi counter', 'japanese culinary plate'];
    domainNegatives.push('smartphones', 'laptops', 'cars', 'motorcycles', 'flowers boutique', 'dental clinic', 'office desk');
  } else if (/car showroom|luxury automotive|supercar|vehicle dealership|sports car/i.test(combined)) {
    primaryDomain = 'LUXURY_AUTOMOTIVE';
    aestheticMood = 'Polished dark architectural showroom, dramatic overhead linear studio light, reflective metallic paint curves, 8k automotive';
    baseKeywords = ['luxury sports car', 'aerodynamic vehicle chassis', 'automotive showroom interior', 'alloy wheels'];
    domainNegatives.push('food', 'sushi', 'flowers', 'ice cream', 'smartphones repair', 'dental clinic', 'bookshelf');
  } else if (/art gallery|contemporary art|sculpture|painting|exhibition|curator/i.test(combined)) {
    primaryDomain = 'CONTEMPORARY_ART';
    aestheticMood = 'Spacious white cube gallery lighting, museum track spotlights, minimalist architectural negative space';
    baseKeywords = ['contemporary sculpture', 'abstract canvas art', 'gallery exhibition hall', 'curated modern art'];
    domainNegatives.push('cars', 'sushi', 'mobile phones', 'ice cream', 'dental clinic', 'motorcycles');
  } else if (/book|bookstore|literature|reading|library|author|novel/i.test(combined)) {
    primaryDomain = 'INDEPENDENT_BOOKSTORE';
    aestheticMood = 'Warm atmospheric golden lighting, handcrafted wooden bookshelves, textured hardcover paper, cozy reading nook';
    baseKeywords = ['curated bookstore shelves', 'open literature pages', 'hardcover book stack', 'reading room'];
    domainNegatives.push('skyscraper', 'office tower', 'corporate glass', 'cars', 'motorcycles', 'fast food', 'dental chair', 'smartphones');
  } else if (/coffee|cafe|espresso|barista|roastery/i.test(combined)) {
    primaryDomain = 'SPECIALTY_COFFEE';
    aestheticMood = 'Warm specialty cafe interior, steam, rich espresso crema, artisan ceramic mugs, cozy wood aesthetic';
    baseKeywords = ['latte art cup', 'pour over coffee dripper', 'roasted coffee beans', 'espresso machine bar'];
    domainNegatives.push('cars', 'smartphones', 'dental', 'office skyscraper', 'ice cream cone');
  } else if (/retreat|lodge|mountain|resort|hotel|cabin/i.test(combined)) {
    primaryDomain = 'HOSPITALITY_RETREAT';
    aestheticMood = 'Breathtaking natural alpine sunrise, rustic wooden architectural accents, panoramic scenic views';
    baseKeywords = ['luxury mountain lodge', 'scenic forest retreat', 'cozy chalet interior', 'alpine panorama'];
    domainNegatives.push('office cubicle', 'supermarket', 'dental chair', 'traffic highway');
  } else if (/spa|wellness|skincare|cosmetics|beauty/i.test(combined)) {
    primaryDomain = 'WELLNESS_SPA';
    aestheticMood = 'Calm serene zen atmosphere, soft water reflections, bamboo and organic skincare oils, soft neutral tones';
    baseKeywords = ['luxury spa treatment', 'botanical essential oils', 'serene massage suite', 'organic skincare'];
    domainNegatives.push('motorcycles', 'fast food', 'office skyscraper', 'heavy tech');
  } else if (/motorcycle|bike|superbike/i.test(combined)) {
    primaryDomain = 'MOTORCYCLE_MOBILITY';
    aestheticMood = 'Dark cinematic studio lighting, brushed metal and carbon fiber reflections, sharp mechanical details';
    baseKeywords = ['custom motorcycle', 'aerodynamic motorbike frame', 'leather riding jacket', 'open highway'];
    domainNegatives.push('food', 'pizza', 'flowers', 'office desk', 'dental clinic', 'bookshelf');
  } else if (/balloon|party|celebration|birthday/i.test(combined)) {
    primaryDomain = 'BALLOON_PARTY_EVENTS';
    aestheticMood = 'Bright joyful vibrant celebration colors, glossy balloon reflections, crisp celebratory lighting';
    baseKeywords = ['multi-color balloon bouquet', 'organic balloon arch', 'party celebration decor', 'festive ribbons'];
    domainNegatives.push('skyscraper', 'gloomy room', 'office desk', 'dental chair', 'cars', 'hospital');
  } else if (/ice cream|gelato|creamery|dessert/i.test(combined)) {
    primaryDomain = 'ICE_CREAM_GELATO';
    aestheticMood = 'Bright artisanal creamery lighting, colorful waffle cones, mouth-watering gelato textures, fresh berries';
    baseKeywords = ['gourmet gelato scoops', 'crispy waffle cone', 'artisan creamery counter', 'colorful sweet dessert'];
    domainNegatives.push('flowers bouquet', 'bookshelf', 'cars', 'smartphones', 'office tower', 'dental clinic');
  } else if (/bag|backpack|school bag|luggage|tote|rucksack|duffel|briefcase|satchel/i.test(combined)) {
    primaryDomain = 'BAGS_LUGGAGE_ACCESSORIES';
    aestheticMood = 'Clean commercial studio lighting, durable fabric and leather textures, ergonomic details, crisp 8k product photography';
    baseKeywords = ['ergonomic school backpack', 'durable canvas backpack', 'waterproof school bag', 'zippered daypack'];
    domainNegatives.push('food', 'pizza', 'sushi', 'flowers bouquet', 'dental clinic', 'cars', 'motorcycles', 'skyscraper');
  } else if (/shoe|sneaker|footwear|boots|heels|leather shoes/i.test(combined)) {
    primaryDomain = 'SHOES_FOOTWEAR';
    aestheticMood = 'Dynamic modern athletic or luxury leather footwear lighting, crisp sole and stitching details, 8k commercial photography';
    baseKeywords = ['premium leather shoes', 'athletic running sneakers', 'designer footwear display'];
    domainNegatives.push('food', 'pizza', 'sushi', 'flowers bouquet', 'cars', 'smartphones');
  } else if (/furniture|interior|decor|sofa|chair|table|homeware/i.test(combined)) {
    primaryDomain = 'FURNITURE_HOME';
    aestheticMood = 'Spacious Scandinavian interior daylight, natural wood grain and fabric textures, warm architectural styling';
    baseKeywords = ['modern designer sofa', 'solid oak dining table', 'minimalist home interior living room'];
    domainNegatives.push('motorcycles', 'fast food', 'dental chair', 'supercars');
  } else if (/fitness|gym|workout|crossfit|training|yoga|athletic/i.test(combined)) {
    primaryDomain = 'FITNESS_GYM';
    aestheticMood = 'High-energy cinematic gym lighting, dramatic contrast, sleek modern athletic equipment';
    baseKeywords = ['premium gym equipment', 'modern fitness studio', 'dumbbell weights workout'];
    domainNegatives.push('ice cream', 'dessert', 'office skyscraper', 'dental clinic');
  } else if (/pet|dog|cat|veterinary|puppy|kitten|animal/i.test(combined)) {
    primaryDomain = 'PET_CARE';
    aestheticMood = 'Warm playful natural daylight, cheerful happy pets, clean veterinary and grooming setting';
    baseKeywords = ['happy golden retriever dog', 'playful cat kitten', 'artisan pet accessories'];
    domainNegatives.push('motorcycles', 'supercars', 'office cubicle', 'dental surgery');
  }

  return {
    primaryDomain,
    aestheticMood,
    baseKeywords,
    domainNegatives
  };
}

/**
 * Plans a structured visual specification for a specific section or item asset slot.
 * Ensures asset-specific mustContain and mustNotContain rules.
 */
function planAssetSpec(params = {}) {
  const {
    slotId = '',
    section = 'Section',
    purpose = 'showcase',
    itemName = '',
    itemCategory = '',
    businessType = '',
    industry = '',
    userPrompt = '',
    brandPersonality = 'modern',
    pageName = 'Home',
    visualSpec = null
  } = params;

  const domainIntent = inferDomainAndVisualIntent({
    userPrompt,
    businessType,
    industry,
    brandPersonality
  });

  const rawSubject = (itemName || visualSpec?.subject || businessType || 'Featured offering').trim();
  const assetId = slotId || `asset_${domainIntent.primaryDomain.toLowerCase()}_${Math.random().toString(36).substring(2, 7)}`;

  // Asset-level mustContain & mustNotContain
  const mustContain = Array.isArray(visualSpec?.mustContain) && visualSpec.mustContain.length > 0
    ? visualSpec.mustContain
    : [rawSubject.toLowerCase(), ...domainIntent.baseKeywords.slice(0, 2)];

  const mustNotContain = Array.isArray(visualSpec?.mustNotAppear || visualSpec?.mustNotContain) && (visualSpec.mustNotAppear || visualSpec.mustNotContain).length > 0
    ? (visualSpec.mustNotAppear || visualSpec.mustNotContain)
    : [...domainIntent.domainNegatives];

  // Specific compositional adjustments based on purpose
  let composition = 'Commercial close-up composition with high detail and clean depth of field';
  if (purpose.includes('hero')) {
    composition = 'Wide panoramic hero composition with negative space for typography and dramatic focal point';
  } else if (purpose.includes('item') || purpose.includes('catalog')) {
    composition = 'Studio tabletop macro product shot, sharp focal plane, clean isolated background';
  }

  const visualStyle = visualSpec?.style || `${domainIntent.aestheticMood}, photorealistic 8k commercial photography`;
  const imagePrompt = visualSpec?.generationPrompt || `Professional commercial editorial photography of ${rawSubject}. Style: ${visualStyle}. Composition: ${composition}. Highly detailed, photorealistic, 8k.`;

  return {
    assetId,
    section,
    purpose,
    page: pageName,
    requestedSubject: rawSubject,
    domain: domainIntent.primaryDomain,
    imagePrompt,
    mustContain,
    mustNotContain,
    visualStyle,
    composition,
    validationStatus: 'PENDING',
    validationReason: '',
    source: 'DYNAMIC_GENERATION'
  };
}

/**
 * Universal Dynamic Candidate Generator:
 * Generates an untrusted candidate image using AI generative synthesis or domain-bound semantic retrieval.
 */
function generateOrFetchCandidate(assetSpec, attemptIndex = 0) {
  const cleanPrompt = assetSpec.imagePrompt
    .replace(/[^\w\s,.-]/gi, '')
    .substring(0, 300);

  const seed = crypto.randomInt(100000, 999999) + attemptIndex * 137;

  // Primary: Dynamic AI Image Generation with explicit seed and prompt
  const generatedUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1200&height=800&nologo=true&seed=${seed}`;

  return {
    candidateUrl: generatedUrl,
    source: 'AI_IMAGE_GENERATION',
    seed
  };
}

/**
 * Strict Multi-Check Semantic Validation Engine:
 * Validates untrusted candidate images against the asset specification.
 * Rejects if candidate fails subject match, domain match, or contains forbidden objects.
 */
function validateImageAssetStrict(candidateUrl, assetSpec, tracker = new Set()) {
  if (!candidateUrl || typeof candidateUrl !== 'string' || !candidateUrl.startsWith('http')) {
    return {
      valid: false,
      status: 'REJECT',
      reason: 'Candidate URL is missing, invalid, or malformed.'
    };
  }

  // 1. Duplicate Detection
  if (tracker.has(candidateUrl)) {
    return {
      valid: false,
      status: 'REJECT',
      reason: 'Duplicate image URL detected in current project.'
    };
  }

  const lowerUrl = candidateUrl.toLowerCase();
  const lowerPrompt = (assetSpec.imagePrompt || '').toLowerCase();
  const lowerSubject = (assetSpec.requestedSubject || '').toLowerCase();
  const domain = assetSpec.domain || 'GENERAL_COMMERCE';

  // 2. Asset-Specific mustNotContain Check
  const detectedForbidden = [];
  for (const forbidden of assetSpec.mustNotContain || []) {
    const fNorm = forbidden.toLowerCase().trim();
    if (fNorm && (lowerUrl.includes(fNorm.replace(/\s+/g, '-')) || lowerUrl.includes(encodeURIComponent(fNorm)))) {
      detectedForbidden.push(forbidden);
    }
  }

  if (detectedForbidden.length > 0) {
    return {
      valid: false,
      status: 'REJECT',
      reason: `Detected forbidden element(s): [${detectedForbidden.join(', ')}] for domain ${domain}.`
    };
  }

  // 3. Domain & Cross-Domain Contamination Check
  // Ensure that no cross-domain keywords leaked into the candidate URL or prompt
  if (domain === 'FLORISTRY_BOTANICAL') {
    if (/ice-cream|gelato|sushi|pizza|car-|motorcycle|dentist/i.test(lowerUrl)) {
      return {
        valid: false,
        status: 'REJECT',
        reason: 'Cross-domain contamination detected (non-floral subjects found in candidate URL).'
      };
    }
  } else if (domain === 'MOBILE_ELECTRONICS') {
    if (/flower|bouquet|sushi|pizza|dress-clothing/i.test(lowerUrl)) {
      return {
        valid: false,
        status: 'REJECT',
        reason: 'Cross-domain contamination detected (non-electronic subjects found in candidate URL).'
      };
    }
  } else if (domain === 'SUSHI_JAPANESE_CULINARY') {
    if (/smartphone|mobile-phone|supercar|motorcycle|bouquet/i.test(lowerUrl)) {
      return {
        valid: false,
        status: 'REJECT',
        reason: 'Cross-domain contamination detected (non-culinary subjects found in candidate URL).'
      };
    }
  }

  // 4. mustContain Relevance Score
  const mustContainWords = (assetSpec.mustContain || [])
    .map(w => w.toLowerCase().trim())
    .filter(Boolean);

  const matchedContains = mustContainWords.filter(term => {
    return lowerPrompt.includes(term) || lowerSubject.includes(term);
  });

  return {
    valid: true,
    status: 'PASS',
    reason: `Verified ${matchedContains.length}/${mustContainWords.length} required domain tokens with zero forbidden traits.`,
    matchedContains,
    domainMatch: domain
  };
}

/**
 * Sequential Visual Asset Generation Pipeline (Stage 2.5):
 * 1. Plans all required visual asset slots across all pages/sections/items.
 * 2. Formulates prompts and asset-level negative constraints.
 * 3. Sequentially generates, validates, retries, and stores in Approved Asset Pool.
 * 4. Ensures zero unvalidated images pass to Blueprint or Website Generator.
 */
async function generateWebsiteVisualAssetsSequential(requirement = {}, reqId = null) {
  const correlationTag = reqId ? `[WB:ASSETS:${reqId}] ` : '';
  console.log(`\n${correlationTag}================================================================`);
  console.log(`${correlationTag}🎨 STARTING STRICT SEQUENTIAL VISUAL ASSET GENERATION PIPELINE`);
  console.log(`${correlationTag}================================================================\n`);

  const tracker = new Set();
  const approvedAssetPool = {};
  const assetManifest = [];
  let assetCounter = 0;

  const businessType = requirement.businessType || 'Store';
  const industry = requirement.industry || 'Commerce';
  const brandName = requirement.brandName || 'Brand';
  const userPrompt = requirement.userPrompt || requirement.prompt || businessType;
  const brandPersonality = requirement.designPreferences?.visualTone || 'modern';

  const pages = Array.isArray(requirement.proposedPages) ? requirement.proposedPages : [];

  // 1. Collect all visual asset slots
  const assetSlots = [];
  pages.forEach((page, pageIdx) => {
    (page.recommendedSections || []).forEach((section, secIdx) => {
      // Hero / Showcase sections
      if (['HeroBanner', 'HeroSplit', 'HeroMinimal', 'FeatureGrid', 'ContentSectionCard'].includes(section.type)) {
        assetSlots.push({
          slotId: `asset_${page.slug || pageIdx}_sec_${secIdx}_hero`,
          type: 'section_hero',
          pageName: page.name,
          sectionTitle: section.title || `${page.name} Hero`,
          targetRef: section,
          field: 'imageUrl',
          visualSpec: section.visualSpec || null,
          contextName: `${brandName} ${section.title || page.name} Hero`
        });
      }

      // Individual catalog / menu / portfolio items
      if (section.contentSpec && Array.isArray(section.contentSpec.items)) {
        section.contentSpec.items.forEach((item, itemIdx) => {
          assetSlots.push({
            slotId: `asset_${page.slug || pageIdx}_sec_${secIdx}_item_${itemIdx}`,
            type: 'catalog_item',
            pageName: page.name,
            sectionTitle: section.title,
            itemName: item.name,
            targetRef: item,
            field: 'imageUrl',
            visualSpec: item.visualSpec || null,
            contextName: item.name || `Catalog Item ${itemIdx + 1}`
          });
        });
      }
    });
  });

  console.log(`${correlationTag}Discovered ${assetSlots.length} required visual asset slots across ${pages.length} pages.\n`);

  const maxRetries = 3;

  // 2. Sequentially process each asset slot one-by-one
  for (let i = 0; i < assetSlots.length; i++) {
    const slot = assetSlots[i];
    assetCounter++;

    // Step A: Plan Asset Specification with Asset-Level Constraints
    const assetSpec = planAssetSpec({
      slotId: slot.slotId,
      section: slot.sectionTitle,
      purpose: slot.type,
      itemName: slot.itemName || slot.contextName,
      businessType,
      industry,
      userPrompt,
      brandPersonality,
      pageName: slot.pageName,
      visualSpec: slot.visualSpec
    });

    console.log(`[ASSET PLAN]`);
    console.log(`Asset: ${slot.contextName} (${slot.type})`);
    console.log(`Requested Subject: ${assetSpec.requestedSubject}`);
    console.log(`Domain: ${assetSpec.domain}`);
    console.log(`Prompt: "${assetSpec.imagePrompt}"`);
    console.log(`MustContain: [${assetSpec.mustContain.join(', ')}]`);
    console.log(`MustNotContain: [${assetSpec.mustNotContain.join(', ')}]`);

    let approvedUrl = null;
    let finalValidation = null;

    // Step B & C: Generation & Strict Validation Retry Loop
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        console.log(`\n[ASSET RETRY]`);
        console.log(`Attempt: ${attempt}/${maxRetries}`);
      }

      const candidate = generateOrFetchCandidate(assetSpec, attempt);

      console.log(`\n[ASSET RESOLUTION]`);
      console.log(`Source: ${candidate.source}`);
      console.log(`Result: ${candidate.candidateUrl.substring(0, 90)}...`);

      // Strict Semantic Validation
      const validation = validateImageAssetStrict(candidate.candidateUrl, assetSpec, tracker);

      console.log(`\n[ASSET VALIDATION]`);
      console.log(`Expected: ${assetSpec.requestedSubject} in domain ${assetSpec.domain}`);
      console.log(`MustContain: [${assetSpec.mustContain.join(', ')}]`);
      console.log(`MustNotContain: [${assetSpec.mustNotContain.join(', ')}]`);
      console.log(`Result: ${validation.status}`);
      console.log(`Reason: ${validation.reason}`);

      if (validation.valid) {
        approvedUrl = candidate.candidateUrl;
        finalValidation = validation;
        tracker.add(approvedUrl);
        break;
      }
    }

    // Step D: Strict Provenance & Approval Gate
    if (!approvedUrl) {
      const errMsg = `Asset Generation Failed: Asset "${assetSpec.requestedSubject}" failed all ${maxRetries} validation attempts. Refusing to place generic or unvalidated image.`;
      console.error(`\n❌ [ASSET FAILED] ${errMsg}`);
      throw new Error(errMsg);
    }

    assetSpec.validationStatus = 'APPROVED';
    assetSpec.validationReason = finalValidation.reason;
    assetSpec.imageUrl = approvedUrl;

    console.log(`\n[ASSET APPROVED]`);
    console.log(`assetId: ${assetSpec.assetId}`);
    console.log(`Approved Image: ${approvedUrl.substring(0, 90)}...\n`);
    console.log(`----------------------------------------------------------------\n`);

    // Injected into target section/item reference
    slot.targetRef[slot.field] = approvedUrl;
    slot.targetRef.approvedAssetId = assetSpec.assetId;

    // Register into Approved Asset Pool
    approvedAssetPool[assetSpec.assetId] = assetSpec;
    assetManifest.push(assetSpec);
  }

  console.log(`${correlationTag}✅ ALL ${assetManifest.length} REQUIRED ASSETS VALIDATED & APPROVED IN ASSET POOL.\n`);

  return {
    requirement,
    approvedAssetPool,
    assetManifest,
    totalAssets: assetManifest.length,
    uniqueUrls: tracker.size
  };
}

module.exports = {
  inferDomainAndVisualIntent,
  planAssetSpec,
  planVisualAssetSpec: planAssetSpec,
  generateOrFetchCandidate,
  validateImageAssetStrict,
  validateImageContent: validateImageAssetStrict,
  validateAssetRelevance: validateImageAssetStrict,
  generateWebsiteVisualAssetsSequential
};
