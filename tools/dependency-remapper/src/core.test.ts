import { describe, it, expect } from 'vitest';
import { planRemap } from './core.js';

describe('planRemap', () => {
  it('removes react-scripts and adds vite + vitest', () => {
    const p = planRemap({ 'react-scripts': '5.0.1', react: '18', 'react-dom': '18' });
    expect(p.remove).toContain('react-scripts');
    const added = p.add.map((a) => a.name);
    expect(added).toContain('vite');
    expect(added).toContain('@vitejs/plugin-react');
    expect(added).toContain('vitest');
    expect(added).toContain('jsdom');
  });

  it('remaps node-sass to sass and craco to removal', () => {
    const p = planRemap({ 'react-scripts': '5', 'node-sass': '9', '@craco/craco': '7' });
    expect(p.remove).toEqual(expect.arrayContaining(['@craco/craco', 'node-sass', 'react-scripts']));
    expect(p.add.map((a) => a.name)).toContain('sass');
  });

  it('adds vite-plugin-svgr when svgr requested', () => {
    const p = planRemap({ 'react-scripts': '5' }, { svgr: true });
    expect(p.add.map((a) => a.name)).toContain('vite-plugin-svgr');
  });

  it('flags workbox as unmapped and does not re-add present deps', () => {
    const p = planRemap({ 'react-scripts': '5', 'workbox-webpack-plugin': '6', vite: '5' });
    expect(p.unmapped).toContain('workbox-webpack-plugin');
    expect(p.add.map((a) => a.name)).not.toContain('vite');
  });
});
