/**
 * Sub-Agent 2: Brand Voice & Tone Synthesizer Agent
 * Path: backend/modules/brandDnaAgent/brandVoiceAgent.js
 * 
 * Role: Brand Copywriting Specialist & Linguistic Auditor
 * Responsibility: Analyzes scraped DOM text to synthesize Brand Tone, Core Promises, and Linguistic Guidelines.
 */

const { generateJSON } = require('../../services/aiService');

const VOICE_AGENT_PERSONA = `
You are the AI Ads™ Brand Voice & Tone Synthesizer Agent.
Your Role: Analyze website evidence and determine the exact brand personality, tone of voice, key promises, and copywriting rules.

INSTRUCTIONS:
Return a JSON object with:
{
  "primaryTone": "Clean adjective phrase (e.g., Premium & Authoritative, Playful & Friendly)",
  "voiceAttributes": ["Attribute 1", "Attribute 2", "Attribute 3"],
  "brandPromises": ["Core Promise 1", "Core Promise 2"],
  "doWords": ["Word 1", "Word 2"],
  "dontWords": ["Word 1", "Word 2"]
}
`;

async function runVoiceAgent(crawlResult) {
  const { brandNameObj, scrapedMetadata, rawUrl } = crawlResult;
  const brandName = brandNameObj.value || 'Brand';
  
  console.log(`[VoiceAgent] 🎙️ Synthesizing Brand Voice & Tone for: "${brandName}"`);

  const pageImages = (scrapedMetadata.pagesEvidence || [])
    .filter(p => p && p.screenshot && p.screenshot.status === 'SUCCESS' && p.screenshot.base64)
    .map(p => ({
      url: p.url,
      pageType: p.pageType || 'PAGE',
      mimeType: p.screenshot.mimeType || 'image/png',
      base64: p.screenshot.base64
    }));

  const hasVisual = pageImages.length > 0;
  console.log(`[AI-MULTIMODAL] Agent: VoiceAgent | Text evidence: YES | Images attached: ${pageImages.length}`);

  const headings = (scrapedMetadata.headings || []).join('\n- ');
  const metaDesc = scrapedMetadata.metaDescription || '';
  const aboutText = scrapedMetadata.aboutPageText || scrapedMetadata.deepContextText || '';

  const prompt = `Synthesize official Brand Voice & Tone for "${brandName}" (Domain: ${scrapedMetadata.domainName}):
Meta Description: "${metaDesc}"
Headings:
- ${headings}
About Text: "${aboutText.slice(0, 500)}"
${hasVisual ? `\nVISUAL EVIDENCE ATTACHED: Inspect the attached ${pageImages.length} rendered page screenshots to analyze typography, visual layout, hero banners, design language, color usage, and visual brand style.` : ''}`;

  try {
    const aiRes = await generateJSON(prompt, { systemInstruction: VOICE_AGENT_PERSONA, images: pageImages });
    const data = aiRes?.data || {};

    const primarySource = hasVisual ? 'WEBSITE_DOM+WEBSITE_SCREENSHOT' : 'AI_SYNTHESIS';

    return {
      primaryTone: {
        value: data.primaryTone || 'Professional & Customer-Centric',
        sourceType: primarySource,
        sourceUrl: rawUrl,
        evidence: hasVisual
          ? `Synthesized brand tone from text DOM evidence and ${pageImages.length} page screenshots`
          : `Synthesized brand tone from homepage evidence & meta description`,
        confidence: 0.90
      },
      voiceAttributes: data.voiceAttributes || ['Professional', 'Modern', 'Trustworthy'],
      brandPromises: data.brandPromises || [`Quality products & service for ${brandName} customers`],
      doWords: data.doWords || ['Premium', 'Quality', 'Authentic'],
      dontWords: data.dontWords || ['Cheap', 'Generic', 'Unverified']
    };
  } catch (err) {
    console.warn(`[VoiceAgent] Synthesis fallback activated (${err.message})`);
    return {
      primaryTone: {
        value: 'Professional & Modern',
        sourceType: 'AI_SYNTHESIS',
        sourceUrl: rawUrl,
        evidence: 'Default fallback voice profile',
        confidence: 0.70
      },
      voiceAttributes: ['Professional', 'Customer-Centric'],
      brandPromises: [`Delivering excellence at ${brandName}`],
      doWords: ['Quality', 'Innovative'],
      dontWords: ['Outdated', 'Unverified']
    };
  }
}

module.exports = { runVoiceAgent };
