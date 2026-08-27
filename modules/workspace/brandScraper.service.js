const axios = require('axios');
const cheerio = require('cheerio');
let Vibrant;
try {
  const vModule = require('node-vibrant/node');
  Vibrant = vModule.Vibrant || vModule.default || vModule;
} catch (e) {
  try {
    const vModule = require('node-vibrant');
    Vibrant = vModule.Vibrant || vModule.default || vModule;
  } catch (err) {}
}

let searchTavily = async () => null;
let extractTavilyUrl = async () => null;
try {
  const tavModule = require('../../services/tavilyService');
  if (tavModule) {
    if (tavModule.searchTavily) searchTavily = tavModule.searchTavily;
    if (tavModule.extractTavilyUrl) extractTavilyUrl = tavModule.extractTavilyUrl;
  }
} catch (e) {}

function isGrayscaleOrNeutral(hex) {
  if (!hex || typeof hex !== 'string') return true;
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return true;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  if (maxDiff < 18) return true; // Grey, Black, White or Neutral tone
  return false;
}

const KNOWN_BRAND_COLORS = {
  'redtape': ['#F43424', '#111827', '#FFFFFF', '#7E0F06'],
  'red tape': ['#F43424', '#111827', '#FFFFFF', '#7E0F06'],
  'nvidia': ['#76B900', '#000000', '#1E293B', '#FFFFFF'],
  'redbus': ['#D84E55', '#1E293B', '#FFFFFF', '#BA2E35'],
  'nike': ['#111827', '#EA580C', '#FFFFFF', '#F3F4F6'],
  'adidas': ['#000000', '#FFFFFF', '#0070EB', '#111827'],
  'puma': ['#BA0C2F', '#000000', '#FFFFFF', '#1E293B'],
  'zomato': ['#E23744', '#FFFFFF', '#2D2D2D', '#CB202D'],
  'swiggy': ['#FC8019', '#282C3F', '#FFFFFF', '#F26F00'],
  'boat': ['#E21E24', '#000000', '#FFFFFF', '#1A1A1A'],
  'apple': ['#000000', '#1D1D1F', '#F5F5F7', '#0071E3'],
  'tesla': ['#E82127', '#000000', '#3E3E3E', '#FFFFFF'],
  'tata': ['#004C97', '#0085CA', '#FFFFFF', '#0A2540'],
  'jio': ['#0A2885', '#E31837', '#FFFFFF', '#0078D4'],
  'airtel': ['#ED1C24', '#1C1C1C', '#FFFFFF', '#8E1216'],
  'lenskart': ['#000042', '#00BAC6', '#EAECF0', '#000000'],
  'myntra': ['#FF3F6C', '#FF527B', '#FFFFFF', '#282C3F'],
  'flipkart': ['#2874F0', '#FFE500', '#FB641B', '#FFFFFF'],
  'amazon': ['#FF9900', '#146EB4', '#000000', '#FFFFFF'],
  'google': ['#4285F4', '#EA4335', '#FBBC05', '#34A853'],
  'microsoft': ['#F25022', '#7FBA00', '#00A4EF', '#FFB900'],
  'spotify': ['#1DB954', '#191414', '#FFFFFF', '#121212'],
  'netflix': ['#E50914', '#141414', '#FFFFFF', '#221F1F'],
  'starbucks': ['#00704A', '#27251F', '#D4E9E2', '#FFFFFF'],
  'nataraj': ['#DC2626', '#1E1B4B', '#F59E0B', '#FFFFFF'],
  'camlin': ['#0066B2', '#E31E24', '#FFCC00', '#FFFFFF'],
  'mamaearth': ['#5FB346', '#222222', '#FFFFFF', '#8ED276'],
  'nykaa': ['#FC2779', '#FFFFFF', '#000000', '#E80071'],
  'dominos': ['#0078AE', '#E31837', '#FFFFFF', '#005580'],
  'subway': ['#008C15', '#FFC20E', '#FFFFFF', '#005810'],
  'uber': ['#000000', '#FFFFFF', '#276EF1', '#1E1E1E'],
  'ola': ['#B0D337', '#000000', '#FFFFFF', '#222222'],
  'paytm': ['#00BAF2', '#002E6E', '#FFFFFF', '#00B9F5'],
  'cred': ['#111111', '#FFFFFF', '#404040', '#D1A054'],
  'zerodha': ['#387ED1', '#666666', '#FFFFFF', '#222222'],
  'razorpay': ['#0C2340', '#3395FF', '#07162C', '#528FF0']
};

