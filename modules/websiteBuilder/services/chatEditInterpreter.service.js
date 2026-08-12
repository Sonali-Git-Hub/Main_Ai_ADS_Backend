const fs = require('fs');
const path = require('path');
const { generateJSON } = require('../../../services/aiService');
const projectSandboxService = require('../sandbox/projectSandbox.service');
const storageService = require('./ProjectStorageService');

/**
 * Chat Edit Interpreter & Targeted Source Code Modifier Service
 *
 * Interprets natural language chat requests (e.g., "Make the navbar smaller",
 * "Change colors to black and ivory", "Make the hero minimal") and applies targeted
 * file edits directly to the existing generated React/Vite project source files.
 */
async function processChatEditRequest(options = {}) {
  const {
    projectId,
    userPrompt,
    activeRequirement = null,
    activeBlueprint = null,
    reqId: inputReqId = null
  } = options;

  const reqId = inputReqId || `edit_${Math.random().toString(36).substring(2, 8)}`;
  const tag = `[WB:CHAT_EDIT:${reqId}] `;
  console.log(`${tag}Processing chat edit request: "${userPrompt}" for project ${projectId}`);

  if (!projectId) {
    throw new Error('projectId is required for chat editing');
  }
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error('userPrompt is required for chat editing');
  }

  // Locate current v1 project directory
  const projectDir = storageService.getProjectVersionPath(projectId, 'v1');
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found at: ${projectDir}`);
  }

  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) {
    throw new Error(`src directory not found in project: ${srcDir}`);
  }

  // Scan existing source files to pass context to AI or targeted modifier
  const sourceFiles = getSourceFilesMap(srcDir);
  console.log(`${tag}Discovered ${Object.keys(sourceFiles).length} source files in project src/`);

  // Target matching & Edit synthesis
  let modifiedFiles = [];
  let summaryExplanation = '';

  const promptLower = userPrompt.toLowerCase();

  // ── 1. THEME & AESTHETIC EDITS (e.g. "warmer softer dental aesthetic", "black and ivory", "minimal typography") ──
  const themeCssPath = Object.keys(sourceFiles).find(f => f.includes('theme.css') || f.includes('styles/theme'));
  const currentThemeCss = themeCssPath ? sourceFiles[themeCssPath] : '';
  const siteDataPath = Object.keys(sourceFiles).find(f => f.includes('siteData.js'));
  const currentSiteData = siteDataPath ? sourceFiles[siteDataPath] : '';

  // Call AI to interpret natural language edit and generate exact CSS variable updates + file modifications
  console.log(`${tag}Calling AI service to generate targeted code & design modifications for: "${userPrompt}"...`);

  try {
    const editSystemPrompt = `
You are AISA Web App Source Code Modifier.
Your task is to analyze the user's natural language edit request and produce precise code or CSS variable updates to apply to the generated React/Vite application.

