const mongoose = require('mongoose');

// Notification model
const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error', 'promo', 'alert'],
      default: 'info',
    },
    isRead: { type: Boolean, default: false },
    actionUrl: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Reminder model
const ReminderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    dueDate: { type: Date, required: true, index: true },
    isCompleted: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    type: { type: String, enum: ['task', 'meeting', 'deadline', 'reminder'], default: 'reminder' },
    relatedCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  },
  { timestamps: true }
);

// Credit log model
const CreditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    action: { type: String, required: true }, // 'deduct' | 'topup' | 'bonus'
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, default: '' },
    feature: { type: String }, // e.g. 'image_generation', 'video_generation', 'chat'
  },
  { timestamps: true }
);

module.exports = {
  Notification: mongoose.models.Notification || mongoose.model('Notification', NotificationSchema),
  Reminder: mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema),
  CreditLog: mongoose.models.CreditLog || mongoose.model('CreditLog', CreditLogSchema),
};
