import type { Request } from 'express';
import { config } from '../config';

export const buildPublicAssetUrl = (relativePath: string, req: Request): string => {
  const normalizedBase = (config.publicBaseUrl ?? `${req.protocol}://${req.get('host') ?? ''}`).replace(/\/$/, '');
  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${normalizedBase}${normalizedPath}`;
};
