const mongoose = require('mongoose');

const CampaignPostSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    workspaceId: {
      type: String,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    date: { type: Date, required: true },
    day: { type: String, required: true },
    platform: { type: String, required: true },
    contentType: { type: String, required: true },
    campaignStage: { type: String, required: true },
    postObjective: { type: String, required: true },
    prompt: { type: String, required: true },
    postType: { type: String, default: 'Image' },
    carouselImages: { type: Number, default: 0 },
    postFor: { type: String, default: 'Brand Awareness' },
    imagePrompt: { type: String, default: '' },
    captionPrompt: { type: String, default: '' },
    caption: { type: String, default: '' },
    hashtags: { type: [String], default: [] },
    cta: { type: String, default: '' },
    generatedImage: { type: String, default: null },
    generatedImages: { type: [String], default: [] }, // For carousel
    status: {
      type: String,
      enum: ['Draft', 'Generated', 'Approved', 'Scheduled', 'Published', 'Failed'],
      default: 'Draft',
    },
    aiScore: { type: Number, default: 0 },
    expectedReach: { type: Number, default: 0 },
    expectedEngagement: { type: Number, default: 0 },
    bestPostingTime: { type: String, default: '10:00 AM' },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    notes: { type: String, default: '' },
    scheduledAt: { type: Date },
    publishedAt: { type: Date },
    analytics: {
      impressions: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

CampaignPostSchema.index({ campaignId: 1, date: 1 });
CampaignPostSchema.index({ workspaceId: 1, status: 1 });

module.exports = mongoose.models.CampaignPost || mongoose.model('CampaignPost', CampaignPostSchema);
