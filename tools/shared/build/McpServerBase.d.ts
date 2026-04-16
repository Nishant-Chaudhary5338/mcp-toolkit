import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ToolRegistry } from './ToolRegistry.js';
import type { ServerConfig, ToolDefinition, ToolHandler, ToolResult } from './types.js';
export declare abstract class McpServerBase {
    protected server: Server;
    protected registry: ToolRegistry;
    protected config: ServerConfig;
    constructor(config: ServerConfig);
    protected abstract registerTools(): void;
    protected addTool(name: string, description: string, inputSchema: ToolDefinition['inputSchema'], handler: ToolHandler): void;
    private setupHandlers;
    private setupErrorHandlers;
    protected success<T extends Record<string, unknown>>(data: T): ToolResult;
    protected error(error: unknown): ToolResult;
    run(): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=McpServerBase.d.ts.map