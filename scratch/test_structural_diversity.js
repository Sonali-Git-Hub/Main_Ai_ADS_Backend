/**
 * Renderer Diversity & Generative Architecture Verification Suite v4.0
 *
 * Tests 7 distinct prompts covering key business categories:
 * 1. Premium Mobile Phone Company ("Hello")
 * 2. Italian Restaurant ("Bella Roma")
 * 3. Wedding Photographer ("Alex Weddings")
 * 4. AI Accounting SaaS ("LedgerAI")
 * 5. Luxury Resort ("Casa Verde")
 * 6. Press-On Nail & Beauty E-Commerce ("VelvetClaws")
 * 7. Architecture Studio ("Vanguard Architects")
 *
 * Verifies:
 * - Business classification differs appropriately
 * - Website strategy differs
 * - Page count is allowed to differ
 * - Page names differ where appropriate
 * - Sections & component types differ
 * - CTA strategy differs
 * - Real imagery URLs are attached contextually to sections & items
 * - Design direction & colors differ
 * - No universal fixed template is being applied
 * - No fake business claims (no "500,000 customers", "25 stores worldwide", etc.)
 */

const { analyzeRequirement } = require('../modules/websiteBuilder/websiteBuilder.service');
const { generateWebsiteBlueprint } = require('../modules/websiteBuilder/websiteBlueprint.service');
const { generateWebsiteFromBlueprint } = require('../modules/websiteBuilder/websiteGenerator.service');

const TEST_PROMPTS = [
  { id: 'mobile',      prompt: 'Create a website for a premium mobile phone company called Hello.' },
  { id: 'restaurant',  prompt: 'Create a website for an Italian restaurant called Bella Roma.' },
  { id: 'photographer',prompt: 'Create a website for a wedding photographer called Alex Weddings.' },
  { id: 'saas',        prompt: 'Create a website for an AI accounting SaaS called LedgerAI.' },
  { id: 'resort',      prompt: 'Create a website for a luxury resort called Casa Verde.' },
  { id: 'ecommerce',   prompt: 'Create an e-commerce website for a press-on nail fashion store called VelvetClaws.' },
  { id: 'architect',   prompt: 'Create a website for a modern architecture studio called Vanguard Architects.' }
];

