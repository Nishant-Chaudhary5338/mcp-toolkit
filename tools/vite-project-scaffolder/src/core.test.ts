import { describe, it, expect } from 'vitest';
import { generateViteProject } from './core.js';

describe('generateViteProject', () => {
  it('emits the standard Vite shell files', () => {
    const r = generateViteProject({ appName: 'My App' });
    const paths = r.files.map((f) => f.path).sort();
    expect(paths).toEqual(['index.html', 'src/main.tsx', 'src/vite-env.d.ts', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.ts']);
  });

  it('index.html points at /src/main.tsx and main.tsx uses createRoot', () => {
    const r = generateViteProject();
    const html = r.files.find((f) => f.path === 'index.html')!.code;
    const main = r.files.find((f) => f.path === 'src/main.tsx')!.code;
    expect(html).toContain('<script type="module" src="/src/main.tsx">');
    expect(main).toContain('ReactDOM.createRoot(document.getElementById(\'root\')!)');
  });

  it('config wires react, envPrefix, alias by default', () => {
    const cfg = generateViteProject().files.find((f) => f.path === 'vite.config.ts')!.code;
    expect(cfg).toContain("import react from '@vitejs/plugin-react'");
    expect(cfg).toContain("envPrefix: 'VITE_'");
    expect(cfg).toContain("'@': path.resolve(__dirname, 'src')");
  });

  it('adds svgr, proxy, and base when requested', () => {
    const cfg = generateViteProject({ svgr: true, proxyTarget: 'http://localhost:4000', homepage: '/app' }).files.find((f) => f.path === 'vite.config.ts')!.code;
    expect(cfg).toContain("import svgr from 'vite-plugin-svgr'");
    expect(cfg).toContain('svgr()');
    expect(cfg).toContain("target: 'http://localhost:4000'");
    expect(cfg).toContain("base: '/app/'");
  });

  it('tsconfig is strict with @ paths', () => {
    const ts = JSON.parse(generateViteProject().files.find((f) => f.path === 'tsconfig.json')!.code);
    expect(ts.compilerOptions.strict).toBe(true);
    expect(ts.compilerOptions.paths['@/*']).toEqual(['src/*']);
  });

  it('defaults to plain vite defineConfig with no test block (unchanged CRUD-factory behavior)', () => {
    const cfg = generateViteProject().files.find((f) => f.path === 'vite.config.ts')!.code;
    expect(cfg).toContain("import { defineConfig } from 'vite';");
    expect(cfg).not.toContain('test:');
  });

  it('wires a Vitest test block (jsdom + setupFiles) when vitest is requested (QA harness regression)', () => {
    // Found dogfooding the real cra-to-vite "apply" path: without a wired test
    // environment, every migrated CRA app's tests fail immediately (jsdom
    // globals undefined) — nothing in the pipeline generated this before.
    const cfg = generateViteProject({ vitest: true, vitestSetupFile: './src/setupTests.ts' }).files.find((f) => f.path === 'vite.config.ts')!.code;
    expect(cfg).toContain("import { defineConfig } from 'vitest/config';");
    expect(cfg).toContain("environment: 'jsdom'");
    expect(cfg).toContain("setupFiles: ['./src/setupTests.ts']");
  });

  it('omits setupFiles when no vitestSetupFile is given', () => {
    const cfg = generateViteProject({ vitest: true }).files.find((f) => f.path === 'vite.config.ts')!.code;
    expect(cfg).toContain("environment: 'jsdom'");
    expect(cfg).not.toContain('setupFiles');
  });
});
