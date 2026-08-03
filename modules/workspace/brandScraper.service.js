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

const COMPOUND_BRAND_NAMES = {
  'boat': 'boAt',
  'boatlifestyle': 'boAt',
  'perfettivanmelle': 'Perfetti Van Melle',
  'peterengland': 'Peter England',
  'zedblack': 'Zed Black',
  'asianpaints': 'Asian Paints',
  'urbancompany': 'Urban Company',
  'sugarcosmetics': 'Sugar Cosmetics',
  'lotusbiscoff': 'Lotus Biscoff',
  'royalenfield': 'Royal Enfield',
  'redbull': 'Red Bull',
  'harleydavidson': 'Harley Davidson',
  'mercedesbenz': 'Mercedes Benz',
  'astonmartin': 'Aston Martin',
  'burgerking': 'Burger King',
  'pizzahut': 'Pizza Hut',
  'subway': 'Subway',
  'starbucks': 'Starbucks',
  'dunkindonuts': "Dunkin' Donuts",
  'tacobell': 'Taco Bell',
  'marutisuzuki': 'Maruti Suzuki',
  'hyundaimotors': 'Hyundai Motors',
  'generalmotors': 'General Motors',
  'heromotocorp': 'Hero MotoCorp',
  'iciciprudential': 'ICICI Prudential',
  'hdfclife': 'HDFC Life',
  'sbilife': 'SBI Life',
  'kotakmahindra': 'Kotak Mahindra',
  'bajajallianz': 'Bajaj Allianz',
  'adityabirla': 'Aditya Birla'
};

function formatCleanSpacedBrandName(name) {
  if (!name || typeof name !== 'string') return '';

  let clean = name.trim();

  // Check known compound brand lookup dictionary
  const strippedKey = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COMPOUND_BRAND_NAMES[strippedKey]) {
    return COMPOUND_BRAND_NAMES[strippedKey];
  }

  // Expand CamelCase / PascalCase transitions (e.g. PerfettiVanMelle -> Perfetti Van Melle)
  clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Capitalize individual words
  return clean
    .split(/[\s\-_]+/)
    .filter(Boolean)
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

  // Crawl up to 10 key internal pages
  const selectedPages = internalPages.slice(0, 10);

  // Concurrently fetch all internal pages
  await Promise.all(selectedPages.map(async (pageUrl) => {
    try {
      const isAboutPage = /about|who-we-are|our-story|company/i.test(pageUrl);
      const isContactPage = /contact|locations|offices|headquarters/i.test(pageUrl);
      const isPressPage = /press|media|newsroom|brand/i.test(pageUrl);

      const response = await axios.get(pageUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
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

  const brandName = extractCleanBrandName(domainName, brandNameOverride);

  console.log(`\n🌐 [SCRAPER] 🚀 Initiating Live Web Scrape & Brand DNA Setup for: ${cleanUrl} (${brandName})`);

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
    console.log(`📡 [SCRAPER] Step 1: Live Homepage HTTP Fetch Successful (200 OK)`);
  } catch (err) {
    console.log(`🛡️ [SCRAPER] Step 1: Anti-Bot/Network Notice (${err.message}). Triggering Tavily AI Web Engine...`);
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
      parsedLogo = $('meta[property="og:image"]').attr('content') ||
                   $('header img[src*="logo"]').attr('src') ||
                   $('img[class*="logo"]').attr('src') ||
                   $('img[alt*="logo"]').attr('src');
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
  let headings = [];
  let socialPlatforms = schemaSameAs || [];
  let emails = [];
  let phones = [];
  let hqAddress = '';

  if ($) {
    metaTitle = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

    const uiFilter = /cart|checkout|subtotal|shipping|sign in|login|register|cookie|privacy|terms|account|wishlist|quick view|filter by|sort by|your cart is empty|empty cart|my cart|search products|add to cart/i;
    $('h1, h2, h3').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5 && text.length < 120 && !uiFilter.test(text) && !headings.includes(text)) {
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


  // STEP 4: Deep Content Crawl & About Page Scrape
  let deepContextText = '';
  let aboutPageHeadings = [];
  let aboutPageText = '';
  let contactPageText = '';
  let pressKitText = '';

  if ($) {
    console.log(`📄 [SCRAPER] Step 2: Crawling About Page & Internal Links...`);
    const deepData = await crawlBrandContext(cleanUrl, $);
    deepContextText = deepData.deepContextText;
    aboutPageHeadings = deepData.aboutPageHeadings || [];
    aboutPageText = deepData.aboutPageText || '';
    contactPageText = deepData.contactPageText || '';
    pressKitText = deepData.pressKitText || '';
    if (deepData.internalPages.length > 0) {
      crawledSources.push('INTERNAL_ABOUT_PAGES');
      console.log(`📄 [SCRAPER] Discovered & Parsed ${deepData.internalPages.length} Internal Pages (${deepData.internalPages.join(', ')})`);
    }
  }

  // STEP 3: Hybrid Color Extraction (Logo Image Pixels + SVG Vector Fills + Design Tokens)
  let brandColors = await extractAccurateBrandColors(cleanUrl, domainName, $, html, logoUrl);
  console.log(`🎨 [SCRAPER] Step 3: Extracted Logo & Color Palette (${brandColors.map(c => c.hex).join(', ')})`);
  console.log(`🔍 [SCRAPER] Step 4: JSON-LD Schema & DOM Signals Parsed (Brand: "${schemaName || brandName}", Schema Slogan: "${schemaSlogan || 'N/A'}")`);

  return {
    cleanUrl,
    domainName,
    brandName: schemaName || brandName,
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

module.exports = {
  scrapeBrandWebsite,
  extractCleanBrandName,
  formatCleanSpacedBrandName,
  extractAccurateBrandColors,
  crawlBrandContext,
  generateDynamicBrandPalette,
  extractLogoPixelColors,
  extractSchemaJsonLd
};
