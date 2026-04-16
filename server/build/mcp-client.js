import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Root of the mcp-showcase project (two levels up from server/src/)
const SHOWCASE_ROOT = join(__dirname, '..', '..');
export class MCPClient {
    serverPath;
    requestId = 1;
    constructor(serverPath) {
        this.serverPath = serverPath;
    }
    async callTool(toolName, args) {
        return new Promise((resolve, reject) => {
            const child = spawn('node', [this.serverPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stdoutData = '';
            let responseReceived = false;
            let initialized = false;
            child.stdout?.on('data', (data) => {
                stdoutData += data.toString();
                const lines = stdoutData.split('\n');
                for (const line of lines) {
                    if (!line.trim() || !line.includes('"jsonrpc"'))
                        continue;
                    try {
                        const response = JSON.parse(line);
                        if (response.id === 1 && response.result && !initialized) {
                            initialized = true;
                            child.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }) + '\n');
                            setTimeout(() => {
                                child.stdin?.write(JSON.stringify({
                                    jsonrpc: '2.0',
                                    id: this.requestId,
                                    method: 'tools/call',
                                    params: { name: toolName, arguments: args },
                                }) + '\n');
                            }, 50);
                            continue;
                        }
                        if (response.id === this.requestId && response.result) {
                            responseReceived = true;
                            const content = response.result.content?.[0]?.text;
                            if (content) {
                                try {
                                    resolve(JSON.parse(content));
                                }
                                catch {
                                    resolve({ success: true, output: content });
                                }
                            }
                            else {
                                resolve({ success: true, ...response.result });
                            }
                            child.kill();
                            return;
                        }
                        else if (response.error) {
                            reject(new Error(response.error.message || 'MCP error'));
                            child.kill();
                            return;
                        }
                    }
                    catch { /* not valid JSON yet */ }
                }
            });
            child.on('close', (code) => {
                if (!responseReceived) {
                    reject(new Error(code !== 0 ? `Process exited with code ${code}` : 'No response from MCP server'));
                }
            });
            child.on('error', reject);
            // Send initialize
            child.stdin?.write(JSON.stringify({
                jsonrpc: '2.0',
                id: this.requestId++,
                method: 'initialize',
                params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'mcp-showcase-server', version: '1.0.0' } },
            }) + '\n');
            setTimeout(() => {
                if (!responseReceived) {
                    child.kill();
                    reject(new Error('Timeout waiting for MCP server response'));
                }
            }, 120000);
        });
    }
}
export function getServerPath(serverName) {
    return join(SHOWCASE_ROOT, 'tools', serverName, 'build', 'index.js');
}
//# sourceMappingURL=mcp-client.js.map