// dependency-remapper CORE — pure logic (no MCP transport).
//
// CRA package.json deps → a Vite dependency plan: what to remove, what to add
// (with pinned versions), and what has no known Vite equivalent (manual review).

export interface DependencyRemapPlan {
  remove: string[];
  add: { name: string; version: string }[];
  unmapped: string[];
}

export interface RemapOptions {
  /** Emit vite-plugin-svgr when the project imports SVGs as React components. */
  svgr?: boolean;
  /** Project uses SASS (node-sass) — add `sass`. */
  sass?: boolean;
}

// CRA-specific build tooling that Vite replaces.
const REMOVE = new Set([
  'react-scripts', '@craco/craco', 'react-app-rewired', 'customize-cra',
  'eslint-config-react-app', 'node-sass',
]);

// Deps with no clean Vite equivalent — flag for a human.
const NEEDS_REVIEW = /^(workbox-|@craco\/|react-app-polyfill)/;

const VERSIONS = {
  vite: '^5.4.0',
  '@vitejs/plugin-react': '^4.3.0',
  vitest: '^2.1.0',
  jsdom: '^25.0.0',
  sass: '^1.79.0',
  'vite-plugin-svgr': '^4.2.0',
} as const;

export function planRemap(deps: Record<string, string>, opts: RemapOptions = {}): DependencyRemapPlan {
  const names = Object.keys(deps ?? {});
  const remove = names.filter((n) => REMOVE.has(n)).sort();
  const unmapped = names.filter((n) => NEEDS_REVIEW.test(n) && !REMOVE.has(n)).sort();

  const add: { name: string; version: string }[] = [
    { name: 'vite', version: VERSIONS.vite },
    { name: '@vitejs/plugin-react', version: VERSIONS['@vitejs/plugin-react'] },
  ];
  // Migrate the test runner to Vitest if the project used react-scripts/jest.
  if ('react-scripts' in deps || 'jest' in deps) {
    add.push({ name: 'vitest', version: VERSIONS.vitest }, { name: 'jsdom', version: VERSIONS.jsdom });
  }
  if (opts.sass || 'node-sass' in deps) add.push({ name: 'sass', version: VERSIONS.sass });
  if (opts.svgr) add.push({ name: 'vite-plugin-svgr', version: VERSIONS['vite-plugin-svgr'] });

  // Don't propose adding something already present.
  const filteredAdd = add.filter((a) => !(a.name in deps));

  return { remove, add: filteredAdd, unmapped };
}
