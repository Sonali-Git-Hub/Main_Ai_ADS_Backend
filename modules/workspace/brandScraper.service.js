const axios = require('axios');
const cheerio = require('cheerio');
let Vibrant;
try {
  const vNode = require('node-vibrant/node');
  Vibrant = vNode.Vibrant || vNode.default || vNode;
} catch (e) {
  try {
    const vPkg = require('node-vibrant');
    Vibrant = vPkg.Vibrant || vPkg.default || vPkg;
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

let puppeteer = null;
try {
  puppeteer = require('puppeteer');
} catch (e) {}

function extractEmailsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  // 1. Decode HTML entities and anti-spam obfuscations
  let cleanText = text
    .replace(/&#64;/gi, '@')
    .replace(/&#46;/gi, '.')
    .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
    .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
    .replace(/\s*\(\s*dot\s*\)\s*/gi, '.');

  // 2. Extract email regex pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const matches = cleanText.match(emailRegex) || [];

  const dummyFilter = /example\.com|domain\.com|yourname|username|email\.com|wixpress\.com|sentry\.io|schema\.org|gravatar\.com|png|jpg|jpeg|webp|gif|svg$/i;

  const validEmails = [];
  matches.forEach(e => {
    const cleanE = e.trim().toLowerCase();
    if (cleanE.length > 5 && cleanE.length < 80 && !dummyFilter.test(cleanE) && !validEmails.includes(cleanE)) {
      validEmails.push(cleanE);
    }
  });

  return validEmails;
}

async function extractLogoPixelColors(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string' || logoUrl.endsWith('.svg') || logoUrl.startsWith('data:image/svg')) {
    return [];
  }

  try {
    const palette = await Vibrant.from(logoUrl).getPalette();
    const hexes = [];
    const swatches = [
      palette.Vibrant,
      palette.Muted,
      palette.DarkVibrant,
      palette.LightVibrant,
      palette.DarkMuted
    ];

    swatches.forEach(swatch => {
      if (swatch) {
        const hex = swatch.getHex().toUpperCase();
        if (hex && !hexes.includes(hex) && hex !== '#FFFFFF' && hex !== '#000000') {
          hexes.push(hex);
        }
      }
    });

    return hexes;
  } catch (err) {
    return [];
  }
}

function formatCleanSpacedBrandName(str) {
  if (!str || typeof str !== 'string') return 'Brand Workspace';

  let clean = str.trim();
  if (clean.includes('/') || clean.toLowerCase().startsWith('http') || /\.(com|in|org|net|io|ai|co\.in|store|shop)\b/i.test(clean)) {
    clean = clean.replace(/^(https?:\/\/)?(www\d*|m|store|shop|en-in)\./i, '');
    clean = clean.split('/')[0];
    clean = clean.replace(/\.(?:com|in|co\.in|org|net|io|ai|app|store|shop|biz|info|us|uk)$/i, '');
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

async function extractAccurateBrandColors(cleanUrl, domainName, $, html, logoUrl = '') {
  const logoBrandHexes = [];
  const tokenBrandHexes = [];

  // Extract pixel colors from logo image via node-vibrant
  if (logoUrl) {
    const pixelColors = await extractLogoPixelColors(logoUrl);
    pixelColors.forEach(h => {
      if (!logoBrandHexes.includes(h)) logoBrandHexes.push(h);
    });
  }

  // Extract SVG Vector Fills
  const svgHexes = extractSvgFills(html);
  svgHexes.forEach(h => {
    if (!tokenBrandHexes.includes(h)) tokenBrandHexes.push(h);
  });

  // Extract CSS Var Tokens & Hex Values from DOM
  if (html) {
    const hexMatches = html.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || [];
    const ignoreList = ['#FFFFFF', '#000000', '#FFF', '#000', '#F8FAFC', '#F1F5F9', '#E2E8F0', '#0F172A', '#1E293B'];

    hexMatches.forEach(h => {
      const upper = h.toUpperCase();
      if (!ignoreList.includes(upper) && !tokenBrandHexes.includes(upper) && upper.length === 7) {
        tokenBrandHexes.push(upper);
      }
    });
  }

  const merged = [...logoBrandHexes, ...tokenBrandHexes];

  if (merged.length >= 1) {
    return merged.slice(0, 4);
  }

  // NOTE: Requirement 7 forbids injecting synthetic brand colors as actual Brand DNA.
  // Visual evidence missing -> return empty array [].
  return [];
}

async function crawlBrandContext(cleanUrl, $) {
  const internalPagesMap = new Map(); // fullHref -> { score, category }
  const crawledTexts = [];
  let aboutPageHeadings = [];
  let aboutPageText = '';
  let contactPageText = '';
  let pressKitText = '';
  let navCategories = [];

  if (!$) return { internalPages: [], deepContextText: '', aboutPageHeadings: [], aboutPageText: '', contactPageText: '', pressKitText: '', navCategories: [] };

  const baseUrl = new URL(cleanUrl);

  // Extract navigation menu category anchors
  const categoryFilter = /cart|checkout|login|account|privacy|terms|cookie|search|help|sign in|contact|about|press|order|location|store|bag|my cart|menu/i;
  $('nav a[href], header a[href], .nav a[href], div[class*="menu" i] a[href], div[class*="nav" i] a[href]').each((_, el) => {
    const text = $(el).text().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (text && text.length > 2 && text.length < 35 && !categoryFilter.test(text) && !navCategories.includes(text)) {
      navCategories.push(text);
    }
  });

  // Field-Aware Link Categorization & Scoring System
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    try {
      const fullUrl = href.startsWith('http') ? new URL(href) : new URL(href, cleanUrl);
      if (fullUrl.hostname === baseUrl.hostname) {
        const rawPath = fullUrl.pathname.toLowerCase();
        const cleanPath = (fullUrl.pathname.length > 1 && fullUrl.pathname.endsWith('/')) 
          ? fullUrl.pathname.slice(0, -1) 
          : fullUrl.pathname;
        const fullHref = fullUrl.origin + cleanPath; // Strip query params and trailing slash for deduplication

        if (fullHref === cleanUrl.replace(/\/$/, '')) return;

        let score = 0;
        let category = 'GENERAL';

        if (/about|who-we-are|our-story|company|our-reason|footprint|history|overview/i.test(rawPath)) {
          score += 10;
          category = 'IDENTITY_STORY';
        } else if (/mission|vision|purpose|values|sustainability|impact/i.test(rawPath)) {
          score += 10;
          category = 'MISSION_VISION';
        } else if (/contact|reach-us|support|help|locations|offices|headquarters|stores|contact-us/i.test(rawPath)) {
          score += 9;
          category = 'HEADQUARTERS_OFFICES';
        } else if (/shop|collections|products|catalog|services|categories|solutions/i.test(rawPath)) {
          score += 5;
          category = 'PRODUCTS_SERVICES';
        } else if (/press|media|newsroom|faq|corporate|info/i.test(rawPath)) {
          score += 6;
          category = 'CLAIMS_PRESS';
        }

        // Apply negative penalty for tracking params or utility links
        if (/utm_|campaign|cart|checkout|login|register|lang=/i.test(href)) score -= 8;

        if (score > 0) {
          const currentBest = internalPagesMap.get(fullHref) || { score: 0, category: 'GENERAL' };
          if (score > currentBest.score) {
            internalPagesMap.set(fullHref, { score, category });
          }
        }
      }
    } catch (e) {}
  });

  // Inject high-value Mission, Vision, and Purpose probe endpoints into candidate pool
  const base = cleanUrl.replace(/\/$/, '');
  const probeEndpoints = [
    { url: `${base}/about-us/mission-and-vision`, score: 12, category: 'MISSION_VISION' },
    { url: `${base}/about/mission`, score: 12, category: 'MISSION_VISION' },
    { url: `${base}/our-purpose`, score: 12, category: 'MISSION_VISION' },
    { url: `${base}/vision-mission`, score: 12, category: 'MISSION_VISION' },
    { url: `${base}/about-us`, score: 10, category: 'IDENTITY_STORY' },
    { url: `${base}/about`, score: 10, category: 'IDENTITY_STORY' },
    { url: `${base}/overview`, score: 10, category: 'IDENTITY_STORY' },
    { url: `${base}/contact-us`, score: 9, category: 'HEADQUARTERS_OFFICES' },
    { url: `${base}/contact`, score: 9, category: 'HEADQUARTERS_OFFICES' }
  ];

  probeEndpoints.forEach(p => {
    if (!internalPagesMap.has(p.url)) {
      internalPagesMap.set(p.url, { score: p.score, category: p.category });
    }
  });

  // Field-Aware Page Selection: Prioritize MISSION_VISION and IDENTITY_STORY buckets first
  const categoryBuckets = new Map();
  for (const [url, item] of internalPagesMap.entries()) {
    if (!categoryBuckets.has(item.category)) categoryBuckets.set(item.category, []);
    categoryBuckets.get(item.category).push({ url, score: item.score });
  }

  const selectedPages = [];
  const priorityCategoryOrder = ['MISSION_VISION', 'IDENTITY_STORY', 'HEADQUARTERS_OFFICES', 'PRODUCTS_SERVICES', 'CLAIMS_PRESS', 'GENERAL'];

  // First pass: pick top URL from each priority category bucket
  for (const cat of priorityCategoryOrder) {
    if (categoryBuckets.has(cat)) {
      const items = categoryBuckets.get(cat);
      items.sort((a, b) => b.score - a.score);
      if (items.length > 0 && selectedPages.length < 5) {
        if (!selectedPages.includes(items[0].url)) {
          selectedPages.push(items[0].url);
        }
      }
    }
  }

  // Second pass: fill remaining slots up to 5 from remaining top scores
  const allRemaining = Array.from(internalPagesMap.entries())
    .map(([url, item]) => ({ url, score: item.score }))
    .filter(i => !selectedPages.includes(i.url))
    .sort((a, b) => b.score - a.score);

  for (const rem of allRemaining) {
    if (selectedPages.length >= 5) break;
    selectedPages.push(rem.url);
  }

  const crawledPageDetails = [];

  // Concurrently fetch top 5 ranked internal pages
  await Promise.all(selectedPages.map(async (pageUrl) => {
    try {
      const pageCategoryInfo = internalPagesMap.get(pageUrl) || { category: 'GENERAL' };
      const isAboutPage = /about|who-we-are|our-story|company|footprint|mission|values|reason/i.test(pageUrl);
      const isContactPage = /contact|locations|offices|headquarters|support|help|stores/i.test(pageUrl);
      const isPressPage = /press|media|newsroom|brand|corporate|faq/i.test(pageUrl);

      const response = await axios.get(pageUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      const page$ = cheerio.load(response.data);
      const pageTitle = page$('title').text().trim() || pageUrl;
      page$('script, style, iframe, noscript, svg').remove();

      const pageHeadings = [];
      const uiFilter = /cart|checkout|subtotal|shipping|sign in|login|register|cookie|account|wishlist|quick view|filter by|sort by|your cart is empty|empty cart|my cart|search products|add to cart/i;

      page$('h1, h2, h3').each((_, el) => {
        const txt = page$(el).text().trim();
        if (txt.length > 5 && txt.length < 150 && !uiFilter.test(txt)) {
          pageHeadings.push(txt);
        }
      });

      const pageParagraphs = [];
      page$('p, article, section, address, div[class*="address"], div[class*="office"], div[class*="contact"], footer, span[class*="slogan"], span[class*="tagline"]').each((_, el) => {
        const txt = page$(el).text().trim();
        if (txt.length >= 4 && txt.length < 800) pageParagraphs.push(txt);
      });

      if (isAboutPage) {
        aboutPageHeadings = [...aboutPageHeadings, ...pageHeadings];
        if (pageParagraphs.length > 0) {
          aboutPageText += (aboutPageText ? ' ' : '') + pageParagraphs.slice(0, 10).join(' ');
        }
      }

      if (isContactPage && pageParagraphs.length > 0) {
        contactPageText += (contactPageText ? ' ' : '') + pageParagraphs.slice(0, 12).join(' ');
      }

      if (isPressPage && pageParagraphs.length > 0) {
        pressKitText += (pressKitText ? ' ' : '') + pageParagraphs.slice(0, 8).join(' ');
      }

      const subEmails = [];
      const subPhones = [];
      const subSocials = [];

      page$('a[href]').each((_, el) => {
        const href = page$(el).attr('href') || '';
        if (/facebook\.com/i.test(href) && !subSocials.includes('Facebook')) subSocials.push('Facebook');
        if (/instagram\.com/i.test(href) && !subSocials.includes('Instagram')) subSocials.push('Instagram');
        if (/linkedin\.com/i.test(href) && !subSocials.includes('LinkedIn')) subSocials.push('LinkedIn');
        if (/twitter\.com|x\.com/i.test(href) && !subSocials.includes('X (Twitter)')) subSocials.push('X (Twitter)');
        if (/youtube\.com/i.test(href) && !subSocials.includes('YouTube')) subSocials.push('YouTube');

        if (href.startsWith('mailto:')) {
          const email = href.replace('mailto:', '').split('?')[0].trim();
          if (email && email.includes('@') && !subEmails.includes(email)) subEmails.push(email.toLowerCase());
        }
        if (href.startsWith('tel:')) {
          const rawPhone = href.replace('tel:', '').trim();
          const validP = filterValidPhoneNumber(rawPhone);
          if (validP && !subPhones.includes(validP)) subPhones.push(validP);
        }
      });

      // Scan full internal subpage text & markup for plain-text email addresses
      const pageTextEmails = extractEmailsFromText(page$.html() + ' ' + page$.text());
      pageTextEmails.forEach(em => { if (!subEmails.includes(em)) subEmails.push(em); });

      const textSnippet = pageParagraphs.slice(0, 12).join(' ');
      if (pageHeadings.length > 0 || pageParagraphs.length > 0) {
        crawledTexts.push(`[Page URL: ${pageUrl}]\nHeadings: ${pageHeadings.join(' | ')}\nContent: ${textSnippet}`);
      }

      crawledPageDetails.push({
        url: pageUrl,
        pageTitle: pageTitle,
        pageType: pageCategoryInfo.category || 'INTERNAL_SUBPAGE',
        textEvidence: textSnippet,
        headings: pageHeadings.slice(0, 8),
        emails: subEmails,
        phones: subPhones,
        socialPlatforms: subSocials,
        metadata: { metaTitle: pageTitle, metaDescription: '' },
        jsonLd: null
      });
    } catch (e) {}
  }));

  return {
    internalPages: selectedPages,
    crawledPageDetails,
    deepContextText: crawledTexts.join('\n\n'),
    aboutPageHeadings,
    aboutPageText,
    contactPageText,
    pressKitText,
    navCategories: navCategories.slice(0, 15)
  };
}

/**
 * Capture screenshots for crawled pages (Homepage + selected internal pages)
 */
async function capturePageScreenshots(pagesList) {
  if (!puppeteer) {
    console.warn('[SCREENSHOT] Puppeteer not available, skipping visual screenshot capture');
    return pagesList.map(p => ({
      ...p,
      screenshot: {
        base64: null,
        mimeType: 'image/png',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        error: 'Puppeteer library unavailable'
      }
    }));
  }

  let browser = null;
  const pagesEvidence = [];
  let successCount = 0;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    for (const pageItem of pagesList) {
      const pageUrl = pageItem.url;
      console.log(`[SCREENSHOT] Capturing: ${pageUrl}`);

      let pageInstance = null;
      try {
        pageInstance = await browser.newPage();
        await pageInstance.setViewport({ width: 1280, height: 800 });

        // Navigate to page
        await pageInstance.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Allow 1s for lazy-loaded images/fonts & JS rendering
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Extract live rendered DOM text for Single Page Applications (React/Vue/Next.js)
        let liveRenderedText = '';
        try {
          liveRenderedText = await pageInstance.evaluate(() => {
            const clone = document.body ? document.body.cloneNode(true) : null;
            if (!clone) return '';
            const removeEls = clone.querySelectorAll('script, style, noscript, svg, iframe');
            removeEls.forEach(el => el.remove());
            return clone.innerText.replace(/\s+/g, ' ').trim();
          });
        } catch (e) {}

        const base64Screenshot = await pageInstance.screenshot({
          type: 'png',
          encoding: 'base64',
          fullPage: false
        });

        console.log(`[SCREENSHOT] Captured successfully: ${pageUrl} (Live DOM Text: ${liveRenderedText.length} chars)`);
        successCount++;

        let enrichedTextEvidence = pageItem.textEvidence || '';
        if (liveRenderedText && (liveRenderedText.length > enrichedTextEvidence.length || enrichedTextEvidence.length < 50)) {
          enrichedTextEvidence = liveRenderedText.slice(0, 1200);
        }

        pagesEvidence.push({
          ...pageItem,
          textEvidence: enrichedTextEvidence,
          screenshot: {
            base64: base64Screenshot,
            mimeType: 'image/png',
            timestamp: new Date().toISOString(),
            status: 'SUCCESS',
            error: null
          }
        });
      } catch (err) {
        console.warn(`[SCREENSHOT] Failed: ${pageUrl} (${err.message})`);
        pagesEvidence.push({
          ...pageItem,
          screenshot: {
            base64: null,
            mimeType: 'image/png',
            timestamp: new Date().toISOString(),
            status: 'FAILED',
            error: err.message
          }
        });
      } finally {
        if (pageInstance) {
          try { await pageInstance.close(); } catch (e) {}
        }
      }
    }
  } catch (browserErr) {
    console.error(`[SCREENSHOT] Browser launch failed: ${browserErr.message}`);
    for (const pageItem of pagesList) {
      if (!pagesEvidence.some(p => p.url === pageItem.url)) {
        pagesEvidence.push({
          ...pageItem,
          screenshot: {
            base64: null,
            mimeType: 'image/png',
            timestamp: new Date().toISOString(),
            status: 'FAILED',
            error: browserErr.message
          }
        });
      }
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }

  console.log(`[SCREENSHOT] Captured ${successCount} / ${pagesList.length} crawled pages`);
  return pagesEvidence;
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

    // Extract plain-text email addresses from clean body text & HTML markup
    const textEmails = extractEmailsFromText(cleanBodyText + ' ' + html);
    textEmails.forEach(em => {
      if (!emails.includes(em)) emails.push(em);
    });

    const hqMatch = cleanBodyText.match(/(?:headquarters|registered office|corporate office|based in|located in)[\s:]+([A-Z][a-zA-Z\s,.'-]{3,60})/i);
    if (hqMatch && hqMatch[1]) {
      const candidateHQ = hqMatch[1].trim().split('\n')[0].trim();
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
  let navCategories = [];
  let brandColors = [];

  let effectiveCheerio = $;
  if (!effectiveCheerio && html) {
    try { effectiveCheerio = cheerio.load(html); } catch (e) {}
  }

  const crawlPromise = effectiveCheerio ? crawlBrandContext(cleanUrl, effectiveCheerio) : Promise.resolve({ internalPages: [] });
  const colorPromise = extractAccurateBrandColors(cleanUrl, domainName, effectiveCheerio, html, logoUrl);

  const [deepData, colorsResult] = await Promise.all([crawlPromise, colorPromise]);

  if (effectiveCheerio) {
    deepContextText = deepData.deepContextText || '';
    aboutPageHeadings = deepData.aboutPageHeadings || [];
    aboutPageText = deepData.aboutPageText || '';
    contactPageText = deepData.contactPageText || '';
    pressKitText = deepData.pressKitText || '';
    navCategories = deepData.navCategories || [];
    if (deepData.internalPages && deepData.internalPages.length > 0) {
      crawledSources.push('INTERNAL_ABOUT_PAGES');
      console.log(`📄 [SCRAPER] Discovered & Parsed ${deepData.internalPages.length} Internal Pages (${deepData.internalPages.join(', ')})`);
    }

    if (deepData.crawledPageDetails) {
      deepData.crawledPageDetails.forEach(page => {
        if (page.emails) page.emails.forEach(em => { if (!emails.includes(em)) emails.push(em); });
        if (page.phones) page.phones.forEach(ph => { if (!phones.includes(ph)) phones.push(ph); });
        if (page.socialPlatforms) page.socialPlatforms.forEach(soc => { if (!socialPlatforms.includes(soc)) socialPlatforms.push(soc); });
      });
    }
  }

  // STEP 5: Capture Visual Screenshots for Homepage & Selected Internal Pages
  const homepageEvidence = {
    url: cleanUrl,
    pageTitle: metaTitle || brandName,
    pageType: 'HOMEPAGE',
    textEvidence: (headings.slice(0, 8).join(' | ') + ' ' + metaDescription).trim(),
    headings: headings.slice(0, 8),
    metadata: { metaTitle, metaDescription },
    jsonLd: { schemaLogo, schemaName, schemaSlogan, schemaIndustry, schemaAddress }
  };

  const pagesToScreenshot = [
    homepageEvidence,
    ...(deepData?.crawledPageDetails || [])
  ];

  console.log(`📸 [SCRAPER] Step 5: Capturing visual screenshots for ${pagesToScreenshot.length} pages...`);
  const pagesEvidence = await capturePageScreenshots(pagesToScreenshot);

  // Enrich deepContextText with Puppeteer live rendered DOM text (Guarantees SPA text support)
  const puppeteerTextSnippets = pagesEvidence
    .filter(p => p.textEvidence && p.textEvidence.length > 50)
    .map(p => `[Page URL: ${p.url}]\nContent: ${p.textEvidence}`);

  if (puppeteerTextSnippets.length > 0) {
    deepContextText = (deepContextText + '\n\n' + puppeteerTextSnippets.join('\n\n')).trim();
  }

  brandColors = colorsResult;
  console.log(`🎨 [SCRAPER] Step 3: Extracted Logo & Color Palette (${brandColors.map(c => c.hex).join(', ')})`);
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
    navCategories: deepData?.navCategories || [],
    brandColors,
    socialPlatforms,
    emails,
    phones,
    hqAddress: hqAddress || '',
    deepContextText,
    crawledSources,
    pagesEvidence
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
