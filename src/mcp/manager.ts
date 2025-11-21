import fs from 'fs';
import path from 'path';
import { logger } from '../logger';
import { McpClient } from './client';
import type { McpConfigFile, McpToolSchema, McpToolCallParams, McpToolCallResult } from './types';

/**
 * MCP管理器
 * 负责管理所有MCP服务器客户端
 */
export class McpManager {
  private clients: Map<string, McpClient> = new Map();
  private initialized = false;

  /**
   * 从MCP.json加载配置并初始化所有服务器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('MCP管理器已初始化');
      return;
    }

    const configPath = path.resolve(process.cwd(), 'MCP.json');

    if (!fs.existsSync(configPath)) {
      logger.info('📋 未检测到 MCP.json，跳过MCP服务器初始化');
      this.initialized = true;
      return;
    }

    try {
      logger.info('📋 正在加载 MCP.json 配置...');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent) as McpConfigFile;

      if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        logger.warn('MCP.json 中未配置任何服务器');
        this.initialized = true;
        return;
      }

      // 启动所有配置的MCP服务器
      const startPromises: Promise<void>[] = [];

      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        if (!serverConfig.command) {
          logger.warn('跳过无效的MCP服务器配置', { serverName });
          continue;
        }

        const client = new McpClient(serverName, serverConfig);
        this.clients.set(serverName, client);

        // 并行启动所有服务器
        startPromises.push(
          client.start().catch((error) => {
            logger.error('MCP服务器启动失败', {
              serverName,
              error: (error as Error).message,
            });
            // 启动失败的客户端从列表中移除
            this.clients.delete(serverName);
          }),
        );
      }

      // 等待所有服务器启动完成
      await Promise.all(startPromises);

      const successCount = this.clients.size;
      const totalCount = Object.keys(config.mcpServers).length;

      if (successCount > 0) {
        logger.info('✨ MCP管理器初始化完成', {
          successCount,
          totalCount,
          servers: Array.from(this.clients.keys()),
        });
      } else {
        logger.warn('⚠️ 没有成功启动任何MCP服务器');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('❌ MCP管理器初始化失败', {
        error: (error as Error).message,
      });
      this.initialized = true; // 即使失败也标记为已初始化，避免重复尝试
      throw error;
    }
  }

  /**
   * 获取所有可用的工具列表
   */
  getAllTools(): Array<{ serverName: string; tool: McpToolSchema }> {
    const allTools: Array<{ serverName: string; tool: McpToolSchema }> = [];

    for (const [serverName, client] of this.clients.entries()) {
      if (!client.isHealthy()) {
        continue;
      }

      for (const tool of client.tools) {
        allTools.push({
          serverName,
          tool,
        });
      }
    }

    return allTools;
  }

  /**
   * 根据工具名称查找对应的服务器
   */
  private findServerByToolName(toolName: string): { serverName: string; client: McpClient } | null {
    for (const [serverName, client] of this.clients.entries()) {
      if (!client.isHealthy()) {
        continue;
      }

      const hasTool = client.tools.some((t) => t.name === toolName);
      if (hasTool) {
        return { serverName, client };
      }
    }

    return null;
  }

  /**
   * 调用MCP工具
   * @param toolName 工具名称
   * @param args 工具参数
   */
  async callTool(toolName: string, args?: Record<string, unknown>): Promise<McpToolCallResult> {
    const server = this.findServerByToolName(toolName);

    if (!server) {
      throw new Error(`未找到提供工具 "${toolName}" 的MCP服务器`);
    }

    const params: McpToolCallParams = {
      name: toolName,
      arguments: args ?? {},
    };

    return await server.client.callTool(params);
  }

  /**
   * 获取所有健康的服务器列表
   */
  getHealthyServers(): string[] {
    return Array.from(this.clients.entries())
      .filter(([_, client]) => client.isHealthy())
      .map(([serverName]) => serverName);
  }

  /**
   * 获取服务器数量统计
   */
  getStats(): { total: number; healthy: number; toolCount: number } {
    const total = this.clients.size;
    const healthy = this.getHealthyServers().length;
    const toolCount = this.getAllTools().length;

    return { total, healthy, toolCount };
  }

  /**
   * 停止所有MCP服务器
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 正在关闭所有MCP服务器...');

    const shutdownPromises: Promise<void>[] = [];

    for (const [serverName, client] of this.clients.entries()) {
      shutdownPromises.push(
        client.stop().catch((error) => {
          logger.error('停止MCP服务器失败', {
            serverName,
            error: (error as Error).message,
          });
        }),
      );
    }

    await Promise.all(shutdownPromises);
    this.clients.clear();
    this.initialized = false;

    logger.info('✅ 所有MCP服务器已关闭');
  }

  /**
   * 检查管理器是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// 导出单例实例
export const mcpManager = new McpManager();