async function extractLogoPixelColors(imageUrls) {
  if (!Vibrant) return [];
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  const hexes = [];

  for (const url of urls) {
    if (!url || typeof url !== 'string' || url.endsWith('.svg') || url.startsWith('data:image/svg')) {
      continue;
    }

    try {
      const palette = await Vibrant.from(url).getPalette();
      const swatches = [
        palette.Vibrant,
        palette.DarkVibrant,
        palette.LightVibrant,
        palette.Muted,
        palette.DarkMuted,
        palette.LightMuted
      ];

      swatches.forEach(swatch => {
        if (swatch) {
          const hex = (swatch.hex || (typeof swatch.getHex === 'function' ? swatch.getHex() : '')).toUpperCase();
          if (hex && !hexes.includes(hex) && !isGrayscaleOrNeutral(hex)) {
            hexes.push(hex);
          }
        }
      });

      if (hexes.length >= 2) break;
    } catch (err) {}
  }

  return hexes;
}

function formatCleanSpacedBrandName(str) {
  if (!str || typeof str !== 'string') return 'Brand Workspace';

  let clean = str.trim();
  if (clean.includes('/') || clean.toLowerCase().startsWith('http') || /\.(com|in|org|net|io|ai|co\.in|store|shop)\b/i.test(clean)) {
    clean = clean.replace(/^(https?:\/\/)?(www\d*|m|store|shop|en-in)\./i, '');
    clean = clean.split('/')[0];
    clean = clean.replace(/\.(com|in|co\.in|org|net|io|ai|app|store|shop|biz|info|us|uk)$/i, '');
    clean = clean.replace(/[-_]/g, ' ').trim();
  }

  // Special Known Brands Dictionary
  const BRAND_MAP = {
    'uspoloassn': 'U.S. Polo Assn.',
    'u.s. polo assn. india': 'U.S. Polo Assn. India',
    'u.s. polo assn.': 'U.S. Polo Assn.',
    'u s polo assn': 'U.S. Polo Assn.',
    'airtel': 'Airtel',
    'swiggy': 'Swiggy',
    'crocs': 'Crocs',
    'zomato': 'Zomato',
    'boat': 'boAt',
    'zebronics': 'Zebronics',
    'flipkart': 'Flipkart',
    'myntra': 'Myntra',
    'nykaa': 'Nykaa',
    'amazon': 'Amazon',
    'oppo': 'OPPO',
    'vivo': 'Vivo',
    'realme': 'realme',
    'oneplus': 'OnePlus',
    'samsung': 'Samsung',
    'apple': 'Apple',
    'nike': 'Nike',
    'puma': 'PUMA',
    'adidas': 'Adidas',
    'zedblack': 'Zed Black',
    'zed black': 'Zed Black',
    'mdph': 'MDPH',
    'peterengland': 'Peter England',
    'abfrl': 'ABFRL',
    'tata': 'Tata',
    'jio': 'Jio',
    'amul': 'Amul',
    'lenskart': 'Lenskart',
    'razorpay': 'Razorpay',
    'paytm': 'Paytm',
    'cred': 'CRED',
    'zerodha': 'Zerodha'
  };

  const lower = clean.toLowerCase();
  if (BRAND_MAP[lower]) return BRAND_MAP[lower];

  return clean
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function extractCleanBrandName(rawHost, overrideName = '') {
  if (overrideName && overrideName.trim() && !overrideName.toUpperCase().startsWith('WWW')) {
    return formatCleanSpacedBrandName(overrideName);
  }

  const h = rawHost.replace(/^(www\d*|m|store|shop|en-in|in|us|uk)\./i, '');
  const basePart = h.split('.')[0];
  return formatCleanSpacedBrandName(basePart);
}

function generateDynamicBrandPalette(domainName) {
  let hash = 0;
  for (let i = 0; i < domainName.length; i++) {
    hash = domainName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 45) % 360;
  const hue3 = (hue1 + 180) % 360;

  function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  }

  return [
    hslToHex(hue1, 75, 45),
    hslToHex(hue2, 65, 55),
    hslToHex(hue3, 80, 50),
    '#0F172A'
  ];
}

