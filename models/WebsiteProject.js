const mongoose = require('mongoose');

const WebsiteProjectSchema = new mongoose.Schema({
  projectId: { type: String, required: true, unique: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  businessType: { type: String, default: 'General Website' },
  industry: { type: String, default: 'Technology & E-Commerce' },
  status: { type: String, enum: ['DRAFT', 'GENERATED', 'MODIFIED', 'VALIDATED', 'DEPLOYED'], default: 'DRAFT' },
  activeVersion: { type: String, default: 'v1' },
  
  // Health Score Metrics
  healthScore: {
    overall: { type: Number, default: 100 },
    ui: { type: Boolean, default: true },
    responsive: { type: Boolean, default: true },
    navigation: { type: Boolean, default: true },
    api: { type: Boolean, default: true },
    database: { type: Boolean, default: true }
  },

  // Active Deployment Status
  activeDeployment: {
    provider: { type: String, default: 'SANDBOX_PREVIEW' },
    subdomain: { type: String, default: '' },
    customDomain: { type: String, default: '' },
    status: { type: String, default: 'NOT_DEPLOYED' },
    deployedAt: { type: Date }
  },

  // Project Artifacts Payload
  blueprint: { type: mongoose.Schema.Types.Mixed },
  website: { type: mongoose.Schema.Types.Mixed },
  requirement: { type: mongoose.Schema.Types.Mixed },
  runtime: { type: mongoose.Schema.Types.Mixed },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

WebsiteProjectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (typeof next === 'function') next();
});

module.exports = mongoose.model('WebsiteProject', WebsiteProjectSchema);
