import OpenAI from 'openai';
import { PromptConfig } from '../models';

interface AIClientConfig {
  client: OpenAI;
  model: string;
  visionModel: string;
}

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

// Fallback Mock Responses for development if API key is not present
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

    const systemPrompt = await getSystemPrompt('resume_review');
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Resume text:\n${resumeText}` }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  static async compareResumeWithJD(resumeText: string, jdText: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.compareJD;
    }

    const systemPrompt = await getSystemPrompt('resume_compare');
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Resume:\n${resumeText}\n\nJob Description:\n${jdText}` }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  static async generateNextQuestion(category: string, experience: string, questionHistory: string[] = []): Promise<string> {
    const ai = getOpenAIClient();
    if (!ai) {
      const defaultQuestions = [
        "What are the differences between SQL and NoSQL databases?",
        "Explain how the Event Loop works in Node.js.",
        "How would you optimize web app performance?",
        "Describe a time when you solved a complex production bug."
      ];
      const unused = defaultQuestions.filter(q => !questionHistory.includes(q));
      return unused.length > 0 ? unused[0] : defaultQuestions[0];
    }

    const systemPrompt = await getSystemPrompt('interview_question');
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Category: ${category}\nExperience: ${experience}\nHistory of asked questions: ${JSON.stringify(questionHistory)}`
        }
      ]
    });

    return response.choices[0].message.content?.trim() || "Can you describe your project experiences?";
  }

  static async evaluateAnswer(question: string, userAnswer: string, category: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.behavioralReview;
    }

    const systemPrompt = await getSystemPrompt('answer_evaluator');
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: ${question}\nUser Answer: ${userAnswer}\nCategory: ${category}` }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  static async evaluateCodingSolution(questionTitle: string, description: string, code: string, language: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.codingReview;
    }

    const systemPrompt = await getSystemPrompt('coding_evaluator');
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Question Title: ${questionTitle}\nDescription: ${description}\nLanguage: ${language}\nCode:\n${code}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  static async evaluateBehavioralAnswer(question: string, userAnswer: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return mocks.behavioralReview;
    }

    const response = await ai.client.chat.completions.create({
      model: ai.model,
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
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  static async analyzeScreen(base64Image: string, resumeText: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return {
        questionDetected: "Simulated question: 'How do you design a high-availability backend cluster?'",
        hint: "Be sure to mention stateless API servers, load balancing (Nginx/HAProxy), database replication (primary-replica), and standard fallback caching (Redis) matching your Node/Express experience.",
        codeSnippet: "// Mock Javascript structural design\nconst cluster = require('cluster');\nif (cluster.isPrimary) { ... }"
      };
    }

    const response = await ai.client.chat.completions.create({
      model: ai.visionModel,
      messages: [
        {
          role: 'system',
          content: `You are an expert real-time mock interview companion.
Review the screen capture showing the technical question, slide, or code prompt.
Identify the question/problem on screen.
Provide tailored coaching hints and short code snippets based on the user's resume text to help them answer or write code during their practice session.
Output strictly as JSON in the following format:
{
  "questionDetected": "The technical question or problem detected...",
  "hint": "Constructive hints and guidelines to speak or explain based on the user's resume...",
  "codeSnippet": "Optional code block in correct language if it is a coding question, else empty string"
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
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
  static async answerAssistantQuery(question: string, resumeText: string) {
    const ai = getOpenAIClient();
    if (!ai) {
      return {
        text: "Mock AI Answer: Ensure you listen carefully and break down your answer using the STAR method if it's a behavioral question. For technical questions, mention trade-offs.",
        code: "// Simulated fallback code\nconsole.log('OpenAI / Groq API Key missing');"
      };
    }

    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert real-time mock interview companion.
The user is currently in an interview. You will receive transcribed audio (either the interviewer asking a question, or the user speaking).
Provide tailored coaching hints and short code snippets based on the user's resume text to help them answer or write code during their practice session.
Keep the answer concise (under 90 seconds to read) and use bullet points where applicable.
Output strictly as JSON in the following format:
{
  "text": "Constructive hints and guidelines to speak or explain based on the user's resume...",
  "code": "Optional code block in correct language if it is a coding question, else empty string"
}`
        },
        {
          role: 'user',
          content: `Candidate's Resume:\n${resumeText}\n\nTranscribed Audio/Question:\n${question}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
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

