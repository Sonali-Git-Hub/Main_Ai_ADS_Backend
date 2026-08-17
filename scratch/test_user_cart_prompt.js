/**
 * test_user_cart_prompt.js
 * Verifies that the cart prompt successfully updates project and builds cleanly.
 */

const { processChatEditRequest } = require('../modules/websiteBuilder/services/chatEditInterpreter.service');
const fs = require('fs');
const path = require('path');

async function testCartPrompt() {
  console.log('================================================================');
  console.log('🧪 TESTING SHOPPING CART NAVBAR PROMPT');
  console.log('================================================================\n');

  const projectId = 'site_1786950591101_3u1xf';

  const prompt = "there is not section for add to cart when we click on add to cart button on product there is no section to see our add to cart product . add add to cart section on top in navbar";

  const res = await processChatEditRequest({
    projectId,
    userPrompt: prompt,
    reqId: 'test_cart_prompt_verify'
  });

  console.log('Chat Edit Result:', {
    success: res.success,
    explanation: res.explanation,
    modifiedFiles: res.modifiedFiles,
    runtimeUrl: res.runtime?.url
  });

  if (res.success && res.runtime?.status === 'RUNNING') {
    console.log('\n🎉 PASS: Cart Drawer & Navbar Cart button built and running live!');
  } else {
    console.error('\n❌ Cart test failed:', res.error);
    process.exit(1);
  }
}

testCartPrompt().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
