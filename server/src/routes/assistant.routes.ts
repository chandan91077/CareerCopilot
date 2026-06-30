import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { OpenAIService } from '../services/openai.service';
import { Resume } from '../models';

const router = Router();

// POST /assistant/analyze-screen - Analyze base64 image capture against user resume
router.post('/analyze-screen', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { image } = req.body;

  try {
    if (!image) {
      return res.status(400).json({ message: 'Screenshot image payload is required' });
    }

    // Retrieve user's latest parsed resume
    const userResume = await Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
    const resumeText = userResume?.parsedText || '[No resume uploaded yet. Analyze based on standard tech standards]';

    // Call OpenAI screen analyzer
    const analysis = await OpenAIService.analyzeScreen(image, resumeText);

    return res.json({
      success: true,
      analysis
    });
  } catch (error: any) {
    console.error('Analyze screen error:', error);
    return res.status(500).json({ message: error.message || 'Server error analyzing screenshot' });
  }
});

export default router;
