const mongoose = require('mongoose');

const BrandProfileSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    companyName: { type: String },
    website: { type: String },
    companyOverviewText: { type: String },
    logoUrl: { type: String },
    brandColors: [String],
    themePreference: { type: String },
    toneOfVoice: { type: mongoose.Schema.Types.Mixed },
    ctaStyle: { type: mongoose.Schema.Types.Mixed },
    dosAndDonts: { type: String },
    extractedBrandSummary: { type: String },
    socialMediaLinks: {
      instagram: { type: String },
      linkedin: { type: String },
      twitter: { type: String },
      facebook: { type: String },
      youtube: { type: String },
    },
    preferredTone: { type: String },
    preferredHookStyle: { type: String },
    preferredCtaStyle: { type: String },
    preferredVisualDirection: { type: String },
    preferredLogoPlacement: {
      type: String,
      enum: ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right', 'None'],
      default: 'Top-Right',
    },
    brandSafeWordRules: [String],
    targetAudience: { type: mongoose.Schema.Types.Mixed },
    contentObjective: { type: mongoose.Schema.Types.Mixed },
    postApprovalRequired: { type: Boolean, default: true },
    fontFamily: { type: String, default: 'Inter' },
    targetIndustry: { type: String },
    campaignMonth: { type: String },
    postingFrequency: { type: String },

    // Core Brand Identity
    structuredIdentity: {
      brand_name: { type: String },
      industry: { type: String },
      target_audience: { type: String },
      tone: { type: String },
      cta_style: { type: String },
      products_services: [String],
      brand_values: [String],
      content_angles: [String],
      color_palette: [String],
      platform_focus: { type: [String], default: ['instagram', 'linkedin', 'twitter'] },
      posting_frequency: { type: String, default: 'daily' },
      goal: { type: String, default: 'engagement + awareness + conversion' },
    },

    // Intelligence sections (free-form JSON from AI analysis)
    companyInformation: { type: mongoose.Schema.Types.Mixed },
    brandIdentity: { type: mongoose.Schema.Types.Mixed },
    brandPersonality: { type: mongoose.Schema.Types.Mixed },
    brandVoice: { type: mongoose.Schema.Types.Mixed },
    targetAudienceSection: { type: mongoose.Schema.Types.Mixed },
    products: { type: mongoose.Schema.Types.Mixed },
    keywords: { type: mongoose.Schema.Types.Mixed },
    contentStrategy: { type: mongoose.Schema.Types.Mixed },
    ctaSection: { type: mongoose.Schema.Types.Mixed },
    social: { type: mongoose.Schema.Types.Mixed },
    competitors: { type: mongoose.Schema.Types.Mixed },
    visualIdentity: { type: mongoose.Schema.Types.Mixed },
    swot: { type: mongoose.Schema.Types.Mixed },
    aiConfidence: { type: Number, default: 85 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.BrandProfile || mongoose.model('BrandProfile', BrandProfileSchema);
