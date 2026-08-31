const { generateJSON } = require('../../services/aiService');
const {
  classifyPrimaryAndSecondaryIndustry,
  classifyBusinessTypeWithConsensus,
  resolveHeadquartersAndLocations,
  validateAndClassifyTagline
} = require('../workspace/brandProcessor.service');

async function runPositioningAgent(crawlResult) {
  const { domainName, brandNameObj, scrapedMetadata, combinedText, rawUrl } = crawlResult;
  const brandName = brandNameObj.value || 'Brand';

  console.log(`[PositioningAgent] 📊 Analyzing Market Positioning & Industry for: "${brandName}"`);

  // Field 2: Primary & Secondary Industry (Rule / Schema Parser)
  let industryResult = classifyPrimaryAndSecondaryIndustry(
    domainName,
    brandName,
    scrapedMetadata.metaDescription,
    scrapedMetadata.headings,
    scrapedMetadata.aboutPageText,
    scrapedMetadata.schemaIndustry,
    rawUrl
  );

  let hqResult = resolveHeadquartersAndLocations(domainName, brandName, scrapedMetadata, combinedText, rawUrl);
  let businessTypeResult = classifyBusinessTypeWithConsensus(combinedText, rawUrl);
  let taglineObj = validateAndClassifyTagline(scrapedMetadata, scrapedMetadata.headings, brandName, domainName);
  let missionObj = { value: null, sourceType: 'UNKNOWN', confidence: 0 };
  let visionObj = { value: null, sourceType: 'UNKNOWN', confidence: 0 };

  // If schema tags are missing, use Multimodal AI reasoning for Industry, Business Type, Headquarters, and Tagline
  try {
    const pageImages = (scrapedMetadata.pagesEvidence || [])
      .filter(p => p && p.screenshot && p.screenshot.status === 'SUCCESS' && p.screenshot.base64)
      .map(p => ({
        url: p.url,
        pageType: p.pageType || 'PAGE',
        mimeType: p.screenshot.mimeType || 'image/png',
        base64: p.screenshot.base64
      }));

    const hasVisual = pageImages.length > 0;
    const aiPrompt = `You are an expert Brand Intelligence Analyst.
Analyze the commercial website context, text excerpts, and attached page screenshots for "${brandName}" (${domainName}) to extract core Brand DNA attributes.

CRITICAL INSTRUCTIONS:
1. "primaryIndustry": Exact core commercial industry based on MAIN products/services sold to customers.
2. "secondaryIndustry": Optional secondary industry or null.
3. "businessType": Select the most accurate commercial model (e.g., "Corporate & Industrial Manufacturer", "B2C Consumer Platform", "D2C E-Commerce Brand", "B2B Enterprise & SaaS Platform", "Healthcare & Medical Provider").
4. "headquarters": Physical city, state/province, and country address found in page text/contact/footer screenshots (e.g., "Mumbai, Maharashtra, India", "Palo Alto, California, USA", "Ventura, California, USA"). If no specific location is found, return null.
5. "tagline": Official brand slogan or tagline visible on banner, logo, or page content. If no tagline exists, return null.
6. "missionStatement": Whenever explicit company purpose or mission evidence exists anywhere in page text or screenshots, extract it accurately (e.g. "To improve people's health and well-being through meaningful innovation"). If no reliable mission evidence exists, return null rather than inventing it.
7. "vision": Whenever explicit company long-term vision or future aspiration evidence exists anywhere in page text or screenshots, extract it accurately (e.g. "We aim to improve 2.5 billion lives per year by 2030"). If no reliable vision evidence exists, return null rather than inventing it.

Return ONLY a valid JSON object:
{
  "primaryIndustry": "String",
  "secondaryIndustry": "String or null",
  "businessType": "String",
  "headquarters": "String or null",
  "tagline": "String or null",
  "missionStatement": "String or null",
  "vision": "String or null"
}`;

    const aiRes = await generateJSON(aiPrompt, { temperature: 0.1, images: pageImages });
    console.log(`[PositioningAgent] 🤖 Gemini AI Response for "${brandName}":`, JSON.stringify(aiRes));
    const payload = aiRes?.data || aiRes;

    if (payload) {
      // 1. Industry
      if (!industryResult.primaryIndustry.value || industryResult.primaryIndustry.sourceType !== 'WEBSITE_SCHEMA') {
        const inferredInd = payload.primaryIndustry || payload.industryCategory || payload.industry;
        if (inferredInd && typeof inferredInd === 'string' && inferredInd.trim().length > 2) {
          industryResult.primaryIndustry = {
            value: inferredInd.trim(),
            sourceType: hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE',
            sourceUrl: rawUrl,
            evidence: `Synthesized by multimodal AI positioning analysis of company products & page screenshots`,
            method: 'MULTIMODAL_POSITIONING_AI',
            confidence: 0.88,
            candidates: [inferredInd.trim()],
            rejectedCandidates: []
          };
        }
        if (payload.secondaryIndustry) {
          industryResult.secondaryIndustries = [{
            value: payload.secondaryIndustry,
            sourceType: hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE',
            evidence: 'Identified as secondary industry by AI positioning analysis'
          }];
        }
      }

      // 2. Business Type
      if (payload.businessType && typeof payload.businessType === 'string' && payload.businessType.trim().length > 2) {
        businessTypeResult = {
          value: payload.businessType.trim(),
          sourceType: hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE',
          sourceUrl: rawUrl,
          evidence: `Synthesized by multimodal AI analysis from website context & screenshots`,
          method: 'MULTIMODAL_BUSINESS_TYPE_AI',
          confidence: 0.88
        };
      }

      // 3. Headquarters (If missing from schema/contact DOM)
      if (!hqResult.headquarters.value && payload.headquarters && typeof payload.headquarters === 'string' && payload.headquarters.trim().length > 3) {
        hqResult.headquarters = {
          value: payload.headquarters.trim(),
          type: 'HEADQUARTERS',
          sourceType: hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE',
          sourceUrl: rawUrl,
          evidence: `Extracted location from website evidence & visual page screenshots: "${payload.headquarters.trim()}"`,
          method: 'MULTIMODAL_HQ_AI',
          confidence: 0.88,
          candidates: [payload.headquarters.trim()],
          rejectedCandidates: []
        };
      }

      // 4. Tagline (If missing from schema/banner)
      if (!taglineObj.value && payload.tagline && typeof payload.tagline === 'string' && payload.tagline.trim().length > 2) {
        taglineObj = {
          value: payload.tagline.trim(),
          sourceType: hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE',
          sourceUrl: rawUrl,
          evidence: `Extracted tagline from website banner/content: "${payload.tagline.trim()}"`,
          method: 'MULTIMODAL_TAGLINE_AI',
          confidence: 0.88
        };
      }

      // 5. Mission Statement
      if (payload.missionStatement && typeof payload.missionStatement === 'string' && payload.missionStatement.trim().length > 5) {
        missionObj = {
          value: payload.missionStatement.trim(),
          sourceType: hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE',
          sourceUrl: rawUrl,
          evidence: `Extracted mission statement from website text & page screenshots: "${payload.missionStatement.trim()}"`,
          method: 'MULTIMODAL_MISSION_AI',
          confidence: 0.88
        };
      }

      // 6. Vision
      if (payload.vision && typeof payload.vision === 'string' && payload.vision.trim().length > 5) {
        visionObj = {
          value: payload.vision.trim(),
          sourceType: hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_INFERENCE',
          sourceUrl: rawUrl,
          evidence: `Extracted vision statement from website text & page screenshots: "${payload.vision.trim()}"`,
          method: 'MULTIMODAL_VISION_AI',
          confidence: 0.88
        };
      }
    }
  } catch (err) {
    console.log(`[PositioningAgent] AI multimodal positioning fallback note: ${err.message}`);
  }

  console.log(`[PositioningAgent] ✅ Positioning Complete. Industry: "${industryResult.primaryIndustry.value || 'N/A'}", BusinessType: "${businessTypeResult.value || 'N/A'}", HQ: "${hqResult.headquarters.value || 'N/A'}", Tagline: "${taglineObj.value || 'N/A'}", Mission: "${missionObj.value || 'N/A'}", Vision: "${visionObj.value || 'N/A'}"`);

  return {
    primaryIndustry: industryResult.primaryIndustry,
    secondaryIndustries: industryResult.secondaryIndustries,
    businessType: businessTypeResult,
    headquarters: hqResult.headquarters,
    tagline: taglineObj,
    missionStatement: missionObj,
    vision: visionObj
  };
}

module.exports = { runPositioningAgent };
