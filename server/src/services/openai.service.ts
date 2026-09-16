import OpenAI from 'openai';
import { PromptConfig } from '../models';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface AIClientConfig {
  client: OpenAI;
  model: string;
  visionModel: string;
}

const GROQ_TEXT_FALLBACKS = [
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
  'llama-3.2-3b-preview',
  'mixtral-8x7b-32768',
  'llama-3.2-1b-preview'
];

let cachedGroqModels: string[] | null = null;
let lastModelFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getActiveGroqModels(ai: AIClientConfig): Promise<string[]> {
  const now = Date.now();
  if (cachedGroqModels && cachedGroqModels.length > 0 && (now - lastModelFetchTime < CACHE_TTL_MS)) {
    return cachedGroqModels;
  }

  try {
    const list = await ai.client.models.list();
    const activeTextModels = list.data
      .map((m: any) => m.id)
      .filter((id: string) =>
        !id.includes('whisper') &&
        !id.includes('vision') &&
        !id.includes('guard') &&
        !id.includes('safeguard') &&
        !id.includes('decommissioned')
      );

    if (activeTextModels.length > 0) {
      console.log('[AI-Fallback] Live active Groq text models retrieved:', activeTextModels);
      cachedGroqModels = activeTextModels;
      lastModelFetchTime = now;
      return activeTextModels;
    }
  } catch (err: any) {
    console.warn('[AI-Fallback] Dynamic model list fetch failed, utilizing static fallback list:', err?.message || err);
  }

  return GROQ_TEXT_FALLBACKS;
}

const getOpenAIClient = (): AIClientConfig | null => {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.trim().length > 0) {
    console.log('[AI-KEY-CHECK] ✅ OPENAI_API_KEY detected');
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: 'gpt-4o-mini',
      visionModel: 'gpt-4o'
    };
  }

  const groqKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  if (groqKey && groqKey.trim().length > 0) {
    console.log('[AI-KEY-CHECK] ✅ GROQ_API_KEY detected');
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' }),
      model: 'llama-3.3-70b-versatile',
      visionModel: 'llama-3.2-11b-vision-preview'
    };
  }

  console.warn('[AI-KEY-CHECK] ⚠️ No valid OPENAI_API_KEY or GROQ_API_KEY found in process.env — falling back to deterministic mock service');
  return null;
};

