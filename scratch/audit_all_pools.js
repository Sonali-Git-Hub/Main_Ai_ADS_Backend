const https = require('https');
const { DOMAIN_POOLS } = require('../modules/websiteBuilder/services/imageResolver.service');

async function checkUrl(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      resolve({ url, status: res.statusCode });
    }).on('error', () => resolve({ url, status: 500 }));
  });
}

async function auditAllPools() {
  console.log('Auditing all image URLs in imageResolver.service.js...');
  const broken = [];
  let total = 0;

  for (const [poolName, list] of Object.entries(DOMAIN_POOLS)) {
    for (const url of list) {
      total++;
      const res = await checkUrl(url);
      if (res.status !== 200) {
        console.error(`❌ BROKEN (${res.status}) in [${poolName}]: ${url}`);
        broken.push({ poolName, url, status: res.status });
      } else {
        console.log(`✅ OK [${poolName}]: ${url.slice(0, 50)}...`);
      }
    }
  }

  console.log(`\nAudit Complete: ${total - broken.length}/${total} URLs OK.`);
  if (broken.length > 0) {
    console.log('Broken URLs count:', broken.length);
  }
}

auditAllPools().catch(console.error);
