export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  plan: 'free' | 'basic' | 'premium';
  isVerified: boolean;
  createdAt: string;
}

export interface Profile {
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  skills: string[];
  experienceYears: number;
  targetRole: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  originalName: string;
  fileUrl?: string;
  parsedText: string;
  summary: string;
  skills: string[];
  detectedGaps: string[];
  suggestedAdditions: string[];
  createdAt: string;
}

export interface JobDescription {
  id: string;
  userId: string;
  title: string;
  company?: string;
  parsedText: string;
  extractedSkills: string[];
  compareMatchScore: number;
  missingSkillsMatched: string[];
  suggestions: string[];
  createdAt: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  answerType: 'voice' | 'text';
  userAnswer?: string;
  score?: number;
  feedback?: string;
  metrics?: {
    technicalAccuracy?: number;
    communication?: number;
    grammar?: number;
    completeness?: number;
  };
  timeSpentSeconds?: number;
}

export interface Interview {
  id: string;
  userId: string;
  title: string;
  category: string; // Backend, Frontend, DevOps, AI Engineer, HR, Data Analyst, Machine Learning
  experienceLevel: 'Fresher' | '1 Year' | '2 Years' | '5 Years';
  durationMinutes: number;
  isCompleted: boolean;
  score?: number;
  feedbackSummary?: string;
  metrics?: {
    confidence: number;
    technicalAccuracy: number;
    communication: number;
    grammar: number;
    completeness: number;
  };
  questions: InterviewQuestion[];
  createdAt: string;
}

export interface CodingQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  starterTemplates: {
    javascript?: string;
    python?: string;
    java?: string;
    cpp?: string;
  };
  testCases: Array<{
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }>;
}

export interface CodingSession {
  id: string;
  userId: string;
  questionId: string;
  questionTitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language: 'javascript' | 'python' | 'java' | 'cpp';
  codeContent: string;
  isPassed: boolean;
  compileOutput?: string;
  aiReview?: {
    timeComplexity: string;
    spaceComplexity: string;
    betterSolution: string;
    mistakesExplanation: string;
  };
  score?: number;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'cancelled' | 'expired';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planType: 'free' | 'basic' | 'premium';
  activeEndsAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  provider: 'stripe' | 'razorpay';
  transactionId: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
}

export interface SystemAnalytics {
  totalUsers: number;
  premiumUsers: number;
  todayInterviewsCount: number;
  totalRevenue: number;
  apiCost: number;
  monthlyRevenue: Array<{ date: string; amount: number }>;
  userRegistrationTrend: Array<{ date: string; count: number }>;
  interviewTrend: Array<{ date: string; count: number }>;
  apiUsageBreakdown: Array<{ service: string; calls: number; cost: number }>;
}

export interface AdminLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  ipAddress?: string;
  details?: string;
  createdAt: string;
}

export interface PromptConfig {
  id: string;
  key: string; // 'resume_review' | 'interview_question_generator' | 'answer_evaluator' | 'coding_evaluator'
  name: string;
  content: string;
  updatedBy: string;
  updatedAt: string;
}
