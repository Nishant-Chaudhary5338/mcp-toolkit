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
});
