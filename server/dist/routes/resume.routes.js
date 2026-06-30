"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const openai_service_1 = require("../services/openai.service");
const models_1 = require("../models");
const router = (0, express_1.Router)();
// Configure Multer storage in memory
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only PDF and TXT are supported.'));
        }
    }
});
// POST /resume/upload
router.post('/upload', auth_middleware_1.authMiddleware, upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        let parsedText = '';
        if (req.file.mimetype === 'application/pdf') {
            const data = await (0, pdf_parse_1.default)(req.file.buffer);
            parsedText = data.text;
        }
        else {
            parsedText = req.file.buffer.toString('utf-8');
        }
        if (!parsedText || parsedText.trim().length < 10) {
            return res.status(400).json({ message: 'Unable to extract text from the document. Please ensure it contains readable text.' });
        }
        // Call OpenAI for Resume Analysis
        const analysis = await openai_service_1.OpenAIService.reviewResume(parsedText);
        // Save to Database
        const resume = new models_1.Resume({
            user: req.user?.id,
            originalName: req.file.originalname,
            parsedText,
            summary: analysis.summary || '',
            skills: analysis.skills || [],
            detectedGaps: analysis.detectedGaps || [],
            suggestedAdditions: analysis.suggestedAdditions || [],
        });
        await resume.save();
        // Auto-update user profile skills if profile exists
        const profile = await models_1.Profile.findOne({ user: req.user?.id });
        if (profile && analysis.skills) {
            // Merge unique skills
            const mergedSkills = Array.from(new Set([...profile.skills, ...analysis.skills]));
            profile.skills = mergedSkills;
            await profile.save();
        }
        return res.status(201).json({
            message: 'Resume uploaded and analyzed successfully',
            resume
        });
    }
    catch (error) {
        console.error('Resume upload error:', error);
        return res.status(500).json({ message: error.message || 'Server error uploading resume' });
    }
});
// GET /resume/latest
router.get('/latest', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const resume = await models_1.Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
        if (!resume) {
            return res.status(404).json({ message: 'No resume found for this user' });
        }
        return res.json(resume);
    }
    catch (error) {
        console.error('Get latest resume error:', error);
        return res.status(500).json({ message: 'Server error retrieving resume' });
    }
});
// DELETE /resume/:id
router.delete('/:id', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const result = await models_1.Resume.findOneAndDelete({ _id: req.params.id, user: req.user?.id });
        if (!result) {
            return res.status(404).json({ message: 'Resume not found' });
        }
        return res.json({ message: 'Resume deleted successfully' });
    }
    catch (error) {
        console.error('Delete resume error:', error);
        return res.status(500).json({ message: 'Server error deleting resume' });
    }
});
// POST /resume/compare-jd - Match Resume against Job Description
router.post('/compare-jd', auth_middleware_1.authMiddleware, async (req, res) => {
    const { jdText, jdTitle, jdCompany } = req.body;
    try {
        if (!jdText) {
            return res.status(400).json({ message: 'Job Description text is required' });
        }
        // Get the user's latest resume
        const resume = await models_1.Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
        if (!resume) {
            return res.status(400).json({ message: 'Please upload a resume first before comparing with a job description.' });
        }
        // Run comparison via OpenAI
        const matchResults = await openai_service_1.OpenAIService.compareResumeWithJD(resume.parsedText, jdText);
        // Save Job Description evaluation record
        const jobDescription = new models_1.JobDescription({
            user: req.user?.id,
            title: jdTitle || 'Target Role',
            company: jdCompany || 'Company',
            parsedText: jdText,
            extractedSkills: matchResults.missingSkillsMatched || [],
            compareMatchScore: matchResults.compareMatchScore || 0,
            missingSkillsMatched: matchResults.missingSkillsMatched || [],
            suggestions: matchResults.suggestions || []
        });
        await jobDescription.save();
        return res.json({
            message: 'Job Description compared successfully',
            comparison: jobDescription
        });
    }
    catch (error) {
        console.error('Compare JD error:', error);
        return res.status(500).json({ message: 'Server error comparing resume with Job Description' });
    }
});
// GET /resume/comparisons - Get list of past job description match results
router.get('/comparisons', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const lists = await models_1.JobDescription.find({ user: req.user?.id }).sort({ createdAt: -1 });
        return res.json(lists);
    }
    catch (error) {
        console.error('Get comparisons error:', error);
        return res.status(500).json({ message: 'Server error loading comparisons' });
    }
});
exports.default = router;
