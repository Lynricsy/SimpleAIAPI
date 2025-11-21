import type { Request } from 'express';
import { config } from '../config';
import type { ParsedPayload } from './payloadParser';
import { buildPublicAssetUrl } from '../utils/urlBuilder';
import type { ParsedUserMessage } from '../types/payload';

export type ChatCompletionContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface ChatCompletionMessage {
  role: 'system' | 'user';
  content: ChatCompletionContent;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

const toOpenAiContent = (message: ParsedUserMessage, req: Request): ChatCompletionContent => {
  if (message.kind === 'text') {
    return message.text;
  }
  const absoluteUrl = message.url.startsWith('/')
    ? buildPublicAssetUrl(message.url, req)
    : message.url;
  return [
    {
      type: 'image_url' as const,
      image_url: { url: absoluteUrl },
    },
  ];
};

export const buildChatCompletionRequest = (payload: ParsedPayload, req: Request): ChatCompletionRequest => {
  const messages: ChatCompletionMessage[] = [];
  if (payload.system) {
    messages.push({
      role: 'system',
      content: payload.system,
    });
  }
  for (const message of payload.messages) {
    messages.push({
      role: 'user',
      content: toOpenAiContent(message, req),
    });
  }

  const request: ChatCompletionRequest = {
    model: payload.model,
    messages,
  };

  if (config.temperature !== undefined) {
    request.temperature = config.temperature;
  }
  if (config.maxTokens !== undefined) {
    request.max_tokens = config.maxTokens;
  }
  if (config.topP !== undefined) {
    request.top_p = config.topP;
  }
  if (config.frequencyPenalty !== undefined) {
    request.frequency_penalty = config.frequencyPenalty;
  }
  if (config.presencePenalty !== undefined) {
    request.presence_penalty = config.presencePenalty;
  }

  return request;
};
