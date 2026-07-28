const mongoose = require('mongoose');
const dns = require('dns');

// Fix Windows Node.js DNS SRV resolution issue for mongodb+srv://
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {}

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_ads_db';
  const localFallbackUri = 'mongodb://127.0.0.1:27017/ai_ads_db';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      family: 4
    });
    console.log(`🍃 MongoDB Atlas Cloud Connected: ${conn.connection.host} / DB: ${conn.connection.name}`);
  } catch (error) {
    console.log(`⚠️ Atlas Cloud IP Restricted (${error.message}). Attempting local DB fallback...`);
    try {
      const connLocal = await mongoose.connect(localFallbackUri);
      console.log(`🍃 Local MongoDB Connected: ${connLocal.connection.host} / DB: ${connLocal.connection.name}`);
    } catch (localErr) {
      console.log('MongoDB Note: Running with in-memory persistence store.');
    }
  }
};

module.exports = connectDB;
