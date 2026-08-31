/**
 * Sub-Agent 1: Live Web Crawler & Provenance DOM Scraper Agent
 * Path: backend/modules/brandDnaAgent/brandCrawlerAgent.js
 * 
 * Role: Technical Web Collector & Data Extraction Agent
 * Responsibility: Live website crawling, anti-bot bypass, Cheerio DOM cleanup, JSON-LD schema parsing.
 */

const { scrapeBrandWebsite } = require('../workspace/brandScraper.service');
const { resolveBrandName, resolveHeadquartersAndLocations, resolveContactInformation, classifySemanticCandidates } = require('../workspace/brandProcessor.service');
const { recordTelemetryEvent } = require('../../services/telemetryService');

async function runCrawlerAgent(targetUrl, seedBrandName = '') {
  console.log(`[CrawlerAgent] 🔍 Initiating live crawl for: ${targetUrl}`);
  
  try {
    recordTelemetryEvent({
      component: 'BrandDnaAgent:Crawler',
      action: 'CRAWL_START',
      details: { targetUrl, seedBrandName }
    });
  } catch (e) {}

  const scrapedMetadata = await scrapeBrandWebsite(targetUrl, seedBrandName);
  const rawUrl = scrapedMetadata.cleanUrl || targetUrl;
  const domainName = scrapedMetadata.domainName || '';

  // Resolve Brand Name & HQ using provenance rules
  const brandNameObj = resolveBrandName(scrapedMetadata, seedBrandName, domainName);
  const combinedText = ((domainName || '') + ' ' + (scrapedMetadata.headings || []).join(' ') + ' ' + (scrapedMetadata.metaDescription || '') + ' ' + (scrapedMetadata.aboutPageText || '') + ' ' + (scrapedMetadata.deepContextText || '')).toLowerCase();
  const hqObj = resolveHeadquartersAndLocations(domainName, brandNameObj.value.toLowerCase(), scrapedMetadata, combinedText, rawUrl);
  const contactObj = resolveContactInformation(scrapedMetadata, rawUrl);

  // Extract Core Product / Category Signals
  const rawCandidates = [
    ...(scrapedMetadata.navCategories || []),
    ...(scrapedMetadata.headings || []),
    ...(scrapedMetadata.aboutPageHeadings || [])
  ];

  const coreProducts = Array.from(new Set(
    rawCandidates
      .filter(c => typeof c === 'string' && c.trim().length > 3 && !/^(home|index|about|contact|login|register|cart|checkout|privacy|terms)$/i.test(c.trim()))
      .slice(0, 8)
  ));

  console.log(`[CrawlerAgent] ✅ Crawl & Extraction complete. Core Products: ${coreProducts.length}, HQ: "${hqObj.headquarters.value || 'N/A'}"`);

  return {
    rawUrl,
    domainName,
    brandNameObj,
    parentCompanyObj: { value: null, status: 'UNKNOWN', sourceType: 'UNKNOWN', evidence: 'No explicit parent company evidence in website DOM', confidence: 0 },
    hqObj: hqObj.headquarters,
    contactObj,
    coreProducts,
    scrapedMetadata,
    combinedText
  };
}

module.exports = { runCrawlerAgent };
