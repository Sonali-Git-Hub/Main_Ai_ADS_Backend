const mongoose = require('mongoose');

const WebsiteVersionSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  version: { type: String, required: true }, // e.g. 'v1', 'v2', 'v3'
  changelog: { type: String, default: 'Initial generation' },
  blueprintSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  storagePath: { type: String, required: true }, // Relative disk path under storage/projects/<projectId>/<version>/
  fileCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

WebsiteVersionSchema.index({ projectId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('WebsiteVersion', WebsiteVersionSchema);
