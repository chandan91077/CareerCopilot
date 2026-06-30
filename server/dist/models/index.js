"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptConfig = exports.AdminLog = exports.Analytics = exports.Payment = exports.Subscription = exports.CodingSession = exports.Interview = exports.JobDescription = exports.Resume = exports.Profile = exports.User = void 0;
const mongoose_1 = require("mongoose");
var User_1 = require("./User");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return User_1.User; } });
// 1. Profile Model
const profileSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    avatarUrl: { type: String },
    bio: { type: String },
    skills: [{ type: String }],
    experienceYears: { type: Number, default: 0 },
    targetRole: { type: String, required: true },
}, { timestamps: true });
exports.Profile = (0, mongoose_1.model)('Profile', profileSchema);
// 2. Resume Model
const resumeSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    fileUrl: { type: String },
    parsedText: { type: String, required: true },
    summary: { type: String },
    skills: [{ type: String }],
    detectedGaps: [{ type: String }],
    suggestedAdditions: [{ type: String }],
}, { timestamps: true });
exports.Resume = (0, mongoose_1.model)('Resume', resumeSchema);
// 3. JobDescription Model
const jobDescriptionSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    company: { type: String },
    parsedText: { type: String, required: true },
    extractedSkills: [{ type: String }],
    compareMatchScore: { type: Number, default: 0 },
    missingSkillsMatched: [{ type: String }],
    suggestions: [{ type: String }],
}, { timestamps: true });
exports.JobDescription = (0, mongoose_1.model)('JobDescription', jobDescriptionSchema);
// 4. Interview Model (Mock & STAR evaluation)
const interviewSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
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
}, { timestamps: true });
exports.Interview = (0, mongoose_1.model)('Interview', interviewSchema);
// 5. CodingSession Model
const codingSessionSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
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
}, { timestamps: true });
exports.CodingSession = (0, mongoose_1.model)('CodingSession', codingSessionSchema);
// 6. Subscription Model
const subscriptionSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    planType: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
    activeEndsAt: { type: Date, required: true }
}, { timestamps: true });
exports.Subscription = (0, mongoose_1.model)('Subscription', subscriptionSchema);
// 7. Payment Model
const paymentSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subscription' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    provider: { type: String, enum: ['stripe', 'razorpay', 'cashfree'], required: true },
    transactionId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'succeeded' }
}, { timestamps: true });
exports.Payment = (0, mongoose_1.model)('Payment', paymentSchema);
// 8. Analytics Model
const analyticsSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.Analytics = (0, mongoose_1.model)('Analytics', analyticsSchema);
// 9. AdminLog Model
const adminLogSchema = new mongoose_1.Schema({
    admin: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true },
    targetId: { type: String },
    ipAddress: { type: String },
    details: { type: String }
}, { timestamps: true });
exports.AdminLog = (0, mongoose_1.model)('AdminLog', adminLogSchema);
// 10. PromptConfig Model
const promptConfigSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    content: { type: String, required: true },
    updatedBy: { type: String, required: true }
}, { timestamps: true });
exports.PromptConfig = (0, mongoose_1.model)('PromptConfig', promptConfigSchema);
