import { logger } from '../logger';
import { mcpManager } from './manager';
import type { OpenAiFunction, McpToolSchema, OpenAiToolCall, OpenAiToolMessage, McpToolCallResult } from './types';

/**
 * 将MCP工具转换为OpenAI Function格式
 */
export function convertMcpToolToOpenAiFunction(tool: McpToolSchema): OpenAiFunction {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? `MCP工具: ${tool.name}`,
      parameters: {
        type: 'object',
        properties: tool.inputSchema.properties ?? {},
        required: tool.inputSchema.required ?? [],
      },
    },
  };
}

/**
 * 获取所有MCP工具的OpenAI Function格式列表
 */
export function getAllMcpToolsAsOpenAiFunctions(): OpenAiFunction[] {
  const allTools = mcpManager.getAllTools();

  if (allTools.length === 0) {
    logger.debug('当前没有可用的MCP工具');
    return [];
  }

  const functions = allTools.map((item) => convertMcpToolToOpenAiFunction(item.tool));

  logger.debug('已转换MCP工具为OpenAI Function格式', {
    toolCount: functions.length,
    tools: functions.map((f) => f.function.name),
  });

  return functions;
}

/**
 * 执行单个MCP工具调用
 */
async function executeSingleToolCall(toolCall: OpenAiToolCall): Promise<OpenAiToolMessage> {
  const toolName = toolCall.function.name;

  try {
    logger.info('🔧 执行MCP工具调用', {
      toolCallId: toolCall.id,
      toolName,
    });

    // 解析参数
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch (parseError) {
      throw new Error(`工具参数解析失败: ${(parseError as Error).message}`);
    }

    // 调用MCP工具
    const result: McpToolCallResult = await mcpManager.callTool(toolName, args);

    // 将MCP结果转换为字符串内容
    let content = '';

    if (result.isError) {
      content = `[错误] ${extractTextFromMcpResult(result)}`;
    } else {
      content = extractTextFromMcpResult(result);
    }

    logger.info('✅ MCP工具调用完成', {
      toolCallId: toolCall.id,
      toolName,
      isError: result.isError,
      contentLength: content.length,
    });

    return {
      role: 'tool',
      content,
      tool_call_id: toolCall.id,
    };
  } catch (error) {
    logger.error('❌ MCP工具调用失败', {
      toolCallId: toolCall.id,
      toolName,
      error: (error as Error).message,
    });

    return {
      role: 'tool',
      content: `[执行失败] ${(error as Error).message}`,
      tool_call_id: toolCall.id,
    };
  }
}

/**
 * 从MCP结果中提取文本内容
 */
function extractTextFromMcpResult(result: McpToolCallResult): string {
  if (!result.content || result.content.length === 0) {
    return '(工具返回空结果)';
  }

  const textParts: string[] = [];

  for (const item of result.content) {
    if (item.type === 'text' && item.text) {
      textParts.push(item.text);
    } else if (item.type === 'resource' && item.text) {
      textParts.push(`[资源] ${item.text}`);
    } else if (item.type === 'image' && item.data) {
      textParts.push(`[图片数据: ${item.mimeType ?? 'unknown'}]`);
    }
  }

  return textParts.join('\n\n') || '(工具返回无可读内容)';
}

/**
 * 执行多个MCP工具调用（并行执行）
 */
export async function executeMcpToolCalls(toolCalls: OpenAiToolCall[]): Promise<OpenAiToolMessage[]> {
  if (toolCalls.length === 0) {
    return [];
  }

  logger.info('🚀 开始批量执行MCP工具调用', {
    count: toolCalls.length,
    tools: toolCalls.map((tc) => tc.function.name),
  });

  // 并行执行所有工具调用
  const results = await Promise.all(toolCalls.map((tc) => executeSingleToolCall(tc)));

  logger.info('✅ MCP工具批量调用完成', {
    count: results.length,
    successCount: results.filter((r) => !r.content.startsWith('[错误]') && !r.content.startsWith('[执行失败]'))
      .length,
  });

  return results;
}
