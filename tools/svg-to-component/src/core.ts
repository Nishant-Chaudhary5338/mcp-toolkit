// svg-to-component CORE — pure logic (no MCP transport).
//
// Raw SVG → a typed, tree-shakeable React component that spreads SVGProps and
// (optionally) uses currentColor so it inherits text color. SVGR-grade, no
// build step. Kills manual icon-component wrapping.

export interface SvgComponentResult {
  code: string;
  filename: string;
  componentName: string;
}

export type SvgComponentOutcome =
  | { ok: true; result: SvgComponentResult }
  | { ok: false; error: string };

export interface SvgComponentOptions {
  name: string;
  currentColor?: boolean;
}

const KEBAB_ATTRS: Record<string, string> = {
  'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray', 'stroke-dashoffset': 'strokeDashoffset', 'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity', 'fill-rule': 'fillRule', 'fill-opacity': 'fillOpacity', 'clip-rule': 'clipRule',
  'clip-path': 'clipPath', 'stop-color': 'stopColor', 'stop-opacity': 'stopOpacity',
  'xlink:href': 'xlinkHref', 'xmlns:xlink': 'xmlnsXlink',
};

function pascal(s: string): string {
  return s.replace(/\.svg$/i, '').replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('') || 'Icon';
}

function jsxify(svg: string, currentColor: boolean): string {
  let out = svg;
  // strip xml decl, doctype, comments
  out = out.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  // class -> className
  out = out.replace(/\bclass=/g, 'className=');
  // kebab / namespaced attrs -> camelCase
  for (const [k, v] of Object.entries(KEBAB_ATTRS)) {
    out = out.replace(new RegExp(k.replace(/[:]/g, '\\$&') + '=', 'g'), `${v}=`);
  }
  if (currentColor) {
    out = out.replace(/(fill|stroke)="(?!none)(#[0-9a-fA-F]+|[a-z]+)"/g, '$1="currentColor"');
  }
  // inject {...props} into the root <svg ...>
  out = out.replace(/<svg\b/, '<svg {...props}');
  return out;
}

export function generateSvgComponent(svg: string, opts: SvgComponentOptions): SvgComponentOutcome {
  if (!opts?.name) return { ok: false, error: 'A component "name" is required.' };
  if (typeof svg !== 'string' || !/<svg[\s>]/i.test(svg)) return { ok: false, error: 'Input does not contain an <svg> element.' };

  const componentName = pascal(opts.name);
  const currentColor = opts.currentColor !== false;
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start < 0 || end < 0) return { ok: false, error: 'Could not find a complete <svg>…</svg> element.' };
  const inner = jsxify(svg.slice(start, end + 6), currentColor);

  const code = `import type { SVGProps } from 'react';

export function ${componentName}(props: SVGProps<SVGSVGElement>) {
  return (
    ${inner.replace(/\n/g, '\n    ')}
  );
}
`;

  return { ok: true, result: { code, filename: `${componentName}.tsx`, componentName } };
}
