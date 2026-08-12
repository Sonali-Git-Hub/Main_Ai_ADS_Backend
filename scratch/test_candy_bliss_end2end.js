const buildOrchestratorService = require('../modules/websiteBuilder/orchestrator/buildOrchestrator.service');

async function testCandyBlissEndToEnd() {
  console.log('\n========================================================');
  console.log(' CANDY BLISS END-TO-END STAGE 2A RUNTIME SANDBOX TEST');
  console.log('========================================================\n');

  const prompt = 'Create a modern candy shop website called Candy Bliss. It should feel playful, premium, colorful, and polished. Include a homepage, product catalog, custom candy box builder, and event/catering page. Do not invent specific prices unless pricing is explicitly provided.';

  console.log('🚀 Launching Build Orchestrator for Candy Bliss prompt...');
  const startTime = Date.now();

  const buildResult = await buildOrchestratorService.runWebsiteBuild({
    prompt,
    options: { generateCode: true, runSandbox: true }
  });

  const durationMs = Date.now() - startTime;

  console.log('\n📊 BUILD ORCHESTRATOR RESULT:');
  console.log(`- Success: ${buildResult.success}`);
  console.log(`- Project ID: ${buildResult.projectId}`);
  console.log(`- Execution Time: ${durationMs}ms`);
  console.log(`- Runtime Status: ${buildResult.runtime?.status}`);
  console.log(`- Runtime URL: ${buildResult.runtime?.url}`);
  console.log(`- Dynamic Port: ${buildResult.runtime?.port}`);
  console.log(`- Build Status: ${buildResult.runtime?.buildStatus}`);

  if (buildResult.success && buildResult.runtime?.status === 'RUNNING') {
    console.log('\n🎉 CANDY BLISS IS LIVE IN THE RUNTIME SANDBOX!');
    console.log(`URL: ${buildResult.runtime.url}`);
  } else {
    console.error('\n❌ BUILD OR RUNTIME FAILED:', buildResult.errors);
    process.exit(1);
  }
}

testCandyBlissEndToEnd().catch((err) => {
  console.error('End-to-end execution error:', err);
  process.exit(1);
});
