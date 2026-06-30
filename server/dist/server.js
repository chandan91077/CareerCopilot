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
// Load environment variables
dotenv_1.default.config();
// Imports router modules
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const profile_routes_1 = __importDefault(require("./routes/profile.routes"));
const resume_routes_1 = __importDefault(require("./routes/resume.routes"));
const assistant_routes_1 = __importDefault(require("./routes/assistant.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Configure Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
// Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Rate Limiting
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
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
app.use('/api/payment', payment_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
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
    socket.on('voice_chunk', (data) => {
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
mongoose_1.default
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
