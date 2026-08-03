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

// ─── Gemini / Vertex AI Chat ──────────────────────────────────────────────────
const chatWithGemini = async (messages, options = {}) => {
  const modelId = options.modelId || 'gemini-2.0-flash';
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

    const response = await aiClient.models.generateContent({
      model: modelId,
      contents,
    });

    const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, model: useVertexAI ? `vertex-ai (${modelId})` : `gemini-api (${modelId})` };
  }

  throw new Error('Neither Google Cloud Vertex AI nor a valid GEMINI_API_KEY is configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in your .env file.');
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
  const modelChoice = (options.model || 'gemini').toLowerCase();

  // If Gemini/Vertex is not configured, skip directly to OpenAI
  const geminiAvailable = !!aiClient;

  try {
    if (modelChoice === 'gpt-4o' || modelChoice === 'openai') {
      return await chatWithOpenAI(messages, options);
    } else if (modelChoice === 'groq' || modelChoice === 'llama') {
      return await chatWithGroq(messages, options);
    } else if (!geminiAvailable) {
      // Gemini/Vertex not configured — go straight to OpenAI
      console.log('[AI-Service] Gemini/Vertex not configured. Using OpenAI GPT-4o...');
      return await chatWithOpenAI(messages, options);
    } else {
      return await chatWithGemini(messages, options);
    }
  } catch (primaryError) {
    console.warn(`[AI-Service] ${modelChoice} primary engine failed (${primaryError.message}). Attempting OpenAI GPT-4o fallback...`);
    try {
      return await chatWithOpenAI(messages, options);
    } catch (fallbackError) {
      console.error(`[AI-Service] OpenAI fallback also failed: ${fallbackError.message}`);
      throw primaryError;
    }
  }
};

const generate = async (prompt, options = {}) => {
  return chat([{ role: 'user', content: prompt }], options);
};

const generateJSON = async (prompt, options = {}) => {
  const jsonInstruction = `\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no explanation. Just raw JSON.`;
  const result = await generate(prompt + jsonInstruction, options);
  try {
    const cleaned = result.text.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[AI-Service] Failed to parse JSON response:', result.text.substring(0, 200));
    return null;
  }
};

module.exports = { chat, generate, generateJSON, chatWithGemini, chatWithOpenAI, chatWithGroq };
