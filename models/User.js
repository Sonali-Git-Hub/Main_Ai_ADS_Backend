const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      required: function () { return !this.providerId; },
    },
    provider: { type: String, default: 'local' },
    providerId: { type: String, unique: true, sparse: true, select: false },
    isVerified: { type: Boolean, default: false },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin', 'AgencyAdmin'], default: 'AgencyAdmin' },
    isBlocked: { type: Boolean, default: false },

    // Credits & Subscription
    credits: { type: Number, default: 500 },
    plan: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },

    // Settings
    settings: {
      emailNotif: { type: Boolean, default: true },
      pushNotif: { type: Boolean, default: false },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
      language: { type: String, default: 'English' },
    },

    // Billing
    billingDetails: {
      companyName: { type: String, default: '' },
      billingName: { type: String, default: '' },
      gstin: { type: String, default: '' },
      addressLine1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: 'IN' },
    },

    // Auth flows
    verificationCode: { type: String, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    acceptedTerms: { type: Boolean, default: false },
    acceptedPrivacy: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Strip sensitive fields from JSON output
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.verificationCode;
    delete ret.resetPasswordToken;
    delete ret.providerId;
    return ret;
  },
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
