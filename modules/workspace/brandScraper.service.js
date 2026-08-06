const axios = require('axios');
const cheerio = require('cheerio');
const { Vibrant } = require('node-vibrant/node');
const { searchTavily, extractTavilyUrl } = require('../../services/tavilyService');

function deduplicateAndFilterColors(colors) {
  const socialBlacklist = [
    '#E60023', '#BD081C', '#BD081D', '#FF4500', '#B92B27',
    '#1DA1F2', '#1A91DA', '#1877F2', '#3B5998', '#0A66C2',
    '#0077B5', '#FF0000', '#282828', '#E1306C', '#C13584',
    '#833AB4', '#000000', '#FFFFFF', '#F8FAFC', '#0F172A',
    '#E2E8F0', '#CCCCCC', '#333333', '#666666', '#999999', '#111111'
  ];

  const unique = [];
  for (const col of colors) {
    if (!col || typeof col !== 'string') continue;
    const upper = col.trim().toUpperCase();
    if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i.test(upper)) continue;
    if (socialBlacklist.includes(upper)) continue;

    let isTooSimilar = false;
    for (const existing of unique) {
      if (existing === upper) {
        isTooSimilar = true;
        break;
      }
    }

    if (!isTooSimilar) {
      unique.push(upper);
      if (unique.length >= 4) break;
    }
  }

  return unique;
}

function extractCleanBrandName(rawHost, overrideName = '') {
  if (overrideName && overrideName.trim() && !overrideName.toUpperCase().startsWith('WWW')) {
    return overrideName.trim();
  }

  const h = rawHost.replace(/^(www\d*|m|store|shop|en-in|in|us|uk)\./i, '');
  const basePart = h.split('.')[0];
  
  return basePart
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
    hslToHex(hue1, 80, 48),
    hslToHex(hue2, 85, 42),
    hslToHex(hue3, 70, 52),
    '#0F172A'
  ];
}

async function extractLogoPixelColors(logoUrl) {
  if (!logoUrl) return [];
  try {
    const palette = await Vibrant.from(logoUrl).getPalette();
    const hexes = [];
    ['Vibrant', 'Muted', 'DarkVibrant', 'LightVibrant', 'DarkMuted'].forEach(key => {
      if (palette[key] && palette[key].hex) {
        hexes.push(palette[key].hex.toUpperCase());
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
  let schemaSameAs = [];

  if (!$) return { schemaLogo, schemaName, schemaSameAs };

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
          if (Array.isArray(item.sameAs)) schemaSameAs = item.sameAs;
        }
      });
    } catch (e) {}
  });

  return { schemaLogo, schemaName, schemaSameAs };
}

