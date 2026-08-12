const fs = require('fs');
const path = require('path');
const http = require('http');
const projectSandboxService = require('../modules/websiteBuilder/sandbox/projectSandbox.service');
const { generateCodeProject } = require('../modules/websiteBuilder/emitter/codeEmitter.service');

async function runSandboxTests() {
  console.log('\n========================================================');
  console.log(' STAGE 2A REAL RUNTIME SANDBOX AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedAssertions++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedAssertions++;
    }
  }

  // Setup: Generate a sample website model & project code for testing sandbox
  const sampleWebsiteModel = {
    websiteId: `sandbox_test_${Date.now()}`,
    websiteIdentity: { title: 'Sandbox Test Shop', businessType: 'Test Bakery', industry: 'Bakery' },
    websiteType: 'E-Commerce Website',
    designSpec: { theme: 'Warm Modern', primaryColor: '#D97706', typography: 'Inter' },
    generatedTheme: { colors: { background: '#0F172A', text: '#F8FAFC' } },
    pages: [
      {
        id: 'home',
        name: 'Home',
        sections: [
          { type: 'HeroBanner', title: 'Welcome to Sandbox Test Shop', headline: 'Freshly Baked Goods', primaryCTA: 'Shop Now' }
        ]
      }
    ]
  };

  console.log('📦 Emitting sample test project code...');
  const emittedProject = generateCodeProject(sampleWebsiteModel, {}, {}, 'test_sandbox');
  const projectId = sampleWebsiteModel.websiteId;
  const projectDir = emittedProject.projectDir;

  // --- TEST 1: Workspace Preparation ---
  console.log('\n--- TEST 1: Project Workspace Preparation ---');
  const prepState = projectSandboxService.prepareProject(projectId, projectDir);
  assert(prepState.status === 'PREPARING', "Status is PREPARING");
  assert(prepState.projectDir === projectDir, "Project directory matches");

  // --- TEST 2: Dependency Installation ---
  console.log('\n--- TEST 2: Dependency Installation (npm install) ---');
  const installRes = await projectSandboxService.installDependencies(projectId, projectDir, { timeoutMs: 180000 });
  assert(installRes.success === true, `npm install completed successfully in ${installRes.durationMs}ms`);
  assert(fs.existsSync(path.join(projectDir, 'node_modules')), "node_modules directory exists on disk");

  // --- TEST 3: Build Verification ---
  console.log('\n--- TEST 3: Build Verification (npm run build) ---');
  const buildRes = await projectSandboxService.buildProject(projectId, projectDir, { timeoutMs: 120000 });
  assert(buildRes.success === true, `npm run build completed successfully in ${buildRes.durationMs}ms`);
  assert(fs.existsSync(path.join(projectDir, 'dist')), "dist output directory exists on disk");

  // --- TEST 4 & 5 & 6 & 7: Start Project, Health Check, RUNNING Status & URL Reachability ---
  console.log('\n--- TEST 4-7: Start Project, Health Check & RUNNING Verification ---');
  const startState = await projectSandboxService.startProject(projectId, projectDir);

  assert(startState.status === 'RUNNING', `Runtime status is RUNNING (got: ${startState.status})`);
  assert(startState.buildStatus === 'SUCCESS', "Build status is SUCCESS");
  assert(!!startState.port && startState.port >= 4100, `Assigned dynamic port is valid: ${startState.port}`);
  assert(!!startState.url && startState.url.startsWith('http://'), `Live project URL generated: ${startState.url}`);

  // Reachability Check
  console.log(`Checking HTTP GET reachability for ${startState.url}...`);
  const httpRes = await new Promise((resolve) => {
    http.get(startState.url, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });

  assert(httpRes.statusCode === 200, `HTTP GET returned status code 200 OK (got: ${httpRes.statusCode})`);
  assert(httpRes.body && httpRes.body.includes('<!DOCTYPE html>'), "Response body contains valid HTML Document");

  // --- TEST 8: Stop Project & Process Cleanup ---
  console.log('\n--- TEST 8: Stop Project & Process Lifecycle Termination ---');
  const stopRes = await projectSandboxService.stopProject(projectId);
  assert(stopRes.success === true, "Stop operation returned success: true");

  const stoppedState = projectSandboxService.getProjectStatus(projectId);
  assert(stoppedState.status === 'STOPPED', "Runtime status transitioned to STOPPED");
  assert(stoppedState.port === null, "Port released");

  // Verify port is closed
  const savedPort = startState.port;
  let portClosed = true;
  if (savedPort) {
    portClosed = await new Promise((resolve) => {
      http.get(`http://127.0.0.1:${savedPort}`, () => resolve(false)).on('error', () => resolve(true));
    });
  }
  assert(portClosed === true, `Port ${savedPort} is closed and released`);

  // --- TEST 9: Intentional Build Failure Handling ---
  console.log('\n--- TEST 9: Intentional Build Failure Handling ---');
  const brokenProjectId = `broken_proj_${Date.now()}`;
  const brokenProjectDir = path.join(path.dirname(projectDir), brokenProjectId);
  fs.mkdirSync(path.join(brokenProjectDir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(brokenProjectDir, 'package.json'), JSON.stringify({
    name: 'broken-app',
    private: true,
    scripts: { build: 'echo "BUILD_SYNTAX_ERROR" && exit 1' }
  }));

  // Temporarily suppress console.error for expected failure log
  const originalConsoleError = console.error;
  console.error = () => {};

  const brokenBuildRes = await projectSandboxService.buildProject(brokenProjectId, brokenProjectDir);
  console.error = originalConsoleError;

  assert(brokenBuildRes.success === false, "Build correctly reported failure for broken script");

  const brokenState = projectSandboxService.getProjectStatus(brokenProjectId);
  assert(brokenState.status === 'FAILED', "Broken project state is FAILED");
  assert(brokenState.status !== 'RUNNING', "Broken project did NOT enter RUNNING state");

  // Clean broken temp directory
  fs.rmSync(brokenProjectDir, { recursive: true, force: true });

  // --- SUMMARY ---
  console.log('\n========================================================');
  console.log(` TEST SUMMARY: ${passedAssertions}/${passedAssertions + failedAssertions} PASSED`);
  if (failedAssertions === 0) {
    console.log(' 🎉 ALL STAGE 2A REAL RUNTIME SANDBOX TESTS PASSED!');
  }
  console.log('========================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runSandboxTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
