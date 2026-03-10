const jwt = require('jsonwebtoken');
const Note = require('./models/Note');
const User = require('./models/User');

// Map of noteId -> Set of connected socket info
const activeRooms = new Map();

const socketHandler = (io) => {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Join a note room
    socket.on('join-note', async (noteId) => {
      try {
        const note = await Note.findById(noteId)
          .populate('owner', 'username color')
          .populate('collaborators.user', 'username color');

        if (!note) return socket.emit('error', 'Note not found');

        const isOwner = note.owner._id.toString() === socket.user._id.toString();
        const isCollaborator = note.collaborators.some(
          (c) => c.user._id.toString() === socket.user._id.toString()
        );

        if (!isOwner && !isCollaborator && !note.isPublic)
          return socket.emit('error', 'Access denied');

        // Leave any previous note rooms
        for (const room of socket.rooms) {
          if (room !== socket.id && room.startsWith('note:')) {
            socket.leave(room);
            const prevNoteId = room.replace('note:', '');
            removeFromRoom(prevNoteId, socket.id, io);
          }
        }

        const roomKey = `note:${noteId}`;
        socket.join(roomKey);

        // Track active user in room
        if (!activeRooms.has(noteId)) activeRooms.set(noteId, new Map());
        activeRooms.get(noteId).set(socket.id, {
          socketId: socket.id,
          userId: socket.user._id.toString(),
          username: socket.user.username,
          color: socket.user.color,
          cursor: 0,
        });

        // Send current note content to joining user
        socket.emit('note-joined', {
          note,
          activeUsers: Array.from(activeRooms.get(noteId).values()),
        });

        // Notify others in room
        socket.to(roomKey).emit('user-joined', {
          userId: socket.user._id.toString(),
          username: socket.user.username,
          color: socket.user.color,
          socketId: socket.id,
        });

        // Send active users list to everyone
        io.to(roomKey).emit('active-users', Array.from(activeRooms.get(noteId).values()));

      } catch (err) {
        socket.emit('error', err.message);
      }
    });

    // Handle content changes
    socket.on('content-change', async ({ noteId, content, title }) => {
      try {
        const roomKey = `note:${noteId}`;

        // Broadcast to others in room (not sender)
        socket.to(roomKey).emit('content-updated', {
          content,
          title,
          editedBy: {
            username: socket.user.username,
            color: socket.user.color,
          },
        });

        // Debounced save to DB (save after each change for simplicity)
        const updateData = { lastEditedBy: socket.user._id };
        if (content !== undefined) {
          // Strip any delete buttons injected by the client before persisting
          const cleanContent = content.replace(/<button[^>]*class="image-delete-btn"[^>]*>.*?<\/button>/gi, '');
          updateData.content = cleanContent;
        }
        if (title !== undefined) updateData.title = title;

        await Note.findByIdAndUpdate(noteId, updateData);
      } catch (err) {
        socket.emit('error', err.message);
      }
    });

    // Handle cursor position
    socket.on('cursor-move', ({ noteId, position }) => {
      const roomKey = `note:${noteId}`;

      // Update cursor in active room
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

    // Handle typing indicator
    socket.on('typing', ({ noteId, isTyping }) => {
      const roomKey = `note:${noteId}`;
      socket.to(roomKey).emit('user-typing', {
        username: socket.user.username,
        color: socket.user.color,
        isTyping,
      });
    });

    // Leave note room
    socket.on('leave-note', (noteId) => {
      const roomKey = `note:${noteId}`;
      socket.leave(roomKey);
      removeFromRoom(noteId, socket.id, io);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username}`);
      // Remove from all active rooms
      for (const [noteId, users] of activeRooms.entries()) {
        if (users.has(socket.id)) {
          removeFromRoom(noteId, socket.id, io);
        }
      }
    });
  });
};

function removeFromRoom(noteId, socketId, io) {
  if (!activeRooms.has(noteId)) return;

  const room = activeRooms.get(noteId);
  const user = room.get(socketId);
  room.delete(socketId);

  if (room.size === 0) {
    activeRooms.delete(noteId);
  }

  if (user) {
    io.to(`note:${noteId}`).emit('user-left', { socketId, username: user.username });
    io.to(`note:${noteId}`).emit('active-users', Array.from(room.values()));
  }
}

module.exports = socketHandler;
