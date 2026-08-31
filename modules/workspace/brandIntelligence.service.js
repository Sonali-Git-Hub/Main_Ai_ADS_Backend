const { scrapeBrandWebsite, formatCleanSpacedBrandName } = require('./brandScraper.service');
const { classifyBrandCategory } = require('./brandProcessor.service');
const { runBrandDnaMasterAgent } = require('../brandDnaAgent');
const aiService = require('../../services/aiService');

async function generateBrandDNA(domainUrl, brandNameOverride = '', documentUploadData = null) {
  // Delegate execution to Master Brand DNA Agent Orchestrator Subsystem
  const masterAgentResult = await runBrandDnaMasterAgent(domainUrl, brandNameOverride);
  const scrapedData = masterAgentResult.scrapedMetadata || {};
  const brandName = masterAgentResult.brandName?.value || brandNameOverride || scrapedData.brandName || 'Brand';

  const categoryDetails = classifyBrandCategory(
    scrapedData.domainName || '',
    brandName,
    scrapedData.headings || [],
    scrapedData.metaDescription || '',
    scrapedData.deepContextText || '',
    scrapedData.aboutPageHeadings || [],
    scrapedData.aboutPageText || '',
    scrapedData
  );

  let aiEnrichedData = null;
  let hasVisual = false;

  try {
    const pageImages = (scrapedData.pagesEvidence || [])
      .filter(p => p && p.screenshot && p.screenshot.status === 'SUCCESS' && p.screenshot.base64)
      .map(p => ({
        url: p.url,
        pageType: p.pageType || 'PAGE',
        mimeType: p.screenshot.mimeType || 'image/png',
        base64: p.screenshot.base64
      }));

    hasVisual = pageImages.length > 0;
    console.log(`[AI-MULTIMODAL] Engine: BrandIntelligence | Text evidence: YES | Images attached: ${pageImages.length}`);

    const prompt = `You are an advanced Brand Intelligence Engine enforcing STRICT EVIDENCE GROUNDING.
Your task is to analyze scraped website text AND attached page screenshots for "${brandName}" (${scrapedData.cleanUrl}) and extract factual Brand DNA.

STRICT EVIDENCE GROUNDING RULES (MANDATORY):
1. Use BOTH textual DOM evidence AND attached page screenshots.
2. If evidence is missing or insufficient in both text and screenshots, return null (or [] for arrays). Do NOT fabricate missing facts.
3. For missionStatement & vision: Inspect page text AND sustainability/about page screenshots to observe explicit mission/vision statements or core purpose commitments.
4. For headquarters: Inspect contact/footer page text AND screenshots for complete corporate headquarters addresses (e.g. "Sant'Agata Bolognese, Italy").
5. For parentCompany, industryCategory, businessType: Inspect text & visual branding.

Context from live website scrape:
- Domain: ${scrapedData.domainName || ''}
- Schema Slogan: ${scrapedData.schemaSlogan || 'None'}
- Homepage Headings: ${(scrapedData.headings || []).join(' | ')}
- About Page Headings: ${(scrapedData.aboutPageHeadings || []).join(' | ')}
- About Page Text Excerpt: ${(scrapedData.aboutPageText || '').slice(0, 1500)}
- Contact Page Text Excerpt: ${(scrapedData.contactPageText || '').slice(0, 2000)}
- Deep Multi-Page Context: ${(scrapedData.deepContextText || '').slice(0, 12000)}
${hasVisual ? `\nVISUAL EVIDENCE ATTACHED: Inspect the attached ${pageImages.length} full-rendered page screenshots (including Homepage, About, Contact, Products, Sustainability/Mission) for visual branding, mission/vision banners, and complete headquarters text.` : ''}

Return ONLY a raw valid JSON object with NO markdown formatting:
{
  "companyName": "${brandName}",
  "parentCompany": null,
  "companyFoundedYear": null,
  "brandLaunchYear": null,
  "industryCategory": null,
  "subIndustry": null,
  "businessType": null,
  "headquarters": null,
  "companyDescription": null,
  "tagline": null,
  "missionStatement": null,
  "vision": null,
  "targetAudience": [],
  "coreProductsServices": [],
  "contentPillars": [],
  "competitorLandscape": [],
  "brandValues": []
}`;

    const aiRes = await aiService.generateJSON(prompt, { temperature: 0.1, images: pageImages });
    if (aiRes && typeof aiRes === 'object') {
      aiEnrichedData = aiRes.data || aiRes;
    }
  } catch (err) {
    console.log('AI Brand DNA synthesis failed, using audited evidence model:', err.message);
  }

  // Assembly & Provenance Synchronization
  const aiSource = hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE';

  const indObj = (masterAgentResult.industryCategory?.value && masterAgentResult.industryCategory.sourceType !== 'UNKNOWN')
    ? masterAgentResult.industryCategory
    : (categoryDetails.industryCategory?.value ? categoryDetails.industryCategory : {
        value: aiEnrichedData?.industryCategory || null,
        sourceType: aiEnrichedData?.industryCategory ? aiSource : 'UNKNOWN',
        sourceUrl: scrapedData.cleanUrl || domainUrl,
        evidence: aiEnrichedData?.industryCategory ? 'Synthesized by multimodal AI from page text & screenshots' : 'No industry evidence found',
        confidence: aiEnrichedData?.industryCategory ? 0.85 : 0,
        lastVerified: new Date().toISOString()
      });

  const bTypeObj = (masterAgentResult.businessType?.value && masterAgentResult.businessType.value !== 'D2C E-Commerce Brand')
    ? masterAgentResult.businessType
    : (categoryDetails.businessType?.value && categoryDetails.businessType.value !== 'D2C E-Commerce Brand' ? categoryDetails.businessType : {
        value: aiEnrichedData?.businessType || (masterAgentResult.businessType?.value || categoryDetails.businessType?.value || null),
        sourceType: aiEnrichedData?.businessType ? aiSource : (masterAgentResult.businessType?.sourceType || 'UNKNOWN'),
        sourceUrl: scrapedData.cleanUrl || domainUrl,
        evidence: aiEnrichedData?.businessType ? 'Inferred by multimodal AI from brand model & page screenshots' : 'No business type evidence found',
        confidence: aiEnrichedData?.businessType ? 0.85 : 0,
        lastVerified: new Date().toISOString()
      });

  const hqObj = masterAgentResult.headquarters?.value
    ? masterAgentResult.headquarters
    : (categoryDetails.headquarters?.value ? categoryDetails.headquarters : {
        value: aiEnrichedData?.headquarters || null,
        sourceType: aiEnrichedData?.headquarters ? aiSource : 'UNKNOWN',
        sourceUrl: scrapedData.cleanUrl || domainUrl,
        evidence: aiEnrichedData?.headquarters ? 'Extracted by multimodal AI from contact text & page screenshots' : 'No headquarters address found',
        confidence: aiEnrichedData?.headquarters ? 0.90 : 0,
        lastVerified: new Date().toISOString()
      });

  let rawDesc = masterAgentResult.companyDescription?.value || categoryDetails.companyDescription?.value || aiEnrichedData?.companyDescription || null;
  if (rawDesc && (!indObj.value || indObj.sourceType === 'UNKNOWN') && /operating in the Consumer Products sector|industry-leading company operating in/i.test(rawDesc)) {
    rawDesc = null; // Purge contradictory hallucination
  }

  const descObj = masterAgentResult.companyDescription?.value
    ? masterAgentResult.companyDescription
    : (categoryDetails.companyDescription?.value ? categoryDetails.companyDescription : (
        rawDesc ? { value: rawDesc, sourceType: aiSource, confidence: 0.80, evidence: 'Summarized by AI reasoning from page text & screenshots', lastVerified: new Date().toISOString() }
        : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No company description found in website evidence', lastVerified: new Date().toISOString() }
      ));

  const missionObj = masterAgentResult.missionStatement?.value ? masterAgentResult.missionStatement : (
    categoryDetails.missionStatement?.value ? categoryDetails.missionStatement : (
      aiEnrichedData?.missionStatement ? { value: aiEnrichedData.missionStatement, sourceType: aiSource, confidence: 0.82, evidence: 'Extracted by AI from page text & sustainability/purpose screenshots', lastVerified: new Date().toISOString() }
      : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No mission statement found in website evidence', lastVerified: new Date().toISOString() }
    )
  );

  const visionObj = masterAgentResult.vision?.value ? masterAgentResult.vision : (
    categoryDetails.vision?.value ? categoryDetails.vision : (
      aiEnrichedData?.vision ? { value: aiEnrichedData.vision, sourceType: aiSource, confidence: 0.82, evidence: 'Extracted by AI from page text & vision/strategy screenshots', lastVerified: new Date().toISOString() }
      : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No vision statement found in website evidence', lastVerified: new Date().toISOString() }
    )
  );

  const taglineObj = masterAgentResult.tagline?.value ? masterAgentResult.tagline : (
    scrapedData.schemaSlogan ? { value: scrapedData.schemaSlogan, sourceType: 'OFFICIAL_WEBSITE_SCHEMA', confidence: 0.95, evidence: 'Extracted from JSON-LD schema slogan', lastVerified: new Date().toISOString() }
    : (scrapedData.heroBannerTagline ? { value: scrapedData.heroBannerTagline, sourceType: 'OFFICIAL_WEBSITE', confidence: 0.88, evidence: 'Extracted from official website hero banner', lastVerified: new Date().toISOString() }
    : (aiEnrichedData?.tagline ? { value: aiEnrichedData.tagline, sourceType: aiSource, confidence: 0.82, evidence: 'Extracted by AI from visual page banner/text', lastVerified: new Date().toISOString() }
    : { value: null, sourceType: 'UNKNOWN', confidence: 0, evidence: 'No slogan found in website evidence', lastVerified: new Date().toISOString() }
  )));

  if (aiEnrichedData) {
    console.log(`[FIELD-MULTIMODAL] Field: vision | Value: "${visionObj.value || 'null'}" | Source: ${visionObj.sourceType}`);
    console.log(`[FIELD-MULTIMODAL] Field: industryCategory | Value: "${indObj.value || 'null'}" | Source: ${indObj.sourceType}`);
    console.log(`[FIELD-MULTIMODAL] Field: businessType | Value: "${bTypeObj.value || 'null'}" | Source: ${bTypeObj.sourceType}`);
  }

  const targetAudienceValue = (masterAgentResult.targetDemographics && masterAgentResult.targetDemographics.length > 0)
    ? masterAgentResult.targetDemographics
    : (aiEnrichedData?.targetAudience && aiEnrichedData.targetAudience.length > 0 ? aiEnrichedData.targetAudience : []);

  const targetAudienceProvenance = (masterAgentResult.targetDemographics && masterAgentResult.targetDemographics.length > 0)
    ? { value: masterAgentResult.targetDemographics, status: 'INFERRED', sourceType: 'AI_INFERENCE', confidence: 0.85, evidence: 'Synthesized from buyer persona and ICP analysis', lastVerified: new Date().toISOString() }
    : ((aiEnrichedData?.targetAudience && aiEnrichedData.targetAudience.length > 0)
        ? { value: aiEnrichedData.targetAudience, status: 'INFERRED', sourceType: 'AI_INFERENCE', confidence: 0.75, evidence: 'Inferred from catalog headings', lastVerified: new Date().toISOString() }
        : { value: [], status: 'UNKNOWN', sourceType: 'UNKNOWN', confidence: 0, evidence: 'No target audience signals', lastVerified: new Date().toISOString() });

  const coreProductsValue = (masterAgentResult.coreProducts && masterAgentResult.coreProducts.length > 0)
    ? masterAgentResult.coreProducts
    : (aiEnrichedData?.coreProductsServices && aiEnrichedData.coreProductsServices.length > 0 ? aiEnrichedData.coreProductsServices : []);

  const coreProductsProvenance = (masterAgentResult.coreProducts && masterAgentResult.coreProducts.length > 0)
    ? { value: masterAgentResult.coreProducts, status: 'VERIFIED', sourceType: 'OFFICIAL_WEBSITE', confidence: 0.90, evidence: 'Extracted product categories from nav menu & headings', lastVerified: new Date().toISOString() }
    : ((aiEnrichedData?.coreProductsServices && aiEnrichedData.coreProductsServices.length > 0)
        ? { value: aiEnrichedData.coreProductsServices, status: 'INFERRED', sourceType: 'AI_INFERENCE', confidence: 0.80, evidence: 'Extracted from page product headings', lastVerified: new Date().toISOString() }
        : { value: [], status: 'UNKNOWN', sourceType: 'UNKNOWN', confidence: 0, evidence: 'No product headings found', lastVerified: new Date().toISOString() });

  const formattedBrandName = masterAgentResult.brandName?.value || formatCleanSpacedBrandName(categoryDetails.companyName?.value || scrapedData.brandName || brandName);

  // Requirement 5: parentCompany must NEVER default to brandName. Returns null if unknown.
  const parentCompanyValue = masterAgentResult.parentCompany?.value || categoryDetails.parentCompany?.value || aiEnrichedData?.parentCompany || null;
  const parentCompanyObj = parentCompanyValue ? {
    value: parentCompanyValue,
    status: masterAgentResult.parentCompany?.value ? 'VERIFIED' : 'INFERRED',
    sourceType: masterAgentResult.parentCompany?.value ? 'OFFICIAL_WEBSITE_SCHEMA' : 'AI_INFERENCE',
    sourceUrl: scrapedData.cleanUrl || domainUrl,
    evidence: `Extracted parent company: "${parentCompanyValue}"`,
    confidence: masterAgentResult.parentCompany?.value ? 0.95 : 0.75,
    lastVerified: new Date().toISOString()
  } : {
    value: null,
    status: 'UNKNOWN',
    sourceType: 'UNKNOWN',
    sourceUrl: scrapedData.cleanUrl || domainUrl,
    evidence: 'No explicit parent company found in website evidence',
    confidence: 0,
    lastVerified: new Date().toISOString()
  };

  // Requirement 6: Marketing headings are EXTRACTED_CLAIMS with verificationStatus: 'UNVERIFIED'
  const extractedClaimsList = (scrapedData.headings && scrapedData.headings.length > 0)
    ? scrapedData.headings.slice(0, 5).map(h => ({
        claimText: h,
        sourceUrl: scrapedData.cleanUrl || domainUrl,
        sourceType: 'OFFICIAL_WEBSITE',
        evidence: `Scraped heading text from homepage`,
        verificationStatus: 'UNVERIFIED'
      }))
    : [];

  // Requirement 7: Brand Colors visual facts
  const visualBrandColors = (masterAgentResult.brandColors && masterAgentResult.brandColors.length >= 1)
    ? masterAgentResult.brandColors
    : (scrapedData.brandColors || categoryDetails.brandColors || []);

  const dnaResult = {
    brandName: formattedBrandName,
    companyName: formattedBrandName,
    parentCompany: parentCompanyValue, // null if unknown, NEVER brandName
    parentCompanyProvenance: parentCompanyObj,
    domainUrl: scrapedData.cleanUrl || domainUrl,
    logoUrl: masterAgentResult.logoUrl || scrapedData.logoUrl || scrapedData.faviconUrl || '',
    brandColors: visualBrandColors,
    brandColorsProvenance: {
      value: visualBrandColors,
      status: visualBrandColors.length >= 1 ? 'VERIFIED' : 'UNKNOWN',
      sourceType: visualBrandColors.length >= 1 ? 'OFFICIAL_LOGO' : 'UNKNOWN',
      confidence: visualBrandColors.length >= 1 ? 0.90 : 0
    },

    // Provenance & Master Agent Audited Fields
    industry: indObj.value,
    industryCategory: indObj.value,
    subIndustry: categoryDetails.subIndustry?.value || aiEnrichedData?.subIndustry || null,
    businessType: bTypeObj.value,
    headquarters: hqObj.value,
    locations: categoryDetails.locations || [],
    companyDescription: descObj.value,
    tagline: taglineObj.value,
    missionStatement: missionObj.value,
    vision: visionObj.value,

    // Strict Provenance Objects
    industryProvenance: indObj,
    secondaryIndustries: categoryDetails.secondaryIndustries || [],
    businessTypeProvenance: bTypeObj,
    headquartersProvenance: hqObj,
    companyDescriptionProvenance: descObj,
    taglineProvenance: taglineObj,
    missionStatementProvenance: missionObj,
    visionProvenance: visionObj,
    targetAudienceProvenance,
    coreProductsServicesProvenance: coreProductsProvenance,

    fieldSources: {
      tagline: taglineObj.sourceType,
      headquarters: hqObj.sourceType,
      industryCategory: indObj.sourceType,
      subIndustry: categoryDetails.subIndustry?.sourceType || 'UNKNOWN',
      businessType: bTypeObj.sourceType,
      companyDescription: descObj.sourceType,
      missionStatement: missionObj.sourceType,
      vision: visionObj.sourceType,
      targetAudience: targetAudienceProvenance.sourceType,
      coreProductsServices: coreProductsProvenance.sourceType
    },

    targetAudience: targetAudienceValue,
    brandVoice: masterAgentResult.brandVoice || (typeof masterAgentResult.brandVoiceTone === 'string' ? masterAgentResult.brandVoiceTone : 'Professional & Authoritative'),
    brandVoiceTone: {
      formalityScore: 3,
      toneKeywords: (Array.isArray(masterAgentResult.voiceAttributes) && masterAgentResult.voiceAttributes.length > 0)
        ? masterAgentResult.voiceAttributes
        : (masterAgentResult.brandVoice ? [masterAgentResult.brandVoice] : ['Professional', 'Authoritative'])
    },
    voiceAttributes: masterAgentResult.voiceAttributes || [],
    brandPromises: masterAgentResult.brandPromises || [],
    coreProductsServices: coreProductsValue,
    contentPillars: (masterAgentResult.contentPillars && masterAgentResult.contentPillars.length > 0)
      ? masterAgentResult.contentPillars
      : (aiEnrichedData?.contentPillars && aiEnrichedData.contentPillars.length > 0
          ? aiEnrichedData.contentPillars
          : (scrapedData.navCategories && scrapedData.navCategories.length > 0 ? scrapedData.navCategories.slice(0, 5) : [])),
    competitorLandscape: aiEnrichedData?.competitorLandscape || [],
    brandValues: (masterAgentResult.brandPromises && masterAgentResult.brandPromises.length > 0)
      ? masterAgentResult.brandPromises
      : (aiEnrichedData?.brandValues || []),
    dosAndDonts: {
      dos: masterAgentResult.doWords || ['Use grounded facts from official evidence', 'Maintain clear professional brand tone'],
      donts: masterAgentResult.dontWords || ['Avoid unverified claims or unsupported statistics', 'Avoid generic marketing buzzwords']
    },
    doWords: masterAgentResult.doWords || ['Use grounded facts from official evidence', 'Maintain clear professional brand tone'],
    dontWords: masterAgentResult.dontWords || ['Avoid unverified claims or unsupported statistics', 'Avoid generic marketing buzzwords'],
    buyerPersonas: masterAgentResult.buyerPersonas || [],
    corePainPoints: masterAgentResult.corePainPoints || [],
    approvedClaims: [], // Only claims verified by explicit approval workflow belong here
    extractedClaims: extractedClaimsList, // Headings with verificationStatus: 'UNVERIFIED'
    tabooTopics: [],
    restrictedClaims: [],
    socialMediaPresence: scrapedData.socialPlatforms || [],
    faviconUrl: masterAgentResult.faviconUrl || scrapedData.faviconUrl || '',
    contactInfo: {
      email: masterAgentResult.contactInfo?.value?.email || scrapedData.emails?.[0] || null,
      phone: masterAgentResult.contactInfo?.value?.phone || scrapedData.phones?.[0] || null,
      location: masterAgentResult.contactInfo?.value?.location || hqObj.value || null
    },
    contactInfoProvenance: {
      value: {
        email: masterAgentResult.contactInfo?.value?.email || scrapedData.emails?.[0] || null,
        phone: masterAgentResult.contactInfo?.value?.phone || scrapedData.phones?.[0] || null,
        location: masterAgentResult.contactInfo?.value?.location || hqObj.value || null
      },
      status: (masterAgentResult.contactInfo?.value?.email || scrapedData.emails?.[0] || masterAgentResult.contactInfo?.value?.phone || scrapedData.phones?.[0]) ? 'VERIFIED' : 'UNKNOWN',
      sourceType: (scrapedData.emails?.[0] || scrapedData.phones?.[0]) ? 'OFFICIAL_WEBSITE' : (masterAgentResult.contactInfo?.sourceType || 'UNKNOWN'),
      confidence: (masterAgentResult.contactInfo?.value?.email || scrapedData.emails?.[0]) ? 0.90 : 0
    },
    evidenceCitations: scrapedData.crawledSources || [],
    pagesEvidence: masterAgentResult.pagesEvidence || scrapedData.pagesEvidence || [],
    confidenceScore: indObj.value ? 95 : 70,
    analysisStatus: scrapedData.isInsufficientEvidence ? 'INSUFFICIENT_EVIDENCE' : 'SUCCESS'
  };

  console.log(`✅ [BRAND-DNA] Setup Complete for "${formattedBrandName}"! (Industry: ${dnaResult.industryCategory} [${dnaResult.industryProvenance?.sourceType}], HQ: ${dnaResult.headquarters} [${dnaResult.headquartersProvenance?.sourceType}])\n`);
  return dnaResult;
}

module.exports = {
  generateBrandDNA
};
