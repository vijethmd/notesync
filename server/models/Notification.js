const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['invite'], default: 'invite' },
  note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
  noteTitle: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  permission: { type: String, enum: ['read', 'write'], default: 'write' },
  read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
