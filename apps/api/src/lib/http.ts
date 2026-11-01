import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'Certains champs sont invalides',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'Photo trop lourde (8 Mo maximum)',
      LIMIT_FILE_COUNT: '20 photos maximum par annonce',
    };
    return res.status(400).json({ error: messages[err.code] ?? err.message });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Violation de contrainte d'unicité PostgreSQL
  if ((err as { code?: string })?.code === '23505') {
    return res.status(409).json({ error: 'Cette ressource existe déjà' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}
