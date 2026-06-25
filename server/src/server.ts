import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Imports router modules
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import resumeRoutes from './routes/resume.routes';
import interviewRoutes from './routes/interview.routes';
import codingRoutes from './routes/coding.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Bind Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/coding', codingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'AI Interview Preparation Platform API - Running' });
});

// Socket.IO event handler for interactive live interview practice
io.on('connection', (socket) => {
  console.log(`[SOCKET] User connected: ${socket.id}`);

  // Join a practice room session
  socket.on('join_interview', (room) => {
    socket.join(room);
    console.log(`[SOCKET] Socket ${socket.id} joined interview room ${room}`);
  });

  // Handle voice stream chunk or text chunk transfer
  socket.on('voice_chunk', (data: { room: string; chunk: ArrayBuffer }) => {
    // Broadcast voice stream chunks to matching listeners or analysis buffers
    socket.to(data.room).emit('voice_chunk_received', data.chunk);
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] User disconnected: ${socket.id}`);
  });
});

// Connect to Database
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai-interview-platform';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[DB] Connected to MongoDB database successfully.');
    
    server.listen(PORT, () => {
      console.log(`[SERVER] API listening on port ${PORT}...`);
    });
  })
  .catch((err) => {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  });
