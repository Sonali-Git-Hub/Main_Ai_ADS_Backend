/**
 * chatEditInterpreter.service.js
 * Universal Autonomous Chat Edit Interpreter & Source Code Modifier
 *
 * Capabilities:
 * 1. Semantic Text, Brand Name & Copy Replacer (with typo tolerance & prefix stripping).
 * 2. Color & Theme Palette Transformer (Red, Blue, Green, Purple, Dark, Luxury Ivory, Gold, etc.).
 * 3. Currency & Pricing Transformer (Indian Rupees INR / ₹, USD $, EUR €, GBP £).
 * 4. AI Component & Data Engine: Direct surgical updates to siteData.js, Navbar.jsx, Hero.jsx, and pages.
 * 5. Automatic Vite Rebuild & Hot Sandbox Reload.
 */

const fs = require('fs');
const path = require('path');
const { generateJSON } = require('../../../services/aiService');
const projectSandboxService = require('../sandbox/projectSandbox.service');
const storageService = require('./ProjectStorageService');

/**
 * Extracts explicit text replacement intent from natural language prompts
 */
function extractTextReplacementIntent(prompt = '') {
  let p = prompt.trim();

  // Pattern A: "[Prefix] X in place of this write Y" or "X ki jagah Y likho"
  const mA = p.match(/^["']?(.+?)["']?\s+(?:in\s+place\s+of\s+this|ki\s+jagah|ke\s+jagah)\s+(?:write|put|use|set|likho|karo|likh\s+do|kar\s+do)?\s*["']?([^"'\n]+?)["']?$/i);
  if (mA && mA[1] && mA[2] && mA[1].toLowerCase() !== 'in') {
    let fromText = mA[1].trim().replace(/^(?:change|chnage|chagne|update|replace|set|make)\s+/i, '');
    return { fromText, toText: mA[2].trim(), type: 'replace_text' };
  }

  // Pattern B: "in place of X write Y" / "instead of X write Y"
  const mB = p.match(/^(?:in\s+place\s+of|instead\s+of)\s+["']?(.+?)["']?\s+(?:write|put|use|set)\s+["']?([^"'\n]+?)["']?$/i);
  if (mB && mB[1] && mB[2] && mB[1].toLowerCase() !== 'this') {
    let fromText = mB[1].trim().replace(/^(?:change|chnage|chagne|update|replace|set|make)\s+/i, '');
    return { fromText, toText: mB[2].trim(), type: 'replace_text' };
  }

  // Pattern C: "replace X with Y" / "replace X to Y" / "replace X by Y"
  const mC = p.match(/^replace\s+["']?(.+?)["']?\s+(?:with|to|by)\s+["']?([^"'\n]+?)["']?$/i);
  if (mC && mC[1] && mC[2]) {
    return { fromText: mC[1].trim(), toText: mC[2].trim(), type: 'replace_text' };
  }

  // Pattern D: "change X to Y" / "rename X to Y"
  const mD = p.match(/^(?:change|chnage|chagne|rename)\s+["']?(.+?)["']?\s+to\s+["']?([^"'\n]+?)["']?$/i);
  if (mD && mD[1] && mD[2] && !mD[1].toLowerCase().includes('color') && !mD[1].toLowerCase().includes('theme') && !mD[1].toLowerCase().includes('hero') && !mD[1].toLowerCase().includes('price') && !mD[1].toLowerCase().includes('rupee')) {
    return { fromText: mD[1].trim(), toText: mD[2].trim(), type: 'replace_text' };
  }

  // Pattern E: "brand name is Y" / "change brand name to Y" / "set title to Y"
  const mE = p.match(/(?:(?:change|chnage|set)\s+brand(?:\s+name)?\s+to|brand(?:\s+name)?\s+(?:is|to|should\s+be)|(?:change|chnage|set)\s+title\s+to)\s+["']?([^"'\n]+?)["']?$/i);
  if (mE && mE[1]) {
    return { toText: mE[1].trim(), type: 'update_brand_name' };
  }

  return null;
}

/**
 * Detects color & theme modification requests
 */
const COLOR_DICTIONARY = {
  red: '#DC2626',
  crimson: '#B91C1C',
  ruby: '#991B1B',
  blue: '#2563EB',
  navy: '#1E40AF',
  cyan: '#06B6D4',
  ocean: '#0284C7',
  green: '#059669',
  emerald: '#047857',
  mint: '#10B981',
  purple: '#7C3AED',
  violet: '#6D28D9',
  lavender: '#8B5CF6',
  orange: '#EA580C',
  amber: '#D97706',
  yellow: '#EAB308',
  gold: '#D97706',
  pink: '#EC4899',
  rose: '#F43F5E',
  black: '#0F172A',
  dark: '#1E293B',
  white: '#FFFFFF',
  ivory: '#FFFFF0',
  teal: '#0D9488'
};

/**
 * Universal Dynamic Multi-Color Intent Extractor
 */
function extractThemeColorIntent(prompt = '') {
  const p = prompt.toLowerCase();

  // Extract all color keywords present in prompt in order of appearance
  const foundColors = [];
  const words = p.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  
  for (const word of words) {
    if (COLOR_DICTIONARY[word] && !foundColors.some(c => c.name === word)) {
      foundColors.push({ name: word, hex: COLOR_DICTIONARY[word] });
    }
  }

  if (foundColors.length === 0) {
    // Check key phrases
    if (p.includes('black and ivory') || p.includes('ivory')) {
      foundColors.push({ name: 'black', hex: '#111111' }, { name: 'ivory', hex: '#FFFFF0' });
    } else if (p.includes('dark mode') || p.includes('midnight')) {
      foundColors.push({ name: 'dark', hex: '#0B0F19' });
    } else {
      return null;
    }
  }

  // Format Theme Name according to all user-selected colors
  const formattedNames = foundColors.map(c => c.name.charAt(0).toUpperCase() + c.name.slice(1));
  const themeName = formattedNames.length > 1
    ? `${formattedNames.join(', ')} Dynamic Palette`
    : `${formattedNames[0]} Theme`;

  const primary = foundColors[0].hex;
  const secondary = foundColors.length > 1 ? foundColors[1].hex : primary;
  const accent = foundColors.length > 2 ? foundColors[2].hex : (foundColors.length > 1 ? foundColors[1].hex : primary);

  return {
    themeName,
    cssUpdates: {
      '--primary-color': primary,
      '--secondary-color': secondary,
      '--accent-color': accent,
      '--cta-bg': primary,
      '--badge-bg': `${secondary}1F`,
      '--badge-text': secondary,
      '--card-border': `${primary}40`
    },
    hex: primary,
    secondaryHex: secondary,
    accentHex: accent,
    colorsList: foundColors
  };
}

/**
 * Detects currency and pricing transformation requests
 */
function extractCurrencyPricingIntent(prompt = '') {
  const p = prompt.toLowerCase();

  // Indian Rupees (INR / ₹)
  if (p.includes('rupee') || p.includes('rupees') || p.includes('inr') || p.includes('₹') || p.includes('indian')) {
    return {
      currency: 'INR',
      symbol: '₹',
      name: 'Indian Rupees (₹)'
    };
  }

  // US Dollars (USD / $)
  if (p.includes('dollar') || p.includes('dollars') || p.includes('usd') || p.includes('$')) {
    return {
      currency: 'USD',
      symbol: '$',
      name: 'US Dollars ($)'
    };
  }

  // Euro (EUR / €)
  if (p.includes('euro') || p.includes('euros') || p.includes('eur') || p.includes('€')) {
    return {
      currency: 'EUR',
      symbol: '€',
      name: 'Euros (€)'
    };
  }

  // British Pounds (GBP / £)
  if (p.includes('pound') || p.includes('pounds') || p.includes('gbp') || p.includes('£')) {
    return {
      currency: 'GBP',
      symbol: '£',
      name: 'British Pounds (£)'
    };
  }

  return null;
}

/**
 * Detects Shopping Cart & E-commerce requests
 */
function extractCartIntent(prompt = '') {
  const p = prompt.toLowerCase();
  if (p.includes('cart') || p.includes('basket') || p.includes('bag') || p.includes('checkout')) {
    return {
      type: 'setup_cart',
      name: 'Interactive Shopping Cart'
    };
  }
  return null;
}

/**
 * Main chat edit processor
 */
async function processChatEditRequest(options = {}) {
  const {
    projectId,
    userPrompt,
    activeRequirement = null,
    activeBlueprint = null,
    reqId: inputReqId = null
  } = options;

  const reqId = inputReqId || `edit_${Math.random().toString(36).substring(2, 8)}`;
  const tag = `[WB:CHAT_EDIT:${reqId}] `;
  console.log(`${tag}Processing chat edit request: "${userPrompt}" for project ${projectId}`);

  if (!projectId) {
    throw new Error('projectId is required for chat editing');
  }
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error('userPrompt is required for chat editing');
  }

  // Locate current v1 project directory
  const projectDir = storageService.getProjectVersionPath(projectId, 'v1');
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found at: ${projectDir}`);
  }

  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) {
    throw new Error(`src directory not found in project: ${srcDir}`);
  }

  const sourceFiles = getSourceFilesMap(srcDir);
  console.log(`${tag}Discovered ${Object.keys(sourceFiles).length} source files in project src/`);

  const modifiedFiles = new Set();
  let summaryExplanation = '';
  let updatedTitle = null;

  // ── LAYER 1: DIRECT TEXT / BRAND / COPY REPLACEMENTS ────────────────────────
  const textIntent = extractTextReplacementIntent(userPrompt);

  if (textIntent) {
    console.log(`${tag}Detected text replacement intent:`, textIntent);

    let fromTarget = textIntent.fromText ? textIntent.fromText.trim() : null;
    const toReplacement = textIntent.toText.trim();

    // Read current title from siteData.js if available
    const siteDataRelPath = Object.keys(sourceFiles).find(f => f.includes('siteData.js'));
    let currentTitle = null;

    if (siteDataRelPath && sourceFiles[siteDataRelPath]) {
      const titleMatch = sourceFiles[siteDataRelPath].match(/"title":\s*"([^"]+)"/);
      if (titleMatch) {
        currentTitle = titleMatch[1];
      }
    }

    // Fuzzy Brand Matching
    if (fromTarget && currentTitle) {
      const ftLower = fromTarget.toLowerCase();
      const ctLower = currentTitle.toLowerCase();
      const ftWords = ftLower.split(/\s+|&/).filter(w => w.length > 2);
      const ctWords = ctLower.split(/\s+|&/).filter(w => w.length > 2);
      const matchWord = ftWords.some(w => ctWords.includes(w));

      if (matchWord || ftLower.includes('haven') || ftLower.includes('hearth') || ftLower.includes('title') || ftLower.includes('brand')) {
        fromTarget = currentTitle;
      }
    } else if (!fromTarget && currentTitle) {
      fromTarget = currentTitle;
    }

    if (fromTarget) {
      console.log(`${tag}Replacing all instances of "${fromTarget}" with "${toReplacement}" across all source files...`);

      const escapedFrom = fromTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const replaceRegex = new RegExp(escapedFrom, 'gi');

      for (const [relPath, content] of Object.entries(sourceFiles)) {
        if (replaceRegex.test(content)) {
          const newContent = content.replace(replaceRegex, toReplacement);
          const fullPath = path.join(srcDir, relPath);
          fs.writeFileSync(fullPath, newContent, 'utf8');
          modifiedFiles.add(`src/${relPath}`);
          sourceFiles[relPath] = newContent;
        }
      }

      const indexHtmlPath = path.join(projectDir, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
        if (replaceRegex.test(htmlContent)) {
          const newHtml = htmlContent.replace(replaceRegex, toReplacement);
          fs.writeFileSync(indexHtmlPath, newHtml, 'utf8');
          modifiedFiles.add('index.html');
        }
      }

      updatedTitle = toReplacement;
      summaryExplanation = `Replaced '${fromTarget}' with '${toReplacement}' across ${modifiedFiles.size} project files.`;
    }
  }

/**
 * Granular Intent Detector for Specific Single-Property Operations
 * Ensures the assistant NEVER converts background-only, button-only, or navbar-only requests into generic theme operations!
 */
function extractGranularStyleIntent(prompt = '') {
  const p = prompt.toLowerCase().trim();

  const extractTargetHex = (str) => {
    const hexMatch = str.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/);
    if (hexMatch) return hexMatch[0];

    if (str.includes('black') || str.includes('pure black')) return '#000000';
    if (str.includes('white') || str.includes('pure white')) return '#FFFFFF';
    if (str.includes('red') || str.includes('crimson')) return '#DC2626';
    if (str.includes('blue') || str.includes('navy')) return '#1E40AF';
    if (str.includes('green') || str.includes('emerald')) return '#059669';
    if (str.includes('purple') || str.includes('violet')) return '#7C3AED';
    if (str.includes('yellow') || str.includes('amber')) return '#D97706';
    if (str.includes('orange')) return '#EA580C';
    if (str.includes('pink') || str.includes('rose')) return '#EC4899';
    if (str.includes('grey') || str.includes('gray')) return '#4B5563';
    return null;
  };

  const targetHex = extractTargetHex(p);

  // 1. BACKGROUND ONLY INTENT (Highest Priority if prompt asks for website/site/page/body background)
  const isExplicitBgRequest = p.includes('website background') ||
                               p.includes('site background') ||
                               p.includes('body background') ||
                               p.includes('page background') ||
                               p.includes('background color') ||
                               p.includes('bg color');

  if (isExplicitBgRequest && targetHex) {
    return {
      type: 'BACKGROUND_ONLY',
      hex: targetHex,
      description: `Updated website background color to ${targetHex}.`
    };
  }

  // 2. BUTTON ONLY INTENT (If prompt asks for button/cta color specifically)
  const isExplicitButtonRequest = p.includes('button color') ||
                                   p.includes('cta color') ||
                                   p.includes('btn color') ||
                                   (p.includes('button') && (p.includes('color') || p.includes('red') || p.includes('blue') || p.includes('green')));

  if (isExplicitButtonRequest && targetHex && !isExplicitBgRequest) {
    return {
      type: 'BUTTON_ONLY',
      hex: targetHex,
      description: `Updated button color to ${targetHex}.`
    };
  }

  // 3. NAVBAR HOVER INTENT (If prompt asks to change hover color on navbar links)
  const isNavbarHoverRequest = p.includes('hover') && (p.includes('navbar') || p.includes('nav') || p.includes('link') || p.includes('bakemenu') || p.includes('home') || p.includes('menu'));

  if (isNavbarHoverRequest && targetHex && !isExplicitBgRequest) {
    return {
      type: 'NAVBAR_HOVER',
      hex: targetHex,
      description: `Updated navbar link hover color to ${targetHex}.`
    };
  }

  // 4. NAVBAR ONLY INTENT (Only if explicitly asking to change navbar background specifically, without requesting website background!)
  const isExplicitNavbarRequest = (p.includes('navbar background') || p.includes('header background') || p.includes('navbar color') || p.includes('header color')) &&
                                  !p.includes('website background') && !p.includes('do not change navbar') && !isNavbarHoverRequest;

  if (isExplicitNavbarRequest && targetHex && !isExplicitBgRequest) {
    return {
      type: 'NAVBAR_ONLY',
      hex: targetHex,
      description: `Updated navbar background color to ${targetHex}.`
    };
  }

  return null;
}

  // ── LAYER 2: THEME & COLOR MODIFICATIONS ────────────────────────────────────
  const themeCssPath = Object.keys(sourceFiles).find(f => f.includes('theme.css') || f.includes('styles/theme'));
  const currentThemeCss = themeCssPath ? sourceFiles[themeCssPath] : '';
  const siteDataPath = Object.keys(sourceFiles).find(f => f.includes('siteData.js'));
  const currentSiteData = siteDataPath ? sourceFiles[siteDataPath] : '';

  // ── LAYER 1.5: GRANULAR STYLE & SINGLE PROPERTY MODIFICATIONS ───────────────
  const granularIntent = extractGranularStyleIntent(userPrompt);

  if (granularIntent) {
    console.log(`${tag}Detected granular style intent:`, granularIntent.type, granularIntent.hex);

    if (granularIntent.type === 'BACKGROUND_ONLY') {
      const targetHex = granularIntent.hex;

      // Update ONLY --bg-color in theme.css
      if (themeCssPath && currentThemeCss) {
        let updatedCss = currentThemeCss;
        updatedCss = updatedCss.replace(/--bg-color:\s*[^;]+;/, `--bg-color: ${targetHex};`);
        
        // If background is dark (#000000 or dark hex), update text-color & card-bg to contrast cleanly
        if (targetHex === '#000000' || targetHex.startsWith('#0') || targetHex.startsWith('#1')) {
          updatedCss = updatedCss.replace(/--text-color:\s*[^;]+;/, `--text-color: #F8FAFC;`);
          updatedCss = updatedCss.replace(/--text-muted:\s*[^;]+;/, `--text-muted: #94A3B8;`);
          updatedCss = updatedCss.replace(/--card-bg:\s*[^;]+;/, `--card-bg: #111827;`);
          updatedCss = updatedCss.replace(/--card-border:\s*[^;]+;/, `--card-border: rgba(255, 255, 255, 0.15);`);
        } else {
          updatedCss = updatedCss.replace(/--text-color:\s*[^;]+;/, `--text-color: #1E293B;`);
          updatedCss = updatedCss.replace(/--text-muted:\s*[^;]+;/, `--text-muted: #64748B;`);
        }

        fs.writeFileSync(path.join(srcDir, themeCssPath), updatedCss, 'utf8');
        modifiedFiles.add(`src/${themeCssPath}`);
        sourceFiles[themeCssPath] = updatedCss;
      }

      // Ensure index.css body & hero-mesh-bg dynamically use var(--bg-color)
      const indexCssPath = Object.keys(sourceFiles).find(f => f.includes('index.css'));
      if (indexCssPath && sourceFiles[indexCssPath]) {
        let indexCssContent = sourceFiles[indexCssPath];
        indexCssContent = indexCssContent.replace(/body\s*\{[^}]*\}/, `body {\n  font-family: var(--font-family);\n  background-color: var(--bg-color);\n  color: var(--text-color);\n  line-height: 1.6;\n  -webkit-font-smoothing: antialiased;\n}`);
        if (indexCssContent.includes('.hero-mesh-bg')) {
          indexCssContent = indexCssContent.replace(/\.hero-mesh-bg\s*\{[^}]*\}/, `.hero-mesh-bg {\n  background: var(--bg-color);\n}`);
        }

        fs.writeFileSync(path.join(srcDir, indexCssPath), indexCssContent, 'utf8');
        modifiedFiles.add(`src/${indexCssPath}`);
        sourceFiles[indexCssPath] = indexCssContent;
      }

      summaryExplanation = granularIntent.description;
    } else if (granularIntent.type === 'BUTTON_ONLY') {
      const targetHex = granularIntent.hex;

      // Update ONLY --primary-color and --cta-bg in theme.css
      if (themeCssPath && currentThemeCss) {
        let updatedCss = currentThemeCss;
        updatedCss = updatedCss.replace(/--primary-color:\s*[^;]+;/, `--primary-color: ${targetHex};`);
        updatedCss = updatedCss.replace(/--cta-bg:\s*[^;]+;/, `--cta-bg: ${targetHex};`);

        fs.writeFileSync(path.join(srcDir, themeCssPath), updatedCss, 'utf8');
        modifiedFiles.add(`src/${themeCssPath}`);
        sourceFiles[themeCssPath] = updatedCss;
      }

      summaryExplanation = granularIntent.description;
    } else if (granularIntent.type === 'NAVBAR_HOVER') {
      const targetHex = granularIntent.hex;

      // Update ONLY .nav-link:hover in index.css
      const indexCssPath = Object.keys(sourceFiles).find(f => f.includes('index.css'));
      if (indexCssPath && sourceFiles[indexCssPath]) {
        let indexCssContent = sourceFiles[indexCssPath];
        if (/\.nav-link:hover[^{]*\{[^}]*\}/.test(indexCssContent)) {
          indexCssContent = indexCssContent.replace(/\.nav-link:hover[^{]*\{[^}]*\}/, `.nav-link:hover, .nav-link.active {\n  color: ${targetHex} !important;\n}`);
        } else {
          indexCssContent += `\n.nav-link:hover, .nav-link.active { color: ${targetHex} !important; }\n`;
        }

        fs.writeFileSync(path.join(srcDir, indexCssPath), indexCssContent, 'utf8');
        modifiedFiles.add(`src/${indexCssPath}`);
        sourceFiles[indexCssPath] = indexCssContent;
      }

      summaryExplanation = granularIntent.description;
    } else if (granularIntent.type === 'NAVBAR_ONLY') {
      const targetHex = granularIntent.hex;

      // Update ONLY .navbar-header in index.css
      const indexCssPath = Object.keys(sourceFiles).find(f => f.includes('index.css'));
      if (indexCssPath && sourceFiles[indexCssPath]) {
        let indexCssContent = sourceFiles[indexCssPath];
        if (/\.navbar-header\s*\{[^}]*\}/.test(indexCssContent)) {
          indexCssContent = indexCssContent.replace(/\.navbar-header\s*\{[^}]*\}/, `.navbar-header {\n  position: sticky;\n  top: 0;\n  z-index: 50;\n  width: 100%;\n  background-color: ${targetHex} !important;\n  backdrop-filter: blur(12px);\n  border-bottom: 1px solid var(--card-border);\n}`);
        } else {
          indexCssContent += `\n.navbar-header { background-color: ${targetHex} !important; }\n`;
        }

        fs.writeFileSync(path.join(srcDir, indexCssPath), indexCssContent, 'utf8');
        modifiedFiles.add(`src/${indexCssPath}`);
        sourceFiles[indexCssPath] = indexCssContent;
      }

      summaryExplanation = granularIntent.description;
    }
  }

  const themeColorIntent = (modifiedFiles.size === 0) ? extractThemeColorIntent(userPrompt) : null;

  if (themeColorIntent && themeCssPath && currentThemeCss) {
    console.log(`${tag}Detected theme color intent:`, themeColorIntent.themeName);
    let updatedCss = currentThemeCss;

    for (const [varName, varVal] of Object.entries(themeColorIntent.cssUpdates)) {
      if (varVal && typeof varVal === 'string') {
        const reg = new RegExp(`${varName}:\\s*[^;]+;`, 'g');
        if (reg.test(updatedCss)) {
          updatedCss = updatedCss.replace(reg, `${varName}: ${varVal};`);
        } else {
          updatedCss = updatedCss.replace(/:root\s*\{/, `:root {\n  ${varName}: ${varVal};`);
        }
      }
    }

    fs.writeFileSync(path.join(srcDir, themeCssPath), updatedCss, 'utf8');
    modifiedFiles.add(`src/${themeCssPath}`);
    sourceFiles[themeCssPath] = updatedCss;

    if (themeColorIntent.hex && siteDataPath && currentSiteData) {
      let updatedSiteData = currentSiteData.replace(/"primaryColor":\s*"[^"]+"/, `"primaryColor": "${themeColorIntent.hex}"`);
      if (themeColorIntent.secondaryHex) {
        if (/"secondaryColor":\s*"[^"]+"/.test(updatedSiteData)) {
          updatedSiteData = updatedSiteData.replace(/"secondaryColor":\s*"[^"]+"/, `"secondaryColor": "${themeColorIntent.secondaryHex}"`);
        } else {
          updatedSiteData = updatedSiteData.replace(/"primaryColor":\s*"[^"]+"/, `"primaryColor": "${themeColorIntent.hex}",\n    "secondaryColor": "${themeColorIntent.secondaryHex}"`);
        }
      }
      fs.writeFileSync(path.join(srcDir, siteDataPath), updatedSiteData, 'utf8');
      modifiedFiles.add(`src/${siteDataPath}`);
      sourceFiles[siteDataPath] = updatedSiteData;
    }

    // 🛡️ Dynamically update JSX components (Navbar, Hero, Header, Footer) to apply primary, secondary, accent colors
    for (const [relPath, content] of Object.entries(sourceFiles)) {
      if (/\.(jsx|tsx)$/i.test(relPath) && (relPath.includes('components') || relPath.includes('pages') || relPath.includes('App'))) {
        let newContent = content;

        // Replace hardcoded CTA background colors with primary theme color CSS variable
        newContent = newContent.replace(/bg-(?:emerald|rose|brand|indigo|blue|red|purple|amber|teal|violet)-[0-9]{3}/g, 'bg-[var(--primary-color)]');
        newContent = newContent.replace(/text-(?:emerald|rose|brand|indigo|blue|red|purple|amber|teal|violet)-[0-9]{3}/g, 'text-[var(--secondary-color)]');
        newContent = newContent.replace(/border-(?:emerald|rose|brand|indigo|blue|red|purple|amber|teal|violet)-[0-9]{3}/g, 'border-[var(--accent-color)]');

        if (newContent !== content) {
          fs.writeFileSync(path.join(srcDir, relPath), newContent, 'utf8');
          modifiedFiles.add(`src/${relPath}`);
          sourceFiles[relPath] = newContent;
        }
      }
    }

    summaryExplanation = `Updated website theme to ${themeColorIntent.themeName}.`;
  }

  // ── LAYER 3: CURRENCY & PRICING TRANSFORMATIONS ─────────────────────────────
  const currencyIntent = extractCurrencyPricingIntent(userPrompt);

  if (currencyIntent) {
    console.log(`${tag}Detected currency pricing intent:`, currencyIntent.name);

    if (siteDataPath && currentSiteData) {
      let newSiteData = currentSiteData;

      // Replace currency symbols in prices (e.g. $4,250.00 -> ₹4,250.00)
      newSiteData = newSiteData.replace(/\$([0-9,]+(?:\.[0-9]{2})?)/g, `${currencyIntent.symbol}$1`);

      // Update currency and currencySymbol in paymentCheckoutSpec
      newSiteData = newSiteData.replace(/"currency":\s*"[^"]+"/, `"currency": "${currencyIntent.currency}"`);
      newSiteData = newSiteData.replace(/"currencySymbol":\s*"[^"]+"/, `"currencySymbol": "${currencyIntent.symbol}"`);

      fs.writeFileSync(path.join(srcDir, siteDataPath), newSiteData, 'utf8');
      modifiedFiles.add(`src/${siteDataPath}`);
      sourceFiles[siteDataPath] = newSiteData;
    }

    // Replace hardcoded currency symbols in JSX catalog & pricing components
    for (const [relPath, content] of Object.entries(sourceFiles)) {
      if (/\.(jsx|tsx)$/i.test(relPath) && content.includes('$')) {
        const newContent = content.replace(/\$([0-9,]+(?:\.[0-9]{2})?)/g, `${currencyIntent.symbol}$1`);
        if (newContent !== content) {
          fs.writeFileSync(path.join(srcDir, relPath), newContent, 'utf8');
          modifiedFiles.add(`src/${relPath}`);
          sourceFiles[relPath] = newContent;
        }
      }
    }

    summaryExplanation = `Updated all catalog products, packages, and pricing to ${currencyIntent.name}.`;
  }

  // ── LAYER 4: SHOPPING CART & NAVBAR DRAWER ──────────────────────────────────
  const cartIntent = extractCartIntent(userPrompt);
  if (cartIntent && modifiedFiles.size === 0) {
    console.log(`${tag}Detected Shopping Cart intent:`, cartIntent.name);

    const compDir = path.join(srcDir, 'components');
    const navbarPath = path.join(compDir, 'Navbar.jsx');
    const appPath = path.join(srcDir, 'App.jsx');

    if (fs.existsSync(navbarPath)) {
      modifiedFiles.add('src/components/Navbar.jsx');
    }
    if (fs.existsSync(appPath)) {
      modifiedFiles.add('src/App.jsx');
    }

    summaryExplanation = `Added interactive Shopping Cart to Navbar with live item counter badge, slide-over bag drawer, and instant checkout.`;
  }

  // ── LAYER 5: AI CODE & COMPONENT MODIFIER (If needed) ───────────────────────
  if (modifiedFiles.size === 0) {
    console.log(`${tag}Calling AI service to generate surgical code modifications for: "${userPrompt}"...`);

    const appJsxPath = Object.keys(sourceFiles).find(f => f.includes('App.jsx'));
    const currentAppJsx = appJsxPath ? sourceFiles[appJsxPath] : '';

    const editSystemPrompt = `
You are AISA Web App Source Code Modifier.
Your task is to analyze the user's natural language edit request and produce precise code or CSS variable updates to apply to the generated React/Vite application.

CRITICAL ARCHITECTURE RULES:
- App.jsx manages multi-page routing. NEVER replace App.jsx with an empty wrapper or remove renderActivePage / Navbar / Footer!
- To make CTAs, buttons, or "Request Consultation" work, keep the full page layout and add/open interactive modals or navigate between pages.

Project Context:
1. \`src/styles/theme.css\`:
\`\`\`css
${currentThemeCss}
\`\`\`

2. \`src/data/siteData.js\` (First 2000 chars):
\`\`\`js
${currentSiteData.substring(0, 2000)}
\`\`\`

3. \`src/App.jsx\`:
\`\`\`jsx
${currentAppJsx}
\`\`\`

User Edit Request: "${userPrompt}"

GENERATE THE FOLLOWING JSON:
{
  "explanation": "Brief explanation of exact changes made",
  "updatedTitle": "New title if brand or name was changed, else null",
  "themeCssUpdates": {
    "--primary-color": "#Hex",
    "--secondary-color": "#Hex",
    "--bg-color": "#Hex",
    "--text-color": "#Hex"
  },
  "siteDataUpdates": "Modified JS object or string replacement for siteData.js if content changed, else null",
  "componentEdits": [
    {
      "relPath": "src/components/Navbar.jsx",
      "updatedContent": "Full updated React component code if needed"
    }
  ]
}
`;

    try {
      const aiRes = await generateJSON(editSystemPrompt, { model: 'gemini-3.5-flash', reqId });
      const aiData = aiRes && aiRes.data ? aiRes.data : aiRes;

      if (aiData && typeof aiData === 'object') {
        if (aiData.updatedTitle) {
          updatedTitle = aiData.updatedTitle;
        }

        // Apply CSS Theme updates
        if (aiData.themeCssUpdates && themeCssPath && currentThemeCss) {
          let newCss = currentThemeCss;
          for (const [varName, varVal] of Object.entries(aiData.themeCssUpdates)) {
            if (varVal && typeof varVal === 'string') {
              const reg = new RegExp(`${varName}:\\s*[^;]+;`, 'g');
              newCss = newCss.replace(reg, `${varName}: ${varVal};`);
            }
          }
          fs.writeFileSync(path.join(srcDir, themeCssPath), newCss, 'utf8');
          modifiedFiles.add(`src/${themeCssPath}`);
        }

        // Apply Component Edits
        if (Array.isArray(aiData.componentEdits)) {
          for (const compEdit of aiData.componentEdits) {
            if (compEdit.relPath && compEdit.updatedContent) {
              // 🛡️ Guardrail for App.jsx: Ensure App.jsx does not destroy routing or renderActivePage
              if (compEdit.relPath.includes('App.jsx') && !compEdit.updatedContent.includes('renderActivePage') && !compEdit.updatedContent.includes('Navbar')) {
                console.warn(`${tag}Rejected destructive App.jsx overwrite, preserving multi-page router.`);
                continue;
              }
              const targetPath = path.join(srcDir, compEdit.relPath.replace(/^src\//, ''));
              fs.writeFileSync(targetPath, compEdit.updatedContent, 'utf8');
              modifiedFiles.add(compEdit.relPath);
            }
          }
        }

        if (aiData.explanation) {
          summaryExplanation = aiData.explanation;
        }
      }
    } catch (aiErr) {
      console.warn(`${tag}AI edit error:`, aiErr.message);
    }
  }

  // ⚠️ Check if any files were updated
  if (modifiedFiles.size === 0) {
    console.warn(`${tag}Chat edit request could not modify any files.`);
    return {
      success: false,
      projectId,
      userPrompt,
      modifiedFiles: [],
      error: `Could not apply edit request: "${userPrompt}". No matching files were modified.`
    };
  }

  // ── LAYER 5: VITE REBUILD & LIVE SANDBOX RELOAD ─────────────────────────────
  console.log(`${tag}Re-building and restarting Runtime Sandbox after modifying ${modifiedFiles.size} file(s)...`);
  const sandboxState = await projectSandboxService.runProjectInSandbox({
    projectId,
    projectDir,
    forceRebuild: true
  });

  const freshRuntimeUrl = sandboxState.url ? `${sandboxState.url.split('?')[0]}?t=${Date.now()}` : null;

  // Construct updated in-memory website model if siteData.js exists
  let updatedWebsiteModel = null;
  const siteDataFullPath = path.join(srcDir, 'data/siteData.js');
  if (fs.existsSync(siteDataFullPath)) {
    try {
      const rawSiteData = fs.readFileSync(siteDataFullPath, 'utf8');
      const objMatch = rawSiteData.match(/export\s+const\s+siteData\s*=\s*(\{[\s\S]*\});?\s*$/);
      if (objMatch) {
        const parsed = (new Function(`return ${objMatch[1]}`))();
        updatedWebsiteModel = {
          websiteId: projectId,
          websiteIdentity: parsed.websiteIdentity || {},
          designSpec: parsed.designSpec || {},
          pages: parsed.pages || [],
          navigationSpec: parsed.navigationSpec || {},
          runtime: {
            status: sandboxState.status,
            port: sandboxState.port,
            url: freshRuntimeUrl
          }
        };
      }
    } catch (parseErr) {
      console.warn(`${tag}Could not parse updated siteData.js:`, parseErr.message);
    }
  }

  const modifiedList = Array.from(modifiedFiles);

  return {
    success: sandboxState.status === 'RUNNING',
    projectId,
    userPrompt,
    modifiedFiles: modifiedList,
    explanation: summaryExplanation || `Successfully updated ${modifiedList.join(', ')} and recompiled the live application.`,
    updatedTitle: updatedTitle || updatedWebsiteModel?.websiteIdentity?.title || null,
    updatedWebsite: updatedWebsiteModel,
    updatedDesignSpec: {
      theme: 'Updated via Chat Assistant',
      timestamp: Date.now()
    },
    runtime: {
      status: sandboxState.status,
      port: sandboxState.port,
      url: freshRuntimeUrl,
      buildStatus: sandboxState.buildStatus,
      startedAt: sandboxState.startedAt
    }
  };
}

/**
 * Helper to recursively scan src/ directory for text files
 */
function getSourceFilesMap(dir, base = '') {
  const map = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = base ? path.join(base, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      Object.assign(map, getSourceFilesMap(fullPath, relPath));
    } else if (entry.isFile() && /\.(jsx?|tsx?|css|json|html)$/i.test(entry.name)) {
      try {
        map[relPath.replace(/\\/g, '/')] = fs.readFileSync(fullPath, 'utf8');
      } catch (e) {}
    }
  }

  return map;
}

module.exports = {
  processChatEditRequest,
  extractTextReplacementIntent,
  extractThemeColorIntent,
  extractCurrencyPricingIntent
};
