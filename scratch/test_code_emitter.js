const fs = require('fs');
const path = require('path');
const { runWebsiteBuild } = require('../modules/websiteBuilder/orchestrator/buildOrchestrator.service');

async function runCodeEmitterTests() {
  console.log('\n========================================================');
  console.log(' STAGE 1B SOURCE CODE EMITTER AUTOMATED TEST SUITE');
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

  // --- TEST 1: Candy Shop Prompt Execution ---
  console.log('--- TEST 1: End-to-End Build for Candy Shop Prompt ---');
  const prompt = "Create a website for a Candy shop called Candy Bliss.";
  const buildResult = await runWebsiteBuild({ prompt });

  assert(buildResult.success === true, "Build Orchestrator returned success: true");
  assert(buildResult.pipeline.phase1.status === 'completed', "Phase 1 completed");
  assert(buildResult.pipeline.phase3.status === 'completed', "Phase 3 completed");
  assert(buildResult.pipeline.phase4.status === 'completed', "Phase 4 completed");
  assert(buildResult.pipeline.phase5.status === 'completed', "Phase 5 Code Emitter completed");
  assert(!!buildResult.sourceProject, "sourceProject object exists in build result");

  const projectDir = buildResult.sourceProject?.projectDir;
  assert(!!projectDir && fs.existsSync(projectDir), `Generated project directory exists at: ${projectDir}`);

  // --- TEST 2: File Structure Integrity ---
  console.log('\n--- TEST 2: Project File Structure Integrity ---');
  const packageJsonPath = path.join(projectDir, 'package.json');
  const indexHtmlPath = path.join(projectDir, 'index.html');
  const appJsxPath = path.join(projectDir, 'src', 'App.jsx');
  const mainJsxPath = path.join(projectDir, 'src', 'main.jsx');
  const themeCssPath = path.join(projectDir, 'src', 'styles', 'theme.css');
  const siteDataPath = path.join(projectDir, 'src', 'data', 'siteData.js');

  assert(fs.existsSync(packageJsonPath), "package.json exists");
  assert(fs.existsSync(indexHtmlPath), "index.html exists");
  assert(fs.existsSync(appJsxPath), "src/App.jsx exists");
  assert(fs.existsSync(mainJsxPath), "src/main.jsx exists");
  assert(fs.existsSync(themeCssPath), "src/styles/theme.css exists");
  assert(fs.existsSync(siteDataPath), "src/data/siteData.js exists");

  // Verify package.json contents
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert(packageJson.dependencies && packageJson.dependencies.react, "package.json contains react dependency");
  assert(packageJson.devDependencies && packageJson.devDependencies.vite, "package.json contains vite devDependency");

  // --- TEST 3: Page & Component File Generation ---
  console.log('\n--- TEST 3: Pages & Component Files Verification ---');
  const pagesDir = path.join(projectDir, 'src', 'pages');
  const componentsDir = path.join(projectDir, 'src', 'components');

  assert(fs.existsSync(pagesDir), "src/pages/ directory exists");
  assert(fs.existsSync(componentsDir), "src/components/ directory exists");

  const pageFiles = fs.readdirSync(pagesDir);
  const componentFiles = fs.readdirSync(componentsDir);

  assert(pageFiles.length > 0, `Generated ${pageFiles.length} page files in src/pages/`);
  assert(componentFiles.length > 0, `Generated ${componentFiles.length} component files in src/components/`);

  assert(componentFiles.includes('Navbar.jsx'), "Navbar.jsx component generated");
  assert(componentFiles.includes('Footer.jsx'), "Footer.jsx component generated");
  assert(componentFiles.includes('SectionRenderer.jsx'), "SectionRenderer.jsx component generated");

  // --- TEST 4: Import Integrity Check ---
  console.log('\n--- TEST 4: Import Integrity Verification ---');
  const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');
  const importRegex = /import\s+([A-Za-z0-9_{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  let importErrors = 0;

  while ((match = importRegex.exec(appJsxContent)) !== null) {
    const importPath = match[2];
    if (importPath.startsWith('.')) {
      const resolvedPath = path.resolve(path.join(projectDir, 'src'), importPath);
      // Check with .jsx or .js extension if missing
      const exists = fs.existsSync(resolvedPath) || fs.existsSync(`${resolvedPath}.jsx`) || fs.existsSync(`${resolvedPath}.js`);
      if (!exists) {
        console.error(`    Missing imported file: ${importPath} resolved to ${resolvedPath}`);
        importErrors++;
      }
    }
  }

  assert(importErrors === 0, "All imported components in App.jsx resolve to existing files on disk");

  // --- TEST 5: Non-Placeholder Content & Attribution Preservation ---
  console.log('\n--- TEST 5: Intent & Rules Compliance ---');
  const siteDataContent = fs.readFileSync(siteDataPath, 'utf8');
  assert(siteDataContent.includes('user_explicit') || siteDataContent.includes('semantic_inference'), "Attribution model preserved in siteData.js");

  // Rule 9 Check: Simple Candy Shop prompt must NOT introduce unrequested features like membership/subscriptions/wholesale
  const lowerPrompt = prompt.toLowerCase();
  const lowerSiteData = siteDataContent.toLowerCase();
  assert(!lowerSiteData.includes('"membership"') && !lowerSiteData.includes('"wholesale"'), "No unrequested complex enterprise capabilities (membership/wholesale) added to Candy Bliss");

  // --- SUMMARY ---
  console.log('\n========================================================');
  console.log(` TEST SUMMARY: ${passedAssertions}/${passedAssertions + failedAssertions} PASSED`);
  if (failedAssertions === 0) {
    console.log(' 🎉 ALL STAGE 1B SOURCE CODE EMITTER TESTS PASSED!');
    console.log(` 📂 Generated Project Location: ${projectDir}`);
    console.log(` 📊 Total Project Files: ${buildResult.sourceProject.fileCount}`);
  }
  console.log('========================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runCodeEmitterTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