// Fake claims that must NEVER be invented unless user provided them
const BANNED_FAKE_CLAIMS = [
  '500,000 customers',
  '500,000+',
  '25 stores worldwide',
  'Award-winning since 1998',
  'Starter Package',
  'Professional Kit',
  'Deluxe Edition',
  '$49.00',
  '$89.00',
  '$129.00'
];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTest() {
  console.log('\n========================================================');
  console.log(' RENDERER DIVERSITY & GENERATIVE ARCHITECTURE SUITE');
  console.log(' Testing 7 Key Industry Prompts (Mobile, Restaurant, Photo, SaaS, Resort, E-Commerce, Architect)');
  console.log('========================================================\n');

  const sites = [];

  for (const { id, prompt } of TEST_PROMPTS) {
    console.log(`📐 Generating: ${id.toUpperCase()} — "${prompt}"`);
    try {
      const requirement = await analyzeRequirement(prompt);
      const blueprint = generateWebsiteBlueprint(requirement, []);
      const website = generateWebsiteFromBlueprint(blueprint);
      sites.push({ id, prompt, requirement, blueprint, website });
      console.log(`   ✓ Industry: "${requirement.industry}" | Business: "${requirement.businessType}"`);
      console.log(`   ✓ Pages (${website.pages.length}): [${website.pages.map(p => p.name).join(' → ')}]`);
      console.log(`   ✓ Theme: "${website.designSpec.theme}" | Primary: ${website.designSpec.primaryColor}`);
      console.log(`   ✓ Primary CTA: "${website.ctaRequirements.primaryCTA}"`);
    } catch (err) {
      console.error(`   ✗ GENERATION ERROR for ${id}:`, err.message);
      failed++;
    }
  }

  console.log('\n========================================================');
  console.log(' ASSERTION SUITE');
  console.log('========================================================\n');

  // --- 1. Generation Success ---
  console.log('\n[1] GENERATION SUCCESS');
  assert(sites.length === TEST_PROMPTS.length, `All ${TEST_PROMPTS.length} test businesses generated successfully`);

  // --- 2. Business Classification Diversity ---
  console.log('\n[2] BUSINESS CLASSIFICATION DIVERSITY');
  const businessTypes = sites.map(s => s.requirement.businessType);
  const uniqueBusinessTypes = new Set(businessTypes);
  console.log(`    Business types: ${businessTypes.join(' | ')}`);
  assert(uniqueBusinessTypes.size === 7, `All 7 businesses have distinct business classifications (got ${uniqueBusinessTypes.size})`);

  // --- 3. Page Count & Architecture Diversity ---
  console.log('\n[3] PAGE ARCHITECTURE DIVERSITY');
  const pageArchitectures = sites.map(s => s.website.pages.map(p => p.name).join(' → '));
  const uniqueArchitectures = new Set(pageArchitectures);
  console.log(`    Architectures:\n      ${pageArchitectures.join('\n      ')}`);
  assert(uniqueArchitectures.size >= 6, `At least 6 distinct page structures across 7 prompts (got ${uniqueArchitectures.size})`);

  // --- 4. Component Vocabulary & Domain Imagery ---
  console.log('\n[4] COMPONENT VOCABULARY & REAL IMAGERY SUPPORT');
  for (const s of sites) {
    const allSections = s.website.pages.flatMap(p => p.sections);
    const hasImages = allSections.some(sec => sec.imageUrl || (sec.items && sec.items.some(i => i.imageUrl)));
    assert(hasImages, `Site "${s.id}" attaches real contextual imagery to sections/items`);
  }

  const nailSite = sites.find(s => s.id === 'ecommerce');
  if (nailSite) {
    const allSections = nailSite.website.pages.flatMap(p => p.sections);
    const hasCatalog = allSections.some(sec => sec.type === 'ItemCatalogGrid' || sec.type === 'FeaturedItemsGrid');
    assert(hasCatalog, 'Nail E-Commerce site renders ItemCatalogGrid for press-on products');
  }

  const archSite = sites.find(s => s.id === 'architect');
  if (archSite) {
    const allSections = archSite.website.pages.flatMap(p => p.sections);
    const hasGalleryOrProjects = allSections.some(sec => sec.type === 'PortfolioGallery' || sec.type === 'PropertyGrid' || sec.type === 'ServicesGrid');
    assert(hasGalleryOrProjects, 'Architecture site renders PortfolioGallery or PropertyGrid for architectural projects');
  }

  // --- 5. CTA Strategy Diversity ---
  console.log('\n[5] CTA STRATEGY DIVERSITY');
  const primaryCTAs = sites.map(s => s.website.ctaRequirements.primaryCTA);
  const uniqueCTAs = new Set(primaryCTAs);
  console.log(`    Primary CTAs: ${primaryCTAs.join(' | ')}`);
  assert(uniqueCTAs.size >= 5, `At least 5 distinct primary CTAs across 7 businesses (got ${uniqueCTAs.size})`);

  // --- 6. Design System & Theme Diversity ---
  console.log('\n[6] DESIGN SYSTEM & THEME DIVERSITY');
  const themes = sites.map(s => s.website.designSpec.theme);
  const primaryColors = sites.map(s => s.website.designSpec.primaryColor);
  const uniqueThemes = new Set(themes);
  const uniqueColors = new Set(primaryColors);

  console.log(`    Themes: ${themes.join(' | ')}`);
  console.log(`    Colors: ${primaryColors.join(', ')}`);
  assert(uniqueThemes.size >= 5, `At least 5 distinct design themes (got ${uniqueThemes.size})`);
  assert(uniqueColors.size >= 5, `At least 5 distinct primary colors (got ${uniqueColors.size})`);

  // --- 7. No Banned Fake Claims ---
  console.log('\n[7] NO UNCHECKED FAKE BUSINESS CLAIMS');
  const allContent = sites.map(s => JSON.stringify(s.website)).join(' ');
  for (const claim of BANNED_FAKE_CLAIMS) {
    const found = allContent.includes(claim);
    assert(!found, `No fake claim "${claim}" in any generated site`);
  }

  // --- SUMMARY ---
  console.log('\n========================================================');
  console.log(' TEST SUMMARY');
  console.log('========================================================');
  console.log(`\n  Total assertions: ${passed + failed}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);

  const score = Math.round((passed / (passed + failed)) * 100);
  console.log(`  Score: ${score}%`);

  if (failed === 0) {
    console.log('\n  🎉 ALL TESTS PASSED — Renderer overhaul & diversity verified!');
  } else {
    console.log('\n  ⚠️  Some tests failed.');
  }

  console.log('\n========================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error('\n❌ FATAL TEST ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
