// craconfig-analyzer CORE — pure logic (no MCP transport).
//
// CRA-specific deep inspection of the FULL config surface that legacy-analyzer
// skips: react-scripts/ejection/CRACO, REACT_APP_ env vars + .env files,
// %PUBLIC_URL% + homepage, proxy (field or setupProxy.js), jest config +
// setupTests, browserslist, eslint-config-react-app, SASS, PWA service worker,
// SVG ReactComponent imports, and absolute-import config. Produces the
// CraConfigProfile the cra-to-vite pipeline reads.

export interface CraConfigProfile {
  isCRA: boolean;
  ejected: boolean;
  craco: boolean;
  reactScriptsVersion?: string;
  homepage?: string;
  envVars: string[];
  envFiles: string[];
  publicUrlUsed: boolean;
  testRunner: 'jest' | 'vitest' | 'unknown';
  jestConfig: { source: 'package.json' | 'jest.config' | 'none'; hasSetupTests: boolean };
  proxy: { type: 'package-json' | 'setupProxy' | 'none'; target?: string };
  browserslist: boolean;
  eslintConfigReactApp: boolean;
  sass: boolean;
  serviceWorker: boolean;
  svgReactComponentImport: boolean;
  absoluteImportsBaseUrl?: string;
}

export interface CraPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  proxy?: string;
  homepage?: string;
  jest?: unknown;
  browserslist?: unknown;
  eslintConfig?: { extends?: string | string[] };
}

export interface CraAnalyzeInput {
  packageJson: CraPackageJson;
  sources: string;
  hasConfigDir?: boolean;
  hasCraco?: boolean;
  hasJestConfig?: boolean;
  hasSetupProxy?: boolean;
  hasSetupTests?: boolean;
  envFiles?: string[];
  jsconfig?: { compilerOptions?: { baseUrl?: string } };
}

export function extractEnvVars(sources: string): string[] {
  const names = new Set<string>();
  for (const m of sources.matchAll(/process\.env\.(REACT_APP_[A-Z0-9_]+)/g)) names.add(m[1]);
  return [...names].sort();
}

function eslintIsReactApp(cfg: CraPackageJson['eslintConfig']): boolean {
  if (!cfg?.extends) return false;
  const ex = Array.isArray(cfg.extends) ? cfg.extends : [cfg.extends];
  return ex.some((e) => e.includes('react-app'));
}

export function analyzeCra(input: CraAnalyzeInput): CraConfigProfile {
  const pkg = input.packageJson;
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const isCRA = 'react-scripts' in deps || Boolean(input.hasCraco);
  const testRunner: CraConfigProfile['testRunner'] = deps['vitest']
    ? 'vitest'
    : deps['react-scripts'] || deps['jest']
      ? 'jest'
      : 'unknown';

  const jestConfig: CraConfigProfile['jestConfig'] = {
    source: pkg.jest ? 'package.json' : input.hasJestConfig ? 'jest.config' : 'none',
    hasSetupTests: Boolean(input.hasSetupTests),
  };

  const proxy: CraConfigProfile['proxy'] = pkg.proxy
    ? { type: 'package-json', target: pkg.proxy }
    : input.hasSetupProxy
      ? { type: 'setupProxy' }
      : { type: 'none' };

  return {
    isCRA,
    ejected: Boolean(input.hasConfigDir),
    craco: Boolean(input.hasCraco),
    reactScriptsVersion: deps['react-scripts'],
    homepage: pkg.homepage,
    envVars: extractEnvVars(input.sources),
    envFiles: input.envFiles ?? [],
    publicUrlUsed: /%PUBLIC_URL%|process\.env\.PUBLIC_URL/.test(input.sources),
    testRunner,
    jestConfig,
    proxy,
    browserslist: Boolean(pkg.browserslist),
    eslintConfigReactApp: eslintIsReactApp(pkg.eslintConfig),
    sass: 'node-sass' in deps || 'sass' in deps,
    serviceWorker: /serviceWorker(Registration)?|register\(\)/.test(input.sources) && /service-?worker/i.test(input.sources),
    svgReactComponentImport: /import\s*\{\s*ReactComponent\s+as\s+\w+\s*\}\s*from\s*['"][^'"]+\.svg['"]/.test(input.sources),
    absoluteImportsBaseUrl: input.jsconfig?.compilerOptions?.baseUrl,
  };
}
