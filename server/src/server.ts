import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Imports router modules
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import resumeRoutes from './routes/resume.routes';
import assistantRoutes from './routes/assistant.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import interviewRoutes from './routes/interview.routes';
import codingRoutes from './routes/coding.routes';
import screenShareRoutes from './routes/screenShare.routes';
import { setupScreenShareSocket } from './socket/screenShare.socket';

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup Real-time Screen Sharing Socket Signaling
setupScreenShareSocket(io);

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window (increased to support real-time features)
  skip: (req) => {
    // Skip rate limiting for real-time transcription chunks and mock assistant queries
    const path = req.originalUrl || '';
    return path.includes('/transcribe') || path.includes('/ask');
  },
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Bind Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/coding', codingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/screen-share', screenShareRoutes);

// Desktop EXE / ZIP Installer Download Endpoint
app.get('/api/download/desktop', (req, res) => {
  const isZip = req.query.format === 'zip';
  const filename = isZip ? 'CareerCopilotSetup.zip' : 'CareerCopilotSetup.exe';
  const mimeType = isZip ? 'application/zip' : 'application/octet-stream';

  const possiblePaths = [
    path.join(__dirname, `../public/downloads/${filename}`),
    path.join(__dirname, `../../desktop/release/${filename}`),
    path.join(process.cwd(), `public/downloads/${filename}`),
    path.join(process.cwd(), `../desktop/release/${filename}`),
    path.join(__dirname, '../public/downloads/CareerCopilotSetup.exe'),
    path.join(__dirname, '../../desktop/release/CareerCopilotSetup.exe')
  ];

  for (const exePath of possiblePaths) {
    if (fs.existsSync(exePath)) {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.download(exePath, filename);
    }
  }

  return res.redirect('https://github.com/chandan91077/CareerCopilot/releases/latest');
});

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'CareerCopilot API - Running' });
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

// ── Start HTTP server immediately (don't wait for DB) ──────────────
// /api/assistant/transcribe and /api/assistant/ask work without MongoDB.
// DB-dependent routes (auth, resume, interview) return 503 gracefully if DB is down.
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai-interview-platform';

server.listen(PORT, () => {
  console.log(`\n✅ [SERVER] API listening on port ${PORT}`);
  console.log(`   Transcription: http://localhost:${PORT}/api/assistant/transcribe`);
  console.log(`   Ask:           http://localhost:${PORT}/api/assistant/ask\n`);
});

// ── Connect MongoDB in background ───────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[DB] ✅ Connected to MongoDB successfully.');
  })
  .catch((err) => {
    console.warn('[DB] ⚠️  MongoDB unavailable:', err.message);
    console.warn('[DB]    Server still running — transcription & AI answers work without DB.');
    console.warn('[DB]    Start MongoDB to enable auth/resume/interview features.\n');
  });

// ── Graceful shutdown ────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[SERVER] Shutting down...');
  server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
});
