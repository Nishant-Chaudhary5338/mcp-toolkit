import { Router } from 'express';
import { MCPClient, getServerPath } from '../mcp-client.js';

const router = Router();

router.post('/', async (req, res) => {
  const { server, tool, args } = req.body as {
    server: string;
    tool: string;
    args: Record<string, unknown>;
  };

  if (!server || !tool) {
    res.status(400).json({ success: false, error: 'Missing required fields: server, tool' });
    return;
  }

  const start = Date.now();
  try {
    const serverPath = getServerPath(server);
    const client = new MCPClient(serverPath);
    const result = await client.callTool(tool, args ?? {});
    res.json({ success: true, result, duration: Date.now() - start });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message, duration: Date.now() - start });
  }
});

export default router;
