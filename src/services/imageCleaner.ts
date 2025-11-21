import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../logger';
import { IMAGE_DIRECTORY } from '../utils/imageStore';
import { isImageProtected } from '../utils/protectedImages';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;

const sweepExpiredImages = async (): Promise<number> => {
  if (!config.imageRetentionDays) {
    return 0;
  }
  const now = Date.now();
  const ttl = config.imageRetentionDays * DAY_IN_MS;
  let deleted = 0;
  const entries = await fs.readdir(IMAGE_DIRECTORY, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const filePath = path.join(IMAGE_DIRECTORY, entry.name);
    try {
      if (isImageProtected(entry.name)) {
        continue;
      }
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs >= ttl) {
        await fs.unlink(filePath);
        deleted += 1;
        logger.info('🧹 已删除过期图片', { file: entry.name });
      }
    } catch (error) {
      logger.warn('无法处理图片文件', { file: entry.name, message: (error as Error).message });
    }
  }
  return deleted;
};

export const scheduleImageCleanup = (): void => {
  if (!config.imageRetentionDays) {
    logger.info('图片清理功能未启用', { reason: 'IMAGE_RETENTION_DAYS <= 0' });
    return;
  }
  const intervalMs = config.imageCleanupIntervalMinutes * MINUTE_IN_MS;
  const execute = async (): Promise<void> => {
    try {
      const deleted = await sweepExpiredImages();
      logger.info('🧼 图片清理完成', {
        deleted,
        retentionDays: config.imageRetentionDays,
      });
    } catch (error) {
      logger.error('图片清理执行失败', { message: (error as Error).message });
    }
  };

  void execute();
  const timer = setInterval(() => {
    void execute();
  }, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
};