async function createChatCompletionWithFallback(
  ai: AIClientConfig,
  payload: any,
  fallbackModels: string[] = GROQ_TEXT_FALLBACKS,
  attemptLogs?: any[]
) {
  let modelsToTry: string[];
  const isGroq = ai.client.baseURL?.includes('groq.com');

  if (fallbackModels !== GROQ_TEXT_FALLBACKS) {
    // Caller passed an explicit model list (e.g., vision models) — preserve caller's list and priority order
    modelsToTry = Array.from(new Set(fallbackModels));
  } else {
    let activeFallbacks = fallbackModels;
    if (isGroq) {
      activeFallbacks = await getActiveGroqModels(ai);
    }
    modelsToTry = Array.from(new Set([ai.model, ...activeFallbacks]));
  }

  let lastError: any;
  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI-Fallback] Attempting model: ${modelName}`);
      const res = await ai.client.chat.completions.create({ ...payload, model: modelName });
      console.log(`[AI-Fallback] ✅ Success with model: ${modelName}`);
      if (attemptLogs) {
        attemptLogs.push({
          model: modelName,
          status: 'success',
          rawOutput: res.choices[0]?.message?.content
        });
      }
      return res;
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || 'unknown';
      const msg = err?.message || String(err);
      console.warn(`[AI-Fallback] ❌ Model "${modelName}" failed (status: ${status}, message: ${msg}). Falling back to next model...`);
      if (attemptLogs) {
        attemptLogs.push({
          model: modelName,
          status: 'failed',
          statusCode: status,
          errorMessage: msg,
          errorBody: err?.error || err?.response?.data || null
        });
      }
    }
  }

  console.error('[AI-Fallback] ❌ All fallback models failed! Last raw error:', lastError?.message || lastError);
  throw new Error(`AI service temporarily unavailable — all fallback models failed (${lastError?.message || 'unknown'}).`);
}

// Fallback Mock Responses for development if API key is not present or fails
const mocks = {
  resumeReview: {
    summary: "Senior Software Engineer with solid experience in building scalable web applications. Strong expertise in TypeScript, React, Node.js, and cloud architectures. Demonstrated history of leading small teams and delivering robust code.",
    skills: ["TypeScript", "React", "Node.js", "Express", "MongoDB", "REST APIs", "Docker", "Git"],
    detectedGaps: ["No direct mention of Cloud providers like AWS/GCP in detail", "CI/CD pipeline configuration", "System design scale specifications"],
    suggestedAdditions: ["Add specific AWS services utilized (e.g. S3, EC2, ECS)", "Mention experience with GitHub Actions or Jenkins", "Detail scale of traffic handled in previous projects"]
  },
  compareJD: {
    compareMatchScore: 78,
    missingSkillsMatched: ["Docker", "CI/CD Pipelines", "Redis"],
    suggestions: ["Highlight containerization skills in the projects section", "Incorporate caching technologies such as Redis under backend skills", "Add automated testing methodologies to your summary"]
  },
  codingReview: {
    timeComplexity: "O(N) - Linear time complexity since we iterate through the list exactly once.",
    spaceComplexity: "O(N) - Linear space complexity due to the storing of seen numbers in a Hash Map.",
    betterSolution: "The current hash map lookup solution is optimal. For an unsorted array, it is not possible to perform faster than O(N). Ensure you check for edge cases such as empty input arrays or cases where no solution adds up to the target.",
    mistakesExplanation: "The syntax looks correct. No logical bugs were detected in the core array loop. One minor detail is that the helper array check could return early if target matches.",
    score: 95,
    isPassed: true
  },
  behavioralReview: {
    score: 85,
    feedback: "The answer follows the STAR pattern well. Situation and Task were clearly described. Actions could have been slightly more descriptive regarding personal technical contributions rather than focusing on group actions.",
    metrics: {
      technicalAccuracy: 80,
      communication: 90,
      grammar: 95,
      completeness: 82
    }
  }
};

const DEFAULT_PROMPTS = {
  resume_review: `You are an expert ATS parser and resume coach.
Analyze the following resume text. Output your analysis strictly as JSON matching this format:
{
  "summary": "Professional summary...",
  "skills": ["Skill1", "Skill2"],
  "detectedGaps": ["Gap1", "Gap2"],
  "suggestedAdditions": ["Addition1", "Addition2"]
}`,
  resume_compare: `You are an expert recruiter.
Compare the resume text with the job description text. Output the analysis strictly as JSON matching this format:
{
  "compareMatchScore": 85,
  "missingSkillsMatched": ["Skill1", "Skill2"],
  "suggestions": ["Suggestion1", "Suggestion2"]
}`,
  interview_question: `You are an expert technical interviewer.
Based on the category, experience level, and previous question history, generate the single next best interview question. Do not include any filler text. Return ONLY the question.`,
  answer_evaluator: `You are a strict technical interviewer.
Evaluate the user's answer to the given question. Provide scores and suggestions. Output strictly as JSON matching this format:
{
  "score": 85,
  "feedback": "Detailed overall feedback...",
  "metrics": {
    "technicalAccuracy": 85,
    "communication": 80,
    "grammar": 90,
    "completeness": 85
  }
}`,
  coding_evaluator: `You are a Senior Principal Engineer grading coding interview submissions.
