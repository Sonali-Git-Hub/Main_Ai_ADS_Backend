const axios = require('axios');

function isValidTavilyKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  const clean = apiKey.trim();
  if (clean.length < 15 || clean.includes('your_tavily') || clean.includes('your_key') || clean.startsWith('tvly-your')) {
    return false;
  }
  return true;
}

async function searchTavily(query, searchDepth = 'advanced', maxResults = 5) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!isValidTavilyKey(apiKey)) {
    return null;
  }

  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      include_answer: true,
      include_images: true,
      max_results: maxResults
    }, { timeout: 10000 });

    if (response.data) {
      return {
        answer: response.data.answer || '',
        results: (response.data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          score: r.score
        })),
        images: response.data.images || []
      };
    }
  } catch (err) {
    console.log('Tavily Search API Note:', err.message);
  }
  return null;
}

async function extractTavilyUrl(url) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!isValidTavilyKey(apiKey)) {
    return null;
  }

  try {
    const response = await axios.post('https://api.tavily.com/extract', {
      api_key: apiKey,
      urls: [url]
    }, { timeout: 10000 });

    if (response.data && response.data.results && response.data.results.length > 0) {
      const item = response.data.results[0];
      return {
        rawContent: item.raw_content || item.content || '',
        url: item.url
      };
    }
  } catch (err) {
    console.log('Tavily Extract API Note:', err.message);
  }
  return null;
}

module.exports = {
  searchTavily,
  extractTavilyUrl
};
