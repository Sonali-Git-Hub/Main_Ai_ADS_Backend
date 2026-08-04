require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const BrandProfile = require('../models/BrandProfile');

async function test() {
  try {
    console.log('Querying BrandProfile...');
    const res = await BrandProfile.findOne({ workspaceId: 'ws_1785742089081' });
    console.log('Query result:', res);
  } catch (err) {
    console.error('Error querying:', err);
  }
  process.exit(0);
}

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_ads_db';
mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  .then(() => test())
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
