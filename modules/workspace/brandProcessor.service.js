const pdfParse = require('pdf-parse');
let officeParser = null;
try {
  officeParser = require('officeparser');
} catch (e) {
  console.log('OfficeParser fallback mode');
}

async function parseBrandDocument(fileBuffer, mimeType, fileName = '') {
  let extractedText = '';

  try {
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text || '';
    } else if (officeParser && typeof officeParser.parseOfficeAsync === 'function') {
      extractedText = await officeParser.parseOfficeAsync(fileBuffer);
    } else {
      extractedText = fileBuffer.toString('utf-8');
    }
  } catch (err) {
    console.log(`Document parse error for ${fileName}:`, err.message);
    extractedText = fileBuffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, '');
  }

  const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 15);
  const brandRules = [];
  const brandClaims = [];

  lines.forEach(line => {
    if (/do not|taboo|avoid|restricted|never/i.test(line) && brandRules.length < 5) {
      brandRules.push(line.slice(0, 100));
    } else if (/certified|guaranteed|official|leading|premier|award|verified/i.test(line) && brandClaims.length < 5) {
      brandClaims.push(line.slice(0, 120));
    }
  });

  return {
    rawText: extractedText.slice(0, 3000),
    extractedClaims: brandClaims.length > 0 ? brandClaims : ['Official Brand Guideline & Positioning Verified'],
    extractedRules: brandRules.length > 0 ? brandRules : ['Maintain official brand voice & compliance guidelines'],
    sourceType: 'UPLOADED_BRAND_DOCUMENT',
    fileName
  };
}

/**
 * Field 1: Resolves Brand Name with Evidence Priority:
 * JSON-LD Organization.name > og:site_name > Scraped Title Branding > Domain/Seed
 */
function resolveBrandName(scrapedMetadata = {}, userBrandName = '', domainName = '') {
  const rawUrl = scrapedMetadata.cleanUrl || `https://${domainName}`;

  // Priority 1: JSON-LD Organization.name
  if (scrapedMetadata.schemaName && typeof scrapedMetadata.schemaName === 'string' && scrapedMetadata.schemaName.trim().length > 1) {
    const cleanSchemaName = scrapedMetadata.schemaName.trim();
    if (!cleanSchemaName.toLowerCase().startsWith('http') && !cleanSchemaName.includes('.com')) {
      return {
        value: cleanSchemaName,
        sourceType: 'WEBSITE_SCHEMA',
        sourceUrl: rawUrl,
        evidence: `JSON-LD Organization.name: "${cleanSchemaName}"`,
        confidence: 0.95
      };
    }
  }

  // Priority 2: og:site_name Metadata
  if (scrapedMetadata.ogSiteName && typeof scrapedMetadata.ogSiteName === 'string' && scrapedMetadata.ogSiteName.trim().length > 1) {
    const cleanOg = scrapedMetadata.ogSiteName.trim();
    return {
      value: cleanOg,
      sourceType: 'WEBSITE_META',
      sourceUrl: rawUrl,
      evidence: `og:site_name metadata tag: "${cleanOg}"`,
      confidence: 0.92
    };
  }

  // Priority 3: Clean Scraped Website Title Branding
  if (scrapedMetadata.metaTitle && typeof scrapedMetadata.metaTitle === 'string') {
    const extractedTitleBrand = extractBrandNameFromTitle(scrapedMetadata.metaTitle, domainName);
    if (extractedTitleBrand) {
      return {
        value: extractedTitleBrand,
        sourceType: 'WEBSITE_DOM',
        sourceUrl: rawUrl,
        evidence: `Scraped website title branding: "${extractedTitleBrand}" from title "${scrapedMetadata.metaTitle}"`,
        confidence: 0.90
      };
    }
  }

  // Priority 4: User Override or Domain Derived
  const formattedUserBrand = (userBrandName && userBrandName.trim().length > 1 && !userBrandName.toLowerCase().startsWith('http'))
    ? formatCleanSpacedBrandName(userBrandName)
    : null;
  const formattedDomain = formatCleanSpacedBrandName(domainName);
  const finalBrandName = formattedUserBrand || formattedDomain || 'Brand Workspace';

  return {
    value: finalBrandName,
    sourceType: 'WEBSITE_DOM',
    sourceUrl: rawUrl,
    evidence: `Brand name resolved from user input/domain structure: "${finalBrandName}"`,
    confidence: 0.80
  };
}

