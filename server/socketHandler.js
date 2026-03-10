const jwt = require('jsonwebtoken');
const Note = require('./models/Note');
const User = require('./models/User');

const activeRooms = new Map(); // noteId -> Map(socketId -> userInfo)
const userSockets = new Map(); // userId -> socketId (for notifications)

const socketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket) => {
    console.log(`Connected: ${socket.user.username}`);
    userSockets.set(socket.user._id.toString(), socket.id);

    socket.on('join-note', async (noteId) => {
      try {
        const note = await Note.findById(noteId)
          .populate('owner', 'username color')
          .populate('collaborators.user', 'username color');
        if (!note) return socket.emit('error', 'Note not found');

        const isOwner = note.owner._id.toString() === socket.user._id.toString();
        const isCollab = note.collaborators.some(c => c.user._id.toString() === socket.user._id.toString());
        if (!isOwner && !isCollab && !note.isPublic) return socket.emit('error', 'Access denied');

        // Leave previous note rooms
        for (const room of socket.rooms) {
          if (room !== socket.id && room.startsWith('note:')) {
            const prevId = room.replace('note:', '');
            socket.leave(room);
            removeFromRoom(prevId, socket.id, io);
          }
        }

        const roomKey = `note:${noteId}`;
        socket.join(roomKey);

        if (!activeRooms.has(noteId)) activeRooms.set(noteId, new Map());
        activeRooms.get(noteId).set(socket.id, {
          socketId: socket.id,
          userId: socket.user._id.toString(),
          username: socket.user.username,
          color: socket.user.color,
          cursor: null,
        });

        socket.emit('note-joined', { note, activeUsers: Array.from(activeRooms.get(noteId).values()) });
        socket.to(roomKey).emit('user-joined', { userId: socket.user._id.toString(), username: socket.user.username, color: socket.user.color, socketId: socket.id });
        io.to(roomKey).emit('active-users', Array.from(activeRooms.get(noteId).values()));
      } catch (err) { socket.emit('error', err.message); }
    });

    socket.on('content-change', async ({ noteId, content, title }) => {
      try {
        const roomKey = `note:${noteId}`;
        socket.to(roomKey).emit('content-updated', {
          content, title,
          editedBy: { username: socket.user.username, color: socket.user.color },
        });
        const updateData = { lastEditedBy: socket.user._id };
        if (content !== undefined) {
          const cleanContent = content.replace(/<button[^>]*class="image-delete-btn"[^>]*>.*?<\/button>/gi, '');
          updateData.content = cleanContent;
        }
        if (title !== undefined) updateData.title = title;
        await Note.findByIdAndUpdate(noteId, updateData);
      } catch (err) { socket.emit('error', err.message); }
    });

    // Multi-cursor: broadcast cursor position with user info
    socket.on('cursor-move', ({ noteId, position, color }) => {
      const roomKey = `note:${noteId}`;
      if (activeRooms.has(noteId) && activeRooms.get(noteId).has(socket.id)) {
        activeRooms.get(noteId).get(socket.id).cursor = position;
      }
      socket.to(roomKey).emit('cursor-updated', {
        socketId: socket.id,
        userId: socket.user._id.toString(),
        username: socket.user.username,
        color: socket.user.color,
        position,
      });
    });

    socket.on('typing', ({ noteId, isTyping }) => {
      socket.to(`note:${noteId}`).emit('user-typing', {
        username: socket.user.username, color: socket.user.color, isTyping,
      });
    });

    socket.on('leave-note', (noteId) => {
      socket.leave(`note:${noteId}`);
      removeFromRoom(noteId, socket.id, io);
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.user.username}`);
      userSockets.delete(socket.user._id.toString());
      for (const [noteId, users] of activeRooms.entries()) {
        if (users.has(socket.id)) removeFromRoom(noteId, socket.id, io);
      }
    });
  });

  // Expose for routes to push notifications
  io.pushNotification = (userId, notification) => {
    const socketId = userSockets.get(userId.toString());
    if (socketId) io.to(socketId).emit('notification', notification);
  };
};

function removeFromRoom(noteId, socketId, io) {
  if (!activeRooms.has(noteId)) return;
  const room = activeRooms.get(noteId);
  const user = room.get(socketId);
  room.delete(socketId);
  if (room.size === 0) activeRooms.delete(noteId);
  if (user) {
    io.to(`note:${noteId}`).emit('user-left', { socketId, username: user.username });
    io.to(`note:${noteId}`).emit('active-users', Array.from(room.values()));
  }
}

module.exports = socketHandler;
