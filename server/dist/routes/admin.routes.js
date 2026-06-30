"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const models_1 = require("../models");
const openai_service_1 = require("../services/openai.service");
const router = (0, express_1.Router)();
// Middleware helper to log admin events
async function logAdminAction(adminId, email, action, targetId, details) {
    try {
        const log = new models_1.AdminLog({ admin: adminId, adminEmail: email, action, targetId, details });
        await log.save();
    }
    catch (err) {
        console.error('Failed to log admin action:', err);
    }
}
// GET /admin/analytics - Retrieve aggregated counts & visual trend data
router.get('/analytics', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, async (req, res) => {
    try {
        const totalUsers = await models_1.User.countDocuments();
        const premiumUsers = await models_1.User.countDocuments({ plan: { $in: ['basic', 'premium'] } });
        // Interviews count today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayInterviewsCount = await models_1.Interview.countDocuments({ createdAt: { $gte: startOfToday } });
        // Revenue summation
        const payments = await models_1.Payment.find({ status: 'succeeded' });
        const totalRevenue = payments.reduce((acc, curr) => acc + curr.amount, 0);
        // Mock analytical data sets for charts
        const monthlyRevenue = [
            { date: 'Jan', amount: 1200 },
            { date: 'Feb', amount: 2100 },
            { date: 'Mar', amount: 3500 },
            { date: 'Apr', amount: 4800 },
            { date: 'May', amount: totalRevenue || 6200 }
        ];
        const userRegistrationTrend = [
            { date: 'Jan', count: 40 },
            { date: 'Feb', count: 85 },
            { date: 'Mar', count: 150 },
            { date: 'Apr', count: 240 },
            { date: 'May', count: totalUsers || 310 }
        ];
        const interviewTrend = [
            { date: 'Jan', count: 120 },
            { date: 'Feb', count: 280 },
            { date: 'Mar', count: 450 },
            { date: 'Apr', count: 620 },
            { date: 'May', count: 810 }
        ];
        const apiUsageBreakdown = [
            { service: 'Resume Parsing', calls: 350, cost: 3.50 },
            { service: 'Mock Questions', calls: 980, cost: 4.90 },
            { service: 'Answer Grading', calls: 740, cost: 14.80 },
            { service: 'Coding Evaluation', calls: 520, cost: 15.60 }
        ];
        const apiCost = apiUsageBreakdown.reduce((sum, item) => sum + item.cost, 0);
        return res.json({
            totalUsers,
            premiumUsers,
            todayInterviewsCount,
            totalRevenue,
            apiCost,
            monthlyRevenue,
            userRegistrationTrend,
            interviewTrend,
            apiUsageBreakdown
        });
    }
    catch (error) {
        console.error('Get admin analytics error:', error);
        return res.status(500).json({ message: 'Server error retrieving analytics' });
    }
});
// GET /admin/users - List users
router.get('/users', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, async (req, res) => {
    try {
        const users = await models_1.User.find({}, '-passwordHash').sort({ createdAt: -1 });
        return res.json(users);
    }
    catch (error) {
        return res.status(500).json({ message: 'Server error retrieving users' });
    }
});
// PUT /admin/users/:id/role - Adjust user roles
router.put('/users/:id/role', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, async (req, res) => {
    const { role } = req.body;
    try {
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }
        const user = await models_1.User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        await logAdminAction(req.user.id, req.user.email, `Change role to ${role}`, user._id.toString());
        return res.json({ message: 'User role updated successfully', user });
    }
    catch (error) {
        return res.status(500).json({ message: 'Server error updating user role' });
    }
});
// DELETE /admin/users/:id - Remove user
router.delete('/users/:id', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, async (req, res) => {
    try {
        const user = await models_1.User.findByIdAndDelete(req.params.id);
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // Also delete profile
        await models_1.Profile.deleteOne({ user: req.params.id });
        await logAdminAction(req.user.id, req.user.email, 'Delete User Account', req.params.id);
        return res.json({ message: 'User and Profile deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Server error deleting user' });
    }
});
// GET /admin/prompts - Fetch custom text prompts configs
router.get('/prompts', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, async (req, res) => {
    try {
        const promptKeys = Object.keys(openai_service_1.DEFAULT_PROMPTS);
        const configs = await models_1.PromptConfig.find();
        // Map existing prompt config or generate default placeholders
        const data = promptKeys.map(key => {
            const dbConfig = configs.find(c => c.key === key);
            return {
                key,
                name: key.toUpperCase().replace('_', ' '),
                content: dbConfig ? dbConfig.content : openai_service_1.DEFAULT_PROMPTS[key],
                updatedBy: dbConfig ? dbConfig.updatedBy : 'System Default',
                updatedAt: dbConfig ? dbConfig.updatedAt : new Date()
            };
        });
        return res.json(data);
    }
    catch (error) {
        return res.status(500).json({ message: 'Server error retrieving prompt configs' });
    }
});
// PUT /admin/prompts - Update prompt configurations
router.put('/prompts', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, async (req, res) => {
    const { key, content } = req.body;
    try {
        if (!key || !content) {
            return res.status(400).json({ message: 'Key and prompt content are required' });
        }
        let config = await models_1.PromptConfig.findOne({ key });
        if (!config) {
            config = new models_1.PromptConfig({
                key,
                name: key.toUpperCase().replace('_', ' '),
                content,
                updatedBy: req.user.email
            });
        }
        else {
            config.content = content;
            config.updatedBy = req.user.email;
        }
        await config.save();
        await logAdminAction(req.user.id, req.user.email, `Update prompt key: ${key}`, config._id.toString());
        return res.json({ message: 'Prompt configuration updated successfully', config });
    }
    catch (error) {
        return res.status(500).json({ message: 'Server error saving prompt configuration' });
    }
});
// GET /admin/logs - Retrieve admin activities log
router.get('/logs', auth_middleware_1.authMiddleware, auth_middleware_1.adminMiddleware, async (req, res) => {
    try {
        const logs = await models_1.AdminLog.find().sort({ createdAt: -1 }).limit(100);
        return res.json(logs);
    }
    catch (error) {
        return res.status(500).json({ message: 'Server error retrieving admin logs' });
    }
});
exports.default = router;
