// ============================================================================
// TOOL REGISTRY - Tool registration and lookup helper
// ============================================================================
export class ToolRegistry {
    tools = new Map();
    register(name, description, inputSchema, handler) {
        if (this.tools.has(name)) {
            throw new Error(`Tool already registered: ${name}`);
        }
        this.tools.set(name, { definition: { name, description, inputSchema }, handler });
    }
    getHandler(name) {
        return this.tools.get(name)?.handler;
    }
    getAllDefinitions() {
        return Array.from(this.tools.values()).map(t => t.definition);
    }
    has(name) {
        return this.tools.has(name);
    }
}
//# sourceMappingURL=ToolRegistry.js.map