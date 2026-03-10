require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');
const imageRoutes = require('./routes/images');
const folderRoutes = require('./routes/folders');
const notificationRoutes = require('./routes/notifications');
const socketHandler = require('./socketHandler');

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true },
});

app.use(cors({ origin: CLIENT_URL, credentials: true, methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'] }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/notifications', notificationRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

socketHandler(io);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-notes')
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB error:', err));
