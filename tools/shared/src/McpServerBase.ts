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
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ToolRegistry } from './ToolRegistry.js';
import { renderDashboard } from './dashboard.js';
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

  /**
   * Like success(), but also renders a self-contained interactive HTML dashboard
   * for the result (summary chips, code panels with copy, finding tables,
   * collapsible JSON) — inline in MCP Apps hosts, plus a file:// link elsewhere.
   */
  protected successWithDashboard<T extends Record<string, unknown>>(title: string, data: T): ToolResult {
    const uri = `ui://${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'result'}`;
    return this.successWithUI(data, { uri, html: renderDashboard(title, data) });
  }

  /**
   * Return machine-readable data (so the model can reason over it), an
   * interactive UI resource (MCP Apps hosts render it inline in a sandboxed
   * iframe), AND a clickable file:// link to the same dashboard written to a
   * temp file — so clients without MCP-Apps rendering (e.g. Claude Code in
   * VS Code) can still open the visual report in a browser.
   */
  protected successWithUI<T extends Record<string, unknown>>(
    data: T,
    ui: { uri: string; html: string }
  ): ToolResult {
    const content: ToolResult['content'] = [
      { type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) },
    ];
    const fileUrl = this.writeReportFile(ui.uri, ui.html);
    if (fileUrl) {
      content.push({
        type: 'text',
        text:
          `📊 Interactive dashboard: ${fileUrl}\n` +
          `Open that link in a browser to explore the report (sortable issues, theme toggle, fix actions). ` +
          `In Claude Desktop it renders inline automatically.`,
      });
    }
    content.push({ type: 'resource', resource: { uri: ui.uri, mimeType: 'text/html', text: ui.html } });
    return { content };
  }

  /** Write the dashboard HTML to a stable temp file; return its file:// URL (null on failure). */
  private writeReportFile(uri: string, html: string): string | null {
    try {
      const slug = uri.replace(/^ui:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
      const dir = join(tmpdir(), 'mcp-react-toolkit');
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, `${slug}.html`);
      writeFileSync(filePath, html, 'utf8');
      return `file://${filePath}`;
    } catch {
      return null;
    }
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
