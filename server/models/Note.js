const mongoose = require('mongoose');

const collaboratorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  permission: { type: String, enum: ['read', 'write'], default: 'write' },
  addedAt: { type: Date, default: Date.now },
});

const noteSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled Note', maxlength: 200 },
  content: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collaborators: [collaboratorSchema],
  folder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  isPublic: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
  color: { type: String, default: '#1a1a2e' },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activeUsers: [{ userId: String, username: String, color: String, cursor: Number }],
}, { timestamps: true });

noteSchema.index({ owner: 1, updatedAt: -1 });
noteSchema.index({ 'collaborators.user': 1 });
noteSchema.index({ folder: 1 });

module.exports = mongoose.model('Note', noteSchema);
