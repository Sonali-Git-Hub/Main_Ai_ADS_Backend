const { analyzeRequirement } = require('../websiteBuilder.service');
const { generateWebsiteBlueprint } = require('../websiteBlueprint.service');
const { generateWebsiteFromBlueprint } = require('../websiteGenerator.service');
const { generateCodeProject } = require('../emitter/codeEmitter.service');
const projectSandboxService = require('../sandbox/projectSandbox.service');
const { recordTelemetryEvent } = require('../../../services/telemetryService');

/**
 * Build Orchestrator Engine v2.0 — Stage 2A Sandbox Integration
 *
 * Coordinates the end-to-end website build pipeline:
 * Phase 1: Requirement & Intent Analysis (via websiteBuilder.service.js)
 * Phase 2: User Strategy & Override Preservation
 * Phase 3: Information Architecture Blueprint Generation (via websiteBlueprint.service.js)
 * Phase 4: Component Specification & Website Model Rendering (via websiteGenerator.service.js)
 * Phase 5 (Stage 1B): Executable React Source Code Project Emission (via codeEmitter.service.js)
 * Phase 6 (Stage 2A): Real Runtime Sandbox & Live App Execution (via projectSandbox.service.js)
 *
 * Strictly enforces source-of-truth priority:
 * USER OVERRIDE > USER EXPLICIT REQUIREMENT > AI INFERENCE > SYSTEM DEFAULT
 */