Analyze the problem description, code content, and programming language. Output strictly as JSON matching this format:
{
  "timeComplexity": "O(N) explanation...",
  "spaceComplexity": "O(1) explanation...",
  "betterSolution": "Code block or description of optimal solution...",
  "mistakesExplanation": "Detailed list of syntactic or logical mistakes...",
  "score": 90,
  "isPassed": true
}`
};

async function getSystemPrompt(key: keyof typeof DEFAULT_PROMPTS): Promise<string> {
  try {
    const config = await PromptConfig.findOne({ key });
    if (config) return config.content;
  } catch (err) {
    // Ignore and fallback
  }
  return DEFAULT_PROMPTS[key];
}

interface VisionClientOption {
  provider: 'openai' | 'groq';
  client: OpenAI;
  models: string[];
}

function getVisionClientOptions(): VisionClientOption[] {
  const options: VisionClientOption[] = [];
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const groqKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY)?.trim();

  // Priority 1: OpenAI (gpt-4o flagship, with gpt-4o-mini as immediate reliable fallback)
  if (openaiKey && openaiKey.length > 0) {
    options.push({
      provider: 'openai',
      client: new OpenAI({ apiKey: openaiKey }),
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4o-2024-08-06']
    });
  }

  // Priority 2: Groq Vision (fallback)
  if (groqKey && groqKey.length > 0) {
    options.push({
      provider: 'groq',
      client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' }),
      models: ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']
    });
  }

  return options;
}

export class OpenAIService {
  static async reviewResume(resumeText: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.resumeReview;
    }

    try {
      const systemPrompt = await getSystemPrompt('resume_review');
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Resume text:\n${resumeText}` }
        ],
        response_format: { type: 'json_object' }
      }, GROQ_TEXT_FALLBACKS);

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (err) {
      console.warn('[OpenAIService.reviewResume] AI error, returning fallback parsed resume:', err);
      return mocks.resumeReview;
    }
  }

  static async compareResumeWithJD(resumeText: string, jdText: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.compareJD;
    }

    try {
      const systemPrompt = await getSystemPrompt('resume_compare');
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Resume:\n${resumeText}\n\nJob Description:\n${jdText}` }
        ],
        response_format: { type: 'json_object' }
      }, GROQ_TEXT_FALLBACKS);

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (err) {
      console.warn('[OpenAIService.compareResumeWithJD] AI error, returning fallback comparison:', err);
      return mocks.compareJD;
    }
  }

  static async generateNextQuestion(category: string, experience: string, questionHistory: string[] = []): Promise<string> {
    const ai = getOpenAIClient();
    const defaultQuestions = [
      "What are the differences between SQL and NoSQL databases?",
      "Explain how the Event Loop works in Node.js.",
      "How would you optimize web app performance?",
      "Describe a time when you solved a complex production bug."
    ];

    if (!ai) {
      const unused = defaultQuestions.filter(q => !questionHistory.includes(q));
      return unused.length > 0 ? unused[0] : defaultQuestions[0];
    }

    try {
      const systemPrompt = await getSystemPrompt('interview_question');
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Category: ${category}\nExperience: ${experience}\nHistory of asked questions: ${JSON.stringify(questionHistory)}`
          }
        ]
      }, GROQ_TEXT_FALLBACKS);

      return response.choices[0].message.content?.trim() || "Can you describe your project experiences?";
    } catch (err) {
      console.warn('[OpenAIService.generateNextQuestion] AI error, returning default question:', err);
      const unused = defaultQuestions.filter(q => !questionHistory.includes(q));
      return unused.length > 0 ? unused[0] : defaultQuestions[0];
    }
  }

  static async evaluateAnswer(question: string, userAnswer: string, category: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.behavioralReview;
    }

    try {
      const systemPrompt = await getSystemPrompt('answer_evaluator');
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Question: ${question}\nUser Answer: ${userAnswer}\nCategory: ${category}` }
        ],
        response_format: { type: 'json_object' }
      }, GROQ_TEXT_FALLBACKS);

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (err) {
      console.warn('[OpenAIService.evaluateAnswer] AI error, returning fallback evaluation:', err);
      return mocks.behavioralReview;
    }
  }

  static async evaluateCodingSolution(questionTitle: string, description: string, code: string, language: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.codingReview;
    }

    try {
      const systemPrompt = await getSystemPrompt('coding_evaluator');
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Question Title: ${questionTitle}\nDescription: ${description}\nLanguage: ${language}\nCode:\n${code}`
          }
        ],
        response_format: { type: 'json_object' }
      }, GROQ_TEXT_FALLBACKS);

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (err) {
      console.warn('[OpenAIService.evaluateCodingSolution] AI error, returning fallback coding evaluation:', err);
      return mocks.codingReview;
    }
  }

  static async evaluateBehavioralAnswer(question: string, userAnswer: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.behavioralReview;
    }

    try {
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          {
            role: 'system',
            content: `You are an expert HR coach specialized in the STAR method (Situation, Task, Action, Result).
Evaluate the user response against the STAR method for behavioral answers. Highlight the rating, score, and constructive tips. Output strictly as JSON:
{
  "score": 88,
  "feedback": "Comprehensive review of STAR method coverage...",
  "metrics": {
    "technicalAccuracy": 85,
    "communication": 90,
    "grammar": 90,
    "completeness": 88
  }
}`
          },
          { role: 'user', content: `Behavioral Question: ${question}\nAnswer: ${userAnswer}` }
        ],
        response_format: { type: 'json_object' }
      }, GROQ_TEXT_FALLBACKS);

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (err) {
      console.warn('[OpenAIService.evaluateBehavioralAnswer] AI error, returning fallback behavioral review:', err);
      return mocks.behavioralReview;
    }
  }

  static async analyzeScreen(base64Image: string, resumeText: string, userInstruction?: string) {
    const visionOptions = getVisionClientOptions();
    if (visionOptions.length === 0) {
      console.warn('[AI-Vision] No valid OPENAI_API_KEY or GROQ_API_KEY found, returning fallback coaching hint.');
      return {
        questionDetected: "Screen Captured",
        hint: "Screen captured. For personalized interview answers, configure OPENAI_API_KEY (recommended: gpt-4o) or GROQ_API_KEY in server/.env.",
        codeSnippet: ""
      };
    }

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '').trim();
    const imageByteLength = Math.round((cleanBase64.length * 3) / 4);
    console.log(`[AI-Vision] Analyzing screen capture: ${cleanBase64.length} base64 chars (~${imageByteLength} bytes). Instruction: "${userInstruction || 'none'}"`);

    // Save screenshot to disk on every capture attempt for debugging/verification
    let savedImagePath = '';
    try {
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `capture-debug-${Date.now()}.png`;
      savedImagePath = path.join(os.tmpdir(), filename);
      fs.writeFileSync(savedImagePath, buffer);
      console.log(`[AI-Vision] 💾 Saved capture image (${buffer.length} bytes) to disk: ${savedImagePath}`);
    } catch (saveErr: any) {
      console.warn('[AI-Vision] Failed to save debug image to disk:', saveErr?.message);
    }

    if (!cleanBase64 || imageByteLength < 1000) {
      console.warn('[AI-Vision] ⚠️ Screenshot payload is empty or too small, skipping vision request.');
      return {
        questionDetected: "Screen Unclear",
        hint: "The captured screenshot was empty or unreadable. Please ensure your window is visible and press Capture again.",
        codeSnippet: "",
        _savedDebugImage: savedImagePath
      };
    }

    const instructionPrompt = userInstruction && userInstruction.trim().length > 0
      ? `USER TYPED INSTRUCTION: "${userInstruction.trim()}"`
      : 'No specific instruction typed. Provide the full solution and analysis for the exact problem visible on screen.';

    const systemPrompt = `You are a Principal Technical Interviewer and elite Competitive Programmer analyzing a live, high-resolution screen capture image.

MANDATORY ACCURACY & OCR PROTOCOL:
1. READ ALL VISIBLE TEXT IN THE SCREENSHOT EXACTLY:
   - Carefully transcribe the exact problem title (e.g. "LeetCode 75. Sort Colors", "Two Sum"), problem statement, all constraints (e.g., 0 <= nums[i] <= 2, n <= 10^5), examples (Input, Output, Explanation), and any visible pre-existing code editor lines or function signatures.
   - NEVER substitute, guess, or switch to a generic question (e.g., do NOT answer "second largest element" if the screen shows "Sort Colors"). Rely 100% on the visible pixels.

2. STRUCTURED RESPONSE BASED ON QUESTION TYPE:
   A. CODING PROBLEM (LeetCode / HackerRank / Codeforces / Online Assessment):
      - In "questionDetected": State the exact problem title and number visible on screen.
      - In "hint": 
        * Algorithm: State the optimal algorithm / approach (e.g., "Dutch National Flag algorithm (3-way partition)", "Two Pointers with Hash Map", "Monotonic Stack").
        * Logic: Give step-by-step reasoning explaining HOW and WHY the algorithm works.
        * Complexity: Explicitly state Time Complexity (e.g. O(N)) and Space Complexity (e.g. O(1) in-place auxiliary) with clear justification.
      - In "codeSnippet": Output complete, clean, production-ready, bug-free code solving the exact problem. If the user specified a language in USER INSTRUCTION (e.g. Python, Java, C++, JavaScript), write in that language. Otherwise, default to Python 3 or Java. Include the exact function signature shown on screen.
   
   B. MULTIPLE CHOICE QUESTION (MCQ):
      - In "questionDetected": Transcribe the exact question text.
      - In "hint": 
        * State the correct option clearly: "Correct Option: [Option Letter] - [Option Text]".
        * Provide a 2-4 sentence explanation detailing why that option is correct and why the alternatives are incorrect.
      - In "codeSnippet": Leave empty ("") unless the question specifically requires code.

   C. CONCEPTUAL / ARCHITECTURE QUESTION:
      - In "questionDetected": State the concept or system design topic.
      - In "hint": Provide a direct, structured answer covering Definition, Core Architecture/Components, Key Trade-offs, and 3-4 bullet points tailored for an interview.
      - In "codeSnippet": Include code only if relevant or requested.

3. IF SCREEN IS LEGITIMATELY UNREADABLE:
   - If the image contains zero legible text or content, set "questionDetected" to "Screen Unclear" and state what was observed. Never guess.

Output strictly valid JSON matching this schema:
{
  "questionDetected": "Exact problem name or question visible on screen",
  "hint": "Optimal algorithm, step-by-step logic, Time/Space Complexity O(...), or MCQ correct option with justification",
  "codeSnippet": "Complete working solution code for the VISIBLE problem, or empty string if not a coding problem"
}`;

    const userContent: any[] = [
      {
        type: 'text',
        text: `${instructionPrompt}\n\n[Candidate Resume Context for style/background]:\n${resumeText ? resumeText.slice(0, 1000) : 'Standard software engineering profile'}`
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${cleanBase64}`,
          detail: 'high' // Instructs vision model to inspect full-resolution 512x512 tiles for crisp code & text OCR
        }
      }
    ];

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    console.log(`[SERVER-VISION-AI-PAYLOAD] 🚀 Dispatching high-accuracy vision analysis. detail=high, max_tokens=4096. Providers available: ${visionOptions.map(o => o.provider).join(', ')}`);

    let lastError: any;
    const attemptLogs: any[] = [];

    // Cross-provider fallback: try OpenAI (gpt-4o) first, fallback to Groq Vision if needed
    for (const option of visionOptions) {
      console.log(`[AI-Vision] Attempting vision provider "${option.provider}" with models: ${option.models.join(', ')}`);
      try {
        const dummyConfig: AIClientConfig = {
          client: option.client,
          model: option.models[0],
          visionModel: option.models[0]
        };

        const response = await createChatCompletionWithFallback(
          dummyConfig,
          {
            messages,
            response_format: { type: 'json_object' },
            max_tokens: 4096
          },
          option.models,
          attemptLogs
        );

        const content = response.choices[0]?.message?.content || '{}';
        console.log(`[AI-Vision] 📄 RAW MODEL RESPONSE from provider "${option.provider}":\n`, content);

        let parsed: any;
        try {
          let cleanContent = content.trim();
          if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          }
          parsed = JSON.parse(cleanContent);
        } catch (jsonErr: any) {
          console.warn(`[AI-Vision] Direct JSON.parse failed (${jsonErr.message}), attempting regex extraction from raw output.`);
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error(`Vision model response was not valid JSON (${jsonErr.message}). Raw model output: ${content.slice(0, 300)}`);
          }
        }

        console.log(`[AI-Vision] ✅ Vision analysis successful using provider "${option.provider}". Detected: "${parsed.questionDetected}"`);
        return {
          ...parsed,
          _rawModelResponse: content,
          _savedDebugImage: savedImagePath,
          _debug: {
            provider: option.provider,
            attemptLogs
          }
        };
      } catch (err: any) {
        lastError = err;
        attemptLogs.push({
          provider: option.provider,
          error: err?.message || String(err)
        });
        console.warn(`[AI-Vision] Provider "${option.provider}" failed:`, err?.message || err);
      }
    }

    console.warn('[OpenAIService.analyzeScreen] All vision providers failed, returning graceful fallback:', lastError?.message || lastError);
    return {
      questionDetected: "Screen Analysis Unavailable",
      hint: "Could not read the screen content clearly with the Vision AI model. Please make sure your problem window is fully visible on screen and try capturing again.",
      codeSnippet: "",
      _savedDebugImage: savedImagePath,
      _rawError: lastError?.message || String(lastError),
      _debug: {
        attemptLogs,
        lastError: lastError?.message || String(lastError)
      }
    };
  }

  static async answerAssistantQuery(question: string, resumeText: string) {
    console.log(`[AI-ASK] Received question: "${question.slice(0, 100)}${question.length > 100 ? '...' : ''}"`);
    const ai = getOpenAIClient();

    if (!ai) {
      throw new Error('AI Service Unavailable: Neither GROQ_API_KEY nor OPENAI_API_KEY is configured in server/.env.');
    }

    try {
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          {
            role: 'system',
            content: `You are a Senior Principal Software Engineer aiding a candidate in a live technical interview.
Provide a DIRECT, COMPLETE, and SPECIFIC technical solution.

STRICT LANGUAGE & CODE RULES:
1. DETECT REQUESTED LANGUAGE:
   - Identify the exact language requested in the question (e.g., Python, Java, SQL, C++, JavaScript, TypeScript, Go, Rust).
   - If the user asks for Python (e.g. "Second largest element in python code"), YOU MUST OUTPUT CODE STICKING 100% STRICTLY TO PYTHON in the "code" field! Do NOT output Java or C++ when Python is requested!
   - If the user asks for Java, output Java. If SQL, output SQL. If C++, output C++.

2. COMPLETE WORKING CODE:
   - In the "code" field, provide the FULL, COMPLETE, WORKING solution. Never output dummy placeholders or generic empty comments like "// Solution implementation"!

3. TECHNICAL EXPLANATION:
   - In the "text" field, explain the algorithm logic, key edge cases, Time Complexity O(...), and Space Complexity O(...).

Output strictly as JSON:
{
  "text": "Direct technical explanation with time/space complexity...",
  "code": "Full working code in exact requested language"
}`
          },
          {
            role: 'user',
            content: `Candidate's Resume:\n${resumeText}\n\nTranscribed Audio/Question:\n${question}`
          }
        ],
        response_format: { type: 'json_object' }
      }, GROQ_TEXT_FALLBACKS);

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return { ...parsed, isMock: false };
    } catch (err: any) {
      console.error('[OpenAIService.answerAssistantQuery] Live AI generation error:', err?.message || err);
      throw err;
    }
  }

  static async transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    const openaiKey = process.env.OPENAI_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';

    if (!openaiKey && !groqKey) {
      throw new Error('OPENAI_API_KEY or GROQ_API_KEY is not set. Please add a valid API key to server/.env.');
    }

    // 1. Try Groq API if GROQ_API_KEY is provided
    if (groqKey) {
      try {
        const groq = new OpenAI({
          apiKey: groqKey,
          baseURL: 'https://api.groq.com/openai/v1',
        });
        const file = await OpenAI.toFile(audioBuffer, filename);
        const response = await groq.audio.transcriptions.create({
          file: file,
          model: 'whisper-large-v3',
          language: 'en',
          temperature: 0.0,
          prompt: 'Technical software engineering interview speech in English.',
        });
        if (response.text) return response.text;
      } catch (groqErr: any) {
        console.warn('[Whisper-Groq] Groq transcription error:', groqErr.message || groqErr);
        if (!openaiKey) throw groqErr;
      }
    }

    // 2. Try OpenAI API
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      try {
        const file = await OpenAI.toFile(audioBuffer, filename);
        const response = await openai.audio.transcriptions.create({
          file: file,
          model: 'whisper-1',
          language: 'en',
          temperature: 0.0,
          prompt: 'Technical software engineering interview speech in English.',
        });
        return response.text;
      } catch (err: any) {
        console.error('[Whisper-OpenAI] Transcription failed:', err.status, err.message || err);

        // Format clean actionable errors
        if (err.status === 429 || err.code === 'insufficient_quota' || (err.message && err.message.includes('quota'))) {
          const quotaErr = new Error('OpenAI API quota exceeded (429). Please add credits at platform.openai.com/account/billing or add a free GROQ_API_KEY to server/.env.');
          (quotaErr as any).status = 429;
          throw quotaErr;
        }

        if (err.status === 401 || (err.message && err.message.includes('invalid_api_key'))) {
          const authErr = new Error('Invalid OpenAI API key. Please verify OPENAI_API_KEY in server/.env.');
          (authErr as any).status = 401;
          throw authErr;
        }

        throw err;
      }
    }

    throw new Error('No working Speech-to-Text API configured.');
  }
}
export { DEFAULT_PROMPTS };

