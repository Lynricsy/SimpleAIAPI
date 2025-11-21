import type { OpenAiToolCall, OpenAiToolMessage } from '../mcp/types';

/**
 * 格式化单个工具调用（带折叠功能）
 */
function formatSingleToolCall(toolCall: OpenAiToolCall, toolResult?: OpenAiToolMessage): string {
  const toolName = toolCall.function.name;
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch {
    args = { raw: toolCall.function.arguments };
  }

  const argsStr = Object.entries(args)
    .map(([key, value]) => `  - **${key}**: ${JSON.stringify(value)}`)
    .join('\n');

  let output = `### 🔧 工具调用: \`${toolName}\`\n\n`;

  // 参数折叠
  output += `<details>\n<summary><strong>📋 查看参数</strong></summary>\n\n${argsStr}\n\n</details>\n\n`;

  // 结果折叠
  if (toolResult) {
    const isError =
      toolResult.content.startsWith('[错误]') || toolResult.content.startsWith('[执行失败]');

    if (isError) {
      output += `<details>\n<summary><strong>❌ 执行失败 - 点击查看详情</strong></summary>\n\n\`\`\`\n${toolResult.content}\n\`\`\`\n\n</details>\n\n`;
    } else {
      output += `<details>\n<summary><strong>✅ 执行成功 - 点击查看结果</strong></summary>\n\n\`\`\`\n${toolResult.content}\n\`\`\`\n\n</details>\n\n`;
    }
  }

  return output;
}

/**
 * 格式化完整的工具调用过程
 * @param messages 完整对话历史
 * @returns Markdown格式的工具调用过程
 */
export function formatToolCallsHistory(
  messages: Array<
    | { role: string; content: unknown }
    | { role: 'assistant'; content: string | null; tool_calls: OpenAiToolCall[] }
    | OpenAiToolMessage
  >,
): string {
  let output = '';
  let roundNumber = 0;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    // 跳过空消息
    if (!message) {
      continue;
    }

    // 检测assistant消息中的tool_calls
    if ('tool_calls' in message && message.tool_calls && message.tool_calls.length > 0) {
      roundNumber++;
      if (roundNumber > 1) {
        output += `---\n\n`;
      }
      output += `## 🔄 第 ${roundNumber} 轮工具调用\n\n`;

      // 遍历所有tool_calls
      for (const toolCall of message.tool_calls) {
        // 查找对应的tool result
        const toolResult = messages
          .slice(i + 1)
          .find(
            (m): m is OpenAiToolMessage =>
              'tool_call_id' in m && m.tool_call_id === toolCall.id,
          );

        output += formatSingleToolCall(toolCall, toolResult);
      }
    }
  }

  return output;
}

/**
 * 判断响应中是否包含工具调用
 */
export function hasToolCalls(
  messages?: Array<
    | { role: string; content: unknown }
    | { role: 'assistant'; content: string | null; tool_calls?: OpenAiToolCall[] }
    | OpenAiToolMessage
  >,
): boolean {
  if (!messages || messages.length === 0) {
    return false;
  }

  return messages.some((msg) => msg && 'tool_calls' in msg && msg.tool_calls && msg.tool_calls.length > 0);
}
