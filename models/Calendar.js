const mongoose = require('mongoose');

const CalendarSchema = new mongoose.Schema({
  workspaceId: { type: String, default: 'ws_001' },
  title: { type: String, required: true },
  date: { type: String, required: true },
  platform: { type: String, default: 'Blog' },
  pillar: { type: String, default: 'Enterprise AI' },
  status: { type: String, default: 'SCHEDULED' },
  owner: { type: String, default: 'Content Strategist' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Calendar', CalendarSchema);
