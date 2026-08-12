/**
 * Phase 4 Renderer Structural Verification
 * Tests Phase 4 output structure for 3 distinct prompt types:
 * 1. Press-on Nail Fashion Store ("VelvetClaws")
 * 2. Italian Restaurant ("Bella Roma")
 * 3. Wedding Photographer ("Alex Weddings")
 */

const { analyzeRequirement } = require('../modules/websiteBuilder/websiteBuilder.service');
const { generateWebsiteBlueprint } = require('../modules/websiteBuilder/websiteBlueprint.service');
const { generateWebsiteFromBlueprint } = require('../modules/websiteBuilder/websiteGenerator.service');

async function testPhase4RenderTree() {
  console.log('\n========================================================');
  console.log(' PHASE 4 RENDER TREE & IMAGERY VERIFICATION');
  console.log('========================================================\n');

  const prompts = [
    { name: 'Nail Store', text: 'Create an e-commerce website for a press-on nail fashion store called VelvetClaws.' },
    { name: 'Restaurant', text: 'Create a website for an Italian restaurant called Bella Roma.' },
    { name: 'Photographer', text: 'Create a website for a wedding photographer called Alex Weddings.' }
  ];

  for (const { name, text } of prompts) {
    console.log(`🔍 Inspecting Phase 4 Output for [${name}]...`);
    const req = await analyzeRequirement(text);
    const bp = generateWebsiteBlueprint(req, []);
    const site = generateWebsiteFromBlueprint(bp);

    console.log(`   Business: "${site.websiteIdentity.title}" (${site.websiteIdentity.businessType})`);
    console.log(`   Theme: "${site.designSpec.theme}" | Primary Color: ${site.designSpec.primaryColor}`);
    console.log(`   Primary CTA: "${site.ctaRequirements.primaryCTA}"`);

    site.pages.forEach(p => {
      console.log(`   📄 Page: "${p.name}"`);
      p.sections.forEach(s => {
        const img = s.imageUrl ? `[Image: ${s.imageUrl.slice(0, 45)}...]` : '[No Image]';
        const itemsWithImg = s.items ? s.items.filter(i => i.imageUrl).length : 0;
        const itemImgTag = itemsWithImg > 0 ? ` (${itemsWithImg} items have images)` : '';
        console.log(`      - Component: <${s.type}> "${s.title}" ${img}${itemImgTag}`);
      });
    });

    console.log('--------------------------------------------------------');
  }

  console.log('\n✅ Phase 4 Render Tree Verification Complete!\n');
}

testPhase4RenderTree().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
