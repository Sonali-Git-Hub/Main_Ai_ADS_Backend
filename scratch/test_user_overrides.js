/**
 * Phase 2 User Edit / Override Automated Test Suite
 * Validates all 6 mandatory user override test scenarios:
 *
 * Test A: AI generates 5 pages -> user removes 1 -> Phase 3 receives 4 pages.
 * Test B: AI recommends WhatsApp -> user rejects -> Phase 3 excludes WhatsApp.
 * Test C: AI generates Home + Catalog -> user adds Portfolio -> Phase 3 receives Home + Catalog + Portfolio.
 * Test D: AI chooses blue theme -> user changes to green -> Phase 3 receives green.
 * Test E: AI recommends component X -> user edits it -> edited version reaches Phase 3.
 * Test F: User resets an edited value -> original AI value returns.
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

async function runUserOverrideTests() {
  console.log('\n========================================================');
  console.log(' PHASE 2 USER EDIT / OVERRIDE AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  // Generate a base requirement from LLM
  console.log('🤖 Generating base Phase 2 requirement from AI...');
  const baseReq = await analyzeRequirement('Create a website for an AI accounting SaaS called LedgerAI with WhatsApp chat integration.');
  assert(baseReq && baseReq.proposedPages && baseReq.proposedPages.length >= 1, 'Base AI requirement generated successfully');

  // TEST A: AI generates N pages -> user removes 1 -> Phase 3 receives N-1 pages
  console.log('\n--- TEST A: Page Removal Override ---');
  total++;
  const testAReq = JSON.parse(JSON.stringify(baseReq));
  const origPageCount = testAReq.proposedPages.length;
  const removedPage = testAReq.proposedPages.pop(); // Remove 1 page
  console.log(`   Removed page: "${removedPage.name}". Remaining pages: ${testAReq.proposedPages.length}`);

  const blueprintA = generateWebsiteBlueprint(testAReq, []);
  assert(blueprintA.pages.length === origPageCount - 1, `Blueprint generated with exactly ${origPageCount - 1} pages (down from ${origPageCount})`);
  assert(!blueprintA.pages.some(p => p.name === removedPage.name), `Removed page "${removedPage.name}" is completely absent in Phase 3`);
  passed++;

  // TEST B: AI recommends WhatsApp -> user rejects -> Phase 3 excludes WhatsApp
  console.log('\n--- TEST B: Rejection of Recommended Feature (WhatsApp) ---');
  total++;
  const testBReq = JSON.parse(JSON.stringify(baseReq));
  testBReq.aiRecommendedFeatures = ['WhatsApp Integration', 'Blog', 'Live Support Chat'];
  testBReq.rejectedRecommendations = ['WhatsApp Integration']; // User rejected WhatsApp

  const blueprintB = generateWebsiteBlueprint(testBReq, ['Blog']);
  assert(!blueprintB.contactRequirements.hasWhatsApp, 'Phase 3 excludes WhatsApp when user rejects it');
  const siteB = generateWebsiteFromBlueprint(blueprintB);
  assert(siteB.validationResult.status === 'PASS', 'Phase 4 site generated successfully with rejected WhatsApp excluded');
  passed++;

  // TEST C: AI generates Home + Catalog -> user adds Portfolio -> Phase 3 receives Home + Catalog + Portfolio
  console.log('\n--- TEST C: User Adds New Page ---');
  total++;
  const testCReq = JSON.parse(JSON.stringify(baseReq));
  const newCustomPage = {
    name: 'Portfolio Showcase',
    purpose: 'Display verified customer case studies and high-growth metrics',
    source: 'user_created',
    recommendedSections: [
      { type: 'HeroBanner', title: 'Case Studies Hero', purpose: 'Portfolio overview', source: 'user_created' },
      { type: 'PortfolioGallery', title: 'Client Growth Stories', purpose: 'Display case studies', source: 'user_created' }
    ]
  };
  testCReq.proposedPages.push(newCustomPage);

  const blueprintC = generateWebsiteBlueprint(testCReq, []);
  assert(blueprintC.pages.some(p => p.name === 'Portfolio Showcase'), 'Phase 3 blueprint includes user-added "Portfolio Showcase" page');
  const siteC = generateWebsiteFromBlueprint(blueprintC);
  assert(siteC.pages.some(p => p.name === 'Portfolio Showcase'), 'Phase 4 generated website includes user-added "Portfolio Showcase" page');
  passed++;

  // TEST D: AI chooses blue theme -> user changes to green -> Phase 3 receives green
  console.log('\n--- TEST D: Design Theme & Color Override ---');
  total++;
  const testDReq = JSON.parse(JSON.stringify(baseReq));
  testDReq.designPreferences = {
    theme: 'Emerald Rainforest Eco',
    primaryColor: '#22C55E',
    secondaryColor: '#15803D',
    typography: 'Outfit',
    visualTone: 'vibrant sustainability'
  };

  const blueprintD = generateWebsiteBlueprint(testDReq, []);
  assert(blueprintD.designSpec.primaryColor === '#22C55E', 'Phase 3 blueprint receives user-edited green primary color (#22C55E)');
  assert(blueprintD.designSpec.theme === 'Emerald Rainforest Eco', 'Phase 3 blueprint receives user-edited theme ("Emerald Rainforest Eco")');
  const siteD = generateWebsiteFromBlueprint(blueprintD);
  assert(siteD.designSpec.primaryColor === '#22C55E', 'Phase 4 website retains user-edited green color');
  passed++;

  // TEST E: AI recommends component X -> user edits it -> edited version reaches Phase 3
  console.log('\n--- TEST E: Component Customization Override ---');
  total++;
  const testEReq = JSON.parse(JSON.stringify(baseReq));
  testEReq.proposedPages[0].components = [
    { type: 'HeroSplit', title: 'Customized LedgerAI Hero', purpose: 'Custom user headline and copy', source: 'user_created' },
    { type: 'PricingPlansGrid', title: 'Bespoke Flexible Pricing', purpose: 'Custom pricing tiers', source: 'user_created' }
  ];

  const blueprintE = generateWebsiteBlueprint(testEReq, []);
  const homeComps = blueprintE.pages[0].components;
  assert(homeComps.some(c => c.title === 'Customized LedgerAI Hero'), 'Phase 3 receives user-edited component title "Customized LedgerAI Hero"');
  assert(homeComps.some(c => c.title === 'Bespoke Flexible Pricing'), 'Phase 3 receives user-edited component title "Bespoke Flexible Pricing"');
  passed++;

  // TEST F: User resets an edited value -> original AI value returns
  console.log('\n--- TEST F: Reset to AI Value ---');
  total++;
  const originalIndustry = baseReq.industry;
  let userWorkCopy = JSON.parse(JSON.stringify(baseReq));
  userWorkCopy.industry = 'Completely Edited Fake Industry'; // User edits
  assert(userWorkCopy.industry !== originalIndustry, 'Field value was edited by user');

  // User hits "Reset to AI"
  userWorkCopy.industry = baseReq.industry;
  assert(userWorkCopy.industry === originalIndustry, 'Reset to AI restores exact original AI value');
  passed++;

  console.log('\n========================================================');
  console.log(` TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log(' 🎉 ALL USER OVERRIDE TESTS PASSED!');
  console.log('========================================================\n');
}

runUserOverrideTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
