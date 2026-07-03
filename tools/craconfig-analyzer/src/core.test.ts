import { describe, it, expect } from 'vitest';
import { analyzeCra, extractEnvVars } from './core.js';

describe('extractEnvVars', () => {
  it('collects unique REACT_APP_ vars', () => {
    expect(extractEnvVars('process.env.REACT_APP_API_URL; process.env.REACT_APP_KEY; process.env.REACT_APP_API_URL')).toEqual(['REACT_APP_API_URL', 'REACT_APP_KEY']);
  });
});

describe('analyzeCra — full config surface', () => {
  it('detects react-scripts, env, publicUrl, homepage, proxy, jest, browserslist, eslint, sass', () => {
    const p = analyzeCra({
      packageJson: {
        dependencies: { 'react-scripts': '5.0.1', 'node-sass': '9', react: '18' },
        proxy: 'http://localhost:4000',
        homepage: '/app',
        jest: { collectCoverage: true },
        browserslist: { production: ['>0.2%'] },
        eslintConfig: { extends: 'react-app' },
      },
      sources: 'const u = process.env.REACT_APP_URL; <img src="%PUBLIC_URL%/logo.png" />',
      hasSetupTests: true,
      envFiles: ['.env', '.env.production'],
    });
    expect(p.isCRA).toBe(true);
    expect(p.reactScriptsVersion).toBe('5.0.1');
    expect(p.homepage).toBe('/app');
    expect(p.envVars).toEqual(['REACT_APP_URL']);
    expect(p.envFiles).toEqual(['.env', '.env.production']);
    expect(p.publicUrlUsed).toBe(true);
    expect(p.proxy).toEqual({ type: 'package-json', target: 'http://localhost:4000' });
    expect(p.jestConfig).toEqual({ source: 'package.json', hasSetupTests: true });
    expect(p.browserslist).toBe(true);
    expect(p.eslintConfigReactApp).toBe(true);
    expect(p.sass).toBe(true);
  });

  it('detects setupProxy.js, jest.config, ejection, craco, SVG imports', () => {
    const p = analyzeCra({
      packageJson: { dependencies: {} },
      sources: "import { ReactComponent as Logo } from './logo.svg';",
      hasConfigDir: true,
      hasCraco: true,
      hasSetupProxy: true,
      hasJestConfig: true,
    });
    expect(p.ejected).toBe(true);
    expect(p.craco).toBe(true);
    expect(p.proxy.type).toBe('setupProxy');
    expect(p.jestConfig.source).toBe('jest.config');
    expect(p.svgReactComponentImport).toBe(true);
  });

  it('reads absolute-import baseUrl and vitest runner', () => {
    const p = analyzeCra({ packageJson: { devDependencies: { vitest: '2' } }, sources: '', jsconfig: { compilerOptions: { baseUrl: 'src' } } });
    expect(p.absoluteImportsBaseUrl).toBe('src');
    expect(p.testRunner).toBe('vitest');
  });
});