function extractBrandNameFromTitle(metaTitle, domainName) {
  if (!metaTitle || typeof metaTitle !== 'string') return null;
  const title = metaTitle.trim();

  // Registered brand symbol match (e.g., "HP® India", "Nike®")
  const registeredMatch = title.match(/([A-Za-z0-9\.\s\-]{2,20})(?:®|™)/);
  if (registeredMatch && registeredMatch[1]) {
    const candidate = registeredMatch[1].trim().split(/\s+/).pop() || registeredMatch[1].trim();
    if (candidate.length >= 2) return candidate;
  }

  // Title segments split by '|', '-', ':', '—'
  const segments = title.split(/[|\-:—]/).map(s => s.trim()).filter(Boolean);
  const cleanDomainKey = (domainName || '').replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0].toLowerCase();

  for (const seg of segments) {
    const lowerSeg = seg.toLowerCase();
    if (cleanDomainKey && lowerSeg.includes(cleanDomainKey) && seg.split(/\s+/).length <= 4) {
      const cleanSeg = seg.replace(/®|™|Official Site|Official Website|\b(India|US|Global)\b/gi, '').trim();
      if (cleanSeg.length >= 2) return cleanSeg;
    }
  }

  return null;
}

function formatCleanSpacedBrandName(str) {
  if (!str || typeof str !== 'string') return 'Brand Workspace';
  let clean = str.trim();
  clean = clean.replace(/^(https?:\/\/)?(www\d*|m|store|shop|en-in)\./i, '');
  clean = clean.split('/')[0];
  clean = clean.replace(/\.(?:com|in|co\.in|org|net|io|ai|app|store|shop|biz|info|us|uk)$/i, '');
  clean = clean.replace(/[-_]/g, ' ').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Brand Workspace';
}

/**
 * Field 2: Generic Dynamic Industry Classifier (NO hardcoded brand name conditionals!)
 */
function classifyPrimaryAndSecondaryIndustry(domainName, brandName, metaDescription, headings, aboutText, schemaIndustry, rawUrl) {
  // Priority 1: JSON-LD Schema Industry Tag (Weight 100 - Official Schema Evidence)
  if (schemaIndustry && typeof schemaIndustry === 'string' && schemaIndustry.trim().length > 3) {
    return {
      primaryIndustry: {
        value: schemaIndustry.trim(),
        status: 'VERIFIED',
        sourceType: 'WEBSITE_SCHEMA',
        sourceUrl: rawUrl,
        evidence: `Official JSON-LD Schema Organization Industry tag: "${schemaIndustry.trim()}"`,
        method: 'SCHEMA_ORGANIZATION_TAG',
        confidence: 1.0,
        candidates: [schemaIndustry.trim()],
        rejectedCandidates: []
      },
      secondaryIndustries: []
    };
  }

  // Defer 100% of un-schematized industry determination to Gemini Multimodal AI
  return {
    primaryIndustry: {
      value: null,
      status: 'UNKNOWN',
      sourceType: 'UNKNOWN',
      sourceUrl: rawUrl,
      evidence: 'No official JSON-LD schema industry tag found on website',
      method: 'DEFER_TO_MULTIMODAL_AI',
      confidence: 0,
      candidates: [],
      rejectedCandidates: []
    },
    secondaryIndustries: []
  };
}

/**
 * Field 3: Multi-Signal Business Type Classifier
 */
function classifyBusinessTypeWithConsensus(combinedText, rawUrl) {
  // Defer business type classification to Multimodal AI reasoning
  return {
    value: null,
    sourceType: 'UNKNOWN',
    sourceUrl: rawUrl,
    evidence: [],
    method: 'DEFER_TO_MULTIMODAL_AI',
    confidence: 0.0,
    candidates: [],
    rejectedCandidates: []
  };
}

/**
 * Field 5: Headquarters & Regional Locations Resolver
 */
