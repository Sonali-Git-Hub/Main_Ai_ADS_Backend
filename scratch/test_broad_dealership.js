/**
 * Test Broad Prompt Inference for "Create a website for a car dealership"
 */
const { analyzeRequirement } = require('../modules/websiteBuilder/websiteBuilder.service');
const { generateWebsiteBlueprint } = require('../modules/websiteBuilder/websiteBlueprint.service');
const { generateWebsiteFromBlueprint } = require('../modules/websiteBuilder/websiteGenerator.service');

async function testBroadDealershipPrompt() {
  console.log('\n========================================================');
  console.log(' TESTING BROAD PROMPT: "Create a website for a car dealership"');
  console.log('========================================================\n');

  try {
    const requirement = await analyzeRequirement('Create a website for a car dealership');
    console.log('  ✓ Business Type:', requirement.businessType);
    console.log('  ✓ Industry:', requirement.industry);
    console.log('  ✓ Page Count:', requirement.proposedPages.length);
    console.log('  ✓ Pages:', requirement.proposedPages.map(p => p.name).join(' → '));
    console.log('  ✓ User Requested Features:', requirement.userRequestedFeatures);
    console.log('  ✓ AI Recommended Features:', requirement.aiRecommendedFeatures);

    const blueprint = generateWebsiteBlueprint(requirement, []);
    const website = generateWebsiteFromBlueprint(blueprint);

    console.log('\n  --- Generated Website Architecture ---');
    website.pages.forEach(p => {
      console.log(`  Page: ${p.name}`);
      p.sections.forEach(s => {
        console.log(`    - Section: ${s.type} ("${s.title}")`);
      });
    });

    console.log('\n  ✓ Validation Status:', website.validationResult.status);
    console.log('========================================================\n');
  } catch (err) {
    console.error('❌ Error during test:', err);
  }
}

testBroadDealershipPrompt();
