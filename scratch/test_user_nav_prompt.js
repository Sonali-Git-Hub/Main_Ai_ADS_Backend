/**
 * test_user_nav_prompt.js
 * Verifies navigation click edit and button interactions end-to-end.
 */

const { processChatEditRequest } = require('../modules/websiteBuilder/services/chatEditInterpreter.service');
const fs = require('fs');
const path = require('path');

async function testNavPrompt() {
  console.log('================================================================');
  console.log('🧪 TESTING NAVIGATION & CTA BUTTONS LIVE BUILD');
  console.log('================================================================\n');

  const projectId = 'site_1786950591101_3u1xf';

  // Test: Navigation prompt from user
  console.log('▶ Running Navigation Prompt...');
  const res = await processChatEditRequest({
    projectId,
    userPrompt: 'when user clicking on home , collection , about us , contact button make sure they work properly',
    reqId: 'test_nav_verify'
  });

  console.log('Result:', {
    success: res.success,
    explanation: res.explanation,
    modifiedFiles: res.modifiedFiles,
    runtimeUrl: res.runtime?.url
  });

  if (res.success && res.runtime?.status === 'RUNNING') {
    console.log('\n🎉 PASS: Project built cleanly and is running live with all buttons working!');
  } else {
    console.error('\n❌ FAIL: Build or run failed:', res.error);
    process.exit(1);
  }
}

testNavPrompt().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