async function extractAccurateBrandColors(cleanUrl, domainName, $, html, logoUrl = '') {
  const logoBrandHexes = [];
  const tokenBrandHexes = [];

  // Extract pixel colors from logo image via node-vibrant
  if (logoUrl) {
    const pixelColors = await extractLogoPixelColors(logoUrl);
    pixelColors.forEach(c => logoBrandHexes.push(c));
  }

  if ($) {
    // 1. Vector SVG Logo fill & stroke values
    $('svg.logo, svg[class*="logo"], a[class*="logo"] svg, header svg[class*="logo"], nav svg[class*="logo"], .brand-logo svg, #logo svg').each((i, el) => {
      const fill = $(el).attr('fill') || $(el).find('path').attr('fill');
      const stroke = $(el).attr('stroke') || $(el).find('path').attr('stroke');
      [fill, stroke].forEach(c => {
        if (c && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i.test(c.trim())) {
          logoBrandHexes.push(c.trim().toUpperCase());
        }
      });
    });

    // 2. Meta Theme-Color & Tile Color
    const themeMeta = $('meta[name="theme-color"]').attr('content') || 
                      $('meta[name="msapplication-TileColor"]').attr('content') ||
                      $('meta[name="apple-mobile-web-app-status-bar-style"]').attr('content');
    if (themeMeta && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i.test(themeMeta.trim())) {
      logoBrandHexes.push(themeMeta.trim().toUpperCase());
    }

    // 3. Brand Design Tokens / CSS Variables (--primary-color, --brand-color, --logo-color)
    $('style').each((i, el) => {
      const styleText = $(el).html() || '';
      const varMatches = styleText.match(/--(?:primary|brand|logo|theme-main|accent)(?:-color)?:\s*(#[A-Fa-f0-9]{6})/gi) || [];
      varMatches.forEach(m => {
        const hex = m.match(/#[A-Fa-f0-9]{6}/i)?.[0];
        if (hex) tokenBrandHexes.push(hex.toUpperCase());
      });
    });
  }

  const combinedCandidates = [...logoBrandHexes, ...tokenBrandHexes];
  const cleanHexes = deduplicateAndFilterColors(combinedCandidates);

  let finalHexes = [];
  if (cleanHexes.length >= 2) {
    finalHexes = cleanHexes.slice(0, 4);
  } else {
    finalHexes = generateDynamicBrandPalette(domainName);
  }

  const roles = ['Brand Primary', 'Brand Secondary', 'Accent', 'Dark Neutral'];
  const names = ['Primary', 'Secondary', 'Accent', 'Dark'];

  return finalHexes.map((hex, index) => ({
    name: names[index] || `Brand Color ${index + 1}`,
    hex: hex.toUpperCase(),
    role: roles[index] || 'Brand Accent'
  }));
}

async function crawlBrandContext(cleanUrl, $) {
  const internalPages = [];
  const crawledTexts = [];

  if (!$) return { internalPages, deepContextText: '' };

  const baseUrl = new URL(cleanUrl);
  const priorityPatterns = [/about/i, /who-we-are/i, /our-story/i, /company/i, /services/i, /products/i, /contact/i, /solutions/i, /features/i, /overview/i, /history/i];

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

  // Crawl up to 6 key internal pages
  const selectedPages = internalPages.slice(0, 6);

  // Concurrently fetch all internal pages
  await Promise.all(selectedPages.map(async (pageUrl) => {
    try {
      const response = await axios.get(pageUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const page$ = cheerio.load(response.data);

      page$('script, style, nav, footer, iframe, noscript').remove();
      const pageHeadings = [];
      page$('h1, h2, h3').each((i, el) => {
        const txt = page$(el).text().trim();
        if (txt.length > 5 && txt.length < 150) pageHeadings.push(txt);
      });

      const pageParagraphs = [];
      page$('p, article, section').each((i, el) => {
        const txt = page$(el).text().trim();
        if (txt.length > 25 && txt.length < 500) pageParagraphs.push(txt);
      });

      if (pageHeadings.length > 0 || pageParagraphs.length > 0) {
        crawledTexts.push(`[Page URL: ${pageUrl}]\nHeadings: ${pageHeadings.join(' | ')}\nContent: ${pageParagraphs.slice(0, 10).join(' ')}`);
      }
    } catch (e) {}
  }));

  return {
    internalPages: selectedPages,
    deepContextText: crawledTexts.join('\n\n')
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

  const brandName = extractCleanBrandName(domainName, brandNameOverride);

  let html = '';
  let $ = null;
  let crawledSources = ['WEBSITE_HOMEPAGE'];

  // STEP 1: Fast HTTP Fetch & Anti-Bot Bypass
  try {
    const response = await axios.get(cleanUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    html = response.data;
    $ = cheerio.load(html);
  } catch (err) {
    console.log(`Live HTTP fetch note for ${cleanUrl}: ${err.message}. Triggering Tavily AI Web Engine...`);
    const tavilyExtract = await extractTavilyUrl(cleanUrl);
    if (tavilyExtract && tavilyExtract.rawContent) {
      html = tavilyExtract.rawContent;
      $ = cheerio.load(html);
      crawledSources.push('TAVILY_ANTI_BOT_BYPASS');
    } else {
      const tavilySearch = await searchTavily(`brand positioning and official details for ${domainName}`);
      if (tavilySearch && tavilySearch.answer) {
        html = `<html><body><h1>${tavilySearch.answer}</h1></body></html>`;
        $ = cheerio.load(html);
        crawledSources.push('TAVILY_DEEP_SEARCH');
      }
    }
  }

  // STEP 2: Dual-Mode Logo Extraction (Google Favicon 128px + Clearbit + Schema JSON-LD + OpenGraph)
  const rootDomain = domainName.replace(/^www\./i, '');
  const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`;
  const clearbitLogoUrl = `https://logo.clearbit.com/${rootDomain}`;
  let faviconUrl = googleFaviconUrl;
  let logoUrl = googleFaviconUrl; // Primary high-confidence fallback

  const { schemaLogo, schemaName, schemaSameAs } = extractSchemaJsonLd($);
  let parsedLogo = schemaLogo;

  if ($) {
    const linkFavicon = $('link[rel*="icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href');
    if (linkFavicon) {
      if (linkFavicon.startsWith('http')) faviconUrl = linkFavicon;
      else if (linkFavicon.startsWith('//')) faviconUrl = 'https:' + linkFavicon;
      else faviconUrl = cleanUrl.replace(/\/$/, '') + (linkFavicon.startsWith('/') ? linkFavicon : '/' + linkFavicon);
    }

    if (!parsedLogo) {
      parsedLogo = $('meta[property="og:image"]').attr('content') ||
                   $('header img[src*="logo"]').attr('src') ||
                   $('img[class*="logo"]').attr('src') ||
                   $('img[alt*="logo"]').attr('src');
    }
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
  let headings = [];
  let socialPlatforms = schemaSameAs || [];
  let emails = [];
  let phones = [];
  let hqAddress = '';

  if ($) {
    metaTitle = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

    $('h1, h2, h3').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5 && text.length < 120 && !headings.includes(text)) {
        headings.push(text);
      }
    });

    $('a[href]').each((i, el) => {
      const href = $(el).attr('href') || '';
      if (/facebook\.com/i.test(href) && !socialPlatforms.includes('Facebook')) socialPlatforms.push('Facebook');
      if (/instagram\.com/i.test(href) && !socialPlatforms.includes('Instagram')) socialPlatforms.push('Instagram');
      if (/linkedin\.com/i.test(href) && !socialPlatforms.includes('LinkedIn')) socialPlatforms.push('LinkedIn');
      if (/twitter\.com|x\.com/i.test(href) && !socialPlatforms.includes('X (Twitter)')) socialPlatforms.push('X (Twitter)');
      if (/youtube\.com/i.test(href) && !socialPlatforms.includes('YouTube')) socialPlatforms.push('YouTube');

      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email && !emails.includes(email)) emails.push(email);
      }
      if (href.startsWith('tel:')) {
        const phone = href.replace('tel:', '').trim().replace(/^\++/, '+');
        if (phone && !phones.includes(phone)) phones.push(phone);
      }
    });

    // Extract official toll-free / helpline phone numbers & HQ Location from body text
    const pageText = $.text() || '';
    const phoneMatches = pageText.match(/(?:1800[-\s]?\d{3}[-\s]?\d{4}|\+?91[-\s]?\d{10}|\+?1[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{4})/gi) || [];
    phoneMatches.forEach(p => {
      const cleanP = p.trim().replace(/^\++/, '+');
      if (cleanP && cleanP.length >= 10 && !phones.includes(cleanP)) {
        phones.push(cleanP);
      }
    });

    const hqMatch = pageText.match(/(?:headquarters|registered office|corporate office|address|based in|located in|h\.o\.)[\s:]+([A-Z][a-zA-Z\s,.-]{5,60})/i);
    if (hqMatch && hqMatch[1]) {
      hqAddress = hqMatch[1].trim().split('\n')[0].slice(0, 50);
    }
  }


  // STEP 4: Deep Content Crawl
  let deepContextText = '';
  if ($) {
    const deepData = await crawlBrandContext(cleanUrl, $);
    deepContextText = deepData.deepContextText;
    if (deepData.internalPages.length > 0) {
      crawledSources.push('INTERNAL_ABOUT_PAGES');
    }
  }

  // STEP 3: Hybrid Color Extraction (Logo Image Pixels + SVG Vector Fills + Design Tokens)
  let brandColors = await extractAccurateBrandColors(cleanUrl, domainName, $, html, logoUrl);

  return {
    cleanUrl,
    domainName,
    brandName: schemaName || brandName,
    metaTitle,
    metaDescription,
    faviconUrl,
    logoUrl,
    headings: headings.slice(0, 8),
    brandColors,
    socialPlatforms,
    emails,
    phones,
    hqAddress: hqAddress || '',
    deepContextText,
    crawledSources
  };

}

module.exports = {
  scrapeBrandWebsite,
  extractCleanBrandName,
  extractAccurateBrandColors,
  crawlBrandContext,
  generateDynamicBrandPalette,
  extractLogoPixelColors,
  extractSchemaJsonLd
};
