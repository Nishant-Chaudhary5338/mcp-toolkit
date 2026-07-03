// vite-project-scaffolder CORE — pure logic (no MCP transport).
//
// Generate the Vite project shell for a CRA migration: vite.config.ts (react +
// optional svgr, env prefix, alias, proxy, base), a root index.html (moved from
// public/), src/main.tsx (createRoot), strict tsconfig(.node).json, and
// vite-env.d.ts. Follows the FileSpec template-assembly pattern.

export interface ScaffoldFile {
  path: string;
  code: string;
}

export interface ViteScaffoldResult {
  files: ScaffoldFile[];
  count: number;
}

export interface ViteScaffoldOptions {
  appName?: string;
  /** Alias src as '@' → ./src (covers CRA NODE_PATH=src-style bare imports). */
  srcAlias?: boolean;
  svgr?: boolean;
  /** Dev-server proxy target for /api. */
  proxyTarget?: string;
  /** CRA homepage → Vite base path. */
  homepage?: string;
  /** Entry component import (default './App'). */
  entry?: string;
  /**
   * Wire a Vitest `test` block into vite.config.ts (jsdom environment) instead
   * of leaving the project with no test runner config. Found dogfooding the
   * real cra-to-vite "apply" path: without this, every migrated CRA app's
   * tests fail at collection/run time with no test environment configured.
   */
  vitest?: boolean;
  /** Setup file for `test.setupFiles`, e.g. './src/setupTests.ts' (only used when vitest is true). */
  vitestSetupFile?: string;
}

export function generateViteProject(opts: ViteScaffoldOptions = {}): ViteScaffoldResult {
  const appName = opts.appName ?? 'App';
  const srcAlias = opts.srcAlias !== false;
  const entry = opts.entry ?? './App';
  const base = opts.homepage && opts.homepage !== '.' && opts.homepage.startsWith('/') ? opts.homepage : undefined;

  const pluginImports = [`import react from '@vitejs/plugin-react';`];
  const plugins = ['react()'];
  if (opts.svgr) { pluginImports.push(`import svgr from 'vite-plugin-svgr';`); plugins.push('svgr()'); }
  const needPath = srcAlias;

  // Vitest's `defineConfig` (from 'vitest/config') is a superset of Vite's own
  // that also types a `test` field — using it lets vite.config.ts carry both
  // configs without duplicating the plugin list into a second file.
  const configLines = [
    `import { defineConfig } from '${opts.vitest ? 'vitest/config' : 'vite'}';`,
    ...pluginImports,
    ...(needPath ? [`import path from 'node:path';`] : []),
    '',
    'export default defineConfig({',
    `  plugins: [${plugins.join(', ')}],`,
    `  envPrefix: 'VITE_',`,
    ...(base ? [`  base: '${base.endsWith('/') ? base : `${base}/`}',`] : []),
    ...(srcAlias ? ['  resolve: {', "    alias: { '@': path.resolve(__dirname, 'src') },", '  },'] : []),
    ...(opts.proxyTarget ? ['  server: {', '    proxy: {', `      '/api': { target: '${opts.proxyTarget}', changeOrigin: true },`, '    },', '  },'] : []),
    ...(opts.vitest ? [
      '  test: {',
      "    environment: 'jsdom',",
      ...(opts.vitestSetupFile ? [`    setupFiles: ['${opts.vitestSetupFile}'],`] : []),
      '  },',
    ] : []),
    '});',
    '',
  ];

  const files: ScaffoldFile[] = [
    { path: 'vite.config.ts', code: configLines.join('\n') },
    {
      path: 'index.html',
      code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: 'src/main.tsx',
      code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '${entry}';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
    },
    {
      path: 'tsconfig.json',
      code: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022', useDefineForClassFields: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', allowImportingTsExtensions: true,
            resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: true,
            noUnusedLocals: true, noUnusedParameters: true, noFallthroughCasesInSwitch: true,
            ...(srcAlias ? { baseUrl: '.', paths: { '@/*': ['src/*'] } } : {}),
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }],
        },
        null,
        2,
      ) + '\n',
    },
    {
      path: 'tsconfig.node.json',
      code: JSON.stringify(
        { compilerOptions: { composite: true, skipLibCheck: true, module: 'ESNext', moduleResolution: 'bundler', allowSyntheticDefaultImports: true }, include: ['vite.config.ts'] },
        null,
        2,
      ) + '\n',
    },
    { path: 'src/vite-env.d.ts', code: '/// <reference types="vite/client" />\n' },
  ];

  return { files, count: files.length };
}
