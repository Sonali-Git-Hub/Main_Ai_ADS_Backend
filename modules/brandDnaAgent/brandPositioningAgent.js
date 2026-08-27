/**
 * Sub-Agent 4: Industry & Market Positioning Agent
 * Path: backend/modules/brandDnaAgent/brandPositioningAgent.js
 * 
 * Role: Market Positioning & Business Model Analyst
 * Responsibility: Classifies Primary/Secondary Industry, Business Model, and Semantic Tagline.
 */

const {
  classifyPrimaryAndSecondaryIndustry,
  classifyBusinessTypeWithConsensus,
  validateAndClassifyTagline
} = require('../workspace/brandProcessor.service');

async function runPositioningAgent(crawlResult) {
  const { domainName, brandNameObj, scrapedMetadata, combinedText, rawUrl } = crawlResult;
  const brandName = brandNameObj.value || 'Brand';

  console.log(`[PositioningAgent] 📊 Analyzing Market Positioning & Industry for: "${brandName}"`);

  // Field 2: Primary & Secondary Industry
  const industryResult = classifyPrimaryAndSecondaryIndustry(
    domainName,
    brandName,
    scrapedMetadata.metaDescription,
    scrapedMetadata.headings,
    scrapedMetadata.aboutPageText,
    scrapedMetadata.schemaIndustry,
    rawUrl
  );

  // Field 3: Business Type Consensus
  const businessTypeResult = classifyBusinessTypeWithConsensus(combinedText, rawUrl);

  // Field 4: Semantic Tagline Classifier
  const taglineObj = validateAndClassifyTagline(scrapedMetadata, scrapedMetadata.headings, brandName, domainName);

  console.log(`[PositioningAgent] ✅ Positioning Complete. Industry: "${industryResult.primaryIndustry.value || 'UNKNOWN'}", BusinessType: "${businessTypeResult.value}"`);

  return {
    primaryIndustry: industryResult.primaryIndustry,
    secondaryIndustries: industryResult.secondaryIndustries,
    businessType: businessTypeResult,
    tagline: taglineObj
  };
}

module.exports = { runPositioningAgent };
