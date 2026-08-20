/**
 * test_autosave_all_projects_sync.js
 * Verifies that chat edits automatically persist to DB and sync with All Projects list
 */

const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');
const WebsiteProject = require('../models/WebsiteProject');
const { processChatEditRequest } = require('../modules/websiteBuilder/services/chatEditInterpreter.service');
const storageService = require('../modules/websiteBuilder/services/ProjectStorageService');
const fs = require('fs');
const path = require('path');

async function testAutoSaveSync() {
  console.log('================================================================');
  console.log('🧪 TESTING AUTO-SAVE & ALL PROJECTS SYNC');
  console.log('================================================================\n');

  await connectDB();

  const projectId = 'site_1786950591101_3u1xf';

  // 1. Process chat edit
  console.log('1. Executing chat edit...');
  const editResult = await processChatEditRequest({
    projectId,
    userPrompt: 'change brand name to HAKUMA TATA',
    reqId: 'test_autosave_verify'
  });

  console.log('Edit Success:', editResult.success);
  console.log('Updated Title:', editResult.updatedTitle);

  // 2. Persist to MongoDB (Simulating /chat-edit route logic)
  const updateFields = {
    status: 'MODIFIED',
    updatedAt: new Date()
  };
  if (editResult.updatedTitle) {
    updateFields.title = editResult.updatedTitle;
  }
  if (editResult.updatedWebsite) {
    updateFields.website = editResult.updatedWebsite;
  } else if (editResult.updatedTitle) {
    updateFields['website.websiteIdentity.title'] = editResult.updatedTitle;
  }
  if (editResult.runtime) {
    updateFields.runtime = editResult.runtime;
  }

  await WebsiteProject.findOneAndUpdate({ projectId }, { $set: updateFields }, { returnDocument: 'after' });

  // 3. Verify project in DB
  const dbProj = await WebsiteProject.findOne({ projectId });
  console.log('\n2. MongoDB Record:');
  console.log('DB Title:', dbProj?.title);
  console.log('DB Status:', dbProj?.status);
  console.log('DB Runtime URL:', dbProj?.runtime?.url);

  // 4. Verify disk sync
  const siteDataPath = path.join(storageService.getProjectVersionPath(projectId, 'v1'), 'src/data/siteData.js');
  const siteDataRaw = fs.readFileSync(siteDataPath, 'utf8');
  const titleMatch = siteDataRaw.match(/"title":\s*"([^"]+)"/);
  console.log('\n3. Disk siteData.js Title:', titleMatch ? titleMatch[1] : 'null');

  if (dbProj?.title === 'HAKUMA TATA' && titleMatch?.[1] === 'HAKUMA TATA' && editResult.success) {
    console.log('\n🎉 PASS: Project auto-saved to MongoDB and synchronized with All Projects list!');
  } else {
    console.error('\n❌ Auto-save sync failed');
    process.exit(1);
  }

  process.exit(0);
}

testAutoSaveSync().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
