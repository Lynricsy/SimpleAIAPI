import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  logger.http('🛬 收到请求', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('🛫 响应完成', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    });
  });

  next();
};
