const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  priceUSD: { type: Number, required: true },
  priceINR: { type: Number, required: true },
  billingCycle: { type: String, default: 'monthly' },
  imageCredits: { type: Number, required: true },
  textGenerations: { type: String, required: true },
  description: { type: String, default: '' },
  features: [{ type: String }],
  badge: { type: String, default: '' },
  isPopular: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
