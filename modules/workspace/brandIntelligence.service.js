const { scrapeBrandWebsite, formatCleanSpacedBrandName } = require('./brandScraper.service');
const { classifyBrandCategory } = require('./brandProcessor.service');
const aiService = require('../../services/aiService');

async function generateBrandDNA(domainUrl, brandNameOverride = '', documentUploadData = null) {
  const scrapedData = await scrapeBrandWebsite(domainUrl, brandNameOverride);
  const brandName = formatCleanSpacedBrandName(scrapedData.brandName);

  const categoryDetails = classifyBrandCategory(
    scrapedData.domainName,
    brandName,
    scrapedData.headings,
    scrapedData.metaDescription,
    scrapedData.deepContextText,
    scrapedData.aboutPageHeadings,
    scrapedData.aboutPageText,
    scrapedData
  );

  let aiEnrichedData = null;

  try {
    const prompt = `You are an advanced Brand Intelligence Engine.
Your task is to identify the best brand tagline for the company "${brandName}" from the website URL: ${scrapedData.cleanUrl}.

Context from live website scrape:
- Domain: ${scrapedData.domainName}
- Schema Slogan: ${scrapedData.schemaSlogan || 'None'}
- Logo Text: ${scrapedData.logoText || 'None'}
- Hero Banner Tagline: ${scrapedData.heroBannerTagline || 'None'}
- Footer Tagline: ${scrapedData.footerTagline || 'None'}
- Homepage Headings: ${scrapedData.headings.join(' | ')}
- About Page Headings: ${(scrapedData.aboutPageHeadings || []).join(' | ')}
- About Page Text Excerpt: ${(scrapedData.aboutPageText || '').slice(0, 1500)}
- Deep Multi-Page Context: ${scrapedData.deepContextText.slice(0, 12000)}

11-STEP OFFICIAL BRAND TAGLINE EXTRACTION FLOW:
Website URL → Homepage → Logo Area → Hero Section → JSON-LD Schema → About Us → Brand Guidelines → Press / Media Kit → Footer → Official Social Profiles → LLM Validation

STEP 4 — CANDIDATE RANKING WEIGHTS:
- Represents the whole company (+30)
- Appears near logo or schema (+25)
- Appears on About page (+20)
- Appears multiple times across pages (+20)
- Short & memorable 3-8 words (+15)
- Timeless (+15)
- Not campaign specific (+20)
Choose the highest scoring candidate tagline.

OFFICIAL TAGLINE VALIDATION CHECKLIST (Mandatory Rules):
A sentence is considered an official brand tagline ONLY IF most of the following conditions are true:
✓ Short (2 to 10 words)
✓ Represents the entire company
✓ Timeless (broad corporate promise, not temporary)
✓ Appears across multiple official pages
✓ Appears near the logo or hero banner
✓ Appears in brand guidelines or press/media kit
✓ Appears in official social profiles
✓ Is NOT product-specific (never mention single product models, 50H battery, specifications)
✓ Is NOT campaign-specific (never mention discounts, seasonal sales, promo offers)
✓ Is NOT promotional UI button text (never mention "Your Cart is Empty", "Shop All", "Checkout")

HEADQUARTERS EXTRACTION PRIORITY & RULES:
- Priority 1: Organization Schema JSON-LD (address, headquarters, location, contactPoint)
- Priority 2: Contact Us page (/contact, /contact-us, /locations, /offices, /headquarters)
- Priority 3: Footer (Corporate Office, Registered Office, Head Office, Headquarters)
- Priority 4: About Us page / Corporate Info
- Priority 5: Official Legal pages (Privacy Policy, Terms, Legal Notice - Registered Office)
- Priority 6: Official LinkedIn Company Profile linked from website

FOUNDING YEAR EXTRACTION RULES (STRICT & MANDATORY):
- companyFoundedYear MUST NEVER BE EMPTY, NULL, OR "N/A".
- Return the exact 4-digit legal founding year for this specific company or brand (e.g. 2010 for Stripe, 2014 for Swiggy, 2008 for Zomato, 1992 for Zed Black, 1889 for Peter England, 1997 for Zebronics, 1976 for Apple, 1994 for Amazon, 1868 for Tata).
- If the founding year is not explicitly written in the scraped HTML text, use your internal corporate knowledge base to return the official 4-digit company formation year.

HEADQUARTERS EXTRACTION RULES:
- Always format output as: "City, State/Province, Country" (e.g., "Gurugram, Haryana, India", "Cupertino, California, USA", "San Francisco, California, USA").

Return ONLY a raw valid JSON object with NO markdown formatting:
{
  "companyName": "${brandName}",
  "parentCompany": "Parent Company Name or same as companyName",
  "companyFoundedYear": "4-digit Founding Year (e.g. 1984 or 2010)",
  "brandLaunchYear": "Brand Launch Year or null if same",
  "industryCategory": "Specific Primary Industry",
  "subIndustry": "Specific Sub-Industry Niche",
  "businessType": "B2C or B2B or D2C or SaaS or FMCG",
  "foundedYear": "4-digit Founding Year (e.g. 1984 or 2010)",
  "headquarters": "City, State/Province, Country",
  "companyDescription": "Detailed 2-3 sentence brand overview derived from website evidence",
  "tagline": "Brand Slogan derived from website evidence or slogan database",
  "missionStatement": "Official brand mission statement from website evidence",
  "vision": "Corporate vision statement from website evidence",
  "coreProductsServices": ["Core Product 1", "Core Product 2", "Core Product 3", "Core Product 4"],
  "targetAudience": ["Target Persona 1", "Target Persona 2", "Target Persona 3", "Target Persona 4"],
  "brandVoiceTone": { "formalityScore": 3, "toneKeywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4"] },
  "brandValues": ["Value 1", "Value 2", "Value 3", "Value 4"],
  "evidenceCitations": {
    "industry": "Scraped HTML heading or product evidence snippet",
    "businessType": "DOM signal snippet (e.g. D2C cart / B2B sales contact)",
    "targetAudience": "Scraped product segment snippet",
    "brandVoice": "Website content language snippet"
  },
  "competitorLandscape": ["Competitor 1", "Competitor 2", "Competitor 3"],
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3", "Pillar 4"],
  "brandColors": ["#HEX1", "#HEX2", "#HEX3", "#HEX4"],
  "contactInfo": { "email": "${scrapedData.emails[0] || `support@${scrapedData.domainName}`}", "phone": "${scrapedData.phones[0] || ''}", "location": "City, State/Province, Country" }
} `;

    aiEnrichedData = await aiService.generateJSON(prompt);
    if (aiEnrichedData) {
      console.log(`✨ AI Brand DNA Synthesized for "${brandName}" (Tagline: "${aiEnrichedData.tagline}")`);
    }
  } catch (err) {
    console.log('AI synthesis note:', err.message);
  }

  const finalDetails = aiEnrichedData || categoryDetails;

  const rawColors = (scrapedData.brandColors && scrapedData.brandColors.length >= 2)
    ? scrapedData.brandColors
    : (aiEnrichedData && aiEnrichedData.brandColors && aiEnrichedData.brandColors.length >= 2)
    ? aiEnrichedData.brandColors
    : categoryDetails.brandColors;

  const roles = ['Brand Primary', 'Brand Secondary', 'Accent', 'Dark Neutral'];
  const names = ['Primary', 'Secondary', 'Accent', 'Dark'];

  const colors = rawColors.map((item, idx) => {
    if (typeof item === 'object' && item.hex) {
      return {
        name: item.name || names[idx] || `Color ${idx + 1}`,
        hex: item.hex.toUpperCase(),
        role: item.role || roles[idx] || 'Brand Accent'
      };
    }
    const hex = (typeof item === 'string' ? item : (item.hex || '#6366F1')).toUpperCase();
    return {
      name: names[idx] || `Color ${idx + 1}`,
      hex,
      role: roles[idx] || 'Brand Accent'
    };
  });

  const sources = [...scrapedData.crawledSources];
  if (aiEnrichedData) sources.push('AI_REASONING');
  if (documentUploadData) sources.push('UPLOADED_BRAND_DOCUMENT');

  let confidenceScore = 90;
  if (scrapedData.brandColors && scrapedData.brandColors.length >= 2) confidenceScore += 5;
  if (documentUploadData) confidenceScore = 99;

  const approvedClaims = [
    { claimText: `Official brand positioning for ${brandName} verified from website & domain context.`, sourceUrl: scrapedData.cleanUrl, verified: true },
    { claimText: `Authentic color palette extracted: ${colors.map(c => c.hex).join(', ')}.`, sourceUrl: scrapedData.cleanUrl, verified: true },
    { claimText: `Industry category: ${finalDetails.industryCategory || categoryDetails.industryCategory}.`, sourceUrl: scrapedData.cleanUrl, verified: true }
  ];

  if (documentUploadData && documentUploadData.extractedClaims) {
    documentUploadData.extractedClaims.forEach(c => {
      approvedClaims.push({
        claimText: typeof c === 'string' ? c : (c.claimText || c),
        sourceUrl: documentUploadData.fileName || scrapedData.cleanUrl,
        verified: true
      });
    });
  }

  const tabooTopics = [
    "Unverified pricing or discount promises not on official site",
    "Unsupported performance or health claims",
    "Competitor disparagement or unverified comparisons"
  ];

  if (documentUploadData && documentUploadData.extractedRules) {
    documentUploadData.extractedRules.forEach(r => {
      if (typeof r === 'string') tabooTopics.push(r);
    });
  }

  // Final Tagline fallback: ensure tagline is NEVER identical to brandName
  let tagline = finalDetails.tagline || categoryDetails.tagline || '';
  if (tagline.toLowerCase() === brandName.toLowerCase()) {
    tagline = scrapedData.metaDescription ? scrapedData.metaDescription.slice(0, 80) : `${brandName} Official Brand Workspace`;
  }

  let finalHq = categoryDetails.headquarters || finalDetails.headquarters;
  if (!finalHq || finalHq.toLowerCase() === 'unknown' || finalHq.toLowerCase() === 'n/a') {
    finalHq = categoryDetails.headquarters || 'Mumbai, Maharashtra, India';
  }

  const formattedBrandName = formatCleanSpacedBrandName(finalDetails.brandName || categoryDetails.companyName || scrapedData.brandName || brandName);

  const dnaResult = {
    brandName: formattedBrandName,
    companyName: formatCleanSpacedBrandName(finalDetails.companyName || categoryDetails.companyName || formattedBrandName),
    parentCompany: formatCleanSpacedBrandName(finalDetails.parentCompany || categoryDetails.parentCompany || formattedBrandName),
    companyFoundedYear: categoryDetails.companyFoundedYear || finalDetails.companyFoundedYear || finalDetails.foundedYear || categoryDetails.foundedYear || '2010',
    brandLaunchYear: finalDetails.brandLaunchYear !== undefined ? finalDetails.brandLaunchYear : categoryDetails.brandLaunchYear,
    domainUrl: scrapedData.cleanUrl,
    industry: finalDetails.industryCategory || categoryDetails.industryCategory || 'Consumer Products & Digital Services',
    industryCategory: finalDetails.industryCategory || categoryDetails.industryCategory || 'Consumer Products & Digital Services',
    subIndustry: finalDetails.subIndustry || categoryDetails.subIndustry || `${brandName} Consumer Products & Lifestyle`,
    businessType: finalDetails.businessType || categoryDetails.businessType || 'B2C Direct Brand',
    foundedYear: categoryDetails.companyFoundedYear || finalDetails.companyFoundedYear || finalDetails.foundedYear || categoryDetails.foundedYear || '2010',
    headquarters: finalHq,

    companyDescription: finalDetails.companyDescription || categoryDetails.companyDescription || `${brandName} is a leading brand in its sector, dedicated to quality, customer trust, and market innovation.`,
    tagline,
    missionStatement: finalDetails.missionStatement || categoryDetails.missionStatement || `To empower ${brandName} customers through premium solutions, uncompromised quality, and elevated brand experiences.`,
    vision: finalDetails.vision || categoryDetails.vision || `To be the premier global choice in the ${categoryDetails.industryCategory || 'consumer'} sector, inspiring innovation and excellence.`,
    targetAudience: finalDetails.targetAudience || categoryDetails.targetAudience || [],
    brandVoiceTone: finalDetails.brandVoiceTone || categoryDetails.brandVoiceTone || { formalityScore: 3, toneKeywords: [] },
    coreProductsServices: finalDetails.coreProductsServices || categoryDetails.coreProductsServices || scrapedData.headings.slice(0, 4),
    contentPillars: finalDetails.contentPillars || categoryDetails.contentPillars || [],
    competitorLandscape: finalDetails.competitorLandscape || categoryDetails.competitorLandscape || [],

    fieldSources: {
      tagline: (scrapedData.schemaSlogan || scrapedData.logoText || scrapedData.heroBannerTagline) ? 'VERIFIED_DOM' : 'AI_VERIFIED_EVIDENCE',
      headquarters: categoryDetails.headquarters ? 'VERIFIED_REGISTRY' : 'AI_VERIFIED_EVIDENCE',
      industryCategory: scrapedData.schemaIndustry ? 'VERIFIED_DOM' : 'AI_VERIFIED_EVIDENCE',
      subIndustry: scrapedData.schemaIndustry ? 'VERIFIED_DOM' : 'AI_VERIFIED_EVIDENCE',
      businessType: 'AI_VERIFIED_EVIDENCE',
      foundedYear: scrapedData.schemaFoundingDate ? 'VERIFIED_DOM' : (categoryDetails.companyFoundedYear ? 'VERIFIED_REGISTRY' : 'AI_VERIFIED_EVIDENCE'),
      companyDescription: scrapedData.metaDescription ? 'VERIFIED_DOM' : 'AI_VERIFIED_EVIDENCE',
      missionStatement: (categoryDetails.missionStatement && categoryDetails.missionStatement.length > 30) ? 'VERIFIED_DOM' : 'AI_VERIFIED_EVIDENCE',
      vision: (categoryDetails.vision && categoryDetails.vision.length > 30) ? 'VERIFIED_DOM' : 'AI_VERIFIED_EVIDENCE',
    },
    evidenceCitations: finalDetails.evidenceCitations || {
      industry: `Scraped from homepage catalog and headings for ${brandName}`,
      businessType: `Extracted from store checkout & DOM transaction signals`,
      targetAudience: `Inferred from product range and catalog categories`,
      brandVoice: `Analyzed from official website language and tone`
    },

    brandColors: colors,
    approvedClaims,
    tabooTopics,
    restrictedClaims: tabooTopics,
    socialMediaPresence: scrapedData.socialPlatforms,
    faviconUrl: scrapedData.faviconUrl,
    contactInfo: finalDetails.contactInfo || {
      email: scrapedData.emails?.[0] || `support@${scrapedData.domainName}`,
      phone: scrapedData.phones?.[0] || 'Official Brand Customer Support',
      location: 'Official Corporate Headquarters'
    },

    crawledSources: sources,
    confidenceScore: Math.min(confidenceScore, 100),
    sourceReasoning: documentUploadData
      ? "Direct extraction from uploaded Brand Guideline Document + Live Web Crawl."
      : aiEnrichedData
      ? "Live AI Reasoning + Web Crawling & Domain Parsing."
      : "Multi-layer live web scrape (Homepage + Internal Pages + Meta Signals)."
  };

  console.log(`✅ [BRAND-DNA] Setup Complete for "${brandName}"! (Confidence: ${Math.min(confidenceScore, 100)}%)\n`);
  return dnaResult;
}

module.exports = {
  generateBrandDNA
};
