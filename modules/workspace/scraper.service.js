const { scrapeBrandWebsite, extractAccurateBrandColors, crawlBrandContext } = require('./brandScraper.service');
const { parseBrandDocument, classifyBrandCategory } = require('./brandProcessor.service');
const { generateBrandDNA } = require('./brandIntelligence.service');

async function scrapeDomainUrl(url, brandNameOverride = '') {
  return await generateBrandDNA(url, brandNameOverride);
}

function getAccurateBrandColors(cleanUrl, domainName, $, html) {
  return extractAccurateBrandColors(cleanUrl, domainName, $, html);
}

function getBrandCategoryDetails(cleanUrl, domainName, brandName, headings, metaDescription, socialPlatforms, emails, phones, faviconUrl) {
  return classifyBrandCategory(domainName, brandName, headings, metaDescription);
}

module.exports = {
  scrapeDomainUrl,
  getAccurateBrandColors,
  getBrandCategoryDetails,
  scrapeBrandWebsite,
  parseBrandDocument,
  classifyBrandCategory,
  generateBrandDNA,
  crawlBrandContext
};

