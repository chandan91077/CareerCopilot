"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const openai_service_1 = require("../services/openai.service");
const models_1 = require("../models");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
const router = (0, express_1.Router)();
// Log a clear warning at startup if OPENAI_API_KEY is missing
if (!process.env.OPENAI_API_KEY) {
    console.error('\n' +
        '╔══════════════════════════════════════════════════════════════╗\n' +
        '║  ⚠️  OPENAI_API_KEY is NOT set in server/.env               ║\n' +
        '║  Audio transcription (Whisper) will NOT work.               ║\n' +
        '║  Add your key: OPENAI_API_KEY=sk-...                        ║\n' +
        '╚══════════════════════════════════════════════════════════════╝\n');
}
// POST /assistant/analyze-screen - Analyze base64 image capture against user resume & optional typed instruction
router.post('/analyze-screen', auth_middleware_1.optionalAuthMiddleware, async (req, res) => {
    const { image, userInstruction } = req.body;
    const imageLen = image ? image.length : 0;
    console.log(`[ANALYZE-SCREEN] Incoming request. Body keys: [${Object.keys(req.body || {}).join(', ')}]. Image present: ${!!image}, type: ${typeof image}, length: ${imageLen} chars (~${Math.round((imageLen * 3) / 4)} bytes), instruction: "${userInstruction || 'none'}"`);
    let savedDebugPath = '';
    try {
        const clean = (image || '').replace(/^data:image\/\w+;base64,/, '').trim();
        if (clean && clean !== 'mock') {
            const buffer = Buffer.from(clean, 'base64');
            savedDebugPath = path_1.default.join(os_1.default.tmpdir(), `capture-debug-${Date.now()}.png`);
            fs_1.default.writeFileSync(savedDebugPath, buffer);
            console.log(`[ANALYZE-SCREEN] 💾 Saved debug screen capture (${buffer.length} bytes) to ${savedDebugPath}`);
        }
    }
    catch (diskErr) {
        console.warn('[ANALYZE-SCREEN] Could not write debug screenshot to disk:', diskErr?.message);
    }
    try {
        // Retrieve user's latest parsed resume
        const userResume = await models_1.Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
        const resumeText = userResume?.parsedText || '[No resume uploaded yet. Analyze based on standard tech standards]';
        let analysis;
        // If no valid image or OpenAI fails, return a helpful coaching fallback
        if (!image || image === 'mock' || image === '') {
            console.warn('[ANALYZE-SCREEN] ⚠️ No image payload provided in request body.');
            analysis = {
                questionDetected: 'Screen captured — awaiting question detection',
                hint: 'Your screen has been captured. If you see an interview question on screen, describe it in the chat below and I will provide a tailored answer based on your resume and experience.',
                codeSnippet: ''
            };
        }
        else {
            try {
                analysis = await openai_service_1.OpenAIService.analyzeScreen(image, resumeText, userInstruction);
                if (!analysis || !analysis.hint)
                    throw new Error('Empty response');
            }
            catch (aiErr) {
                console.warn('[ANALYZE-SCREEN] OpenAIService.analyzeScreen threw:', aiErr?.message || aiErr);
                analysis = {
                    questionDetected: 'Screen Analysis Unavailable',
                    hint: 'Could not read the screen content clearly with the Vision AI model. Please make sure your problem window is fully visible on screen and try capturing again.',
                    codeSnippet: '',
                    _rawError: aiErr?.message || String(aiErr)
                };
            }
        }
        return res.json({
            success: true,
            analysis,
            savedDebugImage: savedDebugPath || analysis?._savedDebugImage || null,
            debug: analysis?._debug || null,
            rawModelResponse: analysis?._rawModelResponse || null,
            rawError: analysis?._rawError || null
        });
    }
    catch (error) {
        console.error('Analyze screen error:', error);
        // Always return a valid payload, never error to the client
        return res.json({
            success: true,
            analysis: {
                questionDetected: 'Screen analyzed',
                hint: 'Ready to assist! Speak or type your interview question for a personalized AI answer.',
                codeSnippet: ''
            },
            savedDebugImage: savedDebugPath || null,
            error: error?.message || String(error)
        });
    }
});
// POST /assistant/ask - Answer real-time transcribed audio question
// Uses optionalAuth so the desktop overlay works without a login session
router.post('/ask', auth_middleware_1.optionalAuthMiddleware, async (req, res) => {
    const { question } = req.body;
    if (!question || question.trim() === '') {
        return res.status(400).json({ success: false, message: 'Question is required' });
    }
    try {
        // Retrieve user's latest parsed resume
        const userResume = await models_1.Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
        const resumeText = userResume?.parsedText || '[No resume uploaded yet. Answer based on standard tech standards]';
        const answer = await openai_service_1.OpenAIService.answerAssistantQuery(question, resumeText);
        return res.json({ success: true, answer });
    }
    catch (error) {
        console.error('Assistant ask error:', error);
        return res.json({
            success: true,
            answer: {
                text: `I couldn’t generate an answer right now. Please try again with a clearer question. ${error?.message ? `Detail: ${error.message}` : ''}`.trim(),
                code: ''
            }
        });
    }
});
// POST /assistant/transcribe - Transcribe real-time audio chunk
// Uses optionalAuth: works for both logged-in users and the Electron
// desktop overlay guest mode. A valid OpenAI key is still required.
router.post('/transcribe', auth_middleware_1.optionalAuthMiddleware, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No audio file uploaded' });
        }
        // Guard: if neither API key is set, return 503
        if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'Transcription unavailable: OPENAI_API_KEY or GROQ_API_KEY is not configured on the server.'
            });
        }
        console.log(`[TRANSCRIBE] Received audio chunk: ${req.file.size} bytes, type: ${req.file.mimetype}, user: ${req.user?.id || 'guest'}`);
        const transcription = await openai_service_1.OpenAIService.transcribeAudio(req.file.buffer, req.file.originalname);
        console.log(`[TRANSCRIBE] Whisper result: "${transcription.slice(0, 80)}..."`);
        return res.json({ success: true, text: transcription });
    }
    catch (error) {
        console.error('[TRANSCRIBE] Error:', error.status || 500, error.message || error);
        const statusCode = error.status || (error.message?.includes('429') || error.message?.includes('quota') ? 429 : 500);
        return res.status(statusCode).json({
            success: false,
            message: error.message || 'Server error transcribing audio'
        });
    }
});
exports.default = router;
