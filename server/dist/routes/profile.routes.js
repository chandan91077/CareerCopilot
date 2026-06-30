"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const models_1 = require("../models");
const router = (0, express_1.Router)();
// GET /profile - Get current user profile
router.get('/', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const profile = await models_1.Profile.findOne({ user: req.user?.id }).populate('user', 'email role plan isVerified');
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        return res.json(profile);
    }
    catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({ message: 'Server error retrieving profile' });
    }
});
// PUT /profile - Update current user profile
router.put('/', auth_middleware_1.authMiddleware, async (req, res) => {
    const { firstName, lastName, phone, avatarUrl, bio, skills, experienceYears, targetRole } = req.body;
    try {
        let profile = await models_1.Profile.findOne({ user: req.user?.id });
        if (!profile) {
            profile = new models_1.Profile({
                user: req.user?.id,
                firstName,
                lastName,
                phone,
                avatarUrl,
                bio,
                skills: skills || [],
                experienceYears: experienceYears || 0,
                targetRole,
            });
        }
        else {
            if (firstName !== undefined)
                profile.firstName = firstName;
            if (lastName !== undefined)
                profile.lastName = lastName;
            if (phone !== undefined)
                profile.phone = phone;
            if (avatarUrl !== undefined)
                profile.avatarUrl = avatarUrl;
            if (bio !== undefined)
                profile.bio = bio;
            if (skills !== undefined)
                profile.skills = skills;
            if (experienceYears !== undefined)
                profile.experienceYears = experienceYears;
            if (targetRole !== undefined)
                profile.targetRole = targetRole;
        }
        await profile.save();
        return res.json(profile);
    }
    catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ message: 'Server error updating profile' });
    }
});
exports.default = router;
