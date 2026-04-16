import express from 'express';
import cors from 'cors';
import callRouter from './routes/call.js';
const app = express();
const PORT = 3002;
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json({ limit: '10mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', port: PORT }));
app.use('/api/call', callRouter);
app.listen(PORT, () => {
    console.log(`\n🚀 MCP Showcase Server running at http://localhost:${PORT}`);
    console.log(`   GET  /health     → health check`);
    console.log(`   POST /api/call   → call a tool { server, tool, args }\n`);
});
//# sourceMappingURL=index.js.map