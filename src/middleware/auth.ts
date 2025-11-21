import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../logger';

const parseBearer = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null;
  }
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  const value = match?.[1];
  return value ? value.trim() : null;
};

export const authenticateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const headerValue = req.header('authorization') ?? undefined;
  const token = parseBearer(headerValue);
  if (!token || !config.authTokens.includes(token)) {
    logger.warn('身份验证失败', { path: req.path });
    res.status(401).json({ error: 'Bad auth token' });
    return;
  }
  next();
};