function extractSvgFills(html) {
  if (!html) return [];
  const hexes = [];
  try {
    const fillMatches = html.match(/fill=["'](#(?:[0-9a-fA-F]{3}){1,2})["']/g) || [];
    fillMatches.forEach(m => {
      const hex = m.match(/#(?:[0-9a-fA-F]{3}){1,2}/)[0].toUpperCase();
      if (hex && !hexes.includes(hex) && hex !== '#FFFFFF' && hex !== '#000000') {
        hexes.push(hex);
      }
    });
    return hexes;
  } catch (e) {
    return [];
  }
}

function extractSchemaJsonLd($) {
  let schemaLogo = '';
  let schemaName = '';
  let schemaSlogan = '';
  let schemaIndustry = '';
  let schemaAddress = '';
  let schemaFoundingDate = '';
  let schemaSameAs = [];

  if (!$) return { schemaLogo, schemaName, schemaSlogan, schemaIndustry, schemaAddress, schemaFoundingDate, schemaSameAs };

  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const items = Array.isArray(json) ? json : [json];
      items.forEach(item => {
        if (item['@type'] === 'Organization' || item['@type'] === 'Corporation' || item['@type'] === 'Brand' || item['@type'] === 'WebSite') {
          if (item.logo) {
            schemaLogo = typeof item.logo === 'string' ? item.logo : (item.logo.url || '');
          }
          if (item.name) schemaName = item.name;
          if (item.slogan) schemaSlogan = item.slogan;
          if (item.industry || item.category) schemaIndustry = item.industry || item.category;
          if (item.foundingDate || item.foundingYear) schemaFoundingDate = String(item.foundingDate || item.foundingYear);
          if (item.address) {
            const addr = item.address;
            if (typeof addr === 'string') schemaAddress = addr;
            else if (typeof addr === 'object') {
              const parts = [
                addr.addressLocality,
                addr.addressRegion,
                addr.addressCountry
              ].filter(Boolean);
              schemaAddress = parts.join(', ');
            }
          }
          if (Array.isArray(item.sameAs)) schemaSameAs = item.sameAs;
        }
      });
    } catch (e) {}
  });

  return { schemaLogo, schemaName, schemaSlogan, schemaIndustry, schemaAddress, schemaFoundingDate, schemaSameAs };
}

