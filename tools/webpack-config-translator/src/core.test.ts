import { describe, it, expect } from 'vitest';
import { translateWebpack } from './core.js';

describe('translateWebpack', () => {
  it('extracts resolve aliases', () => {
    const r = translateWebpack("resolve: { alias: { '@': path.resolve(__dirname, 'src'), utils: path.resolve(__dirname, 'src/utils') } }");
    expect(r.aliases).toEqual([{ name: '@', path: 'src' }, { name: 'utils', path: 'src/utils' }]);
  });

  it('classifies known plugins native vs needs-plugin vs unsupported', () => {
    const r = translateWebpack('plugins: [new HtmlWebpackPlugin(), new DefinePlugin({}), new WeirdCustomPlugin()]');
    const byName = Object.fromEntries(r.plugins.map((p) => [p.name, p.status]));
    expect(byName['HtmlWebpackPlugin']).toBe('native');
    expect(byName['DefinePlugin']).toBe('needs-plugin');
    expect(byName['WeirdCustomPlugin']).toBe('unsupported');
    expect(r.manualReview.some((m) => m.includes('WeirdCustomPlugin'))).toBe(true);
  });

  it('classifies loaders', () => {
    const r = translateWebpack("use: ['babel-loader', 'raw-loader', '@svgr/webpack']");
    const byName = Object.fromEntries(r.loaders.map((l) => [l.name, l.status]));
    expect(byName['babel-loader']).toBe('native');
    expect(byName['raw-loader']).toBe('needs-plugin');
    expect(byName['@svgr/webpack']).toBe('needs-plugin');
  });
});
