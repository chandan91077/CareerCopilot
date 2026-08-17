import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ScreenShareController } from '../controllers/screenShare.controller';

const router = Router();

// Protect all screen-sharing routes with authentication
router.use(authMiddleware);

router.post('/create', ScreenShareController.createSession);
router.post('/join', ScreenShareController.joinSession);
router.post('/stop', ScreenShareController.stopSession);
router.get('/active', ScreenShareController.getActiveSession);
router.get('/:sessionId', ScreenShareController.getSession);

export default router;
