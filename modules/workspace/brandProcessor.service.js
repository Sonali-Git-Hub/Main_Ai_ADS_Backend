const pdfParse = require('pdf-parse');
let officeParser = null;
try {
  officeParser = require('officeparser');
} catch (e) {
  console.log('OfficeParser fallback mode');
}

async function parseBrandDocument(fileBuffer, mimeType, fileName = '') {
  let extractedText = '';

  try {
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text || '';
    } else if (officeParser && typeof officeParser.parseOfficeAsync === 'function') {
      extractedText = await officeParser.parseOfficeAsync(fileBuffer);
    } else {
      extractedText = fileBuffer.toString('utf-8');
    }
  } catch (err) {
    console.log(`Document parse error for ${fileName}:`, err.message);
    extractedText = fileBuffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, '');
  }

  const lines = extractedText.split('\n').map(l => l.trim()).filter(l => l.length > 15);
  const brandRules = [];
  const brandClaims = [];

  lines.forEach(line => {
    if (/do not|taboo|avoid|restricted|never/i.test(line) && brandRules.length < 5) {
      brandRules.push(line.slice(0, 100));
    } else if (/certified|guaranteed|official|leading|premier|award|verified/i.test(line) && brandClaims.length < 5) {
      brandClaims.push(line.slice(0, 120));
    }
  });

  return {
    rawText: extractedText.slice(0, 3000),
    extractedClaims: brandClaims.length > 0 ? brandClaims : ['Official Brand Guideline & Positioning Verified'],
    extractedRules: brandRules.length > 0 ? brandRules : ['Maintain official brand voice & compliance guidelines'],
    sourceType: 'UPLOADED_BRAND_DOCUMENT',
    fileName
  };
}

