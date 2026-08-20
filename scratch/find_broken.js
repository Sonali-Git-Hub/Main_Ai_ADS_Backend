const https = require('https');
const { DOMAIN_POOLS } = require('../modules/websiteBuilder/services/imageResolver.service');

async function checkUrl(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      resolve({ url, status: res.statusCode });
    }).on('error', () => resolve({ url, status: 500 }));
  });
}

async function findBroken() {
  const broken = [];
  for (const [poolName, list] of Object.entries(DOMAIN_POOLS)) {
    for (const url of list) {
      const res = await checkUrl(url);
      if (res.status !== 200) {
        broken.push({ poolName, url, status: res.status });
      }
    }
  }
  console.log('\n--- BROKEN URLS LIST ---');
  console.log(JSON.stringify(broken, null, 2));
}

findBroken().catch(console.error);
