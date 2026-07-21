import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { OpenAIService } from '../services/openai.service';
import { Resume } from '../models';


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = Router();

// Log a clear warning at startup if OPENAI_API_KEY is missing
if (!process.env.OPENAI_API_KEY) {
  console.error(
    '\n' +
    '╔══════════════════════════════════════════════════════════════╗\n' +
    '║  ⚠️  OPENAI_API_KEY is NOT set in server/.env               ║\n' +
    '║  Audio transcription (Whisper) will NOT work.               ║\n' +
    '║  Add your key: OPENAI_API_KEY=sk-...                        ║\n' +
    '╚══════════════════════════════════════════════════════════════╝\n'
  );
}


// POST /assistant/analyze-screen - Analyze base64 image capture against user resume
router.post('/analyze-screen', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { image } = req.body;

  try {
    // Retrieve user's latest parsed resume
    const userResume = await Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
    const resumeText = userResume?.parsedText || '[No resume uploaded yet. Analyze based on standard tech standards]';

    let analysis;

    // If no valid image or OpenAI fails, return a helpful coaching fallback
    if (!image || image === 'mock' || image === '') {
      analysis = {
        questionDetected: 'Screen captured — awaiting question detection',
        hint: 'Your screen has been captured. If you see an interview question on screen, describe it in the chat below and I will provide a tailored answer based on your resume and experience.',
        codeSnippet: ''
      };
    } else {
      try {
        analysis = await OpenAIService.analyzeScreen(image, resumeText);
        if (!analysis || !analysis.hint) throw new Error('Empty response');
      } catch (aiErr) {
        // Graceful fallback if OpenAI vision fails
        analysis = {
          questionDetected: 'Question detected on screen',
          hint: 'I detected content on your screen. For the best results, speak or type the interview question directly and I will generate a precise, resume-tailored answer for you.',
          codeSnippet: ''
        };
      }
    }

    return res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Analyze screen error:', error);
    // Always return a valid payload, never error to the client
    return res.json({
      success: true,
      analysis: {
        questionDetected: 'Screen analyzed',
        hint: 'Ready to assist! Speak or type your interview question for a personalized AI answer.',
        codeSnippet: ''
      }
    });
  }
});

// POST /assistant/ask - Answer real-time transcribed audio question
// Uses optionalAuth so the desktop overlay works without a login session
router.post('/ask', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  const { question } = req.body;

  if (!question || question.trim() === '') {
    return res.status(400).json({ success: false, message: 'Question is required' });
  }

  try {
    // Retrieve user's latest parsed resume
    const userResume = await Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
    const resumeText = userResume?.parsedText || '[No resume uploaded yet. Answer based on standard tech standards]';

    const answer = await OpenAIService.answerAssistantQuery(question, resumeText);
    
    return res.json({ success: true, answer });
  } catch (error: any) {
    console.error('Assistant ask error:', error);
    return res.json({
      success: true,
      answer: {
        text: 'Error generating response. Please try again or ask the question differently.',
        code: ''
      }
    });
  }
});

// POST /assistant/transcribe - Transcribe real-time audio chunk
// Uses optionalAuth: works for both logged-in users and the Electron
// desktop overlay guest mode. A valid OpenAI key is still required.
router.post('/transcribe', optionalAuthMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response) => {
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

    const transcription = await OpenAIService.transcribeAudio(req.file.buffer, req.file.originalname);

    console.log(`[TRANSCRIBE] Whisper result: "${transcription.slice(0, 80)}..."`);
    return res.json({ success: true, text: transcription });
  } catch (error: any) {
    console.error('[TRANSCRIBE] Error:', error.status || 500, error.message || error);
    const statusCode = error.status || (error.message?.includes('429') || error.message?.includes('quota') ? 429 : 500);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error transcribing audio'
    });
  }
});

export default router;
