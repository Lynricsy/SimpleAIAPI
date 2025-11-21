import { config } from '../config';
import { logger } from '../logger';
import type { ParsedUserMessage, RawProxyPayload, RenderMode } from '../types/payload';
import { isDataUriImage, saveDataUriImage } from '../utils/imageStore';

const imageExtensionRegex = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i;

const isStandaloneImageUrl = (value: string): boolean => {
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return false;
  }
  return imageExtensionRegex.test(value);
};

const parseRenderMode = (value: unknown): RenderMode => {
  if (value === true) {
    return 'inline-html';
  }
  if (value === false || value === undefined || value === null) {
    return 'text';
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['html', 'inline', 'inline-html'].includes(normalized)) {
      return 'inline-html';
    }
    if (['page', 'hosted', 'url', 'link', 'view'].includes(normalized)) {
      return 'hosted-page';
    }
    if (['markdown', 'md', 'text', 'plain'].includes(normalized)) {
      return 'text';
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'inline-html' : 'text';
  }
  return 'text';
};

const normalizeMessageValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0)
      .join('\n');
  }
  if (value && typeof value === 'object' && 'content' in value) {
    const possible = (value as Record<string, unknown>).content;
    return typeof possible === 'string' ? possible.trim() : null;
  }
  return null;
};

export interface ParsedPayload {
  model: string;
  system?: string;
  renderMode: RenderMode;
  messages: ParsedUserMessage[];
}

export const parseProxyPayload = async (body: RawProxyPayload): Promise<ParsedPayload> => {
  const model = typeof body.model === 'string' && body.model.trim().length > 0 ? body.model : config.defaultModel;
  const system = typeof body.system === 'string' && body.system.trim().length > 0 ? body.system.trim() : undefined;
  const renderMode = parseRenderMode(body.render);

  const numericKeys = Object.keys(body).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
  const messages: ParsedUserMessage[] = [];

  for (const key of numericKeys) {
    const normalized = normalizeMessageValue(body[key]);
    if (!normalized) {
      continue;
    }
    if (isDataUriImage(normalized)) {
      const relativePath = await saveDataUriImage(normalized);
      logger.info('已接收并保存 Base64 图片', { slot: key, path: relativePath });
      messages.push({ kind: 'image', url: relativePath });
    } else if (isStandaloneImageUrl(normalized)) {
      messages.push({ kind: 'image', url: normalized });
    } else {
      messages.push({ kind: 'text', text: normalized });
    }
  }

  if (messages.length === 0) {
    throw new Error('缺少用户消息，请至少提供一条数字键的内容');
  }

  const parsed: ParsedPayload = {
    model,
    renderMode,
    messages,
  };
  if (system) {
    parsed.system = system;
  }
  return parsed;
};
