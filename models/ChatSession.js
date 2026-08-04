const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model', 'assistant'],
    required: true,
  },
  content: { type: String, required: true },
  timestamp: { type: Number, default: Date.now },
  attachments: [
    {
      type: { type: String },
      url: String,
      name: String,
    },
  ],
  imageUrl: String,
  videoUrl: String,
  isProcessing: Boolean,
  sources: [
    {
      title: String,
      url: String,
      description: String,
    },
  ],
  suggestions: [String],
});

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    workspaceId: {
      type: String,
      ref: 'Workspace',
      required: false,
      index: true,
    },
    title: { type: String, default: 'New Chat' },
    messages: [messageSchema],
    lastModified: { type: Number, default: Date.now },
    detectedMode: { type: String, default: 'NORMAL_CHAT' },
    isShared: { type: Boolean, default: false },
    shareId: { type: String, unique: true, sparse: true, index: true },
    model: { type: String, default: 'gemini' }, // 'gemini' | 'gpt-4o' | 'groq'
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, lastModified: -1 });
chatSessionSchema.index({ workspaceId: 1, lastModified: -1 });

module.exports = mongoose.models.ChatSession || mongoose.model('ChatSession', chatSessionSchema);
