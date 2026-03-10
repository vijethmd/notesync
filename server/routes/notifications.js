const express = require('express');
const Notification = require('../models/Notification');
const Note = require('../models/Note');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendInviteEmail } = require('../services/email');

const router = express.Router();

// Get all notifications for current user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'username color email')
      .populate('note', 'title')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, read: false });
    res.json({ count });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark all as read
router.patch('/mark-read', auth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Accept invite
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    if (notif.status !== 'pending') return res.status(400).json({ message: 'Already responded' });

    const note = await Note.findById(notif.note);
    if (!note) return res.status(404).json({ message: 'Note no longer exists' });

    const alreadyCollab = note.collaborators.some(c => c.user.toString() === req.user._id.toString());
    if (!alreadyCollab) {
      note.collaborators.push({ user: req.user._id, permission: notif.permission });
      await note.save();
    }

    notif.status = 'accepted';
    notif.read = true;
    await notif.save();

    res.json({ message: 'Invite accepted', noteId: note._id });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Decline invite
router.post('/:id/decline', auth, async (req, res) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    notif.status = 'declined';
    notif.read = true;
    await notif.save();
    res.json({ message: 'Invite declined' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
