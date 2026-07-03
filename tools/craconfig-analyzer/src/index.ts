#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeCra, type CraPackageJson } from './core.js';

function readSources(dir: string): string {
  let out = '';
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'build', 'dist'].includes(e.name)) out += readSources(full); }
    else if (/\.(tsx?|jsx?|html)$/.test(e.name)) { try { out += fs.readFileSync(full, 'utf8') + '\n'; } catch { /* skip */ } }
  }
  return out;
}
function readJson(p: string): Record<string, unknown> | undefined {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; }
}
function exists(...p: string[]): boolean { return fs.existsSync(path.join(...p)); }

class CraconfigAnalyzerServer extends McpServerBase {
  constructor() {
    super({ name: 'craconfig-analyzer', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'analyze_cra',
      'Analyze a CRA project root across its FULL config surface and return a CraConfigProfile: react-scripts/ejection/CRACO, REACT_APP_ env vars + .env files, %PUBLIC_URL% + homepage, proxy (field or setupProxy.js), jest config + setupTests, browserslist, eslint-config-react-app, SASS, PWA service worker, SVG ReactComponent imports, and absolute-import baseUrl.',
      { type: 'object', properties: { path: { type: 'string', description: 'Absolute path to the CRA project root.' } }, required: ['path'] },
      async (args) => {
        const { path: root } = (args ?? {}) as { path?: string };
        if (!root) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(root)) throw new Error(`Path does not exist: ${root}`);
          const packageJson = (readJson(path.join(root, 'package.json')) ?? {}) as CraPackageJson;
          const sources = readSources(path.join(root, 'src')) + (exists(root, 'public', 'index.html') ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '');
          const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'].filter((f) => exists(root, f));
          const profile = analyzeCra({
            packageJson,
            sources,
            hasConfigDir: exists(root, 'config', 'webpack.config.js'),
            hasCraco: exists(root, 'craco.config.js'),
            hasJestConfig: exists(root, 'jest.config.js') || exists(root, 'jest.config.ts'),
            hasSetupProxy: exists(root, 'src', 'setupProxy.js'),
            hasSetupTests: exists(root, 'src', 'setupTests.js') || exists(root, 'src', 'setupTests.ts'),
            envFiles,
            jsconfig: readJson(path.join(root, 'jsconfig.json')) as { compilerOptions?: { baseUrl?: string } } | undefined,
          });
          return this.successWithDashboard('Craconfig Analyzer', { ...profile });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new CraconfigAnalyzerServer().run().catch(console.error);
