const { generateJSON } = require('../../../services/aiService');

/**
 * Analyzes a user prompt to determine if intelligent non-technical clarification is needed.
 * Returns 2-3 simple questions with multi-choice pills and a Skip option.
 * Zero technical jargon (no mention of React, Vite, CSS, databases, APIs, etc.).
 */
async function analyzeClarificationNeed(prompt, brandContext = {}, reqId = null) {
  const correlationTag = reqId ? `[WB:${reqId}] ` : '[WB:CLARIFY] ';
  console.log(`${correlationTag}Analyzing prompt for clarification needs...`);

  // Simple heuristic check: if prompt is very detailed (> 120 chars and includes colors/features), skip questions
  const promptLower = (prompt || '').toLowerCase();
  const hasColorsSpec = /(color|palette|theme|black|white|ivory|red|blue|green|gold|cream|pink|purple|burgundy)/i.test(promptLower);
  const hasCartSpec = /(cart|shop|ecommerce|store|e-commerce|checkout|buy|product)/i.test(promptLower);
  const hasMediaSpec = /(logo|image|photo|picture|gallery|upload)/i.test(promptLower);

  // If prompt already specifies colors, media, and features, skip questions
  if (promptLower.length > 180 && hasColorsSpec && (hasCartSpec || hasMediaSpec)) {
    console.log(`${correlationTag}Prompt is highly detailed and explicit. Skipping clarification questions.`);
    return {
      needsClarification: false,
      questions: [],
      reason: 'Prompt contains explicit specifications'
    };
  }

  // Ask AI to generate 2-3 helpful non-technical questions if needed
  try {
    const aiSystemPrompt = `You are AISA, an elite AI Website & Application Builder assistant.
Your task is to analyze a user's prompt for building a website or app, and decide if 2-3 quick non-technical questions would help create a better design.

CRITICAL RULES:
1. NEVER ask technical questions about React, Vite, CSS, databases, APIs, ports, components, or code architecture.
2. Ask ONLY simple business, visual, or customer-facing preference questions (e.g. brand colors, logo/images, cart/e-commerce preference, visual style).
3. Provide 2 to 4 simple human-friendly option choices for each question.
4. Keep questions brief, warm, and clear.

Return valid JSON with format:
{
  "needsClarification": true,
  "questions": [
    {
      "id": "colors",
      "question": "Do you already have brand colors in mind?",
      "options": ["I have brand colors", "Let AI choose colors", "Black and Ivory minimal"]
    },
    {
      "id": "media",
      "question": "Do you have custom logos or product photos?",
      "options": ["I will upload photos", "Use curated AI fashion photography"]
    },
    {
      "id": "ecommerce",
      "question": "Should customers be able to add products to a shopping cart?",
      "options": ["Yes, full shopping cart", "No, showcase catalog only"]
    }
  ]
}`;

    const userPromptPayload = `User Prompt: "${prompt}"
Workspace Brand: ${brandContext.brandName || 'Not specified'} (${brandContext.industryCategory || 'General'})`;

    const aiRes = await generateJSON({
      systemPrompt: aiSystemPrompt,
      userPrompt: userPromptPayload,
      temperature: 0.2,
      model: 'gemini-3.5-flash'
    });

    if (aiRes && aiRes.questions && Array.isArray(aiRes.questions) && aiRes.questions.length > 0) {
      const sanitizedQuestions = aiRes.questions.slice(0, 3).map((q, idx) => ({
        id: q.id || `q_${idx}`,
        question: q.question,
        options: Array.isArray(q.options) ? q.options.slice(0, 4) : ['Yes', 'No']
      }));

      return {
        needsClarification: true,
        questions: sanitizedQuestions,
        reason: 'Recommended visual and feature preferences'
      };
    }
  } catch (err) {
    console.warn(`${correlationTag}AI clarification analysis fallback:`, err.message);
  }

  // Deterministic fallback questions based on prompt keywords
  const fallbackQuestions = [];

  if (!hasColorsSpec) {
    fallbackQuestions.push({
      id: 'colors',
      question: 'Do you have brand colors in mind?',
      options: ['I have brand colors', 'Let AI choose colors', 'Minimal Black & Ivory']
    });
  }

  if (!hasMediaSpec) {
    fallbackQuestions.push({
      id: 'media',
      question: 'Do you have logos or brand imagery ready?',
      options: ['Use curated AI photography', 'I will upload custom images']
    });
  }

  if (hasCartSpec || promptLower.includes('brand') || promptLower.includes('atelier') || promptLower.includes('clothing') || promptLower.includes('fashion') || promptLower.includes('store') || promptLower.includes('shop')) {
    fallbackQuestions.push({
      id: 'ecommerce',
      question: 'Should customers be able to add products to a shopping cart?',
      options: ['Yes, enable shopping cart', 'No, catalog showcase only']
    });
  }

  return {
    needsClarification: fallbackQuestions.length > 0,
    questions: fallbackQuestions.slice(0, 3),
    reason: 'Deterministic fallback questions'
  };
}

module.exports = { analyzeClarificationNeed };
