import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import { AuthenticatedRequest } from '../types/index.js';

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  } else if (req.query && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return next(new UnauthorizedError('Missing or malformed Authorization token'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string; role: string };
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err: any) {
    console.error("JWT Verification error in middleware:", err.message, err);
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Access token expired'));
    }
    return next(new UnauthorizedError('Invalid access token'));
  }
}

export function requireRole(allowedRole: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('User must be authenticated'));
    }

    if (req.user.role !== allowedRole) {
      return next(new ForbiddenError('Access denied: insufficient permissions'));
    }

    next();
  };
}
