import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { Profile } from '../models';

const router = Router();

// GET /profile - Get current user profile
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await Profile.findOne({ user: req.user?.id }).populate('user', 'email role plan isVerified');
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    return res.json(profile);
  } catch (error: any) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Server error retrieving profile' });
  }
});

// PUT /profile - Update current user profile
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { firstName, lastName, phone, avatarUrl, bio, skills, experienceYears, targetRole } = req.body;

  try {
    let profile = await Profile.findOne({ user: req.user?.id });

    if (!profile) {
      profile = new Profile({
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
    } else {
      if (firstName !== undefined) profile.firstName = firstName;
      if (lastName !== undefined) profile.lastName = lastName;
      if (phone !== undefined) profile.phone = phone;
      if (avatarUrl !== undefined) profile.avatarUrl = avatarUrl;
      if (bio !== undefined) profile.bio = bio;
      if (skills !== undefined) profile.skills = skills;
      if (experienceYears !== undefined) profile.experienceYears = experienceYears;
      if (targetRole !== undefined) profile.targetRole = targetRole;
    }

    await profile.save();
    return res.json(profile);
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Server error updating profile' });
  }
});

export default router;
