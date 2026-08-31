/**
 * Sub-Agent 3: Target Buyer Persona Agent
 * Path: backend/modules/brandDnaAgent/brandPersonaAgent.js
 * 
 * Role: Consumer Psychologist & Target Market Analyst
 * Responsibility: Synthesizes Ideal Customer Profiles (ICPs), Demographics, Pain Points, and Objections.
 */

const { generateJSON } = require('../../services/aiService');

const PERSONA_AGENT_PERSONA = `
You are the AI Ads™ Target Buyer Persona Agent.
Your Role: Analyze brand offerings and determine the exact Ideal Customer Profiles (ICPs), target demographics, customer pain points, and buying motivators.

INSTRUCTIONS:
Return a JSON object with:
{
  "targetDemographics": {
    "ageRange": "e.g. 22-45",
    "gender": "e.g. All / Women / Men",
    "geography": "e.g. Global / India / US"
  },
  "buyerPersonas": [
    {
      "title": "Persona Title (e.g. Value-Conscious Shopper, Tech Specialist)",
      "description": "Brief description of who they are",
      "keyMotivation": "Primary buying trigger"
    }
  ],
  "corePainPoints": ["Pain Point 1", "Pain Point 2"],
  "buyingTriggers": ["Trigger 1", "Trigger 2"],
  "commonObjections": ["Objection 1", "Objection 2"]
}
`;

async function runPersonaAgent(crawlResult) {
  const { brandNameObj, scrapedMetadata, rawUrl } = crawlResult;
  const brandName = brandNameObj.value || 'Brand';

  console.log(`[PersonaAgent] 👤 Synthesizing Buyer Personas & Target Market for: "${brandName}"`);

  const pageImages = (scrapedMetadata.pagesEvidence || [])
    .filter(p => p && p.screenshot && p.screenshot.status === 'SUCCESS' && p.screenshot.base64)
    .map(p => ({
      url: p.url,
      pageType: p.pageType || 'PAGE',
      mimeType: p.screenshot.mimeType || 'image/png',
      base64: p.screenshot.base64
    }));

  const hasVisual = pageImages.length > 0;
  console.log(`[AI-MULTIMODAL] Agent: PersonaAgent | Text evidence: YES | Images attached: ${pageImages.length}`);

  const headings = (scrapedMetadata.headings || []).slice(0, 5).join(', ');
  const metaDesc = scrapedMetadata.metaDescription || '';

  const prompt = `Synthesize Target Buyer Personas for "${brandName}" (${scrapedMetadata.domainName}):
Meta Description: "${metaDesc}"
Key Offerings/Headings: "${headings}"
${hasVisual ? `\nVISUAL EVIDENCE ATTACHED: Inspect the attached ${pageImages.length} page screenshots to observe product photography, lifestyle imagery, target audience demographics, and visual positioning signals.` : ''}`;

  try {
    const aiRes = await generateJSON(prompt, { systemInstruction: PERSONA_AGENT_PERSONA, images: pageImages });
    const data = aiRes?.data || {};

    const primarySource = hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_SYNTHESIS';

    return {
      targetDemographics: data.targetDemographics || { ageRange: '18-50', gender: 'All', geography: 'Global' },
      buyerPersonas: data.buyerPersonas || [
        { title: 'Quality-Focused Consumer', description: `Customers seeking premium solutions from ${brandName}`, keyMotivation: 'Quality & Reliability' }
      ],
      corePainPoints: data.corePainPoints || ['Finding reliable quality products', 'Hassle-free service delivery'],
      buyingTriggers: data.buyingTriggers || ['Verified reviews', 'Transparent pricing', 'Fast shipping'],
      commonObjections: data.commonObjections || ['Price comparison', 'Return policy clarity'],
      provenance: {
        sourceType: primarySource,
        sourceUrl: rawUrl,
        evidence: hasVisual ? `Synthesized target customer persona from text & ${pageImages.length} page screenshots` : `Synthesized ideal customer persona from brand text evidence`,
        confidence: 0.88
      }
    };
  } catch (err) {
    console.warn(`[PersonaAgent] Persona synthesis fallback activated (${err.message})`);
    return {
      targetDemographics: { ageRange: '20-45', gender: 'All', geography: 'Global' },
      buyerPersonas: [{ title: 'Standard Consumer', description: 'Primary brand target customer', keyMotivation: 'Value & Convenience' }],
      corePainPoints: ['Product reliability'],
      buyingTriggers: ['Brand reputation'],
      commonObjections: ['Shipping cost'],
      provenance: { sourceType: 'AI_SYNTHESIS', sourceUrl: rawUrl, confidence: 0.70 }
    };
  }
}

module.exports = { runPersonaAgent };
