const { analyzeClarificationNeed } = require('../modules/websiteBuilder/services/clarificationAnalyzer.service');

async function runClarificationTests() {
  console.log('\n========================================================');
  console.log(' CONVERSATIONAL CLARIFICATION AUTOMATED TEST SUITE');
  console.log('========================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  // TEST 1: Generic short prompt needs clarification
  console.log('--- TEST 1: Short Generic Prompt ("Create a website for NOVA Atelier") ---');
  const res1 = await analyzeClarificationNeed("Create a website for NOVA Atelier");
  assert(res1.needsClarification === true, 'Short prompt identified as needing clarification');
  assert(Array.isArray(res1.questions) && res1.questions.length > 0, 'Returned non-empty clarification questions');
  assert(res1.questions.every(q => !/(react|vite|css|api|database|component|port)/i.test(q.question)), 'Zero technical terms in clarification questions');

  // TEST 2: Detailed prompt skips clarification
  console.log('\n--- TEST 2: Highly Detailed Explicit Prompt ---');
  const detailedPrompt = "Create a luxury fashion brand website called NOVA Atelier. Brand colors are black #111111 and ivory #FFFFF0. Include a product collection, product details, lookbook, about brand, shopping cart, and contact form. Upload custom photography.";
  const res2 = await analyzeClarificationNeed(detailedPrompt);
  assert(res2.needsClarification === false || res2.questions.length === 0, 'Highly explicit prompt skips unnecessary clarification questions');

  // TEST 3: Questions have valid option choices
  console.log('\n--- TEST 3: Question Schema & Option Validation ---');
  const res3 = await analyzeClarificationNeed("Build an e-commerce website for press-on nails");
  assert(res3.questions.length > 0, 'Generated question array');
  if (res3.questions.length > 0) {
    assert(Array.isArray(res3.questions[0].options) && res3.questions[0].options.length >= 2, 'First question contains at least 2 choice options');
  }

  console.log('\n========================================================');
  console.log(` TEST SUMMARY: ${passedCount}/${totalCount} PASSED (${Math.round((passedCount/totalCount)*100)}%)`);
  if (passedCount === totalCount) {
    console.log(' 🎉 ALL CLARIFICATION TESTS PASSED!');
  } else {
    console.error(' ❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('========================================================\n');
}

runClarificationTests().catch(err => {
  console.error('Test execution crash:', err);
  process.exit(1);
});