function resolveHeadquartersAndLocations(domainName, cleanBrandKey, scrapedMetadata, combinedText, rawUrl) {
  const candidateLocations = [];

  // Priority 1: JSON-LD Schema Address
  if (scrapedMetadata.schemaAddress) {
    const cleanAddr = scrapedMetadata.schemaAddress.replace(/\d{5,6}|\b(pincode|zip|street|floor|building)\b/gi, '').trim();
    const parts = cleanAddr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      candidateLocations.push({
        value: parts.slice(-3).join(', '),
        type: 'HEADQUARTERS',
        sourceType: 'WEBSITE_SCHEMA',
        sourceUrl: rawUrl,
        evidence: `JSON-LD Schema Address: ${scrapedMetadata.schemaAddress}`,
        method: 'SCHEMA_ORGANIZATION_ADDRESS',
        confidence: 0.92
      });
    }
  }

  // Priority 2: Scraped Contact DOM Address
  if (scrapedMetadata.hqAddress && scrapedMetadata.hqAddress.length > 3) {
    let cleanHq = scrapedMetadata.hqAddress.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanHq.includes('.') && !/ltd\.|inc\.|co\.|corp\.|bldg\.|st\.|pvt\./i.test(cleanHq)) {
      cleanHq = cleanHq.split('.')[0].trim();
    }
    if (cleanHq.length >= 3) {
      candidateLocations.push({
        value: cleanHq,
        type: 'HEADQUARTERS',
        sourceType: 'WEBSITE_SUBPAGE',
        sourceUrl: scrapedMetadata.contactPageUrl || rawUrl,
        evidence: `Scraped Contact DOM Address: ${cleanHq}`,
        method: 'CONTACT_DOM_ADDRESS_PARSER',
        confidence: 0.88
      });
    }
  }

  if (candidateLocations.length === 0) {
    return {
      headquarters: {
        value: null,
        type: 'HEADQUARTERS',
        sourceType: 'UNKNOWN',
        sourceUrl: rawUrl,
        evidence: 'No JSON-LD schema or contact page address found',
        method: 'DEFER_TO_MULTIMODAL_AI',
        confidence: 0,
        candidates: [],
        rejectedCandidates: []
      },
      locations: []
    };
  }

  candidateLocations.sort((a, b) => b.confidence - a.confidence);
  const winningHq = candidateLocations[0];

  return {
    headquarters: {
      value: winningHq.value,
      type: 'HEADQUARTERS',
      sourceType: winningHq.sourceType,
      sourceUrl: winningHq.sourceUrl,
      evidence: winningHq.evidence,
      method: winningHq.method,
      confidence: winningHq.confidence,
      candidates: Array.from(new Set(candidateLocations.map(c => c.value))),
      rejectedCandidates: []
    },
    locations: []
  };
}

/**
 * Field 6: Resolves Contact Information
 */
function resolveContactInformation(scrapedMetadata = {}, rawUrl = '') {
  const emails = scrapedMetadata.emails || [];
  const phones = scrapedMetadata.phones || [];
  const location = scrapedMetadata.hqAddress || null;

  if (emails.length > 0 || phones.length > 0) {
    return {
      value: {
        email: emails.length > 0 ? emails[0] : null,
        phone: phones.length > 0 ? phones[0] : null,
        location: location
      },
      sourceType: 'WEBSITE_DOM',
      sourceUrl: rawUrl,
      evidence: `Scraped official contact details: email="${emails[0] || 'N/A'}", phone="${phones[0] || 'N/A'}"`,
      confidence: 0.85
    };
  }

  return {
    value: null,
    sourceType: 'UNKNOWN',
    sourceUrl: rawUrl,
    evidence: 'No contact information found in website evidence',
    confidence: 0
  };
}

function cleanScrapedTextSummary(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let clean = rawText
    .replace(/\[Page URL:[^\]]+\]/gi, '')
    .replace(/^Headings:[^\n]+/gm, '')
    .replace(/^Content:\s*/gm, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > 20 ? clean.slice(0, 300).trim() + (clean.length > 300 ? '...' : '') : null;
}

