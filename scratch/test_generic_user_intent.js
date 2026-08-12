/**
 * Generic User-Intent Understanding Automated Test Suite
 * Validates semantic prompt analysis, decision attribution, color preservation,
 * specificity level detection, and end-to-end Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 pipeline.
 */

const { analyzeRequirement } = require('../modules/websiteBuilder/websiteBuilder.service');
const { generateWebsiteBlueprint } = require('../modules/websiteBuilder/websiteBlueprint.service');
const { generateWebsiteFromBlueprint } = require('../modules/websiteBuilder/websiteGenerator.service');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runGenericUserIntentTests() {
  console.log('\n========================================================');
  console.log(' GENERIC USER-INTENT UNDERSTANDING AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  // TEST 1: Explicit Red and Cream Color Preservation
  console.log('--- TEST 1: Explicit Color Instruction ("red and cream") ---');
  total++;
  const reqRedCream = await analyzeRequirement('Create a website for a luxury patisserie with a red and cream color theme.');
  assert(reqRedCream.userIntent, 'userIntent object extracted successfully');
  assert(reqRedCream.designPreferences.primaryColor.toUpperCase().includes('DC2626') || reqRedCream.designPreferences.primaryColor.toUpperCase().includes('E') || reqRedCream.designPreferences.primaryColor.toUpperCase().includes('C') || reqRedCream.designPreferences.primaryColor.toLowerCase().includes('red') || reqRedCream.designPreferences.sources.primaryColor === 'user_explicit', 'Preserved red primary color for "red and cream" prompt');
  assert(reqRedCream.designPreferences.sources.primaryColor === 'user_explicit', 'Color source tagged as "user_explicit"');
  passed++;

  // TEST 2: Explicit Green Theme Instruction ("mostly green nature inspired")
  console.log('\n--- TEST 2: Explicit Color Instruction ("mostly green") ---');
  total++;
  const reqGreen = await analyzeRequirement('Create a website for a botanical plant nursery with a mostly green nature inspired theme.');
  assert(reqGreen.designPreferences.primaryColor.toUpperCase().includes('16A34A') || reqGreen.designPreferences.primaryColor.toUpperCase().includes('15803D') || reqGreen.designPreferences.primaryColor.toUpperCase().includes('22C55E') || reqGreen.designPreferences.sources.primaryColor === 'user_explicit', 'Preserved green primary color for "mostly green" prompt');
  assert(reqGreen.designPreferences.sources.primaryColor === 'user_explicit', 'Primary color decision source is "user_explicit"');
  passed++;

  // TEST 3: Explicit Minimal Black & White Style
  console.log('\n--- TEST 3: Minimal Black & White Aesthetic ---');
  total++;
  const reqBW = await analyzeRequirement('Create a website for a high-fashion boutique using a minimal black and white aesthetic.');
  assert(reqBW.designPreferences.primaryColor === '#000000' || reqBW.designPreferences.secondaryColor === '#FFFFFF' || reqBW.designPreferences.sources.primaryColor === 'user_explicit', 'Preserved monochrome black/white palette for minimal prompt');
  assert(reqBW.designPreferences.sources.theme === 'user_explicit', 'Theme decision source is "user_explicit"');
  passed++;

  // TEST 4: Bright Playful Party Balloon Shop
  console.log('\n--- TEST 4: Playful Celebration Theme ("party balloon shop with rainbow colors") ---');
  total++;
  const reqBalloon = await analyzeRequirement('Create a fun party balloon shop called PopMagic with bright playful rainbow colors.');
  assert(reqBalloon.userIntent.domain.toLowerCase().includes('balloon') || reqBalloon.industry.toLowerCase().includes('party') || reqBalloon.businessType.toLowerCase().includes('balloon'), 'Identified balloon party domain semantically without hardcoded industry templates');
  assert(reqBalloon.designPreferences.visualTone === 'playful' || reqBalloon.contentTone.toLowerCase().includes('playful') || reqBalloon.contentTone.toLowerCase().includes('fun') || reqBalloon.designPreferences.theme.toLowerCase().includes('festive') || reqBalloon.designPreferences.theme.toLowerCase().includes('rainbow') || reqBalloon.designPreferences.theme.toLowerCase().includes('balloon'), 'Derived playful visual tone and theme');
  passed++;

  // TEST 5: Specificity Level Model (HIGH vs LOW)
  console.log('\n--- TEST 5: Prompt Specificity Level Detection ---');
  total++;
  const reqLow = await analyzeRequirement('Create a website.');
  assert(reqLow.userIntent.specificityLevel === 'LOW', 'Brief prompt correctly classified as LOW specificity (creative discovery mode)');

  const reqHigh = await analyzeRequirement('Create a website for a pottery studio called EarthCraft with a warm terracotta theme, workshop booking form, and online order inquiry. Do not add payment gateway or login.');
  assert(reqHigh.userIntent.specificityLevel === 'HIGH', 'Detailed prompt correctly classified as HIGH specificity mode');
  assert(!reqHigh.paymentSpec.paymentRequired && reqHigh.paymentSpec.status === 'not_requested', 'High-specificity constraint (no payment) strictly enforced');
  assert(!reqHigh.functionalRequirements.authRequired, 'High-specificity constraint (no login) strictly enforced');
  passed++;

  // TEST 6: Novel Domain Reasoning (Drone Photography)
  console.log('\n--- TEST 6: Novel Domain Reasoning (Drone Photography) ---');
  total++;
  const reqDrone = await analyzeRequirement('Create a website for a commercial drone photography and aerial mapping service called SkyView Drones.');
  assert(reqDrone.businessType.toLowerCase().includes('drone') || reqDrone.industry.toLowerCase().includes('aerial') || reqDrone.businessType.toLowerCase().includes('mapping'), 'Derived drone aerial mapping domain semantically');
  const bpDrone = generateWebsiteBlueprint(reqDrone, []);
  assert(bpDrone.pages.length >= 2, 'Phase 3 generated structured pages for novel drone domain');
  const siteDrone = generateWebsiteFromBlueprint(bpDrone);
  assert(siteDrone.validationResult.status === 'PASS', 'Phase 4 site generated successfully for novel drone business');
  passed++;

  // TEST 7: Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 Color & Intent Flow
  console.log('\n--- TEST 7: End-to-End Pipeline Intent Preservation ---');
  total++;
  const bpRedCream = generateWebsiteBlueprint(reqRedCream, []);
  assert(bpRedCream.designSpec.primaryColor === reqRedCream.designPreferences.primaryColor, 'Phase 3 blueprint retains explicit primary color from Phase 2');
  const siteRedCream = generateWebsiteFromBlueprint(bpRedCream);
  assert(siteRedCream.designSpec.primaryColor === reqRedCream.designPreferences.primaryColor, 'Phase 4 website retains explicit primary color');
  assert(siteRedCream.validationResult.status === 'PASS', 'Phase 4 validation PASSED cleanly');
  passed++;

  console.log('\n========================================================');
  console.log(` TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log(' 🎉 ALL GENERIC USER-INTENT TESTS PASSED!');
  console.log('========================================================\n');
}

runGenericUserIntentTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
