// MCP (Model Context Protocol) 相关类型定义

/**
 * MCP服务器配置
 */
export interface McpServerConfig {
  /** 启动命令 (如 "npx", "bunx", "node") */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 工作目录 */
  cwd?: string;
  /** 传输类型 (当前仅支持stdio) */
  transport?: 'stdio';
  /** 需要确认的工具列表 */
  requires_confirmation?: string[];
  /** 服务器描述 */
  description?: string;
}

/**
 * MCP配置文件格式
 */
export interface McpConfigFile {
  version?: string;
  systemPrompt?: string;
  mcpServers?: Record<string, McpServerConfig>;
}

/**
 * MCP服务器状态
 */
export type McpServerStatus = 'idle' | 'starting' | 'ready' | 'error' | 'stopped';

/**
 * JSON-RPC 2.0 请求
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 响应
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 通知 (无需响应)
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

/**
 * MCP初始化参数
 */
export interface McpInitializeParams {
  protocolVersion: string;
  capabilities: {
    roots?: { listChanged?: boolean };
    sampling?: Record<string, unknown>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP初始化响应
 */
export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
    logging?: Record<string, unknown>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP工具定义 (从MCP服务器获取)
 */
export interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * OpenAI Function格式的工具定义
 */
export interface OpenAiFunction {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * MCP工具调用参数
 */
export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * MCP工具调用结果
 */
export interface McpToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * OpenAI Tool Call格式
 */
export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON字符串
  };
}

/**
 * OpenAI Tool Call响应格式
 */
export interface OpenAiToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}
