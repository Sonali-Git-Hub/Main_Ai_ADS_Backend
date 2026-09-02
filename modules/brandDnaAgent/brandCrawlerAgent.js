/**
 * Sub-Agent 1: Live Web Crawler & Provenance DOM Scraper Agent
 * Path: backend/modules/brandDnaAgent/brandCrawlerAgent.js
 * 
 * Role: Technical Web Collector & Data Extraction Agent
 * Responsibility: Live website crawling, anti-bot bypass, Cheerio DOM cleanup, JSON-LD schema parsing.
 */

const { scrapeBrandWebsite } = require('../workspace/brandScraper.service');
const { resolveBrandName, resolveHeadquartersAndLocations, resolveContactInformation } = require('../workspace/brandProcessor.service');
const { recordTelemetryEvent } = require('../../services/telemetryService');
let searchTavily = async () => null;
try {
  const tav = require('../../services/tavilyService');
  if (tav && tav.searchTavily) searchTavily = tav.searchTavily;
} catch (e) {}

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
  let hqObj = resolveHeadquartersAndLocations(domainName, brandNameObj.value.toLowerCase(), scrapedMetadata, combinedText, rawUrl);
  const contactObj = resolveContactInformation(scrapedMetadata, rawUrl);

  let parentCompanyObj = { value: null, status: 'UNKNOWN', sourceType: 'UNKNOWN', evidence: 'No explicit parent company evidence in website DOM', confidence: 0 };

  // Fallback 1: Web Search Enrichment via Tavily if HQ or Parent Company is missing from site DOM
  if (!hqObj.headquarters.value || hqObj.headquarters.confidence < 0.5) {
    try {
      console.log(`[CrawlerAgent] 🔍 HQ missing from DOM. Triggering web search enrichment for "${brandNameObj.value}"...`);
      const searchRes = await searchTavily(`"${brandNameObj.value}" corporate headquarters location city country`, 'advanced', 3);
      if (searchRes && (searchRes.answer || (searchRes.results && searchRes.results.length > 0))) {
        const text = (searchRes.answer + ' ' + searchRes.results.map(r => r.snippet).join(' ')).trim();
        if (text.length > 10) {
          const searchHq = resolveHeadquartersAndLocations(domainName, brandNameObj.value.toLowerCase(), { deepContextText: text, metaDescription: text }, text, rawUrl);
          if (searchHq?.headquarters?.value) {
            hqObj = searchHq;
            hqObj.headquarters.sourceType = 'SEARCH_ENRICHMENT';
            hqObj.headquarters.evidence = `Retrieved via web search enrichment: "${searchRes.answer || searchRes.results[0].snippet.slice(0, 150)}"`;
            console.log(`[CrawlerAgent] ✅ HQ Enriched via Web Search: "${hqObj.headquarters.value}"`);
          }
        }
      }
    } catch (err) {
      console.log(`[CrawlerAgent] Web Search HQ enrichment note: ${err.message}`);
    }
  }

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
    parentCompanyObj,
    hqObj: hqObj.headquarters,
    contactObj,
    coreProducts,
    scrapedMetadata,
    combinedText
  };
}

module.exports = { runCrawlerAgent };