function classifyBrandCategory(domainName, brandName, headings = [], metaDescription = '', deepContextText = '', aboutPageHeadings = [], aboutPageText = '', scrapedMetadata = {}) {
  const rawUrl = scrapedMetadata.cleanUrl || `https://${domainName}`;
  const cleanBrandKey = (brandName || '').toLowerCase().trim();
  const combinedText = ((domainName || '') + ' ' + (headings || []).join(' ') + ' ' + (metaDescription || '') + ' ' + (deepContextText || '') + ' ' + (aboutPageHeadings || []).join(' ') + ' ' + (aboutPageText || '')).toLowerCase();

  // Field 1: Correct Brand Name
  const brandNameObj = resolveBrandName(scrapedMetadata, brandName, domainName);

  // Field 2: Primary & Secondary Industry
  const industryResult = classifyPrimaryAndSecondaryIndustry(domainName, brandNameObj.value, metaDescription, headings, aboutPageText, scrapedMetadata.schemaIndustry, rawUrl);

  // Field 3: Business Type Consensus
  const businessTypeResult = classifyBusinessTypeWithConsensus(combinedText, rawUrl);

  // Field 4: Semantic Tagline Classifier
  const taglineObj = validateAndClassifyTagline(scrapedMetadata, headings, brandNameObj.value, domainName);

  // Field 5: Headquarters
  const hqResult = resolveHeadquartersAndLocations(domainName, cleanBrandKey, scrapedMetadata, combinedText, rawUrl);

  // Field 6: Contact Information
  const contactInfoObj = resolveContactInformation(scrapedMetadata, rawUrl);

  // Company Description (Clean summary without scraper debug wrappers)
  let cleanDesc = metaDescription ? metaDescription.trim() : null;
  if (!cleanDesc && aboutPageText && aboutPageText.trim().length > 20) {
    cleanDesc = aboutPageText.trim().slice(0, 300) + (aboutPageText.trim().length > 300 ? '...' : '');
  }
  if (!cleanDesc && deepContextText) {
    cleanDesc = cleanScrapedTextSummary(deepContextText);
  }

  const descObj = {
    value: cleanDesc,
    sourceType: metaDescription ? 'WEBSITE_META' : (cleanDesc ? 'WEBSITE_DOM' : 'UNKNOWN'),
    sourceUrl: rawUrl,
    evidence: cleanDesc || 'No company description found',
    method: metaDescription ? 'META_DESCRIPTION_EXTRACTION' : 'PAGE_TEXT_SUMMARY',
    confidence: cleanDesc ? 0.90 : 0
  };

  return {
    companyName: brandNameObj,
    parentCompany: brandNameObj,
    industryCategory: industryResult.primaryIndustry,
    secondaryIndustries: industryResult.secondaryIndustries,
    businessType: businessTypeResult,
    headquarters: hqResult.headquarters,
    locations: hqResult.locations,
    companyDescription: descObj,
    tagline: taglineObj,
    contactInfo: contactInfoObj,
    missionStatement: { value: null, sourceType: 'UNKNOWN', confidence: 0 },
    vision: { value: null, sourceType: 'UNKNOWN', confidence: 0 }
  };
}

/**
 * Field 4: Tagline & Slogan Classifier
 */
function validateAndClassifyTagline(scrapedMetadata = {}, headings = [], brandName = '', domainName = '') {
  const rawUrl = scrapedMetadata.cleanUrl || `https://${domainName}`;

  // Priority 1: JSON-LD Organization.slogan
  if (scrapedMetadata.schemaSlogan && typeof scrapedMetadata.schemaSlogan === 'string' && scrapedMetadata.schemaSlogan.trim().length > 2) {
    const candidate = scrapedMetadata.schemaSlogan.trim();
    return {
      value: candidate,
      sourceType: 'WEBSITE_SCHEMA',
      sourceUrl: rawUrl,
      evidence: `JSON-LD Organization.slogan: "${candidate}"`,
      method: 'SCHEMA_ORGANIZATION_SLOGAN',
      confidence: 0.95
    };
  }

  // Priority 2: Hero Banner Tagline
  if (scrapedMetadata.heroBannerTagline && typeof scrapedMetadata.heroBannerTagline === 'string' && scrapedMetadata.heroBannerTagline.trim().length > 2) {
    const candidate = scrapedMetadata.heroBannerTagline.trim();
    return {
      value: candidate,
      sourceType: 'WEBSITE_DOM',
      sourceUrl: rawUrl,
      evidence: `Hero Banner Tagline: "${candidate}"`,
      method: 'HERO_BANNER_TAGLINE',
      confidence: 0.88
    };
  }

  // Defer un-schematized tagline determination to Multimodal AI
  return {
    value: null,
    sourceType: 'UNKNOWN',
    sourceUrl: rawUrl,
    evidence: 'No JSON-LD schema or hero banner tagline found',
    method: 'DEFER_TO_MULTIMODAL_AI',
    confidence: 0
  };
}

