const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    campaignName: { type: String, required: true },
    campaignGoal: { type: String, required: true },
    campaignMonth: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    postingFrequency: {
      type: String,
      enum: ['Daily', 'Weekly', '2x per week', '3x per week', '4x per week', '5x per week', 'Bi Weekly', 'Monthly'],
      default: 'Daily',
    },
    platforms: { type: [String], default: [] },
    budget: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    targetAudience: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Paused', 'Completed', 'Archived'],
      default: 'Draft',
    },
    aiGeneratedStrategy: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    totalPosts: { type: Number, default: 0 },
    generatedPosts: { type: Number, default: 0 },
    approvedPosts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CampaignSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
