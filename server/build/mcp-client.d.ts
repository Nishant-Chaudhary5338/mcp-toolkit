export interface MCPResponse {
    success: boolean;
    [key: string]: unknown;
}
export declare class MCPClient {
    private serverPath;
    private requestId;
    constructor(serverPath: string);
    callTool(toolName: string, args: Record<string, unknown>): Promise<MCPResponse>;
}
export declare function getServerPath(serverName: string): string;
//# sourceMappingURL=mcp-client.d.ts.map