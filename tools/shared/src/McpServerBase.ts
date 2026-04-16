// ============================================================================
// MCP SERVER BASE - Abstract base class for all MCP servers
// ============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from './ToolRegistry.js';
import type { ServerConfig, ToolDefinition, ToolHandler, ToolResult } from './types.js';

export abstract class McpServerBase {
  protected server: Server;
  protected registry: ToolRegistry;
  protected config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.registry = new ToolRegistry();

    this.server = new Server(
      { name: config.name, version: config.version },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
    this.setupErrorHandlers();
    this.registerTools();
  }

  protected abstract registerTools(): void;

  protected addTool(
    name: string,
    description: string,
    inputSchema: ToolDefinition['inputSchema'],
    handler: ToolHandler
  ): void {
    this.registry.register(name, description, inputSchema, handler);
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.registry.getAllDefinitions(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = this.registry.getHandler(name);
      if (!handler) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
      try {
        return await handler(args);
      } catch (error) {
        if (error instanceof McpError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
      }
    });
  }

  private setupErrorHandlers(): void {
    this.server.onerror = (error) => {
      console.error(`[${this.config.name}] MCP Error:`, error);
    };
    process.on('SIGINT', async () => {
      await this.shutdown();
    });
  }

  protected success<T extends Record<string, unknown>>(data: T): ToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) }],
    };
  }

  protected error(error: unknown): ToolResult {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: msg }, null, 2) }],
      isError: true,
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`${this.config.name} MCP server v${this.config.version} running on stdio`);
  }

  async shutdown(): Promise<void> {
    await this.server.close();
    process.exit(0);
  }
}
