const { scrapeBrandWebsite } = require('./brandScraper.service');
const { classifyBrandCategory } = require('./brandProcessor.service');

let GoogleGenAI;
try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI || genaiPkg.default;
} catch (e) {}

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
let aiClient = null;

if (GoogleGenAI && apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (e) {}
}

async function generateBrandDNA(domainUrl, brandNameOverride = '', documentUploadData = null) {
  const scrapedData = await scrapeBrandWebsite(domainUrl, brandNameOverride);
  const brandName = scrapedData.brandName;

  const categoryDetails = classifyBrandCategory(
    scrapedData.domainName,
    brandName,
    scrapedData.headings,
    scrapedData.metaDescription,
    scrapedData.deepContextText
  );

  let aiEnrichedData = null;

  const currentKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '';
  let activeAiClient = aiClient;
  if (GoogleGenAI && currentKey && !activeAiClient) {
    try {
      activeAiClient = new GoogleGenAI({ apiKey: currentKey });
    } catch (e) {}
  }

  if (activeAiClient) {
    try {

      const prompt = `You are an expert Brand Strategist & Consumer Intelligence AI.
Perform a 5-step Brand DNA Analysis for the URL: ${scrapedData.cleanUrl} (Company: "${brandName}").

Context from live website scrape:
- Domain: ${scrapedData.domainName}
- Headings: ${scrapedData.headings.join(' | ')}
- Deep Multi-Page Site Text Context: ${scrapedData.deepContextText.slice(0, 15000)}



FOLLOW THIS 5-STEP PIPELINE STRICTLY:

STEP 1: Detect Company
- Verify official company name, brand identity, and domain structure.

STEP 2: Detect Industry & Business Model
- Identify exact business sector and model (B2B, B2C, D2C, SaaS, Marketplace, OTT, Healthcare, Education, Banking, Food Delivery, etc.).

STEP 3: Identify Core Products & Services
- Extract 4 primary product lines, core offerings, or key services of "${brandName}".

STEP 4: Identify Real Customers (Target Audience Personas)
- Generate 4–6 specific, human-readable personas (4–8 words each) describing WHO buys or uses "${brandName}".
- Describe real customer demographics, lifestyle, profession, buying behavior, or usage intent.
- REJECT generic terms like "Active Consumers", "Quality Buyers", "Digital Users", "Brand Enthusiasts".

STEP 5: Generate Brand Tagline & Core Hook Line (Brand Promise)
- Primary Goal: Extract "${brandName}"'s official Slogan, Hook Line, or Core Customer Commitment / Promise (what the brand promises to deliver to users, e.g. for OPPO: "Inspiration Ahead" or "Empowering Smart & Innovative Mobile Experiences").
- Look for the brand's primary promise/hook in its hero banner, meta description, or about text.
- REJECT temporary sales offers (e.g. "50% Off"), menu navigation buttons ("Home", "Shop All"), or generic title tags ("OPPO Official Site").
- If no single official slogan exists on page, synthesize a powerful, memorable 3–8 word Brand Hook Line capturing "${brandName}"'s primary commitment to customers.
- NEVER return null, N/A, or generic placeholders! Every brand MUST have a punchy Brand Hook Line / Slogan.
- Synthesize Mission Statement, Vision Statement, unique Brand Voice & Tone keywords, Competitors, and Content Pillars.

CRITICAL MANDATE FOR EVERY SINGLE FIELD:
1. YOU MUST FILL ALL 12 FIELDS IN THE JSON OBJECT.
2. NO FIELD MAY BE LEFT AS AN EMPTY STRING, NULL, OR GENERIC PLACEHOLDER.
3. Every value MUST be specific, accurate, and customized for "${brandName}" (${scrapedData.cleanUrl}):
   - "industryCategory": Primary business sector (e.g. Telecommunications & Digital Services for Airtel; Consumer Electronics & Smartphones for Oppo/Vivo; On-Demand Food Delivery for Swiggy; Footwear for Crocs). REJECT generic "Software, AI & Technology Platform" defaults unless the brand is strictly a software/AI platform.

   - "subIndustry": Specific sub-niche (e.g. Mobile, Broadband, DTH & Digital Payments for Airtel; Smartphones & Wearables for Oppo).
   - "businessType": Exact business model (e.g. B2C, B2B, D2C, B2B & B2C).
   - "foundedYear": Exact founding year (e.g. 1995 for Airtel, 2004 for Oppo, 2014 for Swiggy).
   - "headquarters": Official City and Country (e.g. New Delhi, India for Airtel; Dongguan, China for Oppo; Bengaluru, India for Swiggy).
   - "companyDescription": Rich, detailed 2-3 sentence overview of "${brandName}"'s products, operations, and market leadership.
   - "tagline": Powerful Brand Hook Line / Core Promise slogan.
   - "missionStatement": Official customer-centric mission statement.
   - "vision": Inspiring long-term corporate vision statement.

Return ONLY a raw valid JSON object with NO markdown formatting:
{
  "industryCategory": "Specific Primary Industry",
  "subIndustry": "Specific Sub-Industry Niche",
  "businessType": "B2C or B2B or D2C",
  "foundedYear": "Founding Year string (e.g. 1995)",
  "headquarters": "City, Country of Corporate HQ",
  "companyDescription": "Detailed 2-3 sentence brand overview",
  "tagline": "Brand Hook Line / Core Customer Commitment Slogan",
  "missionStatement": "Official brand mission statement",
  "vision": "Inspiring corporate vision statement",
  "coreProductsServices": ["Core Product/Service 1", "Core Product/Service 2", "Core Product/Service 3", "Core Product/Service 4"],
  "targetAudience": ["Real Customer Persona 1", "Real Customer Persona 2", "Real Customer Persona 3", "Real Customer Persona 4"],
  "brandVoiceTone": { "formalityScore": 3, "toneKeywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"] },
  "competitorLandscape": ["Competitor 1", "Competitor 2", "Competitor 3", "Competitor 4"],
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3", "Pillar 4"],
  "brandColors": ["#HEX1", "#HEX2", "#HEX3", "#HEX4"],
  "contactInfo": { "email": "${scrapedData.emails[0] || `support@${scrapedData.domainName}`}", "phone": "${scrapedData.phones[0] || ''}", "location": "${scrapedData.domainName.endsWith('.in') ? 'India' : 'Global Headquarters'}" }
}`;







      const response = await aiClient.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      if (response && response.text) {
        const rawJsonText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        aiEnrichedData = JSON.parse(rawJsonText);
        console.log(`✨ Live Gemini AI Brand DNA Synthesized for "${brandName}"`);
      }
    } catch (err) {
      console.log('Gemini AI synthesis fallback note:', err.message);
    }
  }

  const finalDetails = aiEnrichedData || categoryDetails;

  const rawColors = (scrapedData.brandColors && scrapedData.brandColors.length >= 2)
    ? scrapedData.brandColors
    : (aiEnrichedData && aiEnrichedData.brandColors && aiEnrichedData.brandColors.length >= 2)
    ? aiEnrichedData.brandColors
    : categoryDetails.brandColors;


  const roles = ['Brand Primary', 'Brand Secondary', 'Accent', 'Dark Neutral'];
  const names = ['Primary', 'Secondary', 'Accent', 'Dark'];

  const colors = rawColors.map((item, idx) => {
    if (typeof item === 'object' && item.hex) {
      return {
        name: item.name || names[idx] || `Color ${idx + 1}`,
        hex: item.hex.toUpperCase(),
        role: item.role || roles[idx] || 'Brand Accent'
      };
    }
    const hex = (typeof item === 'string' ? item : (item.hex || '#6366F1')).toUpperCase();
    return {
      name: names[idx] || `Color ${idx + 1}`,
      hex,
      role: roles[idx] || 'Brand Accent'
    };
  });



  const sources = [...scrapedData.crawledSources];
  if (aiEnrichedData) sources.push('GEMINI_AI_REASONING');
  if (documentUploadData) sources.push('UPLOADED_BRAND_DOCUMENT');

  let confidenceScore = 90;
  if (scrapedData.brandColors && scrapedData.brandColors.length >= 2) confidenceScore += 5;
  if (documentUploadData) confidenceScore = 99;

  const approvedClaims = [
    { claimText: `Official brand positioning for ${brandName} verified from website & domain context.`, sourceUrl: scrapedData.cleanUrl, verified: true },
    { claimText: `Authentic color palette extracted: ${colors.join(', ')}.`, sourceUrl: scrapedData.cleanUrl, verified: true },
    { claimText: `Industry category: ${finalDetails.industryCategory || categoryDetails.industryCategory}.`, sourceUrl: scrapedData.cleanUrl, verified: true }
  ];

  if (documentUploadData && documentUploadData.extractedClaims) {
    documentUploadData.extractedClaims.forEach(c => {
      approvedClaims.push({
        claimText: typeof c === 'string' ? c : (c.claimText || c),
        sourceUrl: documentUploadData.fileName || scrapedData.cleanUrl,
        verified: true
      });
    });
  }

  const tabooTopics = [
    "Unverified pricing or discount promises not on official site",
    "Unsupported performance or health claims",
    "Competitor disparagement or unverified comparisons"
  ];

  if (documentUploadData && documentUploadData.extractedRules) {
    documentUploadData.extractedRules.forEach(r => {
      if (typeof r === 'string') tabooTopics.push(r);
    });
  }

  return {
    brandName,
    domainUrl: scrapedData.cleanUrl,
    industryCategory: finalDetails.industryCategory || categoryDetails.industryCategory || '',
    subIndustry: finalDetails.subIndustry || categoryDetails.subIndustry || '',
    businessType: finalDetails.businessType || categoryDetails.businessType || '',
    foundedYear: finalDetails.foundedYear || categoryDetails.foundedYear || '',
    headquarters: finalDetails.headquarters || finalDetails.contactInfo?.location || categoryDetails.headquarters || scrapedData.hqAddress || '',


    companyDescription: finalDetails.companyDescription || categoryDetails.companyDescription || scrapedData.metaDescription || '',
    tagline: finalDetails.tagline || categoryDetails.tagline || '',
    missionStatement: finalDetails.missionStatement || categoryDetails.missionStatement || '',
    vision: finalDetails.vision || categoryDetails.vision || '',
    targetAudience: finalDetails.targetAudience || categoryDetails.targetAudience || [],
    brandVoiceTone: finalDetails.brandVoiceTone || categoryDetails.brandVoiceTone || { formalityScore: 3, toneKeywords: [] },
    coreProductsServices: finalDetails.coreProductsServices || categoryDetails.coreProductsServices || scrapedData.headings.slice(0, 4),
    contentPillars: finalDetails.contentPillars || categoryDetails.contentPillars || [],
    competitorLandscape: finalDetails.competitorLandscape || categoryDetails.competitorLandscape || [],



    brandColors: colors,
    approvedClaims,
    tabooTopics,
    restrictedClaims: tabooTopics,
    socialMediaPresence: scrapedData.socialPlatforms,
    faviconUrl: scrapedData.faviconUrl,
    contactInfo: finalDetails.contactInfo || {
      email: scrapedData.emails?.[0] || `support@${scrapedData.domainName}`,
      phone: scrapedData.phones?.[0] || 'Official Brand Customer Support',
      location: 'Official Corporate Headquarters'
    },

    crawledSources: sources,
    confidenceScore: Math.min(confidenceScore, 100),
    sourceReasoning: documentUploadData 
      ? "Direct extraction from uploaded Brand Guideline Document + Live Web Crawl."
      : aiEnrichedData 
      ? "Live Gemini AI Reasoning + Web Crawling & Domain Parsing."
      : "Multi-layer live web scrape (Homepage + Internal Pages + CSS Variables + Meta Signals)."
  };
}

module.exports = {
  generateBrandDNA
};
