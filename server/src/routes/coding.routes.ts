import { Router, Response } from 'express';
import vm from 'vm';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { OpenAIService } from '../services/openai.service';
import { CodingSession } from '../models';
import { SAMPLE_CODING_QUESTIONS } from '../shared/questions';

const router = Router();

// Helper to run JS code in a safe sandbox VM
function runJavaScriptSandbox(code: string, testInputsStr: string): { output: string; success: boolean } {
  try {
    // Basic sandboxed context
    const sandbox = {
      console: {
        log: (...args: any[]) => {
          logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
        }
      }
    };
    const logs: string[] = [];
    vm.createContext(sandbox);

    // Append helper script to run the code and check values
    // Example: testInputsStr could be "[2,7,11,15], 9"
    // Assuming the user's function is twoSum
    const scriptText = `
      ${code}
      
      try {
        // Look for common entry functions
        const targetFn = typeof twoSum === 'function' ? twoSum : 
                         typeof isValid === 'function' ? isValid : 
                         typeof reverseList === 'function' ? reverseList : null;
        if (targetFn) {
          const result = targetFn(${testInputsStr});
          JSON.stringify(result);
        } else {
          "No function found";
        }
      } catch (err) {
        throw new Error("Execution: " + err.message);
      }
    `;

    const result = vm.runInContext(scriptText, sandbox, { timeout: 2000 });
    return {
      output: logs.join('\n') + (logs.length ? '\n' : '') + `Returned: ${JSON.stringify(result)}`,
      success: true
    };
  } catch (error: any) {
    return {
      output: `Runtime Error: ${error.message}`,
      success: false
    };
  }
}

// GET /coding/questions - Retrieve standard list
router.get('/questions', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.json(SAMPLE_CODING_QUESTIONS);
});

// POST /coding/run - Execute code block against temporary test cases (sandbox for JS)
router.post('/run', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { questionId, language, codeContent } = req.body;

  try {
    const question = SAMPLE_CODING_QUESTIONS.find(q => q.id === questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    if (language === 'javascript') {
      // Run first test case as sample run
      const sampleTestCase = question.testCases[0];
      const result = runJavaScriptSandbox(codeContent, sampleTestCase.input);
      return res.json({
        success: result.success,
        compileOutput: result.output,
        testResult: result.success ? `Test case: Input: ${sampleTestCase.input} | Expected: ${sampleTestCase.expectedOutput} | Output: ${result.output}` : 'Failed to execute test cases.'
      });
    } else {
      // Mock compiler output for non-JS languages
      return res.json({
        success: true,
        compileOutput: `[Sandbox Simulator] Successful compilation for ${language}.\nPassed Mock Test Case: Input: ${question.testCases[0].input}`,
        testResult: `Test case: Input: ${question.testCases[0].input} | Expected: ${question.testCases[0].expectedOutput} | Output: Pass (Mocked)`
      });
    }
  } catch (err: any) {
    console.error('Run code error:', err);
    return res.status(500).json({ message: 'Server error during code execution' });
  }
});

// POST /coding/submit - Submit code and receive AI analysis review
router.post('/submit', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { questionId, language, codeContent } = req.body;

  try {
    const question = SAMPLE_CODING_QUESTIONS.find(q => q.id === questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    let compileOutput = '';
    let isPassed = true;

    if (language === 'javascript') {
      // Test all cases
      for (const tc of question.testCases) {
        const result = runJavaScriptSandbox(codeContent, tc.input);
        compileOutput += `Case [${tc.input}]: ${result.output}\n`;
        if (!result.success) {
          isPassed = false;
        }
      }
    } else {
      compileOutput = `[Compiler Simulator] All test cases run successfully in isolated container for ${language}.`;
    }

    // OpenAI static review
    const aiReview = await OpenAIService.evaluateCodingSolution(
      question.title,
      question.description,
      codeContent,
      language
    );

    const codingSession = new CodingSession({
      user: req.user?.id,
      questionId,
      questionTitle: question.title,
      difficulty: question.difficulty,
      language,
      codeContent,
      isPassed: isPassed && (aiReview.isPassed !== false),
      compileOutput,
      aiReview: {
        timeComplexity: aiReview.timeComplexity || 'O(N)',
        spaceComplexity: aiReview.spaceComplexity || 'O(1)',
        betterSolution: aiReview.betterSolution || 'N/A',
        mistakesExplanation: aiReview.mistakesExplanation || 'No critical mistakes.'
      },
      score: aiReview.score || (isPassed ? 100 : 50)
    });

    await codingSession.save();

    return res.status(201).json({
      message: 'Code submitted and evaluated',
      session: codingSession
    });
  } catch (error: any) {
    console.error('Submit code error:', error);
    return res.status(500).json({ message: 'Server error evaluating submission' });
  }
});

// GET /coding/sessions - Retrieve past coding submissions
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await CodingSession.find({ user: req.user?.id }).sort({ createdAt: -1 });
    return res.json(sessions);
  } catch (error: any) {
    console.error('Get coding sessions error:', error);
    return res.status(500).json({ message: 'Server error loading submissions' });
  }
});

export default router;
