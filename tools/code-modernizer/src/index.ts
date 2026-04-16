#!/usr/bin/env node
// ============================================================================
// CODE MODERNIZER MCP SERVER
// Modernize React codebases: TypeScript conversion
// ============================================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { convertToTypeScript } from './tools/01-convert-to-typescript.js';

const TOOLS = [
  {
    name: 'convert-to-typescript',
    description: 'Rename .js/.jsx files to .ts/.tsx, add basic type annotations, convert propTypes to TypeScript interfaces',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        includeProps: { type: 'boolean', description: 'Convert propTypes to TS interfaces (default: true)', default: true },
        dryRun: { type: 'boolean', description: 'If true, only analyze without making changes (default: false)', default: false },
      },
      required: ['path'],
    },
  },
];

const server = new Server(
  { name: 'code-modernizer', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!args) throw new McpError(ErrorCode.InvalidParams, 'Missing arguments');

  try {
    let result: unknown;
    switch (name) {
      case 'convert-to-typescript':
        result = await convertToTypeScript({
          path: args.path as string,
          includeProps: args.includeProps as boolean,
          dryRun: args.dryRun as boolean,
        });
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: true, message: error instanceof Error ? error.message : 'Unknown error', tool: name }, null, 2) }],
      isError: true,
    };
  }
});

server.onerror = (error) => console.error('[Code Modernizer Error]', error);
process.on('SIGINT', async () => { await server.close(); process.exit(0); });

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('code-modernizer MCP server v2.0.0 running on stdio');
