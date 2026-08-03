const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

const projectId = process.env.GCP_PROJECT_ID || 'ai-mall-484810';
const location = process.env.GCP_LOCATION || 'asia-south1';
const keyFilePath = path.join(__dirname, '../google_cloud_credentials.json');

let aiClient = null;
let useVertexAI = false;

// Check for Vertex AI via GCP_PROJECT_ID & ADC
if (projectId) {
  try {
    const opts = {
      vertexAI: true,
      project: projectId,
      location: location,
    };

    if (fs.existsSync(keyFilePath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;
      console.log('✅ Vertex AI: Using service account keyfile google_cloud_credentials.json');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log(`✅ Vertex AI: Using GOOGLE_APPLICATION_CREDENTIALS (${process.env.GOOGLE_APPLICATION_CREDENTIALS})`);
    } else {
      console.log(`✅ Google Cloud Vertex AI (ADC) initialized for project "${projectId}" in region "${location}"`);
    }

    aiClient = new GoogleGenAI(opts);
    useVertexAI = true;
  } catch (err) {
    console.warn('⚠️ Vertex AI init note:', err.message);
  }
}

// Fallback to Gemini API Key if valid API key exists
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const isValidApiKey = apiKey && typeof apiKey === 'string' && apiKey.trim().length > 10 && !apiKey.includes('your_gemini_api_key_here');

if (!useVertexAI && isValidApiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
    console.log('✅ Google GenAI initialized with API Key');
  } catch (e) {
    console.warn('⚠️ Gemini API key init note:', e.message);
  }
}

module.exports = {
  aiClient,
  useVertexAI,
  projectId,
  location,
  isValidApiKey,
};
