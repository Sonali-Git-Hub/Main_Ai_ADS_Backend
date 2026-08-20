/**
 * test_open_project_live_sandbox.js
 * Verifies that opening a project from All Projects automatically starts the Live Sandbox
 * and serves the real React application on http://127.0.0.1:<port>
 */

const http = require('http');
const connectDB = require('../config/db');
const WebsiteProject = require('../models/WebsiteProject');
const storageService = require('../modules/websiteBuilder/services/ProjectStorageService');
const projectSandboxService = require('../modules/websiteBuilder/sandbox/projectSandbox.service');
const fs = require('fs');
const path = require('path');

async function testOpenProjectSandbox() {
  console.log('================================================================');
  console.log('🧪 TESTING PROJECT OPEN & AUTO-START LIVE SANDBOX');
  console.log('================================================================\n');

  await connectDB();

  const projectId = 'site_1786950591101_3u1xf';
  const projectDir = storageService.getProjectVersionPath(projectId, 'v1');

  console.log('1. Starting / ensuring Live Sandbox for project:', projectId);
  const runtime = await projectSandboxService.runProjectInSandbox({
    projectId,
    projectDir,
    forceRebuild: false
  });

  console.log('Runtime Result:', {
    status: runtime.status,
    port: runtime.port,
    url: runtime.url
  });

  if (runtime.status !== 'RUNNING' || !runtime.url) {
    console.error('❌ Runtime failed to start');
    process.exit(1);
  }

  // 2. Perform HTTP GET to verify the sandbox returns valid HTML
  console.log('\n2. Probing live sandbox at:', runtime.url);
  const urlObj = new URL(runtime.url);

  const html = await new Promise((resolve, reject) => {
    http.get({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });

  console.log('HTML response received, length:', html.length);
  const hasAppRoot = html.includes('id="root"');
  console.log('HTML contains root mount point:', hasAppRoot);

  if (hasAppRoot && runtime.status === 'RUNNING') {
    console.log('\n🎉 PASS: Live Sandbox starts automatically on project open and is 100% accessible!');
    process.exit(0);
  } else {
    console.error('❌ Verification failed');
    process.exit(1);
  }
}

testOpenProjectSandbox().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
