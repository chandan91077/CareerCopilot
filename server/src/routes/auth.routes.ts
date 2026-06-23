import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Profile } from '../models';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-prod';

function generateToken(user: any) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, plan: user.plan },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, targetRole } = req.body;

  try {
    if (!email || !password || !firstName || !lastName || !targetRole) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = Math.random().toString(36).substring(2, 15);

    // Create the User
    const user = new User({
      email,
      passwordHash,
      verificationToken,
      role: email.includes('@admin.com') ? 'admin' : 'user', // auto-assign admin if email matches
    });
    await user.save();

    // Create the Profile
    const profile = new Profile({
      user: user._id,
      firstName,
      lastName,
      targetRole,
      skills: [],
    });
    await profile.save();

    // Log the verification link for local environment testing
    console.log(`[AUTH] Verification token created for user: ${email} -> ${verificationToken}`);

    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        isVerified: user.isVerified,
      },
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        targetRole: profile.targetRole,
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const profile = await Profile.findOne({ user: user._id });
    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        isVerified: user.isVerified,
      },
      profile: profile ? {
        firstName: profile.firstName,
        lastName: profile.lastName,
        targetRole: profile.targetRole,
        skills: profile.skills,
        experienceYears: profile.experienceYears,
      } : null
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /verify-email
router.post('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.body;

  try {
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return res.json({ message: 'Email verified successfully', isVerified: true });
  } catch (error: any) {
    console.error('Email verification error:', error);
    return res.status(500).json({ message: 'Server error during verification' });
  }
});

// POST /forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'No user registered with this email' });
    }

    const token = Math.random().toString(36).substring(2, 15);
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    console.log(`[AUTH] Password reset token for ${email} -> ${token}`);

    return res.json({ message: 'Password reset instructions have been logged to the server' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Server error processing request' });
  }
});

// POST /reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password has been updated successfully' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Server error resetting password' });
  }
});

export default router;
