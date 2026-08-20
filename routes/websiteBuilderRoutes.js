const express = require('express');
const router = express.Router();
const path = require('path');
const WebsiteProject = require('../models/WebsiteProject');
const WebsiteVersion = require('../models/WebsiteVersion');
const storageService = require('../modules/websiteBuilder/services/ProjectStorageService');
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
    const { prompt, brandContext = {}, requirement = null, approvedRecommendations = [], clarificationAnswers = {} } = req.body;

    if (clarificationAnswers && Object.keys(clarificationAnswers).length > 0) {
      brandContext.clarificationAnswers = clarificationAnswers;
    }

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

    // Automatically persist WebsiteProject to repository
    if (buildResult && buildResult.success) {
      const projectId = buildResult.sourceProject?.projectId || buildResult.website?.websiteId || `proj_${Date.now()}`;
      const projectTitle = buildResult.requirement?.proposedIdentity?.name ||
                           buildResult.requirement?.businessType ||
                           buildResult.website?.websiteIdentity?.title ||
                           'Generated Web Application';
      const wsId = req.body.workspaceId || brandContext?.workspaceId || 'default_ws';

      try {
        await WebsiteProject.findOneAndUpdate(
          { projectId },
          {
            projectId,
            workspaceId: wsId,
            title: projectTitle,
            businessType: buildResult.requirement?.businessType || 'Full-Stack App',
            industry: buildResult.requirement?.industry || 'Technology & E-Commerce',
            status: 'GENERATED',
            activeVersion: 'v1',
            blueprint: buildResult.blueprint,
            website: buildResult.website,
            requirement: buildResult.requirement,
            runtime: buildResult.runtime,
            updatedAt: new Date()
          },
          { upsert: true, returnDocument: 'after' }
        );
        console.log(`[WB:${reqId}] Persisted WebsiteProject document: ${projectId}`);
      } catch (saveErr) {
        console.warn(`[WB:${reqId}] Note: Project persist warning:`, saveErr.message);
      }
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
    const { workspaceId, limit = 50 } = req.query;
    const filter = {};
    if (workspaceId && workspaceId !== 'undefined' && workspaceId !== 'null') {
      filter.$or = [{ workspaceId }, { workspaceId: 'default_ws' }];
    }

    const projects = await WebsiteProject.find(filter)
      .sort({ updatedAt: -1 })
      .limit(Number(limit));

    // Auto-sync titles and identities from disk if siteData.js was modified via chat
    const syncedProjects = projects.map(p => {
      const pObj = p.toObject ? p.toObject() : p;
      try {
        const siteDataPath = path.join(storageService.getProjectVersionPath(pObj.projectId, pObj.activeVersion || 'v1'), 'src/data/siteData.js');
        if (fs.existsSync(siteDataPath)) {
          const raw = fs.readFileSync(siteDataPath, 'utf8');
          const titleMatch = raw.match(/"title":\s*"([^"]+)"/);
          if (titleMatch && titleMatch[1]) {
            pObj.title = titleMatch[1];
            if (pObj.website && pObj.website.websiteIdentity) {
              pObj.website.websiteIdentity.title = titleMatch[1];
            }
          }
        }
      } catch (e) {}
      return pObj;
    });

    res.json({ success: true, projects: syncedProjects });
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

const fs = require('fs');
const { generateCodeProject } = require('../modules/websiteBuilder/emitter/codeEmitter.service');

async function ensureProjectOnDisk(project) {
  if (!project) return false;
  const projectId = project.projectId;
  const version = project.activeVersion || 'v1';
  const versionDir = storageService.getProjectVersionPath(projectId, version);

  if (fs.existsSync(versionDir)) {
    const files = fs.readdirSync(versionDir);
    if (files.length > 0) return true;
  }

  // Self-heal: reconstruct code from website model or blueprint
  console.log(`[AutoSelfHeal] Emitting missing project files to disk for ${projectId}...`);
  try {
    let websiteModel = project.website;
    let blueprint = project.blueprint;
    let requirement = project.requirement;

    if (!blueprint && requirement) {
      blueprint = generateWebsiteBlueprint(requirement, [], projectId);
    }
    if (!websiteModel && blueprint) {
      websiteModel = generateWebsiteFromBlueprint(blueprint, projectId);
    }

    if (websiteModel) {
      websiteModel.websiteId = projectId;
      generateCodeProject(websiteModel, blueprint || {}, requirement || {}, projectId);
      console.log(`[AutoSelfHeal] Successfully emitted code project for ${projectId}`);
      return true;
    }
  } catch (err) {
    console.error(`[AutoSelfHeal Error] Failed to emit ${projectId}:`, err.message);
  }

  return false;
}

