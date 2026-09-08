"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const mongoose_1 = __importDefault(require("mongoose"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load environment variables
dotenv_1.default.config();
// Imports router modules
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const profile_routes_1 = __importDefault(require("./routes/profile.routes"));
const resume_routes_1 = __importDefault(require("./routes/resume.routes"));
const assistant_routes_1 = __importDefault(require("./routes/assistant.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const interview_routes_1 = __importDefault(require("./routes/interview.routes"));
const coding_routes_1 = __importDefault(require("./routes/coding.routes"));
const screenShare_routes_1 = __importDefault(require("./routes/screenShare.routes"));
const screenShare_socket_1 = require("./socket/screenShare.socket");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Configure Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
// Setup Real-time Screen Sharing Socket Signaling
(0, screenShare_socket_1.setupScreenShareSocket)(io);
// Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// API Rate Limiting
const apiLimiter = (0, express_rate_limit_1.default)({
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
app.use('/api/auth', auth_routes_1.default);
app.use('/api/profile', profile_routes_1.default);
app.use('/api/resume', resume_routes_1.default);
app.use('/api/assistant', assistant_routes_1.default);
app.use('/api/interview', interview_routes_1.default);
app.use('/api/coding', coding_routes_1.default);
app.use('/api/payment', payment_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/screen-share', screenShare_routes_1.default);
// Desktop EXE Installer Metadata Endpoint
app.get('/api/download/desktop/meta', (req, res) => {
    const possiblePaths = [
        path_1.default.join(__dirname, '../public/downloads/CareerCopilotSetup.exe'),
        path_1.default.join(__dirname, '../../desktop/release/CareerCopilotSetup.exe'),
        path_1.default.join(process.cwd(), 'public/downloads/CareerCopilotSetup.exe'),
        path_1.default.join(process.cwd(), '../desktop/release/CareerCopilotSetup.exe'),
        path_1.default.join(__dirname, '../public/downloads/InterviewAISetup.exe'),
        path_1.default.join(__dirname, '../../desktop/release/InterviewAISetup.exe'),
        path_1.default.join(process.cwd(), 'public/downloads/InterviewAISetup.exe'),
        path_1.default.join(process.cwd(), '../desktop/release/InterviewAISetup.exe')
    ];
    for (const exePath of possiblePaths) {
        if (fs_1.default.existsSync(exePath)) {
            const stats = fs_1.default.statSync(exePath);
            return res.json({
                filename: 'CareerCopilotSetup.exe',
                sizeBytes: stats.size,
                sizeMB: (stats.size / (1024 * 1024)).toFixed(1),
                lastModified: stats.mtime.toISOString(),
                version: '1.0.0'
            });
        }
    }
    return res.status(404).json({ success: false, message: 'Desktop installer binary not found on server' });
});
// Desktop EXE Installer Download Endpoint
app.get('/api/download/desktop', (req, res) => {
    const possiblePaths = [
        path_1.default.join(__dirname, '../public/downloads/CareerCopilotSetup.exe'),
        path_1.default.join(__dirname, '../../desktop/release/CareerCopilotSetup.exe'),
        path_1.default.join(process.cwd(), 'public/downloads/CareerCopilotSetup.exe'),
        path_1.default.join(process.cwd(), '../desktop/release/CareerCopilotSetup.exe'),
        path_1.default.join(__dirname, '../public/downloads/InterviewAISetup.exe'),
        path_1.default.join(__dirname, '../../desktop/release/InterviewAISetup.exe'),
        path_1.default.join(process.cwd(), 'public/downloads/InterviewAISetup.exe'),
        path_1.default.join(process.cwd(), '../desktop/release/InterviewAISetup.exe')
    ];
    for (const exePath of possiblePaths) {
        if (fs_1.default.existsSync(exePath)) {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="CareerCopilotSetup.exe"');
            return res.download(exePath, 'CareerCopilotSetup.exe');
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
    socket.on('voice_chunk', (data) => {
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
mongoose_1.default
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
    server.close(() => mongoose_1.default.connection.close().finally(() => process.exit(0)));
});