Target Project Files:
1. \`src/styles/theme.css\`:
\`\`\`css
${currentThemeCss}
\`\`\`

User Edit Request: "${userPrompt}"

RULES FOR VISUAL/AESTHETIC EDITS:
- If user requests a warmer, softer, darker, minimal, luxury, colorful, or specific color/aesthetic change:
  - Generate appropriate hex codes for --primary-color, --secondary-color, --accent-color, --bg-color, --text-color, --text-muted, --card-bg, --card-border.
  - For "warmer, softer dental aesthetic":
    - --primary-color: #38BDF8 (soft welcoming sky/cyan) or #4A90E2
    - --secondary-color: #0EA5E9
    - --accent-color: #34D399 (soft mint)
    - --bg-color: #F8FAFC or #FFFDF9 (soft warm cream/off-white, NOT harsh dark navy)
    - --text-color: #0F172A (clean dark charcoal text for high contrast on soft background)
    - --text-muted: #475569
    - --card-bg: #FFFFFF (clean white card on soft warm background)
    - --card-border: rgba(56, 189, 248, 0.15)
- If user requests a smaller navbar:
  - Specify component code update or navbar height/padding adjustments.

GENERATE THE FOLLOWING JSON:
{
  "editType": "aesthetic_theme | component_layout | content_copy",
  "explanation": "Human-readable explanation of exact changes made to the website",
  "themeCssUpdates": {
    "--primary-color": "#Hex",
    "--secondary-color": "#Hex",
    "--accent-color": "#Hex",
    "--bg-color": "#Hex",
    "--text-color": "#Hex",
    "--text-muted": "#Hex",
    "--card-bg": "rgba/Hex",
    "--card-border": "rgba/Hex"
  },
  "updatedThemeCss": "Full updated content for src/styles/theme.css if theme changed, else null",
  "componentEdits": [
    {
      "relPath": "src/components/Navbar.jsx",
      "updatedContent": "Full updated React component code if component changed"
    }
  ]
}
`;

    const aiRes = await generateJSON(editSystemPrompt, { model: 'gemini-3.5-flash', reqId });
    const aiData = aiRes && aiRes.data ? aiRes.data : aiRes;

    if (aiData && typeof aiData === 'object') {
      // 1) Apply CSS Theme updates
      if (aiData.updatedThemeCss && themeCssPath) {
        fs.writeFileSync(path.join(srcDir, themeCssPath), aiData.updatedThemeCss, 'utf8');
        modifiedFiles.push(`src/${themeCssPath}`);
      } else if (aiData.themeCssUpdates && themeCssPath && currentThemeCss) {
        let newCss = currentThemeCss;
        for (const [varName, varVal] of Object.entries(aiData.themeCssUpdates)) {
          if (varVal && typeof varVal === 'string') {
            const reg = new RegExp(`${varName}:\\s*[^;]+;`, 'g');
            newCss = newCss.replace(reg, `${varName}: ${varVal};`);
          }
        }
        fs.writeFileSync(path.join(srcDir, themeCssPath), newCss, 'utf8');
        modifiedFiles.push(`src/${themeCssPath}`);
      }

      // 2) Apply Component Code edits
      if (Array.isArray(aiData.componentEdits)) {
        for (const compEdit of aiData.componentEdits) {
          if (compEdit.relPath && compEdit.updatedContent) {
            const targetPath = path.join(srcDir, compEdit.relPath.replace(/^src\//, ''));
            fs.writeFileSync(targetPath, compEdit.updatedContent, 'utf8');
            modifiedFiles.push(compEdit.relPath);
          }
        }
      }

      if (aiData.explanation) {
        summaryExplanation = aiData.explanation;
      }
    }
  } catch (aiErr) {
    console.warn(`${tag}AI targeted edit failed:`, aiErr.message);
  }

  // Fast Fallback: Deterministic Regex Edits for specific common requests if AI returned no edits
  if (modifiedFiles.length === 0) {
    if (promptLower.includes('warmer') || promptLower.includes('softer') || promptLower.includes('dental')) {
      if (themeCssPath && currentThemeCss) {
        let softDentalCss = currentThemeCss
          .replace(/--primary-color:\s*[^;]+;/g, '--primary-color: #38BDF8;')
          .replace(/--secondary-color:\s*[^;]+;/g, '--secondary-color: #0EA5E9;')
          .replace(/--accent-color:\s*[^;]+;/g, '--accent-color: #34D399;')
          .replace(/--bg-color:\s*[^;]+;/g, '--bg-color: #F8FAFC;')
          .replace(/--text-color:\s*[^;]+;/g, '--text-color: #0F172A;')
          .replace(/--text-muted:\s*[^;]+;/g, '--text-muted: #475569;')
          .replace(/--card-bg:\s*[^;]+;/g, '--card-bg: #FFFFFF;')
          .replace(/--card-border:\s*[^;]+;/g, '--card-border: rgba(56, 189, 248, 0.15);');
        fs.writeFileSync(path.join(srcDir, themeCssPath), softDentalCss, 'utf8');
        modifiedFiles.push(`src/${themeCssPath}`);
        summaryExplanation = 'Updated design to a warmer, softer dental aesthetic with friendly sky-blue accents and off-white background.';
      }
    } else if (promptLower.includes('navbar') || promptLower.includes('header')) {
      const navbarPath = Object.keys(sourceFiles).find(f => f.includes('Navbar') || f.includes('Header'));
      if (navbarPath && sourceFiles[navbarPath]) {
        let navCode = sourceFiles[navbarPath].replace(/py-[4-8]/g, 'py-2').replace(/h-20|h-24|h-16/g, 'h-12');
        fs.writeFileSync(path.join(srcDir, navbarPath), navCode, 'utf8');
        modifiedFiles.push(`src/${navbarPath}`);
        summaryExplanation = 'Updated Navbar layout to a more compact, streamlined header.';
      }
    } else if (promptLower.includes('black and ivory') || promptLower.includes('ivory')) {
      if (themeCssPath && currentThemeCss) {
        let ivoryCss = currentThemeCss
          .replace(/--primary-color:\s*[^;]+;/g, '--primary-color: #111111;')
          .replace(/--bg-color:\s*[^;]+;/g, '--bg-color: #FFFFF0;')
          .replace(/--text-color:\s*[^;]+;/g, '--text-color: #111111;');
        fs.writeFileSync(path.join(srcDir, themeCssPath), ivoryCss, 'utf8');
        modifiedFiles.push(`src/${themeCssPath}`);
        summaryExplanation = 'Updated theme palette to Black & Ivory minimalist.';
      }
    }
  }

  // ⚠️ STRICT ERROR HANDLING: If NO source files were modified, return success: false!
  if (modifiedFiles.length === 0) {
    console.warn(`${tag}Chat edit request could not modify any files.`);
    return {
      success: false,
      projectId,
      userPrompt,
      modifiedFiles: [],
      error: `Could not apply edit request: "${userPrompt}". No source files were updated.`
    };
  }

  // Re-trigger Vite Sandbox build & restart
  console.log(`${tag}Re-building and restarting Runtime Sandbox after modifying ${modifiedFiles.length} file(s)...`);
  const sandboxState = await projectSandboxService.runProjectInSandbox({
    projectId,
    projectDir
  });

  return {
    success: sandboxState.status === 'RUNNING',
    projectId,
    userPrompt,
    modifiedFiles,
    explanation: summaryExplanation || `Successfully updated ${modifiedFiles.length} source file(s) and rebuilt the application.`,
    updatedDesignSpec: {
      theme: 'Updated via Chat Assistant',
      timestamp: Date.now()
    },
    runtime: {
      status: sandboxState.status,
      port: sandboxState.port,
      url: `${sandboxState.url}?t=${Date.now()}`,
      buildStatus: sandboxState.buildStatus,
      startedAt: sandboxState.startedAt
    }
  };
}

/**
 * Helper to recursively scan src/ directory for text files
 */
function getSourceFilesMap(dir, base = '') {
  const map = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = base ? path.join(base, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      Object.assign(map, getSourceFilesMap(fullPath, relPath));
    } else if (entry.isFile() && /\.(jsx?|tsx?|css|json|html)$/i.test(entry.name)) {
      try {
        map[relPath.replace(/\\/g, '/')] = fs.readFileSync(fullPath, 'utf8');
      } catch (e) {}
    }
  }

  return map;
}

module.exports = { processChatEditRequest };
