"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.adminMiddleware = adminMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-prod';
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role || 'user',
            plan: decoded.plan || 'free',
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
function adminMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access forbidden: Admin credentials required' });
    }
    next();
}
/**
 * optionalAuthMiddleware — attaches req.user if a valid Bearer token is
 * present, but NEVER blocks the request.  Use this on endpoints (e.g.
 * /transcribe) that should work both for logged-in users AND for the
 * Electron desktop overlay running without an active session.
 */
function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role || 'user',
                plan: decoded.plan || 'free',
            };
        }
        catch {
            // Token is present but invalid — treat as unauthenticated (don't block)
        }
    }
    next();
}
