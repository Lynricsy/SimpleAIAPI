import dotenv from 'dotenv';
import type { McpToolDefinition } from './types/mcp';
import { loadMcpTools } from './utils/mcpLoader';

dotenv.config();

const toList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const toNumber = (value: string | undefined, fallback?: number): number | undefined => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
};

export interface AppConfig {
  port: number;
  authTokens: string[];
  upstreamBaseUrl: string;
  upstreamApiKeys: string[];
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  requestTimeoutMs: number;
  publicBaseUrl?: string;
  imageRetentionDays?: number;
  imageCleanupIntervalMinutes: number;
  logAssistantResponses: boolean;
  sanitizeHtmlEnabled: boolean;
  mcpTools: McpToolDefinition[];
}

const authTokens = toList(process.env.AUTH_TOKENS);
if (authTokens.length === 0) {
  throw new Error('环境变量 AUTH_TOKENS 尚未配置，无法校验入口请求');
}

const upstreamApiKeys = toList(process.env.UPSTREAM_API_KEYS);
if (upstreamApiKeys.length === 0) {
  throw new Error('环境变量 UPSTREAM_API_KEYS 尚未配置，无法调用上游模型');
}

const upstreamBaseUrl = process.env.UPSTREAM_BASE_URL ?? 'https://api.openai.com/v1';
const defaultModel = process.env.DEFAULT_MODEL ?? 'gpt-4o-mini';

const optionalNumbers: Partial<
  Pick<AppConfig, 'temperature' | 'maxTokens' | 'topP' | 'frequencyPenalty' | 'presencePenalty'>
> = {};

const temperature = toNumber(process.env.TEMPERATURE);
if (temperature !== undefined) {
  optionalNumbers.temperature = temperature;
}
const maxTokens = toNumber(process.env.MAX_TOKENS);
if (maxTokens !== undefined) {
  optionalNumbers.maxTokens = maxTokens;
}
const topP = toNumber(process.env.TOP_P);
if (topP !== undefined) {
  optionalNumbers.topP = topP;
}
const frequencyPenalty = toNumber(process.env.FREQUENCY_PENALTY);
if (frequencyPenalty !== undefined) {
  optionalNumbers.frequencyPenalty = frequencyPenalty;
}
const presencePenalty = toNumber(process.env.PRESENCE_PENALTY);
if (presencePenalty !== undefined) {
  optionalNumbers.presencePenalty = presencePenalty;
}

const retentionDaysRaw = toNumber(process.env.IMAGE_RETENTION_DAYS, 7);
const imageRetentionDays =
  retentionDaysRaw !== undefined && retentionDaysRaw > 0 ? retentionDaysRaw : undefined;

const cleanupIntervalRaw = toNumber(process.env.IMAGE_CLEANUP_INTERVAL_MINUTES, 60) ?? 60;
const imageCleanupIntervalMinutes = cleanupIntervalRaw > 0 ? cleanupIntervalRaw : 60;
const logAssistantResponses = toBoolean(process.env.LOG_ASSISTANT_RESPONSES, false);
const sanitizeHtmlEnabled = toBoolean(process.env.SANITIZE_HTML, true);
const mcpTools = loadMcpTools();

export const config: AppConfig = {
  port: Number(process.env.PORT ?? '8080'),
  authTokens,
  upstreamApiKeys,
  upstreamBaseUrl,
  defaultModel,
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? '60000'),
  imageCleanupIntervalMinutes,
  logAssistantResponses,
  sanitizeHtmlEnabled,
  mcpTools,
  ...(process.env.PUBLIC_BASE_URL ? { publicBaseUrl: process.env.PUBLIC_BASE_URL } : {}),
  ...(imageRetentionDays ? { imageRetentionDays } : {}),
  ...optionalNumbers,
};
