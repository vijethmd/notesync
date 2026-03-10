const express = require('express');
const Note = require('../models/Note');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { sendInviteEmail } = require('../services/email');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({
      $or: [{ owner: req.user._id }, { 'collaborators.user': req.user._id }],
    })
      .populate('owner', 'username color')
      .populate('collaborators.user', 'username color')
      .populate('lastEditedBy', 'username')
      .populate('folder', 'name color icon')
      .sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('owner', 'username color email')
      .populate('collaborators.user', 'username color email')
      .populate('lastEditedBy', 'username')
      .populate('folder', 'name color icon');
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const isOwner = note.owner._id.toString() === req.user._id.toString();
    const isCollaborator = note.collaborators.some(c => c.user._id.toString() === req.user._id.toString());
    if (!isOwner && !isCollaborator && !note.isPublic)
      return res.status(403).json({ message: 'Access denied' });
    res.json(note);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content, color, tags, folder } = req.body;
    const note = await Note.create({ title: title || 'Untitled Note', content: content || '', owner: req.user._id, color, tags, folder: folder || null, lastEditedBy: req.user._id });
    const populated = await note.populate('owner', 'username color');
    res.status(201).json(populated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const isOwner = note.owner.toString() === req.user._id.toString();
    const isWriteCollab = note.collaborators.some(c => c.user.toString() === req.user._id.toString() && c.permission === 'write');
    if (!isOwner && !isWriteCollab) return res.status(403).json({ message: 'No write access' });
    const { title, content, color, tags, isPublic, folder } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (color !== undefined) note.color = color;
    if (tags !== undefined) note.tags = tags;
    if (isPublic !== undefined && isOwner) note.isPublic = isPublic;
    if (folder !== undefined && isOwner) note.folder = folder || null;
    note.lastEditedBy = req.user._id;
    await note.save();
    res.json(note);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only owner can delete' });
    await note.deleteOne();
    res.json({ message: 'Note deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Send invite (creates notification instead of directly adding)
router.post('/:id/invite', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only owner can invite' });

    const { email, permission } = req.body;
    const targetUser = await User.findOne({ email });
    if (!targetUser) return res.status(404).json({ message: 'No user found with that email' });
    if (targetUser._id.toString() === req.user._id.toString()) return res.status(400).json({ message: "You can't invite yourself" });

    const alreadyCollab = note.collaborators.some(c => c.user.toString() === targetUser._id.toString());
    if (alreadyCollab) return res.status(400).json({ message: 'User is already a collaborator' });

    // Check for existing pending invite
    const existingNotif = await Notification.findOne({ recipient: targetUser._id, note: note._id, status: 'pending' });
    if (existingNotif) return res.status(400).json({ message: 'Invite already sent to this user' });

    await Notification.create({
      recipient: targetUser._id,
      sender: req.user._id,
      type: 'invite',
      note: note._id,
      noteTitle: note.title,
      permission: permission || 'write',
    });

    // Send email notification (non-blocking)
    sendInviteEmail(targetUser.email, req.user.username, note.title).catch(console.error);

    res.json({ message: `Invite sent to ${targetUser.username}` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Remove collaborator
router.delete('/:id/collaborators/:userId', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Only owner can remove collaborators' });
    note.collaborators = note.collaborators.filter(c => c.user.toString() !== req.params.userId);
    await note.save();
    res.json({ message: 'Collaborator removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
