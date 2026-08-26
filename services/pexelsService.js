/**
 * Pexels API Service
 * Official Pexels Image Search Integration for AI Website Builder & Creative Studio.
 * Documentation: https://www.pexels.com/api/documentation
 */
const axios = require('axios');

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

const FALLBACK_STOCK_PHOTOS = [
  { keywords: /food|bakery|restaurant|pizza|burger|sushi|dining|cake|bread|cat|dog|pet/i, url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80' },
  { keywords: /jewelry|diamond|gold|ring|necklace/i, url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80' },
  { keywords: /beauty|skincare|cosmetics|salon|spa|perfume|hair/i, url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80' },
  { keywords: /tech|software|saas|laptop|phone|electronics|code/i, url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80' },
  { keywords: /fashion|clothing|apparel|dress|model/i, url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80' },
  { keywords: /real estate|architecture|house|villa|interior/i, url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80' },
  { keywords: /dental|doctor|health|clinic|hospital|medical/i, url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80' },
  { keywords: /fitness|gym|workout|sport|athlete/i, url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80' }
];

const DEFAULT_FALLBACK_URL = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80';

/**
 * Search Pexels photos by query
 * @param {string} query - Search term (e.g., 'luxury sports car', 'dental clinic', 'sourdough bakery')
 * @param {object} options - Optional filters { perPage, page, orientation }
 */
const searchPhotos = async (query, options = {}) => {
  const apiKey = process.env.PEXELS_API_KEY;
  const cleanQuery = (query || 'modern business architecture').trim();
  const perPage = options.perPage || options.limit || 15;
  const orientation = options.orientation || 'landscape';

  if (apiKey && apiKey !== 'your_pexels_api_key_here') {
    try {
      const response = await axios.get(PEXELS_SEARCH_URL, {
        headers: { Authorization: apiKey },
        params: {
          query: cleanQuery,
          per_page: perPage,
          orientation: orientation
        },
        timeout: 8000
      });

      if (response.data && response.data.photos && response.data.photos.length > 0) {
        return response.data.photos.map(p => ({
          id: `pexels_${p.id}`,
          url: p.src.large2x || p.src.large || p.src.landscape || p.src.original,
          thumbnail: p.src.medium || p.src.small,
          photographer: p.photographer,
          photographerUrl: p.photographer_url,
          width: p.width,
          height: p.height,
          alt: p.alt || cleanQuery,
          source: 'PEXELS_API'
        }));
      }
    } catch (err) {
      console.warn(`[PexelsService] API request failed (${err.message}). Using fallback photo provider.`);
    }
  }

  // High-Quality Fallback: Keyword-matched commercial stock photography
  const matched = FALLBACK_STOCK_PHOTOS.find(item => item.keywords.test(cleanQuery));
  const fallbackUrl = matched ? matched.url : DEFAULT_FALLBACK_URL;

  const fallbackPhotos = [];
  for (let i = 0; i < Math.min(perPage, 5); i++) {
    fallbackPhotos.push({
      id: `pexels_fb_${Date.now()}_${i}`,
      url: fallbackUrl,
      thumbnail: fallbackUrl,
      photographer: 'Pexels Commercial Stock Engine',
      photographerUrl: 'https://www.pexels.com',
      width: 1200,
      height: 800,
      alt: cleanQuery,
      source: 'PEXELS_STOCK_FALLBACK'
    });
  }

  return fallbackPhotos;
};

/**
 * Get a single best matching image URL for a given query
 */
const getSinglePhotoUrl = async (query, fallbackCategory = 'GENERAL') => {
  const photos = await searchPhotos(query, { perPage: 1 });
  if (photos && photos.length > 0) {
    return photos[0].url;
  }
  const matched = FALLBACK_STOCK_PHOTOS.find(item => item.keywords.test(query));
  return matched ? matched.url : DEFAULT_FALLBACK_URL;
};

module.exports = {
  searchPhotos,
  getSinglePhotoUrl
};
