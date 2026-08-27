const { scrapeBrandWebsite, formatCleanSpacedBrandName } = require('./brandScraper.service');
const { classifyBrandCategory } = require('./brandProcessor.service');
const { runBrandDnaMasterAgent } = require('../brandDnaAgent');
const aiService = require('../../services/aiService');

async function generateBrandDNA(domainUrl, brandNameOverride = '', documentUploadData = null) {
  // Delegate execution to Master Brand DNA Agent Orchestrator Subsystem
  const masterAgentResult = await runBrandDnaMasterAgent(domainUrl, brandNameOverride);
  const scrapedData = await scrapeBrandWebsite(domainUrl, brandNameOverride);
  const brandName = masterAgentResult.brandName.value;

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
Your task is to analyze scraped website text for "${brandName}" (${scrapedData.cleanUrl}) and extract factual Brand DNA.

STRICT GROUNDING & PROVENANCE RULES (MANDATORY):
1. DO NOT fabricate, invent, or guess any Brand DNA field.
2. If the scraped web text does NOT explicitly state or strongly support an official Mission or Vision statement, return null for missionStatement and vision!
3. If Industry is unknown or not supported by scraped text, DO NOT invent that the company operates in "Consumer Products" or any generic sector in companyDescription!
4. For companyDescription, summarize ONLY factual details from scraped headings/About text. If scraped text is insufficient, return null.
5. For contactInfo email/phone, return null if not found in scraped HTML. NEVER invent fake support emails like support@domain.com!
6. For targetAudience, coreProductsServices, contentPillars, competitorLandscape, brandValues: summarize ONLY from scraped text evidence. If missing, return empty array [].

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

Return ONLY a raw valid JSON object with NO markdown formatting:
{
  "companyName": "${brandName}",
  "parentCompany": "Legal Parent Company or null if unknown",
  "companyFoundedYear": "4-digit Legal Founding Year or null if unknown",
  "brandLaunchYear": null,
  "industryCategory": "Specific Primary Industry or null if unknown",
  "subIndustry": "Specific Sub-Industry Niche or null if unknown",
  "businessType": "B2C or B2B or D2C or SaaS or null if unknown",
  "headquarters": "City, State/Province, Country or null if unknown",
  "companyDescription": "Factual 2-3 sentence overview from scraped text or null if unknown",
  "tagline": "Official Brand Slogan from scraped text/schema or null if unknown",
  "missionStatement": "Explicit mission statement from scraped text or null if unknown",
  "vision": "Explicit vision statement from scraped text or null if unknown",
  "coreProductsServices": ["Extracted Product 1", "Extracted Product 2"],
  "targetAudience": ["Target Persona 1", "Target Persona 2"],
  "brandVoiceTone": { "formalityScore": 3, "toneKeywords": ["Keyword1", "Keyword2"] },
  "brandValues": ["Value 1", "Value 2"],
  "evidenceCitations": {
    "industry": "Evidence snippet or null",
    "companyDescription": "Evidence snippet or null"
  },
  "competitorLandscape": [],
  "contentPillars": [],
  "brandColors": ["#HEX1", "#HEX2"],
  "contactInfo": { "email": "${scrapedData.emails[0] || null}", "phone": "${scrapedData.phones[0] || null}" }
} `;

    aiEnrichedData = await aiService.generateJSON(prompt);
    if (aiEnrichedData) {
      console.log(`✨ AI Brand DNA Synthesized for "${brandName}" (Tagline: "${aiEnrichedData.tagline || 'None'}")`);
    }
  } catch (err) {
    console.log('AI synthesis note:', err.message);
  }

  // Resolve field values and true provenance sourceTypes
  const indObj = categoryDetails.industryCategory?.value ? categoryDetails.industryCategory : (
    aiEnrichedData?.industryCategory ? { value: aiEnrichedData.industryCategory, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Inferred by AI reasoning from scraped context' } : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No industry evidence found' }
  );

  const hqObj = categoryDetails.headquarters?.value ? categoryDetails.headquarters : (
    aiEnrichedData?.headquarters ? { value: aiEnrichedData.headquarters, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Inferred by AI reasoning from scraped context' } : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No headquarters address found in website evidence or registry' }
  );

  const bTypeObj = categoryDetails.businessType?.value ? categoryDetails.businessType : (
    aiEnrichedData?.businessType ? { value: aiEnrichedData.businessType, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Inferred by AI reasoning from business model signals' } : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No business model evidence found' }
  );

  const tagObj = categoryDetails.tagline?.value ? categoryDetails.tagline : (
    aiEnrichedData?.tagline ? { value: aiEnrichedData.tagline, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Extracted by AI reasoning from homepage slogans' } : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No official slogan found' }
  );

  // SANITIZE & PURGE CONTRADICTORY DESCRIPTION
  let rawDesc = categoryDetails.companyDescription?.value || aiEnrichedData?.companyDescription || null;
  if (rawDesc && (!indObj.value || indObj.sourceType === 'UNKNOWN') && /operating in the Consumer Products sector|industry-leading company operating in/i.test(rawDesc)) {
    rawDesc = null; // Purge contradictory hallucination
  }

  const descObj = categoryDetails.companyDescription?.value ? categoryDetails.companyDescription : (
    rawDesc ? { value: rawDesc, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Summarized by AI reasoning from page content' } : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No company description found in website evidence' }
  );

  const missionObj = categoryDetails.missionStatement?.value ? categoryDetails.missionStatement : (
    aiEnrichedData?.missionStatement ? { value: aiEnrichedData.missionStatement, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Extracted by AI from website text' } : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No mission statement found in website evidence' }
  );

  const visionObj = categoryDetails.vision?.value ? categoryDetails.vision : (
    aiEnrichedData?.vision ? { value: aiEnrichedData.vision, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Extracted by AI from website text' } : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No vision statement found in website evidence' }
  );

  const targetAudienceObj = (aiEnrichedData?.targetAudience && aiEnrichedData.targetAudience.length > 0)
    ? { value: aiEnrichedData.targetAudience, sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Inferred from catalog headings' }
    : { value: [], sourceType: 'UNKNOWN', confidence: 0, evidence: 'No target audience signals' };

  const productsObj = (aiEnrichedData?.coreProductsServices && aiEnrichedData.coreProductsServices.length > 0)
    ? { value: aiEnrichedData.coreProductsServices, sourceType: 'AI_INFERENCE', confidence: 0.80, evidence: 'Extracted from page product headings' }
    : { value: [], sourceType: 'UNKNOWN', confidence: 0, evidence: 'No product headings found' };

  const formattedBrandName = masterAgentResult.brandName?.value || formatCleanSpacedBrandName(categoryDetails.companyName?.value || scrapedData.brandName || brandName);

  const dnaResult = {
    brandName: formattedBrandName,
    companyName: formattedBrandName,
    parentCompany: masterAgentResult.parentCompany?.value || formattedBrandName,
    domainUrl: scrapedData.cleanUrl,
    logoUrl: masterAgentResult.logoUrl || scrapedData.logoUrl || scrapedData.faviconUrl || '',

    // Provenance & Master Agent Audited Fields
    industry: masterAgentResult.industryCategory?.value || indObj.value,
    industryCategory: masterAgentResult.industryCategory?.value || indObj.value,
    primaryIndustry: masterAgentResult.industryCategory || indObj,
    industryProvenance: masterAgentResult.industryCategory || indObj,
    secondaryIndustries: masterAgentResult.secondaryIndustries || categoryDetails.secondaryIndustries || [],

    subIndustry: categoryDetails.subIndustry?.value || null,
    subIndustryProvenance: categoryDetails.subIndustry || { value: null, sourceType: 'UNKNOWN', confidence: 0 },

    businessType: masterAgentResult.businessType?.value || bTypeObj.value,
    businessTypeProvenance: masterAgentResult.businessType || bTypeObj,

    headquarters: masterAgentResult.headquarters?.value || hqObj.value,
    headquartersProvenance: masterAgentResult.headquarters || hqObj,
    locations: categoryDetails.locations || [],

    companyDescription: masterAgentResult.companyDescription?.value || descObj.value,
    companyDescriptionProvenance: masterAgentResult.companyDescription || descObj,

    tagline: masterAgentResult.tagline?.value || tagObj.value,
    taglineProvenance: masterAgentResult.tagline || tagObj,

    missionStatement: missionObj.value,
    missionStatementProvenance: missionObj,

    vision: visionObj.value,
    visionProvenance: visionObj,

    targetAudience: masterAgentResult.targetDemographics || targetAudienceObj.value,
    targetAudienceProvenance: targetAudienceObj,

    coreProductsServices: (masterAgentResult.coreProducts && masterAgentResult.coreProducts.length > 0) ? masterAgentResult.coreProducts : (productsObj.value || []),
    coreProductsServicesProvenance: (masterAgentResult.coreProducts && masterAgentResult.coreProducts.length > 0)
      ? { value: masterAgentResult.coreProducts, sourceType: 'WEBSITE_DOM', confidence: 0.90, evidence: 'Extracted product categories from nav menu & headings' }
      : productsObj,

    buyerPersonas: masterAgentResult.buyerPersonas || [],
    brandVoice: masterAgentResult.brandVoice?.value || 'Professional & Customer-Centric',
    voiceAttributes: masterAgentResult.voiceAttributes || [],
    brandPromises: masterAgentResult.brandPromises || [],
    doWords: masterAgentResult.doWords || [],
    dontWords: masterAgentResult.dontWords || [],
    corePainPoints: masterAgentResult.corePainPoints || [],
    buyingTriggers: masterAgentResult.buyingTriggers || [],
    commonObjections: masterAgentResult.commonObjections || [],
    validationReport: masterAgentResult.validationReport || null,

    brandVoiceTone: {
      formalityScore: 3,
      toneKeywords: masterAgentResult.voiceAttributes || ['Professional', 'Authoritative']
    },
    contentPillars: aiEnrichedData?.contentPillars || [],
    competitorLandscape: aiEnrichedData?.competitorLandscape || [],

    fieldSources: {
      tagline: masterAgentResult.tagline?.sourceType || tagObj.sourceType,
      headquarters: masterAgentResult.headquarters?.sourceType || hqObj.sourceType,
      industryCategory: masterAgentResult.industryCategory?.sourceType || indObj.sourceType,
      subIndustry: categoryDetails.subIndustry?.sourceType || 'UNKNOWN',
      businessType: masterAgentResult.businessType?.sourceType || bTypeObj.sourceType,
      companyDescription: masterAgentResult.companyDescription?.sourceType || descObj.sourceType,
      missionStatement: missionObj.sourceType,
      vision: visionObj.sourceType,
      targetAudience: targetAudienceObj.sourceType,
      coreProductsServices: productsObj.sourceType
    },

    brandColors: (masterAgentResult.brandColors && masterAgentResult.brandColors.length >= 2) ? masterAgentResult.brandColors : (scrapedData.brandColors || categoryDetails.brandColors),
    approvedClaims: (scrapedData.headings && scrapedData.headings.length > 0)
      ? scrapedData.headings.slice(0, 3).map(h => ({ claimText: h, sourceUrl: scrapedData.cleanUrl, verified: true }))
      : [],
    tabooTopics: [],
    restrictedClaims: [],
    socialMediaPresence: scrapedData.socialPlatforms,
    faviconUrl: scrapedData.faviconUrl,
    contactInfo: {
      email: masterAgentResult.contactInfo?.value?.email || scrapedData.emails?.[0] || null,
      phone: masterAgentResult.contactInfo?.value?.phone || scrapedData.phones?.[0] || null,
      location: masterAgentResult.headquarters?.value || hqObj.value || null
    },

    crawledSources: scrapedData.crawledSources,
    confidenceScore: masterAgentResult.industryCategory?.value ? 95 : 70
  };

  console.log(`✅ [BRAND-DNA] Setup Complete for "${formattedBrandName}"! (Industry: ${dnaResult.industryCategory} [${dnaResult.industryProvenance?.sourceType}], HQ: ${dnaResult.headquarters} [${dnaResult.headquartersProvenance?.sourceType}])\n`);
  return dnaResult;
}

module.exports = {
  generateBrandDNA
};
