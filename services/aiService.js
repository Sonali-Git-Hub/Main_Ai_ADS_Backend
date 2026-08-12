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
  let system = `You are AISA™ (AI Strategic Advertising Assistant), an elite AI model specialized in:
- Brand intelligence and marketing strategy
- Campaign planning and social media content generation
- SEO optimization and content repurposing
- Creative direction for ads, visuals, and copy

You are integrated into the AI Ads platform helping marketers and agencies build powerful campaigns.
Always be specific, actionable, and data-driven in your recommendations.`;

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
  if (rawModel.includes('pro')) {
    modelId = 'gemini-3.5-pro';
  } else {
    modelId = 'gemini-3.5-flash';
  }

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

    let retries = 2;
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
        if (modelErr.message && modelErr.message.includes('429') && retries > 0) {
          console.warn(`${reqTag}Vertex AI rate limit 429 hit. Waiting 5s before retry... (${retries} retries left)`);
          await new Promise((r) => setTimeout(r, 5000));
          retries--;
        } else {
          console.warn(`${reqTag}Primary @google/genai model ${modelId} failed: ${modelErr.message}`);
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
    console.warn(`${reqTag}Gemini/Primary provider failed: ${safeError}. Attempting OpenAI fallback...`);
    try {
      console.log(`${reqTag}OpenAI fallback started...`);
      return await chatWithOpenAI(messages, options);
    } catch (fallbackError) {
      const safeFbError = fallbackError.message ? fallbackError.message.replace(/(key|token|auth)=[^&\s]+/gi, '$1=***') : 'Unknown error';
      console.warn(`${reqTag}OpenAI fallback failed: ${safeFbError}. Attempting Groq fallback...`);
      try {
        console.log(`${reqTag}Groq fallback started...`);
        return await chatWithGroq(messages, options);
      } catch (groqError) {
        const safeGroqError = groqError.message ? groqError.message.replace(/(key|token|auth)=[^&\s]+/gi, '$1=***') : 'Unknown error';
        console.error(`${reqTag}Groq fallback failed: ${safeGroqError}. All AI providers failed.`);
        throw primaryError;
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
  const result = await generate(prompt + jsonInstruction, options);
  
  try {
    const cleaned = result.text.replace(/```json\n?|```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    console.log(`${reqTag}AI response received & JSON parsed successfully. Model: ${result.model}`);
    return { data, model: result.model };
  } catch (e) {
    console.error(`${reqTag}JSON parsing failed on AI response snippet: ${result.text.substring(0, 150)}`);
    return null;
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
