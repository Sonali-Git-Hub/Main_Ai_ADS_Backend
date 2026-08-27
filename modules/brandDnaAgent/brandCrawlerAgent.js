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

  let coreProducts = (scrapedMetadata.navCategories && scrapedMetadata.navCategories.length > 0)
    ? scrapedMetadata.navCategories.slice(0, 8)
    : [];

  if (coreProducts.length === 0 && scrapedMetadata.headings && scrapedMetadata.headings.length > 0) {
    coreProducts = scrapedMetadata.headings.slice(0, 6);
  }

  if (coreProducts.length === 0 && scrapedMetadata.aboutPageHeadings && scrapedMetadata.aboutPageHeadings.length > 0) {
    coreProducts = scrapedMetadata.aboutPageHeadings.slice(0, 6);
  }

  if (coreProducts.length === 0 && scrapedMetadata.metaDescription) {
    coreProducts = [scrapedMetadata.metaDescription.slice(0, 80)];
  }

  if (coreProducts.length === 0) {
    coreProducts = [`${brandNameObj.value} Products & Services`];
  }

  console.log(`[CrawlerAgent] ✅ Crawl complete. Brand Name: "${brandNameObj.value}", HQ: "${hqObj.headquarters.value || 'N/A'}"`);

  return {
    rawUrl,
    domainName,
    brandNameObj,
    hqObj: hqObj.headquarters,
    contactObj,
    coreProducts,
    scrapedMetadata,
    combinedText
  };
}

module.exports = { runCrawlerAgent };
