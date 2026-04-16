// ============================================================================
// MCP SERVER BASE - Abstract base class for all MCP servers
// ============================================================================
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from './ToolRegistry.js';
export class McpServerBase {
    server;
    registry;
    config;
    constructor(config) {
        this.config = config;
        this.registry = new ToolRegistry();
        this.server = new Server({ name: config.name, version: config.version }, { capabilities: { tools: {} } });
        this.setupHandlers();
        this.setupErrorHandlers();
        this.registerTools();
    }
    addTool(name, description, inputSchema, handler) {
        this.registry.register(name, description, inputSchema, handler);
    }
    setupHandlers() {
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
            }
            catch (error) {
                if (error instanceof McpError)
                    throw error;
                const message = error instanceof Error ? error.message : String(error);
                throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
            }
        });
    }
    setupErrorHandlers() {
        this.server.onerror = (error) => {
            console.error(`[${this.config.name}] MCP Error:`, error);
        };
        process.on('SIGINT', async () => {
            await this.shutdown();
        });
    }
    success(data) {
        return {
            content: [{ type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) }],
        };
    }
    error(error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: msg }, null, 2) }],
            isError: true,
        };
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`${this.config.name} MCP server v${this.config.version} running on stdio`);
    }
    async shutdown() {
        await this.server.close();
        process.exit(0);
    }
}
//# sourceMappingURL=McpServerBase.js.map