export interface McpServerDefinition {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'sse' | 'websocket';
  requires_confirmation?: string[];
  description?: string;
}

export interface McpToolDefinition {
  type: 'mcp';
  server_name: string;
  server_config: McpServerDefinition;
  scope?: string;
}

export interface McpConfigFile {
  version?: string;
  systemPrompt?: string;
  llm?: Record<string, unknown>;
  mcpServers?: Record<string, McpServerDefinition>;
  tools?: McpToolDefinition[];
}
