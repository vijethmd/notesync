const express = require('express');
const Note = require('../models/Note');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all notes for user (owned + collaborated)
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id },
      ],
    })
      .populate('owner', 'username color')
      .populate('collaborators.user', 'username color')
      .populate('lastEditedBy', 'username')
      .sort({ updatedAt: -1 });

    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single note
router.get('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('owner', 'username color email')
      .populate('collaborators.user', 'username color email')
      .populate('lastEditedBy', 'username');

    if (!note) return res.status(404).json({ message: 'Note not found' });

    const isOwner = note.owner._id.toString() === req.user._id.toString();
    const isCollaborator = note.collaborators.some(
      (c) => c.user._id.toString() === req.user._id.toString()
    );

    if (!isOwner && !isCollaborator && !note.isPublic)
      return res.status(403).json({ message: 'Access denied' });

    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create note
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, color, tags } = req.body;
    const note = await Note.create({
      title: title || 'Untitled Note',
      content: content || '',
      owner: req.user._id,
      color,
      tags,
      lastEditedBy: req.user._id,
    });

    const populated = await note.populate('owner', 'username color');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update note
router.put('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const isOwner = note.owner.toString() === req.user._id.toString();
    const isWriteCollaborator = note.collaborators.some(
      (c) => c.user.toString() === req.user._id.toString() && c.permission === 'write'
    );

    if (!isOwner && !isWriteCollaborator)
      return res.status(403).json({ message: 'No write access' });

    const { title, content, color, tags, isPublic } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (color !== undefined) note.color = color;
    if (tags !== undefined) note.tags = tags;
    if (isPublic !== undefined && isOwner) note.isPublic = isPublic;
    note.lastEditedBy = req.user._id;

    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete note
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (note.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Only owner can delete' });

    await note.deleteOne();
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add collaborator
router.post('/:id/collaborators', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (note.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Only owner can add collaborators' });

    const { email, permission } = req.body;
    const targetUser = await User.findOne({ email });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const alreadyAdded = note.collaborators.some(
      (c) => c.user.toString() === targetUser._id.toString()
    );
    if (alreadyAdded)
      return res.status(400).json({ message: 'User already a collaborator' });

    note.collaborators.push({ user: targetUser._id, permission: permission || 'write' });
    await note.save();

    const populated = await note
      .populate('owner', 'username color')
      .then(() => note.populate('collaborators.user', 'username color email'));

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove collaborator
router.delete('/:id/collaborators/:userId', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (note.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Only owner can remove collaborators' });

    note.collaborators = note.collaborators.filter(
      (c) => c.user.toString() !== req.params.userId
    );
    await note.save();
    res.json({ message: 'Collaborator removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
