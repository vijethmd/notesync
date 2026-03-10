const express = require('express');
const Folder = require('../models/Folder');
const Note = require('../models/Note');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all folders
router.get('/', auth, async (req, res) => {
  try {
    const folders = await Folder.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(folders);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create folder
router.post('/', auth, async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ message: 'Folder name is required' });
    const folder = await Folder.create({ name, color, icon, owner: req.user._id });
    res.status(201).json(folder);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update folder
router.put('/:id', auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    const { name, color, icon } = req.body;
    if (name) folder.name = name;
    if (color) folder.color = color;
    if (icon) folder.icon = icon;
    await folder.save();
    res.json(folder);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete folder (moves notes to root)
router.delete('/:id', auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    await Note.updateMany({ folder: req.params.id }, { folder: null });
    await folder.deleteOne();
    res.json({ message: 'Folder deleted, notes moved to root' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Move note to folder (or null for root)
router.patch('/move-note/:noteId', auth, async (req, res) => {
  try {
    const { folderId } = req.body;
    const note = await Note.findOne({ _id: req.params.noteId, owner: req.user._id });
    if (!note) return res.status(404).json({ message: 'Note not found or not owner' });
    note.folder = folderId || null;
    await note.save();
    res.json(note);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
