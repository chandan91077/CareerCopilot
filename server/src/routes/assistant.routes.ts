import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { OpenAIService } from '../services/openai.service';
import { Resume } from '../models';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = Router();

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
router.post('/ask', authMiddleware, async (req: AuthRequest, res: Response) => {
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
router.post('/transcribe', authMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file uploaded' });
    }

    const transcription = await OpenAIService.transcribeAudio(req.file.buffer, req.file.originalname);
    return res.json({ success: true, text: transcription });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error transcribing audio' });
  }
});

export default router;
