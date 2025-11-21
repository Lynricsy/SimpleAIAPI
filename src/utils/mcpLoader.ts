import fs from 'fs';
import path from 'path';
import { logger } from '../logger';
import type { McpConfigFile, McpServerDefinition, McpToolDefinition } from '../types/mcp';

const CONFIG_FILENAME = 'MCP.json';

const hasValidCommand = (server: McpServerDefinition | undefined): server is McpServerDefinition => {
  return Boolean(server?.command && typeof server.command === 'string' && server.command.trim().length > 0);
};

const sanitizeToolList = (tools: unknown): McpToolDefinition[] => {
  if (!Array.isArray(tools)) {
    return [];
  }
  return tools
    .filter((tool): tool is McpToolDefinition => {
      return (
        Boolean(tool) &&
        typeof (tool as McpToolDefinition).server_name === 'string' &&
        (tool as McpToolDefinition).server_name.trim().length > 0 &&
        (tool as McpToolDefinition).type === 'mcp' &&
        hasValidCommand((tool as McpToolDefinition).server_config)
      );
    })
    .map((tool) => ({
      ...tool,
      server_name: tool.server_name.trim(),
      server_config: {
        ...tool.server_config,
        command: tool.server_config.command.trim(),
      },
    }));
};

const buildToolsFromServers = (servers: Record<string, McpServerDefinition> | undefined): McpToolDefinition[] => {
  if (!servers) {
    return [];
  }
  const result: McpToolDefinition[] = [];
  for (const [name, server] of Object.entries(servers)) {
    if (!hasValidCommand(server)) {
      logger.warn('跳过无效的 MCP 服务器配置', { name });
      continue;
    }
    result.push({
      type: 'mcp',
      server_name: name,
      server_config: {
        ...server,
        command: server.command.trim(),
      },
    });
  }
  return result;
};

export const loadMcpTools = (): McpToolDefinition[] => {
  const filePath = path.resolve(process.cwd(), CONFIG_FILENAME);
  if (!fs.existsSync(filePath)) {
    logger.debug('未检测到 MCP.json，默认关闭 MCP 工具注入');
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as McpConfigFile;
    const explicitTools = sanitizeToolList(parsed.tools);
    if (explicitTools.length > 0) {
      logger.info('已从 MCP.json 中载入显式工具配置', { count: explicitTools.length });
      return explicitTools;
    }
    const derived = buildToolsFromServers(parsed.mcpServers);
    if (derived.length > 0) {
      logger.info('已根据 MCP 服务器生成工具配置', { count: derived.length });
    } else {
      logger.warn('MCP.json 中未找到可用的工具配置');
    }
    return derived;
  } catch (error) {
    logger.error('MCP.json 解析失败', { message: (error as Error).message });
    return [];
  }
};
