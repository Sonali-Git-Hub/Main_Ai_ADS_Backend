const mongoose = require('mongoose');

const TopUpPackSchema = new mongoose.Schema({
  packId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  priceUSD: { type: Number, required: true },
  priceINR: { type: Number, required: true },
  imageCredits: { type: Number, required: true },
  description: { type: String, default: '' },
  badge: { type: String, default: '' },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('TopUpPack', TopUpPackSchema);
