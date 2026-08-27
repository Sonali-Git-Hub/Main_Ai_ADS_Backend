/**
 * Master Brand DNA Agent Orchestrator
 * Path: backend/modules/brandDnaAgent/index.js
 * 
 * Role: Master Controller for Brand Intelligence Extraction Subsystem
 * Responsibility: Orchestrates 4 Sub-Agents (Crawler, Voice, Persona, Positioning) to build a unified Brand DNA Profile.
 */

const { runCrawlerAgent } = require('./brandCrawlerAgent');
const { runVoiceAgent } = require('./brandVoiceAgent');
const { runPersonaAgent } = require('./brandPersonaAgent');
const { runPositioningAgent } = require('./brandPositioningAgent');
const { runValidatorAgent } = require('./brandValidatorAgent');

async function runBrandDnaMasterAgent(targetUrl, seedBrandName = '') {
  console.log(`\n================================================================================`);
  console.log(`👑 [MASTER-ORCHESTRATOR] Starting Brand DNA Multi-Agent Pipeline for: ${targetUrl}`);
  console.log(`================================================================================`);

  // Step 1: Execute Sub-Agent 1 — Live Web Crawler & DOM Scraper Agent
  const crawlResult = await runCrawlerAgent(targetUrl, seedBrandName);

  // Step 2: Execute Sub-Agents 2, 3, & 4 in Parallel (Voice, Persona, Positioning)
  console.log(`[MASTER-ORCHESTRATOR] ⚡ Launching Sub-Agents (Voice, Persona, Positioning) in parallel...`);
  const [voiceResult, personaResult, positioningResult] = await Promise.all([
    runVoiceAgent(crawlResult),
    runPersonaAgent(crawlResult),
    runPositioningAgent(crawlResult)
  ]);

  // Company Description (Clean summary without debug URL markers)
  const metaDesc = crawlResult.scrapedMetadata.metaDescription;
  const aboutText = crawlResult.scrapedMetadata.aboutPageText;
  let cleanDesc = metaDesc ? metaDesc.trim() : (aboutText ? aboutText.slice(0, 300).trim() + '...' : null);

  const descObj = {
    value: cleanDesc,
    sourceType: metaDesc ? 'WEBSITE_META' : (cleanDesc ? 'WEBSITE_DOM' : 'UNKNOWN'),
    sourceUrl: crawlResult.rawUrl,
    evidence: cleanDesc || 'No company description found',
    method: metaDesc ? 'META_DESCRIPTION_EXTRACTION' : 'PAGE_TEXT_SUMMARY',
    confidence: cleanDesc ? 0.90 : 0
  };

  const draftPayload = {
    brandName: crawlResult.brandNameObj,
    parentCompany: crawlResult.brandNameObj,
    industryCategory: positioningResult.primaryIndustry,
    secondaryIndustries: positioningResult.secondaryIndustries,
    businessType: positioningResult.businessType,
    headquarters: crawlResult.hqObj,
    tagline: positioningResult.tagline,
    contactInfo: crawlResult.contactObj,
    coreProducts: crawlResult.coreProducts || [],
    companyDescription: descObj,
    brandVoice: voiceResult.primaryTone,
    voiceAttributes: voiceResult.voiceAttributes,
    brandPromises: voiceResult.brandPromises,
    doWords: voiceResult.doWords,
    dontWords: voiceResult.dontWords,
    targetDemographics: personaResult.targetDemographics,
    buyerPersonas: personaResult.buyerPersonas,
    corePainPoints: personaResult.corePainPoints,
    buyingTriggers: personaResult.buyingTriggers,
    commonObjections: personaResult.commonObjections,
    brandColors: crawlResult.scrapedMetadata.brandColors || [],
    logoUrl: crawlResult.scrapedMetadata.logoUrl || '',
    faviconUrl: crawlResult.scrapedMetadata.faviconUrl || ''
  };

  // Step 3: Execute Sub-Agent 5 — Brand DNA Validator Agent (Quality & Grounding Audit)
  console.log(`[MASTER-ORCHESTRATOR] 🛡️ Launching Sub-Agent 5 (Brand DNA Validator Agent)...`);
  const finalValidatedPayload = await runValidatorAgent(draftPayload, crawlResult);

  console.log(`================================================================================`);
  console.log(`✅ [MASTER-ORCHESTRATOR] Pipeline & Audit Complete for "${finalValidatedPayload.brandName.value}"!`);
  console.log(`================================================================================\n`);

  return finalValidatedPayload;
}

module.exports = {
  runBrandDnaMasterAgent,
  runCrawlerAgent,
  runVoiceAgent,
  runPersonaAgent,
  runPositioningAgent,
  runValidatorAgent
};
