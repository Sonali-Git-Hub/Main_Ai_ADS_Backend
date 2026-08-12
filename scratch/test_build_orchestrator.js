/**
 * Build Orchestrator Automated Test Suite — Stage 1A Verification
 * Validates runWebsiteBuild orchestration across all 6 target scenarios.
 */

const { runWebsiteBuild } = require('../modules/websiteBuilder/orchestrator/buildOrchestrator.service');
const { analyzeRequirement } = require('../modules/websiteBuilder/websiteBuilder.service');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runOrchestratorTests() {
  console.log('\n========================================================');
  console.log(' BUILD ORCHESTRATOR STAGE 1A AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  // TEST 1: Broad Prompt End-to-End Orchestration
  console.log('--- TEST 1: Broad Prompt ("colorful balloon shop") ---');
  total++;
  const res1 = await runWebsiteBuild({
    prompt: 'Create a website for a colorful balloon shop.'
  });
  assert(res1.success, 'Orchestrator returned success: true');
  assert(res1.pipeline.phase1.status === 'completed', 'Phase 1 executed and completed');
  assert(res1.pipeline.phase3.status === 'completed', 'Phase 3 executed and completed');
  assert(res1.pipeline.phase4.status === 'completed', 'Phase 4 executed and completed');
  assert(res1.requirement && res1.blueprint && res1.website, 'All artifacts (requirement, blueprint, website) returned');
  assert(res1.website.pages.length >= 1, 'Generated website contains valid pages');
  passed++;

  // TEST 2: Explicit Design Prompt Color Survival
  console.log('\n--- TEST 2: Explicit Design Prompt ("pink, yellow and blue") ---');
  total++;
  const res2 = await runWebsiteBuild({
    prompt: 'Create a website for a balloon shop using pink, yellow and blue.'
  });
  assert(res2.success, 'Orchestration succeeded for explicit color prompt');
  assert(res2.requirement.designPreferences.sources.primaryColor === 'user_explicit', 'Phase 1 extracted user_explicit color source');
  assert(res2.blueprint.designSpec.sources.primaryColor === 'user_explicit', 'Phase 3 blueprint retained user_explicit color source');
  assert(res2.website.designSpec.sources.primaryColor === 'user_explicit', 'Phase 4 website retained user_explicit color source');
  passed++;

  // TEST 3: Prebuilt Requirement Input (Phase 1 Bypass)
  console.log('\n--- TEST 3: Prebuilt Requirement Input (Phase 1 Bypassed) ---');
  total++;
  const prebuiltReq = await analyzeRequirement('Create a website for a wedding photographer called Alex.');
  const p1StartCount = Date.now();
  const res3 = await runWebsiteBuild({
    requirement: prebuiltReq
  });
  assert(res3.success, 'Orchestration succeeded with prebuilt requirement input');
  assert(res3.pipeline.phase1.status === 'bypassed', 'Phase 1 was strictly bypassed (duration 0ms)');
  assert(res3.blueprint.websiteIdentity.industry === prebuiltReq.industry, 'Phase 3 received prebuilt requirement industry');
  passed++;

  // TEST 4: Approved Recommendation Flow
  console.log('\n--- TEST 4: Approved Recommendation Handling ---');
  total++;
  const res4 = await runWebsiteBuild({
    prompt: 'Create a website for an AI SaaS company called LedgerAI.',
    requirement: { ...prebuiltReq, aiRecommendedFeatures: ['WhatsApp Chat Integration', 'Automated Invoicing'] },
    approvedRecommendations: ['WhatsApp Chat Integration']
  });
  assert(res4.success, 'Orchestration succeeded with approved recommendations');
  assert(res4.blueprint.featureMatrix.approvedRecommendations.some(f => f.toLowerCase().includes('whatsapp')), 'Approved WhatsApp recommendation reached Phase 3 blueprint');
  assert(res4.website.contactRequirements.hasWhatsApp === true, 'WhatsApp contact integration active in Phase 4 website model');
  passed++;

  // TEST 5: Unapproved Recommendation Filtering
  console.log('\n--- TEST 5: Unapproved Recommendation Exclusion ---');
  total++;
  const res5 = await runWebsiteBuild({
    prompt: 'Create a website for a local bakery called SweetOven.',
    approvedRecommendations: [] // No recommendations approved
  });
  assert(res5.success, 'Orchestration succeeded with zero approved recommendations');
  const hasUnapprovedWhatsapp = res5.website.pages.some(p => (p.sections || p.components || []).some(c => c.componentType === 'WhatsAppChatFloatingButton' || c.type === 'WhatsAppChatFloatingButton'));
  assert(!hasUnapprovedWhatsapp, 'Unapproved WhatsApp recommendation strictly excluded from Phase 4 website model');
  passed++;

  // TEST 6: Structured Failure Handling
  console.log('\n--- TEST 6: Structured Failure Path (Missing Prompt & Requirement) ---');
  total++;
  const res6 = await runWebsiteBuild({
    prompt: '',
    requirement: null
  });
  assert(res6.success === false, 'Orchestrator returned success: false for invalid input');
  assert(res6.stage === 'phase1', 'Orchestrator identified failing stage as phase1');
  assert(res6.error.includes('provided'), 'Orchestrator returned structured error message');
  passed++;

  console.log('\n========================================================');
  console.log(` TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log(' 🎉 ALL STAGE 1A BUILD ORCHESTRATOR TESTS PASSED!');
  console.log('========================================================\n');
}

runOrchestratorTests().catch(err => {
  console.error('Fatal Orchestrator Test Error:', err);
  process.exit(1);
});
