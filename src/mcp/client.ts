import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { logger } from '../logger';
import type {
  McpServerConfig,
  McpServerStatus,
  McpToolSchema,
  McpToolCallParams,
  McpToolCallResult,
  McpInitializeResult,
} from './types';

/**
 * MCP客户端类
 * 负责与单个MCP服务器进程通信
 */
export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private _status: McpServerStatus = 'idle';
  private _tools: McpToolSchema[] = [];
  private _serverInfo: { name: string; version: string } | null = null;

  constructor(
    private readonly serverName: string,
    private readonly config: McpServerConfig,
  ) {}

  /**
   * 获取当前状态
   */
  get status(): McpServerStatus {
    return this._status;
  }

  /**
   * 获取可用工具列表
   */
  get tools(): McpToolSchema[] {
    return this._tools;
  }

  /**
   * 获取服务器信息
   */
  get serverInfo(): { name: string; version: string } | null {
    return this._serverInfo;
  }

  /**
   * 启动并连接MCP服务器
   */
  async start(): Promise<void> {
    if (this._status === 'ready' || this._status === 'starting') {
      logger.warn('MCP服务器已在运行或正在启动', { serverName: this.serverName });
      return;
    }

    try {
      this._status = 'starting';
      logger.info('🚀 正在启动MCP服务器', {
        serverName: this.serverName,
        command: this.config.command,
        args: this.config.args,
      });

      // 创建stdio传输层
      const envVars: Record<string, string> = {};

      // 复制process.env，过滤undefined值
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          envVars[key] = value;
        }
      }

      // 添加自定义环境变量
      if (this.config.env) {
        Object.assign(envVars, this.config.env);
      }

      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args ?? [],
        env: envVars,
        stderr: 'pipe', // 捕获stderr用于日志
      });

      // 监听stderr输出
      if (this.transport.stderr) {
        this.transport.stderr.on('data', (data: Buffer) => {
          const message = data.toString().trim();
          if (message) {
            logger.debug(`MCP服务器stderr [${this.serverName}]`, { message });
          }
        });
      }

      // 创建MCP客户端
      this.client = new Client(
        {
          name: 'simpleaiapi',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );

      // 连接到服务器
      await this.client.connect(this.transport);

      // 获取服务器信息和能力
      const initResult = (await this.client.request({
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: 'simpleaiapi',
            version: '1.0.0',
          },
        },
      }, z.record(z.unknown()))) as unknown as McpInitializeResult;

      this._serverInfo = initResult.serverInfo;

      // 发送initialized通知
      await this.client.notification({
        method: 'notifications/initialized',
      });

      // 获取工具列表
      await this.refreshTools();

      this._status = 'ready';
      logger.info('✅ MCP服务器已就绪', {
        serverName: this.serverName,
        serverInfo: this._serverInfo,
        toolCount: this._tools.length,
      });
    } catch (error) {
      this._status = 'error';
      logger.error('❌ MCP服务器启动失败', {
        serverName: this.serverName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 刷新工具列表
   */
  private async refreshTools(): Promise<void> {
    if (!this.client) {
      throw new Error('MCP客户端未初始化');
    }

    try {
      const result = await this.client.request({
        method: 'tools/list',
      }, z.record(z.unknown()));

      if (result && typeof result === 'object' && 'tools' in result) {
        this._tools = (result.tools as McpToolSchema[]) ?? [];
        logger.debug('已获取MCP工具列表', {
          serverName: this.serverName,
          toolCount: this._tools.length,
          toolNames: this._tools.map((t) => t.name),
        });
      } else {
        this._tools = [];
        logger.warn('MCP服务器未返回工具列表', { serverName: this.serverName });
      }
    } catch (error) {
      logger.error('获取MCP工具列表失败', {
        serverName: this.serverName,
        error: (error as Error).message,
      });
      this._tools = [];
    }
  }

  /**
   * 调用MCP工具
   */
  async callTool(params: McpToolCallParams): Promise<McpToolCallResult> {
    if (this._status !== 'ready' || !this.client) {
      throw new Error(`MCP服务器未就绪: ${this.serverName}`);
    }

    try {
      logger.info('🔧 调用MCP工具', {
        serverName: this.serverName,
        toolName: params.name,
        arguments: params.arguments,
      });

      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: params.name,
          arguments: params.arguments ?? {},
        },
      }, z.record(z.unknown()));

      if (!result || typeof result !== 'object') {
        throw new Error('MCP工具返回了无效的结果');
      }

      const toolResult = result as unknown as McpToolCallResult;

      logger.info('✅ MCP工具调用成功', {
        serverName: this.serverName,
        toolName: params.name,
        isError: toolResult.isError,
        contentLength: toolResult.content?.length ?? 0,
      });

      return toolResult;
    } catch (error) {
      logger.error('❌ MCP工具调用失败', {
        serverName: this.serverName,
        toolName: params.name,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 停止MCP服务器
   */
  async stop(): Promise<void> {
    if (this._status === 'stopped' || this._status === 'idle') {
      return;
    }

    try {
      logger.info('🛑 正在停止MCP服务器', { serverName: this.serverName });

      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      this._status = 'stopped';
      this._tools = [];
      this._serverInfo = null;

      logger.info('✅ MCP服务器已停止', { serverName: this.serverName });
    } catch (error) {
      logger.error('停止MCP服务器时发生错误', {
        serverName: this.serverName,
        error: (error as Error).message,
      });
      this._status = 'error';
    }
  }

  /**
   * 检查服务器是否健康
   */
  isHealthy(): boolean {
    return this._status === 'ready' && this.client !== null && this.transport !== null;
  }
}