// ─── GET /api/website-builder/projects/:id ────────────────────────────────────
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await WebsiteProject.findOne({ projectId: req.params.id });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    await ensureProjectOnDisk(project);

    // Sync siteData.js title and identity from disk
    const projectDir = storageService.getProjectVersionPath(project.projectId, project.activeVersion || 'v1');
    const siteDataPath = path.join(projectDir, 'src/data/siteData.js');
    if (fs.existsSync(siteDataPath)) {
      try {
        const raw = fs.readFileSync(siteDataPath, 'utf8');
        const titleMatch = raw.match(/"title":\s*"([^"]+)"/);
        if (titleMatch && titleMatch[1]) {
          project.title = titleMatch[1];
          if (project.website && project.website.websiteIdentity) {
            project.website.websiteIdentity.title = titleMatch[1];
          }
        }
      } catch (e) {}
    }

    // Auto-ensure Live Sandbox Runtime is running for this project
    let runtime = projectSandboxService.getProjectStatus(project.projectId);
    if (!runtime || runtime.status !== 'RUNNING' || !runtime.url) {
      if (fs.existsSync(projectDir)) {
        try {
          runtime = await projectSandboxService.runProjectInSandbox({
            projectId: project.projectId,
            projectDir,
            forceRebuild: false
          });
        } catch (e) {
          console.warn(`[WB:GET /projects/:id] Auto-start runtime note for ${project.projectId}:`, e.message);
        }
      }
    }

    if (runtime && runtime.status === 'RUNNING') {
      project.runtime = runtime;
      if (project.website) {
        project.website.runtime = runtime;
      }
    }

    const versions = await WebsiteVersion.find({ projectId: req.params.id }).sort({ createdAt: -1 });
    const artifacts = storageService.loadVersionArtifacts(req.params.id, project.activeVersion || 'v1');

    res.json({ success: true, project, runtime, versions, files: artifacts.files || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/website-builder/projects/:id/export-zip ─────────────────────────
router.get('/projects/:id/export-zip', async (req, res) => {
  try {
    const project = await WebsiteProject.findOne({ projectId: req.params.id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    await ensureProjectOnDisk(project);

    const title = project?.websiteIdentity?.title || project?.title || 'website-app';
    const version = project?.activeVersion || 'v1';

    storageService.exportProjectZip(req.params.id, version, res, title);
  } catch (err) {
    console.error('[ExportZIP Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// ─── GET /api/website-builder/projects/:id/files ──────────────────────────────
router.get('/projects/:id/files', async (req, res) => {
  try {
    const project = await WebsiteProject.findOne({ projectId: req.params.id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    await ensureProjectOnDisk(project);

    const version = project?.activeVersion || req.query.version || 'v1';
    const artifacts = storageService.loadVersionArtifacts(req.params.id, version);

    if (!artifacts.success) {
      return res.status(404).json({ success: false, error: artifacts.error });
    }

    res.json({ success: true, files: artifacts.files || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/website-builder/projects/:id ─────────────────────────────────
router.delete('/projects/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isMongoId ? { $or: [{ projectId: id }, { _id: id }] } : { projectId: id };

    const project = await WebsiteProject.findOne(filter);
    const pid = project?.projectId || id;

    // 1. Stop sandbox runtime if running
    try {
      await projectSandboxService.stopProject(pid);
    } catch (e) {
      // Ignore sandbox stop errors
    }

    // 2. Delete database records
    await WebsiteProject.deleteMany(filter);
    await WebsiteVersion.deleteMany({ projectId: pid });

    // 3. Remove disk storage directory
    const projectDir = path.join(storageService.baseStorageDir, pid);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }

    console.log(`[WB:DELETE] Successfully deleted project ${pid}`);
    res.json({ success: true, message: `Project ${pid} deleted successfully` });
  } catch (err) {
    console.error(`[WB:DELETE Error] Failed to delete ${id}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const projectSandboxService = require('../modules/websiteBuilder/sandbox/projectSandbox.service');

// ─── GET /api/website-builder/projects/:id/runtime ────────────────────────────
router.get('/projects/:id/runtime', async (req, res) => {
  const projectId = req.params.id;
  let runtime = projectSandboxService.getProjectStatus(projectId);
  if (!runtime || runtime.status !== 'RUNNING' || !runtime.url) {
    const projectDir = storageService.getProjectVersionPath(projectId, 'v1');
    if (fs.existsSync(projectDir)) {
      try {
        runtime = await projectSandboxService.runProjectInSandbox({
          projectId,
          projectDir,
          forceRebuild: false
        });
      } catch (e) {
        console.warn(`[WB:Runtime] Auto-start on GET runtime failed for ${projectId}:`, e.message);
      }
    }
  }
  res.json({ success: true, runtime });
});

// ─── POST /api/website-builder/projects/:id/runtime/start ─────────────────────
router.post('/projects/:id/runtime/start', async (req, res) => {
  const projectId = req.params.id;
  const projectDir = storageService.getProjectVersionPath(projectId, 'v1');
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ success: false, error: 'Project directory not found on disk' });
  }
  try {
    const runtime = await projectSandboxService.runProjectInSandbox({
      projectId,
      projectDir,
      forceRebuild: req.body.forceRebuild || false
    });
    res.json({ success: true, runtime });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

    if (editResult && editResult.success) {
      try {
        const updateFields = {
          status: 'MODIFIED',
          updatedAt: new Date()
        };
        if (editResult.updatedTitle) {
          updateFields.title = editResult.updatedTitle;
        }
        if (editResult.updatedWebsite) {
          updateFields.website = editResult.updatedWebsite;
        } else {
          if (editResult.updatedTitle) {
            updateFields['website.websiteIdentity.title'] = editResult.updatedTitle;
          }
          if (editResult.updatedDesignSpec) {
            updateFields['website.designSpec'] = editResult.updatedDesignSpec;
          }
        }
        if (editResult.runtime) {
          updateFields.runtime = editResult.runtime;
        }
        await WebsiteProject.findOneAndUpdate(
          { projectId },
          { $set: updateFields },
          { returnDocument: 'after' }
        );
        console.log(`[WB:${reqId}] Auto-saved updated project '${projectId}' to MongoDB successfully.`);
      } catch (dbErr) {
        console.warn(`[WB:${reqId}] DB update note on chat edit:`, dbErr.message);
      }
    }

    res.json({ success: true, result: editResult, reqId });
  } catch (err) {
    console.error(`[WB:${reqId}] Chat Edit Route Error:`, err.message);
    res.status(500).json({ success: false, error: err.message, reqId });
  }
});

module.exports = router;


