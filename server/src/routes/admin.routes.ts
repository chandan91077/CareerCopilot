import { Router, Response } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { User, Profile, Interview, Payment, AdminLog, PromptConfig } from '../models';
import { DEFAULT_PROMPTS } from '../services/openai.service';

const router = Router();

// Middleware helper to log admin events
async function logAdminAction(adminId: string, email: string, action: string, targetId?: string, details?: string) {
  try {
    const log = new AdminLog({ admin: adminId, adminEmail: email, action, targetId, details });
    await log.save();
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}

// GET /admin/analytics - Retrieve aggregated counts & visual trend data
router.get('/analytics', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ plan: { $in: ['basic', 'premium'] } });
    
    // Interviews count today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayInterviewsCount = await Interview.countDocuments({ createdAt: { $gte: startOfToday } });

    // Revenue summation
    const payments = await Payment.find({ status: 'succeeded' });
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
  } catch (error: any) {
    console.error('Get admin analytics error:', error);
    return res.status(500).json({ message: 'Server error retrieving analytics' });
  }
});

// GET /admin/users - List users
router.get('/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Server error retrieving users' });
  }
});

// PUT /admin/users/:id/role - Adjust user roles
router.put('/users/:id/role', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  try {
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logAdminAction(req.user!.id, req.user!.email, `Change role to ${role}`, user._id.toString());

    return res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error updating user role' });
  }
});

// DELETE /admin/users/:id - Remove user
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Also delete profile
    await Profile.deleteOne({ user: req.params.id });

    await logAdminAction(req.user!.id, req.user!.email, 'Delete User Account', req.params.id);

    return res.json({ message: 'User and Profile deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error deleting user' });
  }
});

// GET /admin/prompts - Fetch custom text prompts configs
router.get('/prompts', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const promptKeys = Object.keys(DEFAULT_PROMPTS);
    const configs = await PromptConfig.find();
    
    // Map existing prompt config or generate default placeholders
    const data = promptKeys.map(key => {
      const dbConfig = configs.find(c => c.key === key);
      return {
        key,
        name: key.toUpperCase().replace('_', ' '),
        content: dbConfig ? dbConfig.content : DEFAULT_PROMPTS[key as keyof typeof DEFAULT_PROMPTS],
        updatedBy: dbConfig ? dbConfig.updatedBy : 'System Default',
        updatedAt: dbConfig ? dbConfig.updatedAt : new Date()
      };
    });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: 'Server error retrieving prompt configs' });
  }
});

// PUT /admin/prompts - Update prompt configurations
router.put('/prompts', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { key, content } = req.body;
  try {
    if (!key || !content) {
      return res.status(400).json({ message: 'Key and prompt content are required' });
    }

    let config = await PromptConfig.findOne({ key });
    if (!config) {
      config = new PromptConfig({
        key,
        name: key.toUpperCase().replace('_', ' '),
        content,
        updatedBy: req.user!.email
      });
    } else {
      config.content = content;
      config.updatedBy = req.user!.email;
    }
    await config.save();

    await logAdminAction(req.user!.id, req.user!.email, `Update prompt key: ${key}`, config._id.toString());

    return res.json({ message: 'Prompt configuration updated successfully', config });
  } catch (error) {
    return res.status(500).json({ message: 'Server error saving prompt configuration' });
  }
});

// GET /admin/logs - Retrieve admin activities log
router.get('/logs', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await AdminLog.find().sort({ createdAt: -1 }).limit(100);
    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ message: 'Server error retrieving admin logs' });
  }
});

export default router;
