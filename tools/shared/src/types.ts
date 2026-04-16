// ============================================================================
// MCP TYPES - Common types for all MCP tools
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
  };
}

export interface SchemaProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface ServerConfig {
  name: string;
  version: string;
  capabilities?: Record<string, unknown>;
}

export type ToolHandler = (args: unknown) => Promise<ToolResult>;
