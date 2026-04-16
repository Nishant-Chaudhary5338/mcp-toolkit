import type { ToolDefinition, ToolHandler } from './types.js';
export declare class ToolRegistry {
    private tools;
    register(name: string, description: string, inputSchema: ToolDefinition['inputSchema'], handler: ToolHandler): void;
    getHandler(name: string): ToolHandler | undefined;
    getAllDefinitions(): ToolDefinition[];
    has(name: string): boolean;
}
//# sourceMappingURL=ToolRegistry.d.ts.map