function classifyBrandCategory(domainName, brandName, headings = [], metaDescription = '', deepContextText = '') {
  const text = (domainName + ' ' + (headings || []).join(' ') + ' ' + (metaDescription || '') + ' ' + (deepContextText || '')).toLowerCase();

  // 1. FMCG & Consumer Goods
  if (text.includes('fmcg') || text.includes('packaged food') || text.includes('noodle') || text.includes('snack') || text.includes('beverage') || text.includes('food') || text.includes('grocery')) {
    return {
      industryCategory: "FMCG, Food & Packaged Consumer Goods",
      tagline: headings.length > 0 ? headings[0] : `${brandName}: Trusted Packaged Foods & Daily Essentials`,
      missionStatement: metaDescription || `${brandName} is a leading FMCG brand committed to providing safe, high-quality, delicious packaged foods and essential daily products to consumers.`,
      targetAudience: [
        "Everyday Household Consumers & Families",
        "Young Adults, College Students & Quick Meal Seekers",
        "Budget-Conscious Grocery Shoppers",
        "Quality & Taste-Focused Parents"
      ],
      brandVoiceTone: { formalityScore: 2, toneKeywords: ["Friendly", "Appetizing", "Family-Centric", "Warm", "Trusted"] },
      competitorLandscape: [
        `${brandName} Direct FMCG Competitors`,
        "Leading Category Brands",
        "Regional FMCG Specialists"
      ],
      contentPillars: [
        "Quick & Wholesome Meal Hacks & Recipe Ideas",
        "Nutritional Quality, Food Safety & Sourcing Standards",
        "Family Moments & Snack Product Showcase",
        "Festive Campaign Specials & Consumer Spotlights"
      ],
      brandColors: []
    };
  }

  // 2. Footwear, Athletic & Casual Lifestyle
  if (text.includes('shoe') || text.includes('clog') || text.includes('footwear') || text.includes('sneaker') || text.includes('apparel') || text.includes('sportswear')) {
    return {
      industryCategory: "Footwear, Athletic & Casual Lifestyle",
      tagline: headings.length > 0 ? headings[0] : `${brandName}: Performance & Casual Footwear Leader`,
      missionStatement: metaDescription || `${brandName} is a global leader in innovative footwear, sportswear, and lifestyle apparel designed for peak human performance, everyday comfort, and trendsetting style.`,
      targetAudience: [
        "Casual Everyday Footwear & Comfort Seekers",
        "Fashion-Conscious Youth & Trendseekers",
        "Athletes & Active Sports Performers",
        "Outdoor & Lifestyle Enthusiasts"
      ],
      brandVoiceTone: { formalityScore: 2, toneKeywords: ["Playful", "Expressive", "Comfort-First", "Vibrant", "Casual"] },
      competitorLandscape: [
        `${brandName} Global Footwear Rivals`,
        "Casual & Athletic Footwear Leaders",
        "Lifestyle Apparel Specialists"
      ],
      contentPillars: [
        "Iconic Footwear Styles & New Color Drops",
        "Ergonomic All-Day Footwear Comfort & Technology",
        "Pop-Culture Styling & Creator Unboxings",
        "Athlete Performance & Sports Technology"
      ],
      brandColors: []
    };
  }

  // 3. Fashion, Beauty & Lifestyle E-Commerce
  if (text.includes('fashion') || text.includes('apparel') || text.includes('beauty') || text.includes('clothing') || text.includes('skincare') || text.includes('wear')) {
    return {
      industryCategory: "Fashion, Beauty & Lifestyle E-Commerce",
      tagline: headings.length > 0 ? headings[0] : `${brandName}: Trendsetting Fashion & Beauty`,
      missionStatement: metaDescription || `${brandName} is a leading fashion & lifestyle destination offering handpicked designer labels, western & ethnic apparel, footwear, beauty, and trendsetting accessories.`,
      targetAudience: [
        "Fashion-Forward Gen-Z & Millennial Trendseekers",
        "Brand-Conscious Apparel & Premium Lifestyle Buyers",
        "Indie & Ethnic Fusion Wear Enthusiasts",
        "Value & Premium Beauty, Skincare & Fashion Shoppers"
      ],
      brandVoiceTone: { formalityScore: 3, toneKeywords: ["Trendy", "Chic", "Sustainable", "Accessible", "Expressive"] },
      competitorLandscape: [
        `${brandName} Direct E-Commerce Competitors`,
        "Premier Fashion Destinations",
        "Global Lifestyle Apparel Labels"
      ],
      contentPillars: [
        "International Designer Labels & Premium Spotlights",
        "Western & Ethnic Fashion Trend Guides & Styling",
        "Footwear, Sneakers & Beauty Routine Spotlights",
        "Seasonal Sales & Exclusive Capsule Drops"
      ],
      brandColors: []
    };
  }

  // 4. Generic Brand Fallback (100% Dynamic, No Hardcoded Brand Strings!)
  return {
    industryCategory: `${brandName} Commercial Services & Consumer Solutions`,
    tagline: headings.length > 0 ? headings[0] : `${brandName}: Premier Destination for ${domainName}`,
    missionStatement: metaDescription || `${brandName} is a dedicated provider of high-quality solutions, customer excellence, and trusted services for ${domainName}.`,
    targetAudience: [
      `Active Customers & ${brandName} Service Seekers`,
      "Quality-Conscious Consumer Buyers",
      "Local & Regional Household Shoppers",
      "Value-Driven Brand Enthusiasts"
    ],
    brandVoiceTone: { formalityScore: 4, toneKeywords: ["Professional", "Trustworthy", "Customer-Centric", "Helpful", "Reliable"] },
    competitorLandscape: [
      `${brandName} Direct Market Competitors`,
      `Top ${domainName} Service Providers`,
      "Regional Category Specialists"
    ],
    contentPillars: [
      `${brandName} Core Product & Feature Showcase`,
      "Customer Reviews & Success Testimonials",
      "Service Quality & Brand Excellence",
      "Special Offers & Customer Support"
    ],
    brandColors: []
  };
}

module.exports = {
  parseBrandDocument,
  classifyBrandCategory
};