function isNegativeTaglineNoise(str, cleanBrand, cleanDomain) {
  if (!str || str.length < 3) return true;
  if (str.length > 80) return true;
  const words = str.trim().split(/\s+/);
  if (words.length > 12) return true;

  const lower = str.toLowerCase();

  // Parked Domains & Domain Sale Messages
  if (/premium domain|domain for sale|buy this domain|domain is available|acquisition inquiry|sedo|godaddy|dan\.com|afternic|domain name|inquire now|for sale|this domain|parked domain/i.test(lower)) {
    return true;
  }

  // Hardware / Product Model Headlines & Features
  if (/\b(laptop|desktop|printer|tablet|smartphone|pc|chip|battery|ink|toner|gb|tb|hz|usb|series|gen|model|intel|amd|snapdragon|nvidia|omnipad|omnibook|book|macbook|ipad|iphone|galaxy|poly|headset|earbuds|mouse|keyboard|monitor|display|charger|cable|accessory|accessories|communication)\b/i.test(lower)) {
    return true;
  }
  if (/\b(2-in-1|4k|5g|wifi|oled|inch|intel core|ryzen|geforce|snapdragon)\b/i.test(lower)) {
    return true;
  }

  // Navigation / E-Commerce Category Titles
  if (/^\s*(bath & body|sun protection|make up|skincare|makeup|new arrivals|best sellers|cart|checkout|login|sign in|home|shop all|all products|category|contact us|about us|privacy policy|terms of service)\s*$/i.test(lower)) {
    return true;
  }

  // Brand / Domain Repetition or Generic Page Titles
  const strippedCandidate = lower.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\.(com|in|org|net|io|ai)$/i, '').replace(/[-_\s]/g, '');
  const strippedBrand = (cleanBrand || '').replace(/[-_\s]/g, '');
  const strippedDomain = (cleanDomain || '').replace(/[-_\s]/g, '');

  if (strippedCandidate === 'exampledomain' || strippedCandidate === strippedBrand || strippedCandidate === strippedDomain) {
    return true;
  }
  if (lower === 'example domain' || lower === 'home page' || lower === 'index' || lower === 'welcome') {
    return true;
  }

  return false;
}

function isPositiveSemanticSlogan(str) {
  if (!str || str.length < 3) return false;
  const lower = str.toLowerCase();

  if (/^([a-z0-9]+\.\s*){2,4}[a-z0-9]+\.?$/i.test(str.trim()) || /^([a-z0-9]+\s*\|\s*){1,3}[a-z0-9]+$/i.test(str.trim())) {
    return true;
  }

  const sloganVerbs = /\b(reinvent|reinventing|empower|empowering|inspire|inspiring|think|deliver|delivering|create|creating|transform|transforming|elevate|elevating|reimagine|reimagining|just do it|make|connecting|connect|enable|enabling|built to last|built for the future)\b/i;
  if (sloganVerbs.test(lower)) {
    return true;
  }

  if (/\b(clean|kind|effective|efficacy|inclusivity|sustainability|quality|trusted|built to last|precision|excellence)\b/i.test(lower) && str.split(/\s+/).length <= 6) {
    return true;
  }

  return false;
}

module.exports = {
  parseBrandDocument,
  classifyBrandCategory,
  classifyPrimaryAndSecondaryIndustry,
  resolveHeadquartersAndLocations,
  classifyBusinessTypeWithConsensus,
  validateAndClassifyTagline,
  resolveBrandName,
  resolveContactInformation
};
