import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ScreenShareService } from '../services/screenShare.service';

export class ScreenShareController {
  /**
   * POST /api/screen-share/create
   * Candidate creates a new screen sharing session
   */
  static async createSession(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const durationMinutes = req.body.durationMinutes ? parseInt(req.body.durationMinutes, 10) : 60;
      const result = await ScreenShareService.createSession(req.user.id, durationMinutes);

      return res.status(201).json(result);
    } catch (error: any) {
      console.error('[SCREEN-SHARE] Error creating session:', error);
      return res.status(500).json({ message: 'Failed to create screen sharing session' });
    }
  }

  /**
   * POST /api/screen-share/join
   * Viewer joins a screen sharing session with ID and temporary password
   */
  static async joinSession(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required to view screen share' });
      }

      const { sessionId, password } = req.body;
      if (!sessionId || !password) {
        return res.status(400).json({ message: 'Session ID and Password are required' });
      }

      const result = await ScreenShareService.joinSession(sessionId, password);
      if (!result.ok) {
        return res.status(result.statusCode || 400).json({ message: result.error });
      }

      return res.json(result);
    } catch (error: any) {
      console.error('[SCREEN-SHARE] Error joining session:', error);
      return res.status(500).json({ message: 'Failed to validate screen sharing credentials' });
    }
  }

  /**
   * POST /api/screen-share/stop
   * Candidate explicitly stops active screen share session
   */
  static async stopSession(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      const result = await ScreenShareService.stopSession(sessionId, req.user.id);
      if (!result.ok) {
        return res.status(result.statusCode || 400).json({ message: result.error });
      }

      return res.json({ message: 'Screen sharing session stopped successfully', sessionId: result.sessionId });
    } catch (error: any) {
      console.error('[SCREEN-SHARE] Error stopping session:', error);
      return res.status(500).json({ message: 'Failed to stop screen sharing session' });
    }
  }

  /**
   * GET /api/screen-share/active
   * Get active session for logged-in candidate
   */
  static async getActiveSession(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const activeSession = await ScreenShareService.getActiveSessionForCandidate(req.user.id);
      return res.json({ activeSession });
    } catch (error: any) {
      console.error('[SCREEN-SHARE] Error fetching active session:', error);
      return res.status(500).json({ message: 'Failed to fetch active session' });
    }
  }

  /**
   * GET /api/screen-share/:sessionId
   * Get details of a session by ID
   */
  static async getSession(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { sessionId } = req.params;
      const session = await ScreenShareService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      return res.json(session);
    } catch (error: any) {
      console.error('[SCREEN-SHARE] Error fetching session:', error);
      return res.status(500).json({ message: 'Failed to fetch session status' });
    }
  }
}
