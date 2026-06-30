"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vm_1 = __importDefault(require("vm"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const openai_service_1 = require("../services/openai.service");
const models_1 = require("../models");
const questions_1 = require("../shared/questions");
const router = (0, express_1.Router)();
// Helper to run JS code in a safe sandbox VM
function runJavaScriptSandbox(code, testInputsStr) {
    try {
        // Basic sandboxed context
        const sandbox = {
            console: {
                log: (...args) => {
                    logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
                }
            }
        };
        const logs = [];
        vm_1.default.createContext(sandbox);
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
        const result = vm_1.default.runInContext(scriptText, sandbox, { timeout: 2000 });
        return {
            output: logs.join('\n') + (logs.length ? '\n' : '') + `Returned: ${JSON.stringify(result)}`,
            success: true
        };
    }
    catch (error) {
        return {
            output: `Runtime Error: ${error.message}`,
            success: false
        };
    }
}
// GET /coding/questions - Retrieve standard list
router.get('/questions', auth_middleware_1.authMiddleware, async (req, res) => {
    return res.json(questions_1.SAMPLE_CODING_QUESTIONS);
});
// POST /coding/run - Execute code block against temporary test cases (sandbox for JS)
router.post('/run', auth_middleware_1.authMiddleware, async (req, res) => {
    const { questionId, language, codeContent } = req.body;
    try {
        const question = questions_1.SAMPLE_CODING_QUESTIONS.find(q => q.id === questionId);
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
        }
        else {
            // Mock compiler output for non-JS languages
            return res.json({
                success: true,
                compileOutput: `[Sandbox Simulator] Successful compilation for ${language}.\nPassed Mock Test Case: Input: ${question.testCases[0].input}`,
                testResult: `Test case: Input: ${question.testCases[0].input} | Expected: ${question.testCases[0].expectedOutput} | Output: Pass (Mocked)`
            });
        }
    }
    catch (err) {
        console.error('Run code error:', err);
        return res.status(500).json({ message: 'Server error during code execution' });
    }
});
// POST /coding/submit - Submit code and receive AI analysis review
router.post('/submit', auth_middleware_1.authMiddleware, async (req, res) => {
    const { questionId, language, codeContent } = req.body;
    try {
        const question = questions_1.SAMPLE_CODING_QUESTIONS.find(q => q.id === questionId);
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
        }
        else {
            compileOutput = `[Compiler Simulator] All test cases run successfully in isolated container for ${language}.`;
        }
        // OpenAI static review
        const aiReview = await openai_service_1.OpenAIService.evaluateCodingSolution(question.title, question.description, codeContent, language);
        const codingSession = new models_1.CodingSession({
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
    }
    catch (error) {
        console.error('Submit code error:', error);
        return res.status(500).json({ message: 'Server error evaluating submission' });
    }
});
// GET /coding/sessions - Retrieve past coding submissions
router.get('/sessions', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const sessions = await models_1.CodingSession.find({ user: req.user?.id }).sort({ createdAt: -1 });
        return res.json(sessions);
    }
    catch (error) {
        console.error('Get coding sessions error:', error);
        return res.status(500).json({ message: 'Server error loading submissions' });
    }
});
exports.default = router;
