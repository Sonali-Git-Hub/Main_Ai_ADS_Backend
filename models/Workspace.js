const mongoose = require('mongoose');

const WorkspaceSchema = new mongoose.Schema({
  brandName: { type: String, required: true },
  domainUrl: { type: String, required: true },
  logoUrl: { type: String, default: '' },
  brandColors: [mongoose.Schema.Types.Mixed],
  targetAudience: [{ type: String }],

  brandVoiceTone: {
    formalityScore: { type: Number, default: 4 },
    toneKeywords: [{ type: String }]
  },
  competitorLandscape: [{ type: String }],
  contentPillars: [{ type: String }],
  socialMediaPresence: [{ type: String }],
  faviconUrl: { type: String, default: '' },
  contactInfo: {
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: 'Global Operations' }
  },
  industryCategory: { type: String, default: 'Technology & E-Commerce' },
  missionStatement: { type: String, default: '' },
  tagline: { type: String, default: '' },
  positioningSummary: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  approvedClaims: [
    {
      claimText: { type: String },
      sourceUrl: { type: String },
      verified: { type: Boolean, default: true }
    }
  ],
  restrictedClaims: [{ type: String }],
  priorityKeywords: [{ type: String }],
  currentStrategy: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Workspace', WorkspaceSchema);
