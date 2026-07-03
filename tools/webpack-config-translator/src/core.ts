// webpack-config-translator CORE — pure logic (no MCP transport).
//
// Best-effort translation of a webpack / CRACO config into Vite equivalents.
// Extracts aliases, classifies known plugins and loaders (native to Vite /
// needs-a-plugin / unsupported), and returns an explicit manual-review list —
// this is inherently partial, so it never pretends a config is fully handled.

export type Status = 'native' | 'needs-plugin' | 'unsupported';

export interface TranslatedItem {
  name: string;
  status: Status;
  note: string;
}

export interface WebpackTranslation {
  aliases: { name: string; path: string }[];
  plugins: TranslatedItem[];
  loaders: TranslatedItem[];
  manualReview: string[];
}

const PLUGIN_MAP: Record<string, TranslatedItem> = {
  HtmlWebpackPlugin: { name: 'HtmlWebpackPlugin', status: 'native', note: 'Vite serves index.html natively — drop it.' },
  MiniCssExtractPlugin: { name: 'MiniCssExtractPlugin', status: 'native', note: 'Vite extracts CSS in build — drop it.' },
  CleanWebpackPlugin: { name: 'CleanWebpackPlugin', status: 'native', note: 'Vite cleans outDir by default — drop it.' },
  DefinePlugin: { name: 'DefinePlugin', status: 'needs-plugin', note: 'Move env values to import.meta.env / vite `define`.' },
  ProvidePlugin: { name: 'ProvidePlugin', status: 'needs-plugin', note: 'Use vite-plugin-inject or explicit imports.' },
  ForkTsCheckerWebpackPlugin: { name: 'ForkTsCheckerWebpackPlugin', status: 'needs-plugin', note: 'Use vite-plugin-checker.' },
  BundleAnalyzerPlugin: { name: 'BundleAnalyzerPlugin', status: 'needs-plugin', note: 'Use rollup-plugin-visualizer.' },
  ModuleFederationPlugin: { name: 'ModuleFederationPlugin', status: 'needs-plugin', note: 'Use @originjs/vite-plugin-federation (verify shared-deps config).' },
  CopyWebpackPlugin: { name: 'CopyWebpackPlugin', status: 'native', note: 'Put static files in public/ — Vite copies them.' },
};

const LOADER_MAP: Record<string, TranslatedItem> = {
  'babel-loader': { name: 'babel-loader', status: 'native', note: 'Vite uses esbuild/@vitejs/plugin-react — drop it.' },
  'ts-loader': { name: 'ts-loader', status: 'native', note: 'Vite transpiles TS natively — drop it.' },
  'sass-loader': { name: 'sass-loader', status: 'native', note: 'Native with the `sass` dep installed.' },
  'less-loader': { name: 'less-loader', status: 'native', note: 'Native with the `less` dep installed.' },
  'css-loader': { name: 'css-loader', status: 'native', note: 'Vite handles CSS + CSS Modules natively.' },
  'style-loader': { name: 'style-loader', status: 'native', note: 'Vite injects styles natively.' },
  'file-loader': { name: 'file-loader', status: 'native', note: 'Vite handles asset imports natively.' },
  'url-loader': { name: 'url-loader', status: 'native', note: 'Vite inlines small assets via assetsInlineLimit.' },
  'raw-loader': { name: 'raw-loader', status: 'needs-plugin', note: 'Import with the ?raw suffix instead.' },
  '@svgr/webpack': { name: '@svgr/webpack', status: 'needs-plugin', note: 'Use vite-plugin-svgr.' },
};

export function translateWebpack(configText: string): WebpackTranslation {
  const aliases: { name: string; path: string }[] = [];
  for (const m of configText.matchAll(/['"]?([\w@/-]+)['"]?\s*:\s*path\.resolve\([^,]*,\s*['"]([^'"]+)['"]\s*\)/g)) {
    aliases.push({ name: m[1], path: m[2] });
  }

  const plugins: TranslatedItem[] = [];
  const seenP = new Set<string>();
  for (const m of configText.matchAll(/new\s+([A-Za-z]+Plugin)\s*\(/g)) {
    const name = m[1];
    if (seenP.has(name)) continue;
    seenP.add(name);
    plugins.push(PLUGIN_MAP[name] ?? { name, status: 'unsupported', note: 'No known Vite equivalent — review manually.' });
  }

  const loaders: TranslatedItem[] = [];
  const seenL = new Set<string>();
  for (const [name, item] of Object.entries(LOADER_MAP)) {
    if (configText.includes(name) && !seenL.has(name)) { seenL.add(name); loaders.push(item); }
  }

  const manualReview: string[] = [];
  for (const p of plugins) if (p.status === 'unsupported') manualReview.push(`Plugin "${p.name}" has no known Vite equivalent.`);
  if (/webpack\.config\.js/.test(configText) || /eject/.test(configText)) manualReview.push('Ejected/custom webpack config detected — review the full config by hand.');
  for (const l of loaders) if (l.status === 'needs-plugin') manualReview.push(`Loader "${l.name}": ${l.note}`);

  return { aliases, plugins, loaders, manualReview };
}
