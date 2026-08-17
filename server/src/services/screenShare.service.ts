import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import ScreenShareSession, { IScreenShareSession } from '../models/ScreenShareSession';

/**
 * Generate cryptographically secure random session ID in format PREP-XXXXXX
 */
function generateSessionId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0/O, 1/I
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `PREP-${code}`;
}

/**
 * Generate cryptographically secure temporary password (e.g. 6 chars)
 */
function generateTemporaryPassword(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let password = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export class ScreenShareService {
  /**
   * Create a new temporary screen sharing session for candidate
   */
  static async createSession(candidateId: string, durationMinutes = 60) {
    // Deactivate any existing active session for this candidate
    await ScreenShareSession.updateMany(
      { candidateId, status: 'active' },
      { status: 'stopped' }
    );

    let sessionId = generateSessionId();
    // Ensure uniqueness
    let existing = await ScreenShareSession.findOne({ sessionId });
    while (existing) {
      sessionId = generateSessionId();
      existing = await ScreenShareSession.findOne({ sessionId });
    }

    const plainPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + durationMinutes * 60 * 1000);

    const session = await ScreenShareSession.create({
      sessionId,
      candidateId,
      passwordHash,
      status: 'active',
      createdAt,
      expiresAt,
    });

    return {
      sessionId: session.sessionId,
      password: plainPassword,
      expiresAt: session.expiresAt.toISOString(),
      status: session.status,
    };
  }

  /**
   * Validate session ID and temporary password for authorized viewer
   */
  static async joinSession(sessionId: string, password: string) {
    const cleanSessionId = sessionId.trim().toUpperCase();
    const session = await ScreenShareSession.findOne({ sessionId: cleanSessionId });

    if (!session) {
      return { ok: false, error: 'Invalid Session ID', statusCode: 404 };
    }

    if (session.status === 'stopped') {
      return { ok: false, error: 'Screen sharing session has been stopped by candidate', statusCode: 400 };
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      session.status = 'expired';
      await session.save();
      return { ok: false, error: 'Screen sharing session has expired', statusCode: 400 };
    }

    if (session.status !== 'active') {
      return { ok: false, error: 'Session is not active', statusCode: 400 };
    }

    // Verify password hash
    const isValidPassword = await bcrypt.compare(password.trim().toUpperCase(), session.passwordHash);
    if (!isValidPassword) {
      return { ok: false, error: 'Invalid Session Password', statusCode: 401 };
    }

    return {
      ok: true,
      sessionId: session.sessionId,
      candidateId: session.candidateId.toString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Candidate explicitly stops active screen sharing session
   */
  static async stopSession(sessionId: string, candidateId: string) {
    const cleanSessionId = sessionId.trim().toUpperCase();
    const session = await ScreenShareSession.findOne({ sessionId: cleanSessionId });

    if (!session) {
      return { ok: false, error: 'Session not found', statusCode: 404 };
    }

    if (session.candidateId.toString() !== candidateId) {
      return { ok: false, error: 'Unauthorized to stop this session', statusCode: 403 };
    }

    session.status = 'stopped';
    await session.save();

    return { ok: true, sessionId: session.sessionId };
  }

  /**
   * Get public active session info for candidate
   */
  static async getActiveSessionForCandidate(candidateId: string) {
    const session = await ScreenShareSession.findOne({
      candidateId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Get session status details by ID
   */
  static async getSession(sessionId: string) {
    const cleanSessionId = sessionId.trim().toUpperCase();
    const session = await ScreenShareSession.findOne({ sessionId: cleanSessionId });

    if (!session) {
      return null;
    }

    const isExpired = new Date() > session.expiresAt;
    if (isExpired && session.status === 'active') {
      session.status = 'expired';
      await session.save();
    }

    return {
      sessionId: session.sessionId,
      candidateId: session.candidateId.toString(),
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}
