import { Schema, model } from 'mongoose';

export { User } from './User';

// 1. Profile Model
const profileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    avatarUrl: { type: String },
    bio: { type: String },
    skills: [{ type: String }],
    experienceYears: { type: Number, default: 0 },
    targetRole: { type: String, required: true },
  },
  { timestamps: true }
);
export const Profile = model('Profile', profileSchema);

// 2. Resume Model
const resumeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    fileUrl: { type: String },
    parsedText: { type: String, required: true },
    summary: { type: String },
    skills: [{ type: String }],
    detectedGaps: [{ type: String }],
    suggestedAdditions: [{ type: String }],
  },
  { timestamps: true }
);
export const Resume = model('Resume', resumeSchema);

// 3. JobDescription Model
const jobDescriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    company: { type: String },
    parsedText: { type: String, required: true },
    extractedSkills: [{ type: String }],
    compareMatchScore: { type: Number, default: 0 },
    missingSkillsMatched: [{ type: String }],
    suggestions: [{ type: String }],
  },
  { timestamps: true }
);
export const JobDescription = model('JobDescription', jobDescriptionSchema);

// 4. Interview Model (Mock & STAR evaluation)
const interviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    experienceLevel: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    isCompleted: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    feedbackSummary: { type: String },
    metrics: {
      confidence: { type: Number, default: 0 },
      technicalAccuracy: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      grammar: { type: Number, default: 0 },
      completeness: { type: Number, default: 0 }
    },
    questions: [
      {
        question: { type: String, required: true },
        answerType: { type: String, enum: ['voice', 'text'], default: 'text' },
        userAnswer: { type: String },
        score: { type: Number },
        feedback: { type: String },
        metrics: {
          technicalAccuracy: { type: Number },
          communication: { type: Number },
          grammar: { type: Number },
          completeness: { type: Number }
        },
        timeSpentSeconds: { type: Number, default: 0 }
      }
    ]
  },
  { timestamps: true }
);
export const Interview = model('Interview', interviewSchema);

// 5. CodingSession Model
const codingSessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: String, required: true },
    questionTitle: { type: String, required: true },
    difficulty: { type: String, required: true },
    language: { type: String, required: true },
    codeContent: { type: String, required: true },
    isPassed: { type: Boolean, default: false },
    compileOutput: { type: String },
    aiReview: {
      timeComplexity: { type: String },
      spaceComplexity: { type: String },
      betterSolution: { type: String },
      mistakesExplanation: { type: String }
    },
    score: { type: Number, default: 0 }
  },
  { timestamps: true }
);
export const CodingSession = model('CodingSession', codingSessionSchema);

// 6. Subscription Model
const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    planType: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
    activeEndsAt: { type: Date, required: true }
  },
  { timestamps: true }
);
export const Subscription = model('Subscription', subscriptionSchema);

// 7. Payment Model
const paymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    provider: { type: String, enum: ['stripe', 'razorpay', 'cashfree'], required: true },
    transactionId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'succeeded' }
  },
  { timestamps: true }
);
export const Payment = model('Payment', paymentSchema);

// 8. Analytics Model
const analyticsSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // Format YYYY-MM-DD
    totalUsers: { type: Number, default: 0 },
    premiumUsers: { type: Number, default: 0 },
    todayInterviewsCount: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    apiCost: { type: Number, default: 0 },
    monthlyRevenue: [{ date: String, amount: Number }],
    userRegistrationTrend: [{ date: String, count: Number }],
    interviewTrend: [{ date: String, count: Number }],
    apiUsageBreakdown: [{ service: String, calls: Number, cost: Number }]
  },
  { timestamps: true }
);
export const Analytics = model('Analytics', analyticsSchema);

// 9. AdminLog Model
const adminLogSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true },
    targetId: { type: String },
    ipAddress: { type: String },
    details: { type: String }
  },
  { timestamps: true }
);
export const AdminLog = model('AdminLog', adminLogSchema);

// 10. PromptConfig Model
const promptConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    content: { type: String, required: true },
    updatedBy: { type: String, required: true }
  },
  { timestamps: true }
);
export const PromptConfig = model('PromptConfig', promptConfigSchema);
