/**
 * Pexels API Service
 * Official Pexels Image Search Integration for AI Website Builder & Creative Studio.
 * Documentation: https://www.pexels.com/api/documentation
 */
const axios = require('axios');

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

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

  // High-Quality Fallback: Prompt-matched AI/Unsplash dynamic images matching the exact query
  const fallbackPhotos = [];
  for (let i = 0; i < Math.min(perPage, 5); i++) {
    const seed = (i + 1) * 777;
    const promptWithQuery = `${cleanQuery}, 8k resolution, professional photography, studio lighting`;
    fallbackPhotos.push({
      id: `pexels_fb_${Date.now()}_${i}`,
      url: `https://image.pollinations.ai/prompt/${encodeURIComponent(promptWithQuery)}?width=1200&height=800&nologo=true&seed=${seed}`,
      thumbnail: `https://image.pollinations.ai/prompt/${encodeURIComponent(promptWithQuery)}?width=400&height=300&nologo=true&seed=${seed}`,
      photographer: 'AI Ads™ Pexels Engine',
      photographerUrl: 'https://www.pexels.com',
      width: 1200,
      height: 800,
      alt: cleanQuery,
      source: 'PEXELS_AI_FALLBACK'
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
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(query + ' professional photography')}?width=1200&height=800&nologo=true`;
};

module.exports = {
  searchPhotos,
  getSinglePhotoUrl
};
