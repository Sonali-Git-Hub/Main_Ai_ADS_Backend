/**
 * AI Service — Multi-model orchestrator
 * Supports: Google Cloud Vertex AI (via @google/genai & ADC), OpenAI GPT-4o, Groq (Llama 3)
 * Automatic multi-model fallback chain: Vertex AI / Gemini → OpenAI GPT-4o → Groq
 */
const { aiClient, useVertexAI } = require('../config/vertex');
const axios = require('axios');

// ─── OpenAI Setup ──────────────────────────────────────────────────────────────
let openaiClient = null;
const getOpenAIClient = () => {
  if (!openaiClient) {
    const { OpenAI } = require('openai');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment');
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
};

// ─── Groq Setup ───────────────────────────────────────────────────────────────
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── System Prompt ─────────────────────────────────────────────────────────────
const buildSystemPrompt = (options = {}) => {
  let system = `You are AI Ads™ Assistant, the official AI copilot embedded inside the AI Ads™ Platform.

CRITICAL DIRECTIVE - AI ADS™ PLATFORM MODULE REFERENCE FIRST:
Whenever users ask how to generate content, create Instagram/social posts, build websites, generate ad visuals, or execute marketing tasks, ALWAYS direct them to the corresponding built-in AI Ads™ platform modules FIRST:
1. Content Studio (Module 6): Generate Instagram posts, LinkedIn posts, tweets, Facebook posts, blog posts, ad copies, and content repurposing tailored to your Brand DNA.
2. Creative Studio (Module 9): Generate AI ad images, visual variations, ad banners, and visual creative prompts.
3. AI Website Builder (Module 7): Generate, customize, and edit full landing pages and websites with AI prompts.
4. Brand DNA (Module 2): Scrape brand website URL, configure brand voice, target audience, and brand memory.
5. SEO Intelligence (Module 3): Keyword research, competitor audits, and SEO briefs.
6. Strategy (Module 4): AI campaign strategy, marketing roadmap, and growth playbooks.
7. Content Calendar (Module 5): Schedule, plan, and auto-publish content.
8. Campaigns (Module 8): Multi-channel ad campaign planner and execution.
9. Approvals Desk (Module 12): Review and approve generated posts and ad copies before publishing.
10. Quick Action: Click "+ Quick Post" in the top bar to create posts instantly.

NEVER recommend third-party external tools (such as Canva, Midjourney, DALL-E, CapCut, or ChatGPT) when the capability exists directly in AI Ads™. Always guide the user to the appropriate AI Ads™ module step-by-step.

CRITICAL CONCISENESS DIRECTIVE:
By default, keep all your responses SHORT, CONCISE, and DIRECTLY TO THE POINT.
DO NOT provide long, detailed, or essay-style explanations UNLESS the user explicitly asks for "in detail", "detailed explanation", "in-depth", "long form", or "comprehensive breakdown".
Avoid unnecessary prologues, long introductions, or filler text. Present answers in clean, brief bullet points and short sentences. DO NOT use any asterisks (*), hashtags (#), or angular brackets (< >) in your text.`;

  if (options.brandContext) {
    system += `\n\n### ACTIVE BRAND CONTEXT:\n${options.brandContext}`;
  }
  if (options.userName) {
    system += `\n\nUser's name: ${options.userName}. Address them by name naturally.`;
  }
  if (options.systemInstruction) {
    system += `\n\n### ADDITIONAL INSTRUCTIONS:\n${options.systemInstruction}`;
  }
  return system;
};

// ─── Gemini / Vertex AI Chat (@google/genai SDK in Vertex AI Mode) ──────────
const chatWithGemini = async (messages, options = {}) => {
  const reqTag = options.reqId ? `[WB:${options.reqId}] ` : '[AI-Service] ';
  const rawModel = (options.modelId || options.model || 'gemini-3.5-flash').toLowerCase();
  
  let modelId = 'gemini-3.5-flash';

  const systemInstruction = buildSystemPrompt(options);

  if (aiClient) {
    const contents = [];
    if (systemInstruction) {
      contents.push({ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemInstruction}` }] });
    }

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      contents.push({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }

    let retries = 3;
    let delay = 1000;
    while (retries >= 0) {
      try {
        console.log(`${reqTag}Calling @google/genai (Vertex AI asia-south1) model: ${modelId}...`);
        const response = await aiClient.models.generateContent({
          model: modelId,
          contents,
        });

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`${reqTag}@google/genai Vertex AI (${modelId}) response received successfully.`);
        return { text, model: `vertex-ai (${modelId})` };
      } catch (modelErr) {
        const errMsg = modelErr.message || '';
        const isNetworkErr = errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND') || errMsg.includes('ETIMEDOUT') || errMsg.includes('429') || errMsg.includes('503');
        if (isNetworkErr && retries > 0) {
          console.warn(`${reqTag}Vertex AI connection glitch (${errMsg}). Retrying in ${delay}ms... (${retries} retries left)`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 1.5;
          retries--;
        } else {
          console.warn(`${reqTag}Primary @google/genai model ${modelId} failed: ${errMsg}`);
          throw modelErr;
        }
      }
    }
  }

  throw new Error('Google Cloud Vertex AI (@google/genai) is not initialized with Application Default Credentials (ADC).');
};

// ─── OpenAI Chat ──────────────────────────────────────────────────────────────
const chatWithOpenAI = async (messages, options = {}) => {
  const client = getOpenAIClient();
  const systemMsg = { role: 'system', content: buildSystemPrompt(options) };
  const fullMessages = [systemMsg, ...messages.map((m) => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content,
  }))];

  const response = await client.chat.completions.create({
    model: options.modelId || 'gpt-4o',
    messages: fullMessages,
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 4096,
  });

  return {
    text: response.choices[0].message.content,
    model: 'gpt-4o',
    usage: response.usage,
  };
};

// ─── Groq Chat ────────────────────────────────────────────────────────────────
const chatWithGroq = async (messages, options = {}) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY not set in environment');
  }

  const systemMsg = { role: 'system', content: buildSystemPrompt(options) };
  const fullMessages = [systemMsg, ...messages.map((m) => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content,
  }))];

  const response = await axios.post(
    GROQ_BASE_URL,
    {
      model: options.modelId || 'llama-3.1-70b-versatile',
      messages: fullMessages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  return {
    text: response.data.choices[0].message.content,
    model: 'groq-llama3',
    usage: response.data.usage,
  };
};

// ─── Smart Fallback Response Generator ───────────────────────────────────────
const generateSmartFallbackJSON = (prompt, options = {}) => {
  const brandName = options.brandName || options.brandContext || 'your brand';
  const topicMatch = prompt.match(/about:\s*"([^"]+)"/i) || prompt.match(/topic:\s*([^\n]+)/i) || prompt.match(/keyword:\s*"([^"]+)"/i) || prompt.match(/for:\s*"([^"]+)"/i);
  const topic = topicMatch ? topicMatch[1].trim() : 'Modern Growth Marketing';

  const isSocial = /social|instagram|linkedin|facebook|twitter|post|hook/i.test(prompt);
  const isBlog = /blog|article|readingTime/i.test(prompt);
  const isAdCopy = /ad copy|headlines|callToActions/i.test(prompt);
  const isEmail = /email|newsletter|subject|preheader/i.test(prompt);
  const isSeo = /seo|brief|metaDescription|searchIntent/i.test(prompt);

  if (isSocial) {
    return {
      hook: `🚀 Transform your ${topic} strategy with ${brandName}!`,
      shortCaption: `Discover how ${brandName} revolutionizes ${topic} for peak growth.`,
      caption: `Ready to elevate your ${topic}? At ${brandName}, we combine innovative strategies with modern execution to deliver high-converting social content. Explore our full suite of AI tools to automate and scale your brand presence today!`,
      longCaption: `Are you looking to scale ${topic}? Building a sustainable brand requires consistent, high-impact content.\n\nHere is how ${brandName} empowers your workflow:\n1. Targeted Audience Alignment\n2. High-Converting Copy & Visuals\n3. Automated Multi-Channel Scheduling\n\nTake action today and transform your content strategy with ${brandName}.`,
      cta: `👉 Click the link in bio or visit ${brandName} to unlock instant access!`,
      hashtags: [`#${brandName.replace(/\s+/g, '')}`, `#${topic.replace(/[^a-zA-Z0-9]/g, '')}`, '#GrowthMarketing', '#AIContent', '#MarketingStrategy'],
      creativeVariations: [
        {
          type: 'STORYTELLING ANGLE',
          text: `How ${brandName} revolutionized ${topic} by focusing on audience-first value and data-driven insights.`
        },
        {
          type: 'PROBLEM-SOLUTION',
          text: `Struggling with ${topic}? Here is how ${brandName} solves low engagement and saves you hours every week.`
        }
      ],
      imagePrompt: `Professional high-resolution commercial photography representing ${topic} for ${brandName}, 8k resolution, studio lighting, modern sleek aesthetic`,
      bestTimeToPost: '9:00 AM - 11:00 AM EST',
      expectedEngagement: 'High (85%+ Target Reach)'
    };
  }

  if (isBlog) {
    return {
      title: `The Ultimate Guide to ${topic} for ${brandName}`,
      metaDescription: `Discover the top strategies for ${topic} with ${brandName}. Learn key takeaways and growth frameworks.`,
      content: `## Introduction\nIn today's digital landscape, ${topic} plays a pivotal role in driving sustainable brand growth...\n\n## 1. Understanding ${topic}\nBuilding a powerful brand requires strategic alignment...\n\n## 2. Key Action Steps\nImplement data-backed strategies to maximize reach and ROI.\n\n## Conclusion\nReady to get started? Connect with ${brandName} today!`,
      wordCount: 800,
      readingTime: '4 min read',
      seoScore: 88,
      keywords: [topic, brandName, 'Growth', 'Strategy'],
      outline: ['Introduction', `Understanding ${topic}`, 'Key Action Steps', 'Conclusion'],
      internalLinkSuggestions: ['Content Studio', 'SEO Intelligence']
    };
  }

  if (isAdCopy) {
    return {
      headlines: [`Scale ${topic} Fast`, `${brandName}: #1 Choice`, 'Boost Your ROI Today'],
      descriptions: [`Transform your ${topic} with ${brandName}. Get started with high-converting campaigns.`, `Automate and scale ${topic} in minutes. Try ${brandName} today.`],
      callToActions: ['Get Started', 'Learn More', 'Claim Free Trial'],
      longFormAd: `🚀 Are you struggling with ${topic}?\n\nDiscover how ${brandName} helps businesses scale faster with intelligent automation and data-driven insights.\n\n👉 Click below to start today!`,
      shortAd: `Transform your ${topic} with ${brandName}. High-converting ad campaigns created in seconds. Try it now!`,
      keyBenefits: ['Instant Automation', 'Higher Conversion Rates', 'Data-Backed Strategy']
    };
  }

  if (isSeo) {
    return {
      primaryKeyword: topic,
      secondaryKeywords: [`${topic} strategy`, `best ${topic} tools`, `${brandName} ${topic}`],
      suggestedTitles: [`Mastering ${topic}: A Complete Guide`, `Top 10 ${topic} Strategies for 2026`, `${topic} Best Practices`],
      metaDescription: `Comprehensive guide to ${topic}. Learn how ${brandName} helps you optimize content and rank higher.`,
      contentOutline: [`Introduction to ${topic}`, 'Core Strategies', 'Optimization Checklist', 'Summary'],
      wordCountTarget: 1500,
      searchIntent: 'informational',
      competitorTopics: [`${topic} tools`, `${topic} tutorials`],
      faqSuggestions: [`What is ${topic}?`, `How does ${brandName} improve ${topic}?`],
      internalLinkOpportunities: ['SEO Studio', 'Brand Memory']
    };
  }

  return {
    success: true,
    topic,
    brandName,
    summary: `AI Generated insights for ${topic}`,
    content: `High-converting content for ${topic} powered by ${brandName}.`,
    cta: `Explore ${brandName} features today!`
  };
};

const generateSmartFallbackResponse = (messages, options = {}) => {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || 'marketing strategy';
  const isDetailed = /detail|in-depth|comprehensive|explain/i.test(lastUserMsg);
  const brandName = options.brandName || options.brandContext || 'your brand';

  if (!isDetailed) {
    const shortText = `AI Ads™ Platform Instructions for ${brandName}:

- For Instagram & Social Posts: Go to Content Studio (Module 6) or click "+ Quick Post" in the top bar.
- For AI Ad Visuals & Banners: Go to Creative Studio (Module 9).
- For Websites & Landing Pages: Use AI Website Builder (Module 7).`;

    return {
      text: shortText,
      model: 'AI Ads™ Intelligence Fallback Engine',
      fallback: true
    };
  }

  const text = `AI Ads™ Platform Guide for ${brandName}:

# 1. Content & Post Generation
Open Content Studio (Module 6) from the left sidebar to generate Instagram posts, captions, hashtags, and social copy.

# 2. Visual Ad Creation
Open Creative Studio (Module 9) to generate high-converting AI ad visuals and banners tailored to your Brand DNA.

# 3. Landing Page & Website Build
Use AI Website Builder (Module 7) to generate and edit landing pages using conversational AI prompts.`;

  return {
    text,
    model: 'AI Ads™ Intelligence Fallback Engine',
    fallback: true
  };
};

// ─── Main Chat Dispatcher with Robust Fallback Chain ──────────────────────────
const chat = async (messages, options = {}) => {
  const reqTag = options.reqId ? `[WB:${options.reqId}] ` : '[AI-Service] ';
  const modelChoice = (options.model || 'gemini').toLowerCase();

  const geminiAvailable = !!aiClient;
  console.log(`${reqTag}AI Request initiated. Target provider: ${modelChoice}, Gemini Available: ${geminiAvailable}`);

  try {
    if (modelChoice === 'gpt-4o' || modelChoice === 'openai') {
      console.log(`${reqTag}Selected AI provider: OpenAI (Model: gpt-4o)`);
      return await chatWithOpenAI(messages, options);
    } else if (modelChoice === 'groq' || modelChoice === 'llama') {
      console.log(`${reqTag}Selected AI provider: Groq (Model: llama-3)`);
      return await chatWithGroq(messages, options);
    } else if (!geminiAvailable) {
      console.log(`${reqTag}Gemini/Vertex not configured. Attempting OpenAI GPT-4o...`);
      return await chatWithOpenAI(messages, options);
    } else {
      console.log(`${reqTag}Selected AI provider: Gemini / Vertex AI (Model: gemini-3.5-flash)`);
      return await chatWithGemini(messages, options);
    }
  } catch (primaryError) {
    const safeError = primaryError.message ? primaryError.message.replace(/(key|token|auth)=[^&\s]+/gi, '$1=***') : 'Unknown error';
    console.warn(`${reqTag}Primary AI provider failed (${safeError}). Attempting OpenAI fallback...`);
    try {
      console.log(`${reqTag}OpenAI fallback started...`);
      return await chatWithOpenAI(messages, options);
    } catch (fallbackError) {
      const safeFbError = fallbackError.message ? fallbackError.message.replace(/(key|token|auth)=[^&\s]+/gi, '$1=***') : 'Unknown error';
      console.warn(`${reqTag}OpenAI fallback failed (${safeFbError}). Attempting Groq fallback...`);
      try {
        console.log(`${reqTag}Groq fallback started...`);
        return await chatWithGroq(messages, options);
      } catch (groqError) {
        const safeGroqError = groqError.message ? groqError.message.replace(/(key|token|auth)=[^&\s]+/gi, '$1=***') : 'Unknown error';
        console.warn(`${reqTag}All external AI APIs failed (${safeGroqError}). Activating AI Ads™ Smart Fallback Engine...`);
        return generateSmartFallbackResponse(messages, options);
      }
    }
  }
};

const generate = async (prompt, options = {}) => {
  return chat([{ role: 'user', content: prompt }], options);
};

const generateJSON = async (prompt, options = {}) => {
  const reqTag = options.reqId ? `[WB:${options.reqId}] ` : '[AI-Service] ';
  const jsonInstruction = `\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no explanation. Just raw JSON.`;
  
  console.log(`${reqTag}AI generateJSON started...`);
  
  let result = null;
  try {
    result = await generate(prompt + jsonInstruction, options);
  } catch (genErr) {
    console.warn(`${reqTag}AI generate threw error (${genErr.message}). Using Smart Fallback JSON.`);
  }
  
  if (!result || !result.text || result.fallback) {
    console.log(`${reqTag}Using Smart Fallback JSON structure.`);
    const fallbackData = generateSmartFallbackJSON(prompt, options);
    return { data: fallbackData, model: 'AI Ads™ Smart Fallback Engine' };
  }

  try {
    const cleaned = result.text.replace(/```json\n?|```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    console.log(`${reqTag}AI response received & JSON parsed successfully. Model: ${result.model}`);
    return { data, model: result.model };
  } catch (e) {
    console.warn(`${reqTag}Standard JSON parse failed, attempting smart repair...`);
    try {
      let raw = result.text.replace(/```json\n?|```\n?/g, '').trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1) {
        if (lastBrace > firstBrace) {
          raw = raw.substring(firstBrace, lastBrace + 1);
        } else {
          raw = raw.substring(firstBrace) + '"}';
        }
        const data = JSON.parse(raw);
        console.log(`${reqTag}Repaired and parsed JSON successfully.`);
        return { data, model: result.model };
      }
    } catch (repairErr) {
      // Fallback: Extract partial fields with regex
      const partialData = {};
      const expMatch = result.text.match(/"explanation":\s*"([^"]+)"/);
      if (expMatch) partialData.explanation = expMatch[1];
      const titleMatch = result.text.match(/"updatedTitle":\s*"([^"]+)"/);
      if (titleMatch) partialData.updatedTitle = titleMatch[1];

      if (Object.keys(partialData).length > 0) {
        console.log(`${reqTag}Extracted partial JSON fields successfully.`);
        return { data: partialData, model: result.model };
      }
    }
    console.warn(`${reqTag}JSON parsing failed on AI response snippet. Using Smart Fallback JSON.`);
    const fallbackData = generateSmartFallbackJSON(prompt, options);
    return { data: fallbackData, model: 'AI Ads™ Smart Fallback Engine' };
  }
};

const generateCaptions = async (prompt, options = {}) => {
  // Short caption request (<= 60 chars)
  const shortInstruction = `\n\nPLEASE RETURN ONLY A SHORT CAPTION (max 60 characters) for the content below.\nSEO focus: ${options.seo || 'generic SEO'}\nStrategy: ${options.strategy || 'general marketing'}`;
  const shortResult = await generate(prompt + shortInstruction, options);
  const shortCaption = shortResult.text.trim();

  // Long caption request (up to 150 chars)
  const longInstruction = `\n\nPLEASE RETURN ONLY A LONG CAPTION (max 150 characters) for the content below.\nSEO focus: ${options.seo || 'generic SEO'}\nStrategy: ${options.strategy || 'general marketing'}`;
  const longResult = await generate(prompt + longInstruction, options);
  const longCaption = longResult.text.trim();

  return {
    shortCaption,
    longCaption,
    // include raw texts for debugging if needed
    rawShort: shortResult.text,
    rawLong: longResult.text,
  };
};

module.exports = { chat, generate, generateJSON, generateCaptions, chatWithGemini, chatWithOpenAI, chatWithGroq };
