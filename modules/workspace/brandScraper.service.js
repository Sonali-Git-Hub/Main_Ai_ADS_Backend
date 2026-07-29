const axios = require('axios');
const cheerio = require('cheerio');

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
  
  // Format brand name naturally (e.g., buyhawkins -> Buyhawkins, coca-cola -> Coca-Cola)
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

function extractAccurateBrandColors(cleanUrl, domainName, $, html) {
  const extractedCandidateColors = [];

  if ($) {
    // 1. Meta Theme-Color & Tile Color
    const themeMeta = $('meta[name="theme-color"]').attr('content') || 
                      $('meta[name="msapplication-TileColor"]').attr('content') ||
                      $('meta[name="apple-mobile-web-app-status-bar-style"]').attr('content');
    if (themeMeta && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i.test(themeMeta.trim())) {
      extractedCandidateColors.push(themeMeta.trim().toUpperCase());
    }

    // 2. SVG Logo & Path Fill/Stroke Attributes
    $('svg.logo, svg[class*="logo"], a[class*="logo"] svg, header svg, nav svg, .brand svg').each((i, el) => {
      const fill = $(el).attr('fill') || $(el).find('path').attr('fill');
      const stroke = $(el).attr('stroke') || $(el).find('path').attr('stroke');
      [fill, stroke].forEach(c => {
        if (c && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i.test(c.trim())) {
          extractedCandidateColors.push(c.trim().toUpperCase());
        }
      });
    });

    // 3. CSS Variables (--primary, --brand, --main, --accent)
    $('style').each((i, el) => {
      const styleText = $(el).html() || '';
      const varMatches = styleText.match(/--(?:primary|brand|theme|main|accent|color)(?:-color)?:\s*(#[A-Fa-f0-9]{6})/gi) || [];
      varMatches.forEach(m => {
        const hex = m.match(/#[A-Fa-f0-9]{6}/i)?.[0];
        if (hex) extractedCandidateColors.push(hex.toUpperCase());
      });
    });

    // 4. Header, Nav, CTA Button, Hero Inline CSS Styles
    $('header, nav, .navbar, button.btn-primary, .cta-button, .hero, .banner, footer').each((i, el) => {
      const styleAttr = $(el).attr('style') || '';
      const bgMatch = styleAttr.match(/background(?:-color)?:\s*(#[A-Fa-f0-9]{6})/i);
      const colorMatch = styleAttr.match(/(?:^|;)color:\s*(#[A-Fa-f0-9]{6})/i);

      if (bgMatch && bgMatch[1]) extractedCandidateColors.push(bgMatch[1].toUpperCase());
      if (colorMatch && colorMatch[1]) extractedCandidateColors.push(colorMatch[1].toUpperCase());
    });
  }

  // 5. HTML Regex Hex Pattern Match (Filtered against social media icons & generic black/white)
  if (html) {
    const socialBlacklist = [
      '#E60023', '#BD081C', '#BD081D', '#FF4500', '#B92B27',
      '#1DA1F2', '#1A91DA', '#1877F2', '#3B5998', '#0A66C2',
      '#0077B5', '#FF0000', '#282828', '#E1306C', '#C13584',
      '#833AB4', '#000000', '#FFFFFF', '#F8FAFC', '#0F172A',
      '#E2E8F0', '#CCCCCC', '#333333', '#666666', '#999999', '#111111'
    ];

    const allHexes = html.match(/#(?:[A-Fa-f0-9]{6})/gi) || [];
    const counts = {};
    allHexes.forEach(h => {
      const upper = h.toUpperCase();
      if (!socialBlacklist.includes(upper)) {
        counts[upper] = (counts[upper] || 0) + 1;
      }
    });

    const sortedHexes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    sortedHexes.slice(0, 5).forEach(h => extractedCandidateColors.push(h));
  }

  const cleanColors = deduplicateAndFilterColors(extractedCandidateColors);
  if (cleanColors.length >= 2) {
    return cleanColors.slice(0, 4);
  }

  // 6. 100% Dynamic HSL Color Generator for Any URL
  return generateDynamicBrandPalette(domainName);
}

async function crawlBrandContext(cleanUrl, $) {
  const internalPages = [];
  const crawledTexts = [];

  if (!$) return { internalPages, deepContextText: '' };

  const baseUrl = new URL(cleanUrl);
  const priorityPatterns = [/about/i, /who-we-are/i, /our-story/i, /company/i, /services/i, /products/i];

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

  const selectedPages = internalPages.slice(0, 5);

  for (const pageUrl of selectedPages) {
    try {
      const response = await axios.get(pageUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const page$ = cheerio.load(response.data);

      page$('script, style, nav, footer, iframe').remove();
      const pageHeadings = [];
      page$('h1, h2, h3').each((i, el) => {
        const txt = page$(el).text().trim();
        if (txt.length > 10 && txt.length < 150) pageHeadings.push(txt);
      });

      const pageParagraphs = [];
      page$('p').each((i, el) => {
        const txt = page$(el).text().trim();
        if (txt.length > 30 && txt.length < 300) pageParagraphs.push(txt);
      });

      if (pageHeadings.length > 0 || pageParagraphs.length > 0) {
        crawledTexts.push(`[Source: ${pageUrl}] ${pageHeadings.join(' | ')} ${pageParagraphs.slice(0, 3).join(' ')}`);
      }
    } catch (e) {}
  }

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
    console.log(`Live HTTP fetch note for ${cleanUrl}: ${err.message}`);
  }

  let metaTitle = '';
  let metaDescription = '';
  let faviconUrl = `https://www.google.com/s2/favicons?domain=${domainName}&sz=128`;
  let headings = [];
  let socialPlatforms = [];
  let emails = [];
  let phones = [];

  if ($) {
    metaTitle = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';

    const linkFavicon = $('link[rel*="icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href');
    if (linkFavicon) {
      if (linkFavicon.startsWith('http')) faviconUrl = linkFavicon;
      else if (linkFavicon.startsWith('//')) faviconUrl = 'https:' + linkFavicon;
      else faviconUrl = cleanUrl.replace(/\/$/, '') + (linkFavicon.startsWith('/') ? linkFavicon : '/' + linkFavicon);
    }

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
        const phone = href.replace('tel:', '').trim();
        if (phone && !phones.includes(phone)) phones.push(phone);
      }
    });
  }

  let deepContextText = '';
  if ($) {
    const deepData = await crawlBrandContext(cleanUrl, $);
    deepContextText = deepData.deepContextText;
    if (deepData.internalPages.length > 0) {
      crawledSources.push('INTERNAL_ABOUT_PAGES');
    }
  }

  let brandColors = extractAccurateBrandColors(cleanUrl, domainName, $, html);

  return {
    cleanUrl,
    domainName,
    brandName,
    metaTitle,
    metaDescription,
    faviconUrl,
    logoUrl: faviconUrl,
    headings: headings.slice(0, 8),
    brandColors,
    socialPlatforms,
    emails,
    phones,
    deepContextText,
    crawledSources
  };
}

module.exports = {
  scrapeBrandWebsite,
  extractCleanBrandName,
  extractAccurateBrandColors,
  crawlBrandContext,
  generateDynamicBrandPalette
};
