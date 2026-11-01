import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';

export interface AuthUser {
  id: number;
  role: 'particulier' | 'professionnel' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, { expiresIn: '7d' });
}

function readToken(req: Request): AuthUser | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    return { id: Number(payload.sub), role: payload.role };
  } catch {
    throw new HttpError(401, 'Session expirée, veuillez vous reconnecter');
  }
}

/** Ajoute req.user si un jeton valide est présent, sans l'exiger. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readToken(req);
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readToken(req);
  if (!req.user) throw new HttpError(401, 'Connexion requise');
  next();
}
