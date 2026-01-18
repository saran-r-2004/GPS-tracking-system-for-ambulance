const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ambulance-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Ambulance Tracker API' });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join a room for specific ambulance tracking
  socket.on('join-ambulance-room', (ambulanceId) => {
    socket.join(ambulanceId);
    console.log(`Socket ${socket.id} joined room ${ambulanceId}`);
  });
  
  // Update ambulance location
  socket.on('update-location', (data) => {
    socket.to(data.ambulanceId).emit('location-update', data);
    console.log('Location updated:', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
