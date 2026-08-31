/**
 * LEGACY / MOCK SCRAPER HELPER (OBSOLETE)
 * ⚠️ WARNING: This file contains synthetic mock data for offline testing.
 * Production Brand DNA flow uses `modules/workspace/scraper.service.js` & `modules/brandDnaAgent/`.
 * Production code must NEVER import this file for factual Brand DNA generation.
 */

async function scrapeDomainUrl(url) {
  try {
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    const domainName = new URL(cleanUrl).hostname.replace('www.', '');
    const brandName = domainName.split('.')[0].toUpperCase();

    // Generates simulated rich extracted metadata based on URL
    return {
      success: true,
      domainUrl: cleanUrl,
      brandName: brandName,
      logoUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${brandName}`,
      brandColors: ['#6366F1', '#8B5CF6', '#06B6D4', '#0F172A'],
      metaDescription: `${brandName} is a leading enterprise provider delivering AI-driven digital transformation, innovative software solutions, and high-performance customer growth across global markets.`,
      positioningSummary: `${brandName} empowers modern enterprise marketing teams and digital agencies to scale multi-channel performance through cutting-edge strategy, governed content operations, and real-time intelligence.`,
      targetAudiences: [
        {
          personaName: "VP of Digital Marketing",
          demographics: "B2B Tech / Agency Leaders (Age 32-52)",
          painPoints: ["Fragmented tooling", "Brand voice drift", "Slow approval velocity", "Unverified claims"],
          coreDrivers: ["High production ROI", "Strict brand governance", "Automated workflows"]
        },
        {
          personaName: "SEO Operations Director",
          demographics: "Enterprise Growth Strategists",
          painPoints: ["Keyword cannibalization", "Lack of structured outlines", "Manual cluster planning"],
          coreDrivers: ["Organic intent mapping", "JSON-LD schema readiness", "Topic cluster authority"]
        }
      ],
      approvedClaims: [
        { claimText: `${brandName} improves content delivery velocity by 400%`, sourceUrl: `${cleanUrl}/case-studies`, verified: true },
        { claimText: "SOC2 Type II certified enterprise security architecture", sourceUrl: `${cleanUrl}/security`, verified: true }
      ],
      restrictedClaims: [
        "Guaranteed #1 Google ranking",
        "100% viral outcome guaranteed",
        "Instant backlink indexing"
      ],
      priorityKeywords: ["AI Content Marketing", "SEO Automation", "Brand Intelligence", "Campaign Operations"],
      scrapedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  scrapeDomainUrl
};