async function runWebsiteBuild(options = {}) {
  const {
    prompt,
    brandContext = {},
    requirement: inputRequirement = null,
    approvedRecommendations = [],
    reqId: inputReqId = null,
    runSandbox = true
  } = options;

  const reqId = inputReqId || `wb_${Math.random().toString(36).substring(2, 9)}`;
  const correlationTag = `[WB:BUILD:${reqId}] `;
  console.log(`${correlationTag}Build Orchestrator initiated.`);

  recordTelemetryEvent({
    eventType: 'AI_PIPELINE',
    source: 'AI_PIPELINE',
    component: 'BuildOrchestrator',
    action: 'BUILD_PIPELINE_INITIATED',
    buildId: reqId,
    requestId: reqId,
    metadata: { promptSnippet: prompt?.slice(0, 120), brandName: brandContext.brandName }
  });

  const pipeline = {
    phase1: { status: 'skipped', durationMs: 0 },
    phase2: { status: 'completed', durationMs: 0 },
    phase3: { status: 'pending', durationMs: 0 },
    phase4: { status: 'pending', durationMs: 0 },
    phase5: { status: 'pending', durationMs: 0 },
    phase6: { status: 'pending', durationMs: 0 }
  };

  let requirement = inputRequirement;

  // ─── STAGE 1: Requirement & Intent Analysis ────────────────────────────────
  if (!requirement) {
    if (!prompt || !prompt.trim()) {
      console.warn(`${correlationTag}Build failed: Prompt or requirement object is required.`);
      recordTelemetryEvent({
        eventType: 'ERROR',
        source: 'AI_PIPELINE',
        component: 'BuildOrchestrator',
        action: 'STAGE1_VALIDATION_ERROR',
        buildId: reqId,
        status: 'ERROR',
        metadata: { error: 'Prompt or requirement object is required.' }
      });
      return {
        success: false,
        reqId,
        stage: 'phase1',
        error: 'Either a user prompt or a valid requirement object must be provided.',
        pipeline
      };
    }

    console.log(`${correlationTag}Executing Stage 1: Requirement Analysis for prompt "${prompt.slice(0, 50)}..."`);
    recordTelemetryEvent({
      eventType: 'AI_PIPELINE',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE1_INTENT_ANALYSIS_START',
      buildId: reqId,
      metadata: { promptLength: prompt.length }
    });

    const p1Start = Date.now();
    try {
      requirement = await analyzeRequirement(prompt, brandContext, reqId);
      pipeline.phase1 = {
        status: 'completed',
        durationMs: Date.now() - p1Start
      };
      console.log(`${correlationTag}Phase 1 completed successfully in ${pipeline.phase1.durationMs}ms`);

      recordTelemetryEvent({
        eventType: 'AI_PIPELINE',
        source: 'AI_PIPELINE',
        component: 'BuildOrchestrator',
        action: 'STAGE1_INTENT_ANALYSIS_SUCCESS',
        buildId: reqId,
        metadata: {
          businessType: requirement.businessType,
          industry: requirement.industry,
          proposedPagesCount: requirement.proposedPages?.length || 0,
          durationMs: pipeline.phase1.durationMs
        }
      });
    } catch (err) {
      console.error(`${correlationTag}Phase 1 failed:`, err.message);
      pipeline.phase1 = {
        status: 'failed',
        durationMs: Date.now() - p1Start,
        error: err.message
      };
      recordTelemetryEvent({
        eventType: 'ERROR',
        source: 'AI_PIPELINE',
        component: 'BuildOrchestrator',
        action: 'STAGE1_INTENT_ANALYSIS_FAILED',
        buildId: reqId,
        status: 'ERROR',
        metadata: { error: err.message }
      });
      return {
        success: false,
        reqId,
        stage: 'phase1',
        error: `Phase 1 Requirement Analysis failed: ${err.message}`,
        pipeline
      };
    }
  } else {
    console.log(`${correlationTag}Phase 1 bypassed: Valid pre-analyzed requirement object provided.`);
    pipeline.phase1 = { status: 'bypassed', durationMs: 0 };
  }

  // ─── STAGE 2: User Strategy & Override Verification ────────────────────────
  if (!requirement || !requirement.proposedPages || !Array.isArray(requirement.proposedPages)) {
    console.warn(`${correlationTag}Phase 2 validation failed: Requirement missing proposedPages.`);
    return {
      success: false,
      reqId,
      stage: 'phase2',
      error: 'Invalid requirement payload: proposedPages array is required.',
      pipeline
    };
  }

  // ─── STAGE 2.5: Sequential Visual Asset Generation ─────────────────────────
  console.log(`${correlationTag}Executing Stage 2.5: Sequential Visual Asset Generation.`);
  recordTelemetryEvent({
    eventType: 'ASSET_PLAN',
    source: 'AI_PIPELINE',
    component: 'BuildOrchestrator',
    action: 'STAGE2_5_ASSET_PLANNING_START',
    buildId: reqId
  });

  const p25Start = Date.now();
  let visualAssetResult = null;
  try {
    const { generateWebsiteVisualAssetsSequential } = require('../services/visualAssetEngine.service');
    visualAssetResult = await generateWebsiteVisualAssetsSequential(requirement, reqId);
    requirement = visualAssetResult.requirement;
    requirement.approvedAssetPool = visualAssetResult.approvedAssetPool || {};
    pipeline.phaseVisualAssets = {
      status: 'completed',
      durationMs: Date.now() - p25Start,
      totalAssets: visualAssetResult.totalAssets,
      uniqueUrls: visualAssetResult.uniqueUrls
    };
    console.log(`${correlationTag}Phase 2.5 completed: ${visualAssetResult.totalAssets} assets planned, generated & validated.`);

    recordTelemetryEvent({
      eventType: 'ASSET_VALIDATION',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE2_5_ASSETS_APPROVED',
      buildId: reqId,
      metadata: {
        totalAssets: visualAssetResult.totalAssets,
        uniqueUrls: visualAssetResult.uniqueUrls,
        durationMs: pipeline.phaseVisualAssets.durationMs
      }
    });
  } catch (assetErr) {
    console.error(`${correlationTag}Phase 2.5 Visual Asset Generation failed:`, assetErr.message);
    pipeline.phaseVisualAssets = {
      status: 'failed',
      durationMs: Date.now() - p25Start,
      error: assetErr.message
    };
    recordTelemetryEvent({
      eventType: 'ERROR',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE2_5_ASSET_PLANNING_FAILED',
      buildId: reqId,
      status: 'ERROR',
      metadata: { error: assetErr.message }
    });
    return {
      success: false,
      reqId,
      stage: 'phaseVisualAssets',
      error: `Visual Asset Generation failed: ${assetErr.message}`,
      pipeline
    };
  }

  // ─── STAGE 3: Blueprint Generation ─────────────────────────────────────────
  console.log(`${correlationTag}Executing Stage 3: Information Architecture Blueprint Generation.`);
  recordTelemetryEvent({
    eventType: 'BLUEPRINT',
    source: 'AI_PIPELINE',
    component: 'BuildOrchestrator',
    action: 'STAGE3_BLUEPRINT_GENERATE_START',
    buildId: reqId
  });

  const p3Start = Date.now();
  let blueprint = null;
  try {
    blueprint = generateWebsiteBlueprint(requirement, approvedRecommendations, reqId);
    pipeline.phase3 = {
      status: 'completed',
      durationMs: Date.now() - p3Start
    };
    console.log(`${correlationTag}Phase 3 blueprint completed successfully. Pages count: ${blueprint.pages.length}`);

    recordTelemetryEvent({
      eventType: 'BLUEPRINT',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE3_BLUEPRINT_GENERATE_SUCCESS',
      buildId: reqId,
      metadata: { pagesCount: blueprint.pages.length, durationMs: pipeline.phase3.durationMs }
    });
  } catch (err) {
    console.error(`${correlationTag}Phase 3 failed:`, err.message);
    pipeline.phase3 = {
      status: 'failed',
      durationMs: Date.now() - p3Start,
      error: err.message
    };
    recordTelemetryEvent({
      eventType: 'ERROR',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE3_BLUEPRINT_FAILED',
      buildId: reqId,
      status: 'ERROR',
      metadata: { error: err.message }
    });
    return {
      success: false,
      reqId,
      stage: 'phase3',
      error: `Phase 3 Blueprint Generation failed: ${err.message}`,
      pipeline
    };
  }

  // ─── STAGE 4: Website Model Rendering ──────────────────────────────────────
  console.log(`${correlationTag}Executing Stage 4: Website Model Rendering.`);
  const p4Start = Date.now();
  let website = null;
  try {
    website = generateWebsiteFromBlueprint(blueprint, reqId);
    pipeline.phase4 = {
      status: 'completed',
      durationMs: Date.now() - p4Start
    };
    console.log(`${correlationTag}Phase 4 website model generated successfully. Pages: ${website.pages.length}, Status: ${website.validationResult?.status}`);

    recordTelemetryEvent({
      eventType: 'CODE_GENERATION',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE4_WEBSITE_MODEL_SUCCESS',
      buildId: reqId,
      metadata: { pagesCount: website.pages.length, validationStatus: website.validationResult?.status }
    });
  } catch (err) {
    console.error(`${correlationTag}Phase 4 failed:`, err.message);
    pipeline.phase4 = {
      status: 'failed',
      durationMs: Date.now() - p4Start,
      error: err.message
    };
    recordTelemetryEvent({
      eventType: 'ERROR',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE4_WEBSITE_MODEL_FAILED',
      buildId: reqId,
      status: 'ERROR',
      metadata: { error: err.message }
    });
    return {
      success: false,
      reqId,
      stage: 'phase4',
      error: `Phase 4 Website Model Generation failed: ${err.message}`,
      pipeline
    };
  }

  // ─── STAGE 5 / STAGE 1B: Source Code Project Emission ───────────────────────
  console.log(`${correlationTag}Executing Stage 1B: Source Code Project Emission.`);
  recordTelemetryEvent({
    eventType: 'CODE_GENERATION',
    source: 'AI_PIPELINE',
    component: 'BuildOrchestrator',
    action: 'STAGE1B_CODE_EMISSION_START',
    buildId: reqId
  });

  const p5Start = Date.now();
  let sourceProject = null;
  try {
    sourceProject = generateCodeProject(website, blueprint, requirement, reqId);
    pipeline.phase5 = {
      status: 'completed',
      durationMs: Date.now() - p5Start,
      fileCount: sourceProject.fileCount,
      projectDir: sourceProject.projectDir
    };
    console.log(`${correlationTag}Stage 1B source code emission completed successfully. Files: ${sourceProject.fileCount}`);

    recordTelemetryEvent({
      eventType: 'CODE_GENERATION',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE1B_CODE_EMISSION_SUCCESS',
      buildId: reqId,
      metadata: { fileCount: sourceProject.fileCount, durationMs: pipeline.phase5.durationMs }
    });
  } catch (err) {
    console.error(`${correlationTag}Stage 1B Code Emission failed:`, err.message);
    pipeline.phase5 = {
      status: 'failed',
      durationMs: Date.now() - p5Start,
      error: err.message
    };
    recordTelemetryEvent({
      eventType: 'ERROR',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE1B_CODE_EMISSION_FAILED',
      buildId: reqId,
      status: 'ERROR',
      metadata: { error: err.message }
    });
    return {
      success: false,
      reqId,
      stage: 'phase5',
      error: `Stage 1B Source Code Emission failed: ${err.message}`,
      pipeline
    };
  }

  // ─── STAGE 6 / STAGE 2A: Runtime Sandbox Execution ──────────────────────────
  let runtime = null;
  if (runSandbox) {
    console.log(`${correlationTag}Executing Stage 2A: Real Runtime Sandbox Execution.`);
    recordTelemetryEvent({
      eventType: 'BUILD',
      source: 'AI_PIPELINE',
      component: 'BuildOrchestrator',
      action: 'STAGE2A_SANDBOX_EXECUTION_START',
      buildId: reqId
    });

    const p6Start = Date.now();
    try {
      const sandboxState = await projectSandboxService.runProjectInSandbox({
        projectId: sourceProject.projectId || website.websiteId,
        projectDir: sourceProject.projectDir
      });

      runtime = {
        status: sandboxState.status,
        projectId: sandboxState.projectId,
        versionId: 'v1',
        port: sandboxState.port,
        url: sandboxState.url,
        buildStatus: sandboxState.buildStatus,
        startedAt: sandboxState.startedAt,
        errors: sandboxState.errors || []
      };

      pipeline.phase6 = {
        status: sandboxState.status === 'RUNNING' ? 'completed' : 'failed',
        durationMs: Date.now() - p6Start,
        port: sandboxState.port,
        url: sandboxState.url,
        statusState: sandboxState.status
      };
      console.log(`${correlationTag}Stage 2A Sandbox execution status: ${sandboxState.status}. URL: ${sandboxState.url}`);

      recordTelemetryEvent({
        eventType: sandboxState.status === 'RUNNING' ? 'BUILD' : 'ERROR',
        source: 'AI_PIPELINE',
        component: 'BuildOrchestrator',
        action: 'STAGE2A_SANDBOX_COMPLETED',
        buildId: reqId,
        status: sandboxState.status === 'RUNNING' ? 'SUCCESS' : 'ERROR',
        metadata: { url: sandboxState.url, port: sandboxState.port, sandboxStatus: sandboxState.status }
      });
    } catch (err) {
      console.error(`${correlationTag}Stage 2A Sandbox execution failed:`, err.message);
      pipeline.phase6 = {
        status: 'failed',
        durationMs: Date.now() - p6Start,
        error: err.message
      };
      runtime = {
        status: 'FAILED',
        projectId: sourceProject?.projectId || website?.websiteId,
        versionId: 'v1',
        port: null,
        url: null,
        buildStatus: 'FAILED',
        startedAt: null,
        errors: [err.message]
      };
    }
  } else {
    pipeline.phase6 = { status: 'skipped', durationMs: 0 };
  }

  // ─── STAGE 2A BUILD RESULT ──────────────────────────────────────────────────
  const isValidationPass = website.validationResult?.status === 'PASS' && sourceProject.success && (!runSandbox || runtime?.status === 'RUNNING');
  console.log(`${correlationTag}Build Orchestration finished cleanly. Validation status: ${website.validationResult?.status}, Runtime: ${runtime?.status || 'N/A'}`);

  return {
    success: isValidationPass,
    reqId,
    pipeline,
    requirement,
    blueprint,
    website,
    visualAssets: visualAssetResult?.assetManifest || [],
    approvedAssetPool: visualAssetResult?.approvedAssetPool || {},
    sourceProject,
    runtime,
    validation: website.validationResult || { status: 'PASS', checks: [] },
    metadata: {
      orchestratorVersion: '2.0.0-stage2a',
      generatedAt: new Date().toISOString(),
      analysisSource: requirement.analysisMetadata?.analysisSource || 'unknown',
      model: requirement.analysisMetadata?.model || 'none'
    }
  };
}

module.exports = { runWebsiteBuild };


