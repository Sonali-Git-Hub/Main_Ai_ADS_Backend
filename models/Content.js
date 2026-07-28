const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  workspaceId: { type: String, default: 'ws_001' },
  title: { type: String, required: true },
  type: { type: String, enum: ['BLOG', 'SOCIAL', 'REPURPOSE', 'SEO_BRIEF'], default: 'BLOG' },
  content: { type: String, default: '' },
  wordCount: { type: Number, default: 0 },
  author: { type: String, default: 'Gemini 3.5 Editorial Engine' },
  approver: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['DRAFT', 'INTERNAL_REVIEW', 'APPROVED', 'RED_FLAG_CITATION_NEEDED'], 
    default: 'INTERNAL_REVIEW' 
  },
  factCheck: {
    passed: { type: Boolean, default: true },
    score: { type: Number, default: 100 },
    status: { type: String, default: 'VERIFIED' },
    flags: [
      {
        type: { type: String },
        severity: { type: String },
        message: { type: String }
      }
    ]
  },
  briefData: { type: mongoose.Schema.Types.Mixed, default: null },
  repurposedOutputs: { type: mongoose.Schema.Types.Mixed, default: null },
  reviewerComment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Content', ContentSchema);
