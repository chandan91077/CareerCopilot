import OpenAI from 'openai';
import { PromptConfig } from '../models';

interface AIClientConfig {
  client: OpenAI;
  model: string;
  visionModel: string;
}

const GROQ_TEXT_FALLBACKS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'deepseek-r1-distill-llama-70b',
  'llama-3.1-8b-instant'
];

const getOpenAIClient = (): AIClientConfig | null => {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.trim().length > 0) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: 'gpt-4o-mini',
      visionModel: 'gpt-4o'
    };
  }

  const groqKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  if (groqKey && groqKey.trim().length > 0) {
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' }),
      model: 'llama-3.3-70b-versatile',
      visionModel: 'llama-3.2-11b-vision-preview'
    };
  }

  return null;
};

async function createChatCompletionWithFallback(
  ai: AIClientConfig,
  payload: any,
  fallbackModels: string[] = GROQ_TEXT_FALLBACKS
) {
  const modelsToTry = Array.from(new Set([ai.model, ...fallbackModels]));

  let lastError: any;
  for (const modelName of modelsToTry) {
    try {
      return await ai.client.chat.completions.create({ ...payload, model: modelName });
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI-Fallback] Model ${modelName} failed (${err?.status || err?.message}). Trying next fallback model...`);
    }
  }

  throw lastError;
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

  static async analyzeScreen(base64Image: string, resumeText: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return {
        questionDetected: "Screen Captured",
        hint: "Screen captured. Be sure to mention stateless API servers, load balancing, database replication, and fallback caching matching your technical experience.",
        codeSnippet: ""
      };
    }

    try {
      const response = await createChatCompletionWithFallback(ai, {
        messages: [
          {
            role: 'system',
            content: `You are an expert real-time technical interview companion.
Review the screen capture showing a LeetCode problem, coding problem description, diagram, or interview code prompt.
1. Identify the EXACT problem title and requirements visible on screen (e.g. "268. Missing Number", "Two Sum", "Reverse Linked List", "3Sum").
2. In the "questionDetected" field, state the exact problem name and key constraints.
3. In the "hint" field, provide step-by-step logic, optimal approach, Time Complexity O(...) and Space Complexity O(...).
4. In the "codeSnippet" field, provide the COMPLETE WORKING CODE SOLUTION in the language visible on screen (or Java/Python).

Output strictly as JSON in the following format:
{
  "questionDetected": "Exact problem name detected on screen",
  "hint": "Constructive hints, optimal approach, Time Complexity O(...) and Space Complexity O(...)",
  "codeSnippet": "Complete working solution code for the problem on screen"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Candidate's Resume:\n${resumeText}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      }, ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview', 'llama-3.3-70b-versatile']);

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (err) {
      console.warn('[OpenAIService.analyzeScreen] AI vision error, returning fallback screen response:', err);
      return {
        questionDetected: "Question detected on screen",
        hint: "I detected content on your screen. Speak or type your question directly into the chat for a precise AI answer.",
        codeSnippet: ""
      };
    }
  }

  static async answerAssistantQuery(question: string, resumeText: string) {
    const ai = getOpenAIClient();
    const fallbackAnswer = () => {
      const qLower = question.toLowerCase();
      let text = `Technical Answer for: "${question}"\n\n`;
      let code = "";

      const isPython = qLower.includes('python') || qLower.includes('py');
      const isJava = qLower.includes('java') && !qLower.includes('script');
      const isCpp = qLower.includes('c++') || qLower.includes('cpp');
      const isSql = qLower.includes('sql') || qLower.includes('join') || qLower.includes('query');

      if (qLower.includes('second largest') || (qLower.includes('largest') && qLower.includes('second'))) {
        text += `• **Optimal Single-Pass Approach**: Maintain two variables (\`largest\` and \`secondLargest\`) in a single pass.\n• **Time Complexity**: O(N) single pass.\n• **Space Complexity**: O(1) auxiliary space.`;
        if (isPython) {
          code = `def find_second_largest(arr):\n    if not arr or len(arr) < 2:\n        return -1\n    largest = second = float('-inf')\n    for num in arr:\n        if num > largest:\n            second = largest\n            largest = num\n        elif num > second and num != largest:\n            second = num\n    return second if second != float('-inf') else -1\n\n# Example usage:\nprint(find_second_largest([12, 35, 1, 10, 34, 1]))  # Output: 34`;
        } else {
          code = `public class Solution {\n    public static int findSecondLargest(int[] arr) {\n        if (arr == null || arr.length < 2) return -1;\n        int largest = Integer.MIN_VALUE, second = Integer.MIN_VALUE;\n        for (int num : arr) {\n            if (num > largest) {\n                second = largest;\n                largest = num;\n            } else if (num > second && num != largest) {\n                second = num;\n            }\n        }\n        return (second == Integer.MIN_VALUE) ? -1 : second;\n    }\n}`;
        }
      } else if (qLower.includes('missing number') || qLower.includes('268')) {
        text += `• **Mathematical Sum Formula Approach**: The sum of numbers from 0 to N is N*(N+1)/2. The missing number is expectedSum - actualSum.\n• **Time Complexity**: O(N).\n• **Space Complexity**: O(1).`;
        if (isPython) {
          code = `def missingNumber(nums: list[int]) -> int:\n    n = len(nums)\n    return n * (n + 1) // 2 - sum(nums)\n\n# Example test:\nprint(missingNumber([3, 0, 1]))  # Output: 2`;
        } else {
          code = `class Solution {\n    public int missingNumber(int[] nums) {\n        int n = nums.length;\n        int expectedSum = n * (n + 1) / 2;\n        int actualSum = 0;\n        for (int num : nums) {\n            actualSum += num;\n        }\n        return expectedSum - actualSum;\n    }\n}`;
        }
      } else if (qLower.includes('3sum') || qLower.includes('3 some') || qLower.includes('three sum')) {
        text += `• **Two-Pointer Approach**: Sort the array, then iterate each element \`i\` and use two pointers (\`left\`, \`right\`) to find pairs adding to \`-nums[i]\` while skipping duplicates.\n• **Time Complexity**: O(N^2).\n• **Space Complexity**: O(1) auxiliary space.`;
        if (isPython) {
          code = `def threeSum(nums: list[int]) -> list[list[int]]:\n    nums.sort()\n    res = []\n    for i in range(len(nums) - 2):\n        if i > 0 and nums[i] == nums[i-1]: continue\n        l, r = i + 1, len(nums) - 1\n        while l < r:\n            s = nums[i] + nums[l] + nums[r]\n            if s == 0:\n                res.append([nums[i], nums[l], nums[r]])\n                while l < r and nums[l] == nums[l+1]: l += 1\n                while l < r and nums[r] == nums[r-1]: r -= 1\n                l += 1; r -= 1\n            elif s < 0: l += 1\n            else: r -= 1\n    return res`;
        } else {
          code = `import java.util.*;\n\nclass Solution {\n    public List<List<Integer>> threeSum(int[] nums) {\n        Arrays.sort(nums);\n        List<List<Integer>> res = new ArrayList<>();\n        for (int i = 0; i < nums.length - 2; i++) {\n            if (i > 0 && nums[i] == nums[i-1]) continue;\n            int left = i + 1, right = nums.length - 1;\n            while (left < right) {\n                int sum = nums[i] + nums[left] + nums[right];\n                if (sum == 0) {\n                    res.add(Arrays.asList(nums[i], nums[left], nums[right]));\n                    while (left < right && nums[left] == nums[left+1]) left++;\n                    while (left < right && nums[right] == nums[right-1]) right--;\n                    left++; right--;\n                } else if (sum < 0) left++;\n                else right--;\n            }\n        }\n        return res;\n    }\n}`;
        }
      } else if (isSql) {
        text += `• **SQL Joins & Aggregation**:\n  - **INNER JOIN**: Returns rows matching keys in both tables.\n  - **LEFT JOIN**: Returns all rows from left table plus matching right rows.`;
        code = `SELECT e.id, e.name, d.department_name\nFROM employees e\nINNER JOIN departments d ON e.department_id = d.id;`;
      } else if (qLower.includes('oops') || qLower.includes('object oriented')) {
        text += `• **OOP Core Pillars**: Encapsulation, Inheritance, Polymorphism, Abstraction.`;
        code = `class Developer:\n    def __init__(self, name, role):\n        self._name = name\n        self._role = role\n\n    def get_info(self):\n        return f"{self._name} ({self._role})"\n\ndev = Developer("Candidate", "Software Engineer")\nprint(dev.get_info())`;
      } else {
        text += `• **Technical Solution Approach**:\n  - Analyze constraints, inputs, and edge cases.\n  - Implement single-pass or hash-based lookup for optimal runtime.\n• **Time Complexity**: O(N).\n• **Space Complexity**: O(1) or O(N).`;
        if (isPython) {
          code = `def solve(nums):\n    if not nums:\n        return None\n    return nums`;
        } else {
          code = `class Solution {\n    public static int solve(int[] nums) {\n        if (nums == null || nums.length == 0) return -1;\n        return nums[0];\n    }\n}`;
        }
      }

      return { text, code };
    };

    if (!ai) {
      return fallbackAnswer();
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

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (err: any) {
      console.warn('[OpenAIService.answerAssistantQuery] AI error, returning technical fallback answer:', err?.message || err);
      return fallbackAnswer();
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

