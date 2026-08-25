const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';

const projectId = process.env.GCP_PROJECT_ID || 'ai-mall-484810';
const location = process.env.GCP_LOCATION || 'asia-south1';
const keyFilePath = path.join(__dirname, '../google_cloud_credentials.json');

let aiClient = null;
let useVertexAI = false;

if (fs.existsSync(keyFilePath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;
  console.log('✅ Vertex AI: Using service account keyfile google_cloud_credentials.json');
}

// Initialize @google/genai in Vertex AI Mode or direct API Key Mode
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  try {
    aiClient = new GoogleGenAI({ apiKey });
    useVertexAI = false;
    console.log('✅ @google/genai initialized using direct Gemini API key');
  } catch (err) {
    console.warn('⚠️ GoogleGenAI API key init error:', err.message);
  }
} else if (projectId) {
  try {
    aiClient = new GoogleGenAI({
      vertexAI: true,
      project: projectId,
      location: location,
    });
    useVertexAI = true;
    console.log(`✅ @google/genai Vertex AI (ADC) initialized for project "${projectId}" in region "${location}"`);
  } catch (err) {
    console.warn('⚠️ Vertex AI init note:', err.message);
  }
}

module.exports = {
  aiClient,
  useVertexAI,
  projectId,
  location,
};
