const mongoose = require('mongoose');

const GeneratedPostSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    calendarEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Calendar',
      index: true,
    },
    type: {
      type: String,
      enum: ['image', 'carousel', 'video', 'reel', 'story', 'static'],
      required: true,
    },
    platform: {
      type: String,
      enum: ['instagram', 'facebook', 'linkedin', 'twitter', 'youtube', 'threads'],
      required: true,
    },
    aspectRatio: { type: String, default: '4:5' },
    hook: { type: String },
    onAssetText: { type: String },
    captionShort: { type: String },
    captionLong: { type: String },
    hashtags: [{ type: String }],
    cta: { type: String },
    imageUrl: { type: String },
    imageUrls: [{ type: String }], // For carousel
    videoUrl: { type: String },
    status: {
      type: String,
      enum: ['draft', 'in_review', 'approved', 'rejected', 'scheduled', 'published', 'failed'],
      default: 'draft',
    },
    analytics: {
      impressions: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      commentsCount: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
    },
    version: { type: Number, default: 1 },
    scheduledDate: { type: Date, index: true },
    dateString: { type: String },
  },
  { timestamps: true }
);

GeneratedPostSchema.index({ workspaceId: 1, status: 1 });
GeneratedPostSchema.index({ workspaceId: 1, scheduledDate: 1 });

module.exports = mongoose.models.GeneratedPost || mongoose.model('GeneratedPost', GeneratedPostSchema);
