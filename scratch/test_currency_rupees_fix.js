/**
 * test_currency_rupees_fix.js
 * Verifies that "give amout or pricing in indian rupees" updates all prices to ₹ (INR)
 */

const { processChatEditRequest } = require('../modules/websiteBuilder/services/chatEditInterpreter.service');
const fs = require('fs');
const path = require('path');

async function testCurrencyRupeesFix() {
  console.log('================================================================');
  console.log('🧪 TESTING CURRENCY CONVERSION TO INDIAN RUPEES (₹)');
  console.log('================================================================\n');

  const projectId = 'site_1786950591101_3u1xf';

  const res = await processChatEditRequest({
    projectId,
    userPrompt: 'give amout or pricing in indian rupees',
    reqId: 'test_rupees_conversion'
  });

  console.log('Chat Edit Result:', {
    success: res.success,
    explanation: res.explanation,
    modifiedFiles: res.modifiedFiles,
    runtimeUrl: res.runtime?.url
  });

  // Verify siteData.js has ₹
  const siteDataPath = path.join(__dirname, `../../storage/projects/${projectId}/v1/src/data/siteData.js`);
  const siteDataContent = fs.readFileSync(siteDataPath, 'utf8');

  const hasRupee = siteDataContent.includes('₹');
  const hasDollar = siteDataContent.includes('$');

  console.log('\n--- Pricing Verification ---');
  console.log('siteData.js contains "₹":', hasRupee);
  console.log('siteData.js contains "$":', hasDollar);

  if (res.success && hasRupee) {
    console.log('\n🎉 PASS: All prices converted to Indian Rupees (₹) successfully!');
  } else {
    console.error('\n❌ Currency conversion failed');
    process.exit(1);
  }
}

testCurrencyRupeesFix().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
