import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';
import type { ChatCompletionRequest } from './messageBuilder';

interface ChoiceMessage {
  role: string;
  content: string | Array<{ type: string; text?: string }>;
}

interface ChatCompletionResponse {
  choices: Array<{
    index: number;
    message: ChoiceMessage;
    finish_reason: string;
  }>;
}

const httpClient = axios.create({
  baseURL: config.upstreamBaseUrl.replace(/\/$/, ''),
  timeout: config.requestTimeoutMs,
});

let keyIndex = 0;
const pickApiKey = (): string => {
  const key = config.upstreamApiKeys[keyIndex % config.upstreamApiKeys.length];
  keyIndex = (keyIndex + 1) % config.upstreamApiKeys.length;
  if (!key) {
    throw new Error('未找到可用的上游 API Key');
  }
  return key;
};

export const requestChatCompletion = async (payload: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
  const apiKey = pickApiKey();
  try {
    const response = await httpClient.post<ChatCompletionResponse>('/chat/completions', payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    logger.info('已成功转发请求至上游模型', {
      model: payload.model,
      usageChoices: response.data.choices.length,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('上游模型响应错误', {
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        error.response?.data?.error?.message ??
          `Upstream request failed with status ${error.response?.status ?? 'unknown'}`,
      );
    }
    logger.error('上游未知错误', { message: (error as Error).message });
    throw error;
  }
};
