const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, default: '' },
    subject: { type: String, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    category: { type: String, default: 'General' },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
