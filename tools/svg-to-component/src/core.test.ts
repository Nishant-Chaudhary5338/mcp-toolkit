import { describe, it, expect } from 'vitest';
import { generateSvgComponent } from './core.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2"><path class="a" d="M5 12h14" stroke-linecap="round"/></svg>';

describe('generateSvgComponent', () => {
  it('wraps the svg in a typed component and spreads props', () => {
    const out = generateSvgComponent(SVG, { name: 'arrow-right' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import type { SVGProps } from 'react'");
    expect(code).toContain('export function ArrowRight(props: SVGProps<SVGSVGElement>)');
    expect(code).toContain('<svg {...props}');
    expect(out.result.filename).toBe('ArrowRight.tsx');
  });

  it('camelCases attributes and renames class', () => {
    const out = generateSvgComponent(SVG, { name: 'x' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('strokeWidth=');
    expect(out.result.code).toContain('strokeLinecap=');
    expect(out.result.code).toContain('className="a"');
    expect(out.result.code).not.toContain('stroke-width');
  });

  it('replaces hardcoded colors with currentColor by default, leaving fill="none"', () => {
    const out = generateSvgComponent(SVG, { name: 'x' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('stroke="currentColor"');
    expect(out.result.code).toContain('fill="none"');
  });

  it('keeps hardcoded colors when currentColor is false', () => {
    const out = generateSvgComponent(SVG, { name: 'x', currentColor: false });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('stroke="#000000"');
  });

  it('rejects non-svg input', () => {
    expect(generateSvgComponent('<div/>', { name: 'x' }).ok).toBe(false);
  });
});
