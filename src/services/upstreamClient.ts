import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';
import type { ChatCompletionRequest, ChatCompletionMessage } from './messageBuilder';
import type { OpenAiToolCall, OpenAiToolMessage } from '../mcp/types';
import { executeMcpToolCalls } from '../mcp/toolConverter';

/**
 * 上游响应的消息类型
 */
interface ChoiceMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAiToolCall[];
}

/**
 * 上游响应类型
 */
interface ChatCompletionResponse {
  choices: Array<{
    index: number;
    message: ChoiceMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * 扩展的响应类型，包含完整对话历史
 */
export interface ExtendedChatCompletionResponse extends ChatCompletionResponse {
  /** 完整的对话历史（包括所有tool_calls和结果） */
  fullMessages?: Array<ChatCompletionMessage | { role: 'assistant'; content: string | null; tool_calls: OpenAiToolCall[] } | OpenAiToolMessage>;
  /** 对话轮数 */
  conversationRounds?: number;
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

/**
 * 发送单次请求到上游API
 */
async function sendSingleRequest(payload: ChatCompletionRequest, apiKey: string): Promise<ChatCompletionResponse> {
  try {
    const response = await httpClient.post<ChatCompletionResponse>('/chat/completions', payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
}

/**
 * 处理带tool_calls的多轮对话
 * @param payload 初始请求
 * @param maxRounds 最大轮次（防止无限循环）
 */
export const requestChatCompletion = async (
  payload: ChatCompletionRequest,
  maxRounds = 5,
): Promise<ExtendedChatCompletionResponse> => {
  const apiKey = pickApiKey();
  let currentPayload = { ...payload };
  let roundCount = 0;
  let allMessages: Array<ChatCompletionMessage | { role: 'assistant'; content: string | null; tool_calls: OpenAiToolCall[] } | OpenAiToolMessage> = [...payload.messages];

  while (roundCount < maxRounds) {
    roundCount++;

    logger.info('🔄 发送请求到上游模型', {
      model: currentPayload.model,
      round: roundCount,
      messageCount: currentPayload.messages.length,
      hasTools: Boolean(currentPayload.tools && currentPayload.tools.length > 0),
    });

    // 发送请求
    const response = await sendSingleRequest(currentPayload, apiKey);

    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('上游响应中没有choices');
    }

    const finishReason = choice.finish_reason;
    const message = choice.message;

    logger.info('✅ 上游模型响应完成', {
      finishReason,
      hasContent: Boolean(message.content),
      hasToolCalls: Boolean(message.tool_calls && message.tool_calls.length > 0),
      round: roundCount,
    });

    // 如果不是tool_calls，直接返回结果
    if (finishReason !== 'tool_calls' || !message.tool_calls || message.tool_calls.length === 0) {
      logger.info('📨 完成对话，返回最终结果', {
        totalRounds: roundCount,
        finishReason,
      });

      // 返回扩展响应，包含完整对话历史
      const extendedResponse: ExtendedChatCompletionResponse = {
        ...response,
        conversationRounds: roundCount,
      };

      if (roundCount > 1) {
        extendedResponse.fullMessages = allMessages;
      }

      return extendedResponse;
    }

    // 执行tool_calls
    logger.info('🔧 检测到tool_calls，开始执行工具调用', {
      toolCallCount: message.tool_calls.length,
      tools: message.tool_calls.map((tc) => tc.function.name),
    });

    const toolResults: OpenAiToolMessage[] = await executeMcpToolCalls(message.tool_calls);

    // 将assistant的消息和tool结果添加到消息历史
    const assistantMessage = {
      role: 'assistant' as const,
      content: message.content,
      tool_calls: message.tool_calls,
    };

    allMessages = [...allMessages, assistantMessage, ...toolResults];

    const newMessages: Array<ChatCompletionMessage | { role: 'assistant'; content: string | null; tool_calls: OpenAiToolCall[] } | OpenAiToolMessage> = [
      ...currentPayload.messages,
      assistantMessage,
      ...toolResults,
    ];

    // 更新payload，继续下一轮对话
    currentPayload = {
      ...currentPayload,
      messages: newMessages as ChatCompletionMessage[],
    };

    logger.info('✨ 工具执行完成，继续下一轮对话', {
      currentRound: roundCount,
      maxRounds,
      newMessageCount: newMessages.length,
    });
  }

  // 达到最大轮次
  logger.warn('⚠️ 达到最大对话轮次，终止tool_calls循环', {
    maxRounds,
  });

  throw new Error(`对话已达到最大轮次限制 (${maxRounds})，可能存在tool_calls循环`);
};
