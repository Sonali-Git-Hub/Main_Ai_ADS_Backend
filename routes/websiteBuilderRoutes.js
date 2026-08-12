const express = require('express');
const router = express.Router();
const WebsiteProject = require('../models/WebsiteProject');
const WebsiteVersion = require('../models/WebsiteVersion');
const { analyzeRequirement } = require('../modules/websiteBuilder/websiteBuilder.service');

const { generateWebsiteBlueprint } = require('../modules/websiteBuilder/websiteBlueprint.service');

// ─── POST /api/website-builder/analyze ───────────────────────────────────────
router.post('/analyze', async (req, res) => {
  const reqId = req.headers['x-correlation-id'] || req.body.reqId || `wb_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[WB:${reqId}] Backend request received. POST /api/website-builder/analyze`);
  console.log(`[WB:${reqId}] Prompt: "${(req.body.prompt || '').slice(0, 60)}..."`);

  try {
    const { prompt, brandContext = {} } = req.body;
    if (!prompt) {
      console.warn(`[WB:${reqId}] Request validation failed: Missing prompt parameter.`);
      return res.status(400).json({ success: false, error: 'prompt is required', reqId });
    }

    const requirement = await analyzeRequirement(prompt, brandContext, reqId);
    const source = requirement.analysisMetadata?.analysisSource || 'unknown';
    console.log(`[WB:${reqId}] Returning requirement response. analysisSource: ${source}`);

    res.json({ success: true, requirement, reqId });
  } catch (err) {
    console.error(`[WB:${reqId}] Requirement Analysis Route Error:`, err.message);
    res.status(500).json({ success: false, error: err.message, reqId });
  }
});

// ─── POST /api/website-builder/blueprint ─────────────────────────────────────
router.post('/blueprint', async (req, res) => {
  const reqId = req.headers['x-correlation-id'] || req.body.reqId || `wb_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[WB:${reqId}] Backend request received. POST /api/website-builder/blueprint`);

  try {
    const { requirement, approvedRecommendations = [] } = req.body;
    if (!requirement) {
      return res.status(400).json({ success: false, error: 'Requirement object is required', reqId });
    }

    const blueprint = generateWebsiteBlueprint(requirement, approvedRecommendations, reqId);
    console.log(`[WB:${reqId}] Returning Website Blueprint response. Pages count: ${blueprint.pages.length}`);

    res.json({ success: true, blueprint, reqId });
  } catch (err) {
    console.error(`[WB:${reqId}] Website Blueprint Route Error:`, err.message);
    res.status(500).json({ success: false, error: err.message, reqId });
  }
});

const { generateWebsiteFromBlueprint } = require('../modules/websiteBuilder/websiteGenerator.service');

// ─── POST /api/website-builder/generate ─────────────────────────────────────
router.post('/generate', async (req, res) => {
  const reqId = req.headers['x-correlation-id'] || req.body.reqId || `wb_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[WB:${reqId}] Backend request received. POST /api/website-builder/generate`);

  try {
    const { blueprint } = req.body;
    if (!blueprint || typeof blueprint !== 'object') {
      return res.status(400).json({ success: false, error: 'Blueprint object is required', reqId });
    }

    const website = generateWebsiteFromBlueprint(blueprint, reqId);
    console.log(`[WB:${reqId}] Returning Generated Website response. Pages: ${website.pages.length}, Validation Status: ${website.validationResult.status}`);

    res.json({ success: true, website, reqId });
  } catch (err) {
    console.error(`[WB:${reqId}] Website Generator Route Error:`, err.message);
    res.status(500).json({ success: false, error: err.message, reqId });
  }
});

const { runWebsiteBuild } = require('../modules/websiteBuilder/orchestrator/buildOrchestrator.service');

// ─── POST /api/website-builder/build ──────────────────────────────────────────
router.post('/build', async (req, res) => {
  const reqId = req.headers['x-correlation-id'] || req.body.reqId || `wb_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[WB:${reqId}] Backend request received. POST /api/website-builder/build`);

  try {
    const { prompt, brandContext = {}, requirement = null, approvedRecommendations = [] } = req.body;

    const buildResult = await runWebsiteBuild({
      prompt,
      brandContext,
      requirement,
      approvedRecommendations,
      reqId
    });

    if (!buildResult.success && buildResult.error) {
      return res.status(buildResult.stage === 'phase1' ? 400 : 422).json({
        success: false,
        reqId,
        stage: buildResult.stage,
        error: buildResult.error,
        pipeline: buildResult.pipeline
      });
    }

    res.json({ success: true, build: buildResult, reqId });
  } catch (err) {
    console.error(`[WB:${reqId}] Build Orchestrator Route Error:`, err.message);
    res.status(500).json({ success: false, error: err.message, reqId });
  }
});

