import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { OpenAIService } from '../services/openai.service';
import { Interview } from '../models';

const router = Router();

// POST /interview/start - Initialize a new mock interview session
router.post('/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { category, experienceLevel, durationMinutes } = req.body;

  try {
    if (!category || !experienceLevel || !durationMinutes) {
      return res.status(400).json({ message: 'Category, experience level, and duration are required' });
    }

    // Generate the first question
    const firstQuestionText = await OpenAIService.generateNextQuestion(category, experienceLevel, []);

    const interview = new Interview({
      user: req.user?.id,
      title: `${category} Mock Interview (${experienceLevel})`,
      category,
      experienceLevel,
      durationMinutes: Number(durationMinutes),
      isCompleted: false,
      questions: [
        {
          question: firstQuestionText,
          answerType: 'text',
          userAnswer: '',
          score: 0,
          feedback: '',
          metrics: {
            technicalAccuracy: 0,
            communication: 0,
            grammar: 0,
            completeness: 0
          },
          timeSpentSeconds: 0
        }
      ]
    });

    await interview.save();

    return res.status(201).json({
      message: 'Interview session started',
      interviewId: interview._id,
      question: firstQuestionText,
      questionIndex: 0,
      totalQuestionsPlanned: Math.max(3, Math.round(Number(durationMinutes) / 3)) // approx 3-4 mins per question
    });
  } catch (error: any) {
    console.error('Start interview error:', error);
    return res.status(500).json({ message: 'Server error starting interview' });
  }
});

// POST /interview/answer - Submit response for current question, get next or end
router.post('/answer', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { interviewId, answerText, timeSpentSeconds } = req.body;

  try {
    if (!interviewId || answerText === undefined) {
      return res.status(400).json({ message: 'Interview ID and answer text are required' });
    }

    const interview = await Interview.findOne({ _id: interviewId, user: req.user?.id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview session not found' });
    }
    if (interview.isCompleted) {
      return res.status(400).json({ message: 'This interview has already completed' });
    }

    const currentQuestionIndex = interview.questions.findIndex(q => !q.userAnswer);
    if (currentQuestionIndex === -1) {
      return res.status(400).json({ message: 'No pending questions to answer' });
    }

    const activeQuestion = interview.questions[currentQuestionIndex];
    activeQuestion.userAnswer = answerText || '[No response provided]';
    activeQuestion.timeSpentSeconds = Number(timeSpentSeconds) || 0;

    // Evaluate answer via OpenAI
    const evaluation = await OpenAIService.evaluateAnswer(
      activeQuestion.question,
      activeQuestion.userAnswer || '',
      interview.category
    );

    activeQuestion.score = evaluation.score || 0;
    activeQuestion.feedback = evaluation.feedback || '';
    activeQuestion.metrics = {
      technicalAccuracy: evaluation.metrics?.technicalAccuracy || 0,
      communication: evaluation.metrics?.communication || 0,
      grammar: evaluation.metrics?.grammar || 0,
      completeness: evaluation.metrics?.completeness || 0
    };

    // Calculate maximum question limit based on duration
    // E.g., 15 mins -> 5 questions; 30 mins -> 8 questions; 60 mins -> 15 questions
    const limit = interview.durationMinutes <= 15 ? 4 : (interview.durationMinutes <= 30 ? 7 : 12);
    const hasNext = interview.questions.length < limit;

    if (hasNext) {
      // Gather question text history to prevent duplication
      const history = interview.questions.map(q => q.question);
      const nextQuestionText = await OpenAIService.generateNextQuestion(
        interview.category,
        interview.experienceLevel,
        history
      );

      interview.questions.push({
        question: nextQuestionText,
        answerType: 'text',
        userAnswer: '',
        score: 0,
        feedback: '',
        metrics: {
          technicalAccuracy: 0,
          communication: 0,
          grammar: 0,
          completeness: 0
        },
        timeSpentSeconds: 0
      });

      await interview.save();

      return res.json({
        isCompleted: false,
        nextQuestion: nextQuestionText,
        questionIndex: currentQuestionIndex + 1,
        evaluationResult: {
          score: activeQuestion.score,
          feedback: activeQuestion.feedback,
          metrics: activeQuestion.metrics
        }
      });
    } else {
      // End the interview, compile overall metrics
      interview.isCompleted = true;

      const gradedQuestions = interview.questions.filter(q => q.userAnswer);
      const count = gradedQuestions.length || 1;

      let sumScore = 0;
      let sumAccuracy = 0;
      let sumComm = 0;
      let sumGrammar = 0;
      let sumComp = 0;

      gradedQuestions.forEach(q => {
        sumScore += q.score || 0;
        if (q.metrics) {
          sumAccuracy += q.metrics.technicalAccuracy || 0;
          sumComm += q.metrics.communication || 0;
          sumGrammar += q.metrics.grammar || 0;
          sumComp += q.metrics.completeness || 0;
        }
      });

      interview.score = Math.round(sumScore / count);
      interview.metrics = {
        confidence: Math.round(sumComm * 0.9 + 10), // simulated aggregate metrics
        technicalAccuracy: Math.round(sumAccuracy / count),
        communication: Math.round(sumComm / count),
        grammar: Math.round(sumGrammar / count),
        completeness: Math.round(sumComp / count)
      };

      // Generate feedback summary using the scores
      interview.feedbackSummary = `You completed the mock interview for ${interview.category}. Overall Score: ${interview.score}%. Technical Accuracy: ${interview.metrics.technicalAccuracy}%, Communication: ${interview.metrics.communication}%, Grammar: ${interview.metrics.grammar}%. You did well in structuring answers, but can improve in technical depth.`;

      await interview.save();

      return res.json({
        isCompleted: true,
        interviewReport: interview
      });
    }
  } catch (error: any) {
    console.error('Answer submission error:', error);
    return res.status(500).json({ message: 'Server error saving answer' });
  }
});

// POST /interview/behavioral - STAR evaluation specific handler
router.post('/behavioral', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { question, answer } = req.body;
  try {
    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer are required' });
    }
    const evalResults = await OpenAIService.evaluateBehavioralAnswer(question, answer);
    return res.json(evalResults);
  } catch (error) {
    console.error('Behavioral evaluation error:', error);
    return res.status(500).json({ message: 'Server error evaluating behavioral answer' });
  }
});

// GET /interview/history - List past interviews for current user
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const list = await Interview.find({ user: req.user?.id }).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error: any) {
    console.error('Get history error:', error);
    return res.status(500).json({ message: 'Server error retrieving history' });
  }
});

// GET /interview/:id - Retrieve detailed reports
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const session = await Interview.findOne({ _id: req.params.id, user: req.user?.id });
    if (!session) {
      return res.status(404).json({ message: 'Interview session not found' });
    }
    return res.json(session);
  } catch (error: any) {
    console.error('Get interview details error:', error);
    return res.status(500).json({ message: 'Server error retrieving interview data' });
  }
});

export default router;
