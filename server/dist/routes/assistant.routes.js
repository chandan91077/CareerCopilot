"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const openai_service_1 = require("../services/openai.service");
const models_1 = require("../models");
const router = (0, express_1.Router)();
// POST /assistant/analyze-screen - Analyze base64 image capture against user resume
router.post('/analyze-screen', auth_middleware_1.authMiddleware, async (req, res) => {
    const { image } = req.body;
    try {
        if (!image) {
            return res.status(400).json({ message: 'Screenshot image payload is required' });
        }
        // Retrieve user's latest parsed resume
        const userResume = await models_1.Resume.findOne({ user: req.user?.id }).sort({ createdAt: -1 });
        const resumeText = userResume?.parsedText || '[No resume uploaded yet. Analyze based on standard tech standards]';
        // Call OpenAI screen analyzer
        const analysis = await openai_service_1.OpenAIService.analyzeScreen(image, resumeText);
        return res.json({
            success: true,
            analysis
        });
    }
    catch (error) {
        console.error('Analyze screen error:', error);
        return res.status(500).json({ message: error.message || 'Server error analyzing screenshot' });
    }
});
exports.default = router;