async function extractAccurateBrandColors(cleanUrl, domainName, $, html, logoUrl = '', faviconUrl = '', brandName = '') {
  const lowerBrand = (brandName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const lowerDomain = (domainName || '').toLowerCase().replace(/^(www\d*|m|store|shop|en-in)\./, '').split('.')[0];

  // Tier 1: Known curated brand dictionary (100% authentic ground-truth hex codes)
  if (KNOWN_BRAND_COLORS[lowerBrand]) return KNOWN_BRAND_COLORS[lowerBrand];
  if (KNOWN_BRAND_COLORS[lowerDomain]) return KNOWN_BRAND_COLORS[lowerDomain];

  const logoBrandHexes = [];
  const tokenBrandHexes = [];

  // Tier 2: Real Pixel extraction from logo image & favicon via node-vibrant
  const candidateImages = [
    logoUrl,
    faviconUrl,
    `https://www.google.com/s2/favicons?domain=${domainName}&sz=128`
  ].filter(Boolean);

  const pixelColors = await extractLogoPixelColors(candidateImages);
  pixelColors.forEach(h => {
    if (!logoBrandHexes.includes(h) && !isGrayscaleOrNeutral(h)) {
      logoBrandHexes.push(h);
    }
  });

  // Tier 3: Extract Meta Theme-Color & TileColor from DOM
  if ($) {
    const metaTheme = $('meta[name="theme-color"]').attr('content') || $('meta[name="msapplication-TileColor"]').attr('content') || $('meta[name="msapplication-navbutton-color"]').attr('content');
    if (metaTheme && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(metaTheme.trim())) {
      const u = metaTheme.trim().toUpperCase();
      if (!isGrayscaleOrNeutral(u) && !tokenBrandHexes.includes(u)) {
        tokenBrandHexes.push(u);
      }
    }
  }

  // Tier 4: Extract SVG Vector Fills inside Header/Nav/Logo
  if (html) {
    const svgHexes = extractSvgFills(html);
    svgHexes.forEach(h => {
      if (!isGrayscaleOrNeutral(h) && !tokenBrandHexes.includes(h)) {
        tokenBrandHexes.push(h);
      }
    });
  }

  const mergedChromatic = [...logoBrandHexes, ...tokenBrandHexes];

  if (mergedChromatic.length >= 1) {
    const primary = mergedChromatic[0];
    const secondary = mergedChromatic[1] || (isGrayscaleOrNeutral(primary) ? '#1E293B' : '#111827');
    const accent = mergedChromatic[2] || '#38BDF8';
    const dark = '#0F172A';
    return [primary, secondary, accent, dark].slice(0, 4);
  }

  return generateDynamicBrandPalette(domainName);
}

async function crawlBrandContext(cleanUrl, $) {
  const internalPages = [];
  const crawledTexts = [];
  let aboutPageHeadings = [];
  let aboutPageText = '';
  let contactPageText = '';
  let pressKitText = '';

  if (!$) return { internalPages, deepContextText: '', aboutPageHeadings: [], aboutPageText: '', contactPageText: '', pressKitText: '' };

  const baseUrl = new URL(cleanUrl);
  const priorityPatterns = [/about/i, /who-we-are/i, /our-story/i, /company/i, /contact/i, /press/i, /media/i, /newsroom/i, /brand/i, /locations/i, /offices/i, /privacy/i, /terms/i];

  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    try {
      const fullUrl = href.startsWith('http') ? new URL(href) : new URL(href, cleanUrl);
      if (fullUrl.hostname === baseUrl.hostname) {
        const path = fullUrl.pathname;
        if (priorityPatterns.some(pattern => pattern.test(path)) && !internalPages.includes(fullUrl.href)) {
          internalPages.push(fullUrl.href);
        }
      }
    } catch (e) {}
  });

  // If no contact/about links found in DOM, probe common endpoints
  const hasContactLink = internalPages.some(p => /contact|locations|offices|headquarters/i.test(p));
  if (!hasContactLink) {
    try {
      internalPages.push(`${cleanUrl.replace(/\/$/, '')}/contact-us`);
      internalPages.push(`${cleanUrl.replace(/\/$/, '')}/about-us`);
      internalPages.push(`${cleanUrl.replace(/\/$/, '')}/press`);
    } catch (e) {}
  }

  // Crawl up to 3 key internal pages (optimized for speed)
  const selectedPages = internalPages.slice(0, 3);

  // Concurrently fetch all internal pages
  await Promise.all(selectedPages.map(async (pageUrl) => {
    try {
      const isAboutPage = /about|who-we-are|our-story|company/i.test(pageUrl);
      const isContactPage = /contact|locations|offices|headquarters/i.test(pageUrl);
      const isPressPage = /press|media|newsroom|brand/i.test(pageUrl);

      const response = await axios.get(pageUrl, {
        timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      const page$ = cheerio.load(response.data);

      page$('script, style, iframe, noscript').remove();
      const pageHeadings = [];
      const uiFilter = /cart|checkout|subtotal|shipping|sign in|login|register|cookie|account|wishlist|quick view|filter by|sort by|your cart is empty|empty cart|my cart|search products|add to cart/i;

      page$('h1, h2, h3').each((i, el) => {
        const txt = page$(el).text().trim();
        if (txt.length > 5 && txt.length < 150 && !uiFilter.test(txt)) {
          pageHeadings.push(txt);
        }
      });

      const pageParagraphs = [];
      page$('p, article, section, address, div[class*="address"], div[class*="office"], div[class*="contact"]').each((i, el) => {
        const txt = page$(el).text().trim();
        if (txt.length > 15 && txt.length < 600) pageParagraphs.push(txt);
      });

      if (isAboutPage) {
        aboutPageHeadings = [...aboutPageHeadings, ...pageHeadings];
        if (pageParagraphs.length > 0) {
          aboutPageText += (aboutPageText ? ' ' : '') + pageParagraphs.slice(0, 8).join(' ');
        }
      }

      if (isContactPage && pageParagraphs.length > 0) {
        contactPageText += (contactPageText ? ' ' : '') + pageParagraphs.slice(0, 10).join(' ');
      }

      if (isPressPage && pageParagraphs.length > 0) {
        pressKitText += (pressKitText ? ' ' : '') + pageParagraphs.slice(0, 8).join(' ');
      }

      if (pageHeadings.length > 0 || pageParagraphs.length > 0) {
        crawledTexts.push(`[Page URL: ${pageUrl}]\nHeadings: ${pageHeadings.join(' | ')}\nContent: ${pageParagraphs.slice(0, 10).join(' ')}`);
      }
    } catch (e) {}
  }));

  return {
    internalPages: selectedPages,
    deepContextText: crawledTexts.join('\n\n'),
    aboutPageHeadings,
    aboutPageText,
    contactPageText,
    pressKitText
  };
}


async function scrapeBrandWebsite(urlInput, brandNameOverride = '') {
  let cleanUrl = urlInput.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  let domainName = '';
  try {
    const urlObj = new URL(cleanUrl);
    domainName = urlObj.hostname;
  } catch (err) {
    domainName = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }

  // Auto TLD completion if missing (e.g. https://www.motorola -> https://www.motorola.com)
  if (domainName && !/\.[a-z]{2,}$/i.test(domainName)) {
    cleanUrl = cleanUrl.replace(/\/$/, '') + '.com';
    try {
      domainName = new URL(cleanUrl).hostname;
    } catch (e) {
      domainName = domainName + '.com';
    }
  }

  const brandName = extractCleanBrandName(domainName, brandNameOverride);

  console.log(`\n🌐 [SCRAPER] 🚀 Initiating Live Web Scrape & Brand DNA Setup for: ${cleanUrl} (${brandName})`);

  let html = '';
  let $ = null;
  let crawledSources = ['WEBSITE_HOMEPAGE'];

  // STEP 1: Fast HTTP Fetch with Full Chrome Browser Headers
  try {
    const response = await axios.get(cleanUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    html = response.data;
    $ = cheerio.load(html);
    console.log(`📡 [SCRAPER] Step 1: Live Homepage HTTP Fetch Successful (200 OK)`);
  } catch (err) {
    console.log(`🛡️ [SCRAPER] Direct HTTP blocked (${err.message}). Switching to secondary web fetcher...`);
    const tavilyExtract = await extractTavilyUrl(cleanUrl);
    if (tavilyExtract && tavilyExtract.rawContent) {
      html = tavilyExtract.rawContent;
      $ = cheerio.load(html);
      crawledSources.push('TAVILY_ANTI_BOT_BYPASS');
      console.log(`📡 [SCRAPER] Tavily Anti-Bot Bypass Content Retrieved Successfully`);
    } else {
      const tavilySearch = await searchTavily(`brand positioning and official details for ${domainName}`);
      if (tavilySearch && tavilySearch.answer) {
        html = `<html><body><h1>${tavilySearch.answer}</h1></body></html>`;
        $ = cheerio.load(html);
        crawledSources.push('TAVILY_DEEP_SEARCH');
        console.log(`📡 [SCRAPER] Tavily Deep Search Details Retrieved`);
      }
    }
    if (!$) {
      html = `<html><head><title>${brandName}</title><meta name="description" content="${brandName} Official Corporate Brand Workspace"></head><body><h1>${brandName}</h1><p>${brandName} official corporate website.</p></body></html>`;
      $ = cheerio.load(html);
      crawledSources.push('SYNTHESIZED_FALLBACK_DOM');
    }
  }

  // STEP 2: Dual-Mode Logo Extraction (Google Favicon 128px + Clearbit + Schema JSON-LD + OpenGraph)
  const rootDomain = domainName.replace(/^www\./i, '');
  const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`;
  const clearbitLogoUrl = `https://logo.clearbit.com/${rootDomain}`;
  let faviconUrl = googleFaviconUrl;
  let logoUrl = googleFaviconUrl; // Primary high-confidence fallback

  const { schemaLogo, schemaName, schemaSlogan, schemaIndustry, schemaAddress, schemaFoundingDate, schemaSameAs } = extractSchemaJsonLd($);
  let parsedLogo = schemaLogo;
  let logoText = '';
  let heroBannerTagline = '';
  let footerTagline = '';

  if ($) {
    const linkFavicon = $('link[rel*="icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href');
    if (linkFavicon) {
      if (linkFavicon.startsWith('http')) faviconUrl = linkFavicon;
      else if (linkFavicon.startsWith('//')) faviconUrl = 'https:' + linkFavicon;
      else faviconUrl = cleanUrl.replace(/\/$/, '') + (linkFavicon.startsWith('/') ? linkFavicon : '/' + linkFavicon);
    }

    if (!parsedLogo) {
      parsedLogo = $('header img[src*="logo" i], nav img[src*="logo" i], img[class*="logo" i], img[id*="logo" i], img[alt*="logo" i]').first().attr('src') ||
                   $('link[rel="apple-touch-icon"], link[rel*="icon"]').first().attr('href') ||
                   googleFaviconUrl;
    }

    logoText = $('header .logo-text, .brand-logo span, a[class*="logo"] span, #logo span, .logo-tagline').first().text().trim();
    heroBannerTagline = $('.hero h1, .hero p, .banner h1, .banner p, section[class*="hero"] p, section[class*="hero"] h2').first().text().trim();
    footerTagline = $('footer .tagline, footer p, footer .copyright').first().text().trim();
  }

  // Validate parsedLogo to ensure it is a valid image URL
  const isValidImage = (urlStr) => {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const cleanStr = urlStr.trim().toLowerCase();
    if (cleanStr.startsWith('data:image/')) return true;
    return /\.(png|jpe?g|svg|webp|ico)(\?.*)?$/i.test(cleanStr) || cleanStr.includes('/logo') || cleanStr.includes('/icon') || cleanStr.includes('/favicon');
  };

  try {
    const clearbitRes = await axios.head(clearbitLogoUrl, { timeout: 3000 });
    if (clearbitRes.status === 200) {
      logoUrl = clearbitLogoUrl;
      crawledSources.push('CLEARBIT_LOGO_API');
    } else throw new Error('Clearbit 404');
  } catch (e) {
    if (parsedLogo && isValidImage(parsedLogo)) {
      if (parsedLogo.startsWith('http')) logoUrl = parsedLogo;
      else if (parsedLogo.startsWith('//')) logoUrl = 'https:' + parsedLogo;
      else logoUrl = cleanUrl.replace(/\/$/, '') + (parsedLogo.startsWith('/') ? parsedLogo : '/' + parsedLogo);
      crawledSources.push('SCHEMA_DOM_LOGO');
    } else {
      logoUrl = googleFaviconUrl;
      crawledSources.push('GOOGLE_FAVICON_API');
    }
  }


  let metaTitle = '';
  let metaDescription = '';
  let ogSiteName = '';
  let headings = [];
  let socialPlatforms = schemaSameAs || [];
  let emails = [];
  let phones = [];
  let hqAddress = '';

  if ($) {
    // Clean scripts, styles, iframe, code, and svg before text extraction
    const $clean = cheerio.load(html);
    $clean('script, style, noscript, svg, iframe, code').remove();

    metaTitle = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    ogSiteName = $('meta[property="og:site_name"]').attr('content') || $('meta[name="og:site_name"]').attr('content') || '';

    const uiFilter = /cart|checkout|subtotal|shipping|sign in|login|register|cookie|privacy|terms|account|wishlist|quick view|filter by|sort by|your cart is empty|empty cart|my cart|search products|add to cart/i;
    $clean('h1, h2, h3').each((i, el) => {
      const text = $clean(el).text().trim();
      if (text && text.length > 5 && text.length < 120 && !uiFilter.test(text) && !headings.includes(text)) {
        headings.push(text);
      }
    });

    $clean('a[href]').each((i, el) => {
      const href = $clean(el).attr('href') || '';
      if (/facebook\.com/i.test(href) && !socialPlatforms.includes('Facebook')) socialPlatforms.push('Facebook');
      if (/instagram\.com/i.test(href) && !socialPlatforms.includes('Instagram')) socialPlatforms.push('Instagram');
      if (/linkedin\.com/i.test(href) && !socialPlatforms.includes('LinkedIn')) socialPlatforms.push('LinkedIn');
      if (/twitter\.com|x\.com/i.test(href) && !socialPlatforms.includes('X (Twitter)')) socialPlatforms.push('X (Twitter)');
      if (/youtube\.com/i.test(href) && !socialPlatforms.includes('YouTube')) socialPlatforms.push('YouTube');

      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email && email.includes('@') && !emails.includes(email)) emails.push(email);
      }
      if (href.startsWith('tel:')) {
        const rawPhone = href.replace('tel:', '').trim();
        const validP = filterValidPhoneNumber(rawPhone);
        if (validP && !phones.includes(validP)) phones.push(validP);
      }
    });

    // Extract official toll-free / helpline phone numbers & HQ Location from cleaned body text
    const cleanBodyText = $clean('body').text().replace(/\s+/g, ' ') || '';
    const phoneMatches = cleanBodyText.match(/(?:\+?91[-\s]?\d{10}|\+?1[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{4}|1800[-\s]?\d{3}[-\s]?\d{4})/gi) || [];
    phoneMatches.forEach(p => {
      const validP = filterValidPhoneNumber(p);
      if (validP && !phones.includes(validP)) {
        phones.push(validP);
      }
    });

    const hqMatch = cleanBodyText.match(/(?:headquarters|registered office|corporate office|based in|located in)[\s:]+([A-Z][a-zA-Z\s,.]{3,40})/i);
    if (hqMatch && hqMatch[1]) {
      const candidateHQ = hqMatch[1].trim().split('.')[0].trim();
      if (candidateHQ.length >= 3 && !/looking|feel free|welcome|click|call|services|our|booking/i.test(candidateHQ)) {
        hqAddress = candidateHQ;
      }
    }
  }


  // STEP 3 & 4: Deep Content Crawl & Hybrid Color Extraction (Run in Parallel)
  let deepContextText = '';
  let aboutPageHeadings = [];
  let aboutPageText = '';
  let contactPageText = '';
  let pressKitText = '';
  let brandColors = [];

  const crawlPromise = $ ? crawlBrandContext(cleanUrl, $) : Promise.resolve({ internalPages: [] });
  const colorPromise = extractAccurateBrandColors(cleanUrl, domainName, $, html, logoUrl, faviconUrl, brandName);

  const [deepData, colorsResult] = await Promise.all([crawlPromise, colorPromise]);

  if ($) {
    deepContextText = deepData.deepContextText || '';
    aboutPageHeadings = deepData.aboutPageHeadings || [];
    aboutPageText = deepData.aboutPageText || '';
    contactPageText = deepData.contactPageText || '';
    pressKitText = deepData.pressKitText || '';
    if (deepData.internalPages && deepData.internalPages.length > 0) {
      crawledSources.push('INTERNAL_ABOUT_PAGES');
      console.log(`📄 [SCRAPER] Discovered & Parsed ${deepData.internalPages.length} Internal Pages (${deepData.internalPages.join(', ')})`);
    }
  }

  brandColors = colorsResult;
  console.log(`🎨 [SCRAPER] Step 3: Extracted Logo & Color Palette (${brandColors.join(', ')})`);
  console.log(`🔍 [SCRAPER] Step 4: JSON-LD Schema & DOM Signals Parsed (Brand: "${schemaName || brandName}", Schema Slogan: "${schemaSlogan || 'N/A'}")`);

  return {
    cleanUrl,
    domainName,
    brandName: schemaName || brandName,
    schemaName,
    ogSiteName,
    schemaSlogan,
    schemaIndustry,
    schemaAddress,
    schemaFoundingDate,
    logoText,
    heroBannerTagline,
    footerTagline,
    metaTitle,
    metaDescription,
    faviconUrl,
    logoUrl,
    headings: headings.slice(0, 8),
    aboutPageHeadings,
    aboutPageText,
    contactPageText,
    pressKitText,
    brandColors,
    socialPlatforms,
    emails,
    phones,
    hqAddress: hqAddress || '',
    deepContextText,
    crawledSources
  };

}

function filterValidPhoneNumber(str) {
  if (!str || typeof str !== 'string') return null;
  const clean = str.trim().replace(/[^\d+]/g, '');
  // Reject dummy template numbers: +1 234 567 890, 1234567890, 0000000000, 9999999999, 14285714286
  if (/^(\+?1)?1234567890$/i.test(clean)) return null;
  if (/^(\+?1)?234567890\d?$/i.test(clean)) return null;
  if (/^0+$/i.test(clean) || /^9+$/i.test(clean) || /^142857/i.test(clean)) return null;
  
  // Must be between 10 and 14 digits
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length >= 10 && digitsOnly.length <= 14) {
    return str.trim();
  }
  return null;
}

module.exports = {
  scrapeBrandWebsite,
  extractCleanBrandName,
  formatCleanSpacedBrandName,
  extractAccurateBrandColors,
  crawlBrandContext,
  generateDynamicBrandPalette,
  extractLogoPixelColors,
  extractSchemaJsonLd,
  filterValidPhoneNumber
};
