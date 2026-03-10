const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  color: { type: String, default: '#d4a853' },
  icon: { type: String, default: '📁' },
}, { timestamps: true });

folderSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Folder', folderSchema);
