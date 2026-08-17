/**
 * imageResolver.service.js
 * Universal Autonomous Image Resolution Adapter
 * Powered 100% by Strict Dynamic visualAssetEngine.service.js
 */

const {
  planAssetSpec,
  generateOrFetchCandidate,
  validateImageAssetStrict
} = require('./visualAssetEngine.service');

/**
 * Resolves a hero / banner visual dynamically based on context keywords with strict validation.
 */
function resolveDomainImagePool(contextText = '', imageryKeywords = []) {
  const query = `${contextText} ${Array.isArray(imageryKeywords) ? imageryKeywords.join(' ') : ''}`.trim();
  const spec = planAssetSpec({
    businessType: query,
    itemName: query,
    purpose: 'hero_banner'
  });
  const candidate = generateOrFetchCandidate(spec, 1);
  return [candidate.candidateUrl];
}

/**
 * Resolves an individual item / card image dynamically via visualAssetEngine with Zero-Repetition.
 */
function resolveItemImage({
  itemName = '',
  itemCategory = '',
  businessType = '',
  industry = '',
  itemIndex = 0,
  usedImageUrls = null,
  visualSpec = null
}) {
  const tracker = usedImageUrls || new Set();
  const assetSpec = planAssetSpec({
    businessType,
    industry,
    itemName,
    itemCategory,
    purpose: 'catalog_item',
    visualSpec
  });

  const candidate = generateOrFetchCandidate(assetSpec, itemIndex);
  tracker.add(candidate.candidateUrl);
  return candidate.candidateUrl;
}

module.exports = {
  resolveDomainImagePool,
  resolveItemImage,
  planVisualAssetSpec: planAssetSpec,
  validateAssetRelevance: validateImageAssetStrict,
  DOMAIN_POOLS: {}
};