// ─── GET /api/website-builder/projects ───────────────────────────────────────
router.get('/projects', async (req, res) => {
  try {
    const { workspaceId, limit = 20 } = req.query;
    const filter = {};
    if (workspaceId) filter.workspaceId = workspaceId;

    const projects = await WebsiteProject.find(filter)
      .sort({ updatedAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/website-builder/projects ──────────────────────────────────────
router.post('/projects', async (req, res) => {
  try {
    const { workspaceId = 'default_ws', title = 'My Web App', businessType = 'General Store', industry = 'E-Commerce' } = req.body;
    const projectId = `proj_${Date.now()}`;

    const project = await WebsiteProject.create({
      projectId,
      workspaceId,
      title,
      businessType,
      industry,
      status: 'DRAFT',
      activeVersion: 'v1'
    });

    // Create v1 initial version record
    const version = await WebsiteVersion.create({
      projectId,
      version: 'v1',
      changelog: 'Project initialized',
      storagePath: storageService.getProjectVersionPath(projectId, 'v1'),
      fileCount: 0
    });

    res.json({ success: true, project, version });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/website-builder/projects/:id ────────────────────────────────────
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await WebsiteProject.findOne({ projectId: req.params.id });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const versions = await WebsiteVersion.find({ projectId: req.params.id }).sort({ createdAt: -1 });
    const artifacts = storageService.loadVersionArtifacts(req.params.id, project.activeVersion);

    res.json({ success: true, project, versions, files: artifacts.files || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const projectSandboxService = require('../modules/websiteBuilder/sandbox/projectSandbox.service');

// ─── GET /api/website-builder/projects/:id/runtime ────────────────────────────
router.get('/projects/:id/runtime', (req, res) => {
  const projectId = req.params.id;
  const runtime = projectSandboxService.getProjectStatus(projectId);
  res.json({ success: true, runtime });
});

// ─── POST /api/website-builder/projects/:id/runtime/stop ───────────────────────
router.post('/projects/:id/runtime/stop', async (req, res) => {
  const projectId = req.params.id;
  const result = await projectSandboxService.stopProject(projectId);
  res.json({ success: true, result });
});

const { analyzeClarificationNeed } = require('../modules/websiteBuilder/services/clarificationAnalyzer.service');
const { processChatEditRequest } = require('../modules/websiteBuilder/services/chatEditInterpreter.service');

// ─── POST /api/website-builder/clarify ─────────────────────────────────────────
router.post('/clarify', async (req, res) => {
  const reqId = req.headers['x-correlation-id'] || req.body.reqId || `wb_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[WB:${reqId}] POST /api/website-builder/clarify request received.`);

  try {
    const { prompt, brandContext = {} } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt is required', reqId });
    }

    const clarification = await analyzeClarificationNeed(prompt, brandContext, reqId);
    res.json({ success: true, clarification, reqId });
  } catch (err) {
    console.error(`[WB:${reqId}] Clarification Route Error:`, err.message);
    res.status(500).json({ success: false, error: err.message, reqId });
  }
});

// ─── POST /api/website-builder/chat-edit ──────────────────────────────────────
router.post('/chat-edit', async (req, res) => {
  const reqId = req.headers['x-correlation-id'] || req.body.reqId || `wb_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[WB:${reqId}] POST /api/website-builder/chat-edit request received.`);

  try {
    const { projectId, userPrompt, activeRequirement, activeBlueprint } = req.body;
    if (!projectId || !userPrompt) {
      return res.status(400).json({ success: false, error: 'projectId and userPrompt are required', reqId });
    }

    const editResult = await processChatEditRequest({
      projectId,
      userPrompt,
      activeRequirement,
      activeBlueprint,
      reqId
    });

    res.json({ success: true, result: editResult, reqId });
  } catch (err) {
    console.error(`[WB:${reqId}] Chat Edit Route Error:`, err.message);
    res.status(500).json({ success: false, error: err.message, reqId });
  }
});

module.exports = router;


