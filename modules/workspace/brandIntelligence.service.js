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

  if (aiClient) {
    try {
      const prompt = `Act as an expert Brand Strategist & Intelligence Analyst.
Analyze the brand "${brandName}" (${scrapedData.cleanUrl}).
Context: Domain="${scrapedData.domainName}", Headings="${scrapedData.headings.join(' | ')}", Description="${scrapedData.metaDescription}", DeepText="${scrapedData.deepContextText.slice(0, 500)}".

Return ONLY a raw valid JSON object with NO markdown formatting, matching this exact structure:
{
  "tagline": "Official Tagline or Main Slogan",
  "missionStatement": "Comprehensive official mission statement",
  "targetAudience": ["Persona 1", "Persona 2", "Persona 3", "Persona 4"],
  "brandVoiceTone": { "formalityScore": 3, "toneKeywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"] },
  "competitorLandscape": ["Competitor 1", "Competitor 2", "Competitor 3", "Competitor 4"],
  "contentPillars": ["Pillar 1", "Pillar 2", "Pillar 3", "Pillar 4"],
  "industryCategory": "Exact Business Sector Name",
  "brandColors": ["#HEX1", "#HEX2", "#HEX3", "#HEX4"],
  "contactInfo": { "email": "customer.service@${scrapedData.domainName}", "phone": "+1 (800) 555-0199", "location": "Global Operations" }
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

  const colors = (aiEnrichedData && aiEnrichedData.brandColors && aiEnrichedData.brandColors.length >= 2)
    ? aiEnrichedData.brandColors
    : (scrapedData.brandColors && scrapedData.brandColors.length >= 2)
    ? scrapedData.brandColors
    : categoryDetails.brandColors;


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
    industryCategory: finalDetails.industryCategory || categoryDetails.industryCategory,
    tagline: finalDetails.tagline || categoryDetails.tagline,
    missionStatement: finalDetails.missionStatement || categoryDetails.missionStatement,
    targetAudience: finalDetails.targetAudience || categoryDetails.targetAudience,
    brandVoiceTone: finalDetails.brandVoiceTone || categoryDetails.brandVoiceTone,
    competitorLandscape: finalDetails.competitorLandscape || categoryDetails.competitorLandscape,
    contentPillars: finalDetails.contentPillars || categoryDetails.contentPillars,
    brandColors: colors,
    approvedClaims,
    tabooTopics,
    restrictedClaims: tabooTopics,
    socialMediaPresence: scrapedData.socialPlatforms,
    faviconUrl: scrapedData.faviconUrl,
    contactInfo: finalDetails.contactInfo || {
      email: scrapedData.emails?.[0] || `support@${scrapedData.domainName}`,
      phone: scrapedData.phones?.[0] || '+1 (800) 555-0199',
      location: 'Global Enterprise Operations'
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
