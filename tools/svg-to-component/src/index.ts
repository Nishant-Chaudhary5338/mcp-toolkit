#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { generateSvgComponent } from './core.js';

class SvgToComponentServer extends McpServerBase {
  constructor() {
    super({ name: 'svg-to-component', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'convert_svg',
      'Convert an SVG (raw string or file path) into a typed React component that spreads SVGProps<SVGSVGElement> and optionally uses currentColor. Returns { code, filename, componentName }.',
      {
        type: 'object',
        properties: {
          svg: { type: 'string', description: 'Raw SVG markup.' },
          path: { type: 'string', description: 'Path to an .svg file (alternative to svg). Component name is inferred from the filename.' },
          name: { type: 'string', description: 'Component name. Required when passing raw svg; inferred from the filename when passing path.' },
          currentColor: { type: 'boolean', description: 'Replace hardcoded fill/stroke colors with currentColor. Default true.' },
        },
        required: [],
      },
      async (args) => {
        const { svg, path: p, name, currentColor } = (args ?? {}) as { svg?: string; path?: string; name?: string; currentColor?: boolean };
        try {
          let source = svg;
          let compName = name;
          if (p) {
            source = fs.readFileSync(p, 'utf8');
            compName = compName ?? path.basename(p, '.svg');
          }
          if (!source) return this.error(new Error('Provide "svg" markup or a "path" to an .svg file.'));
          if (!compName) return this.error(new Error('A "name" is required when passing raw svg.'));
          const outcome = generateSvgComponent(source, { name: compName, currentColor });
          if (!outcome.ok) return this.error(new Error(outcome.error));
          return this.success({ ...outcome.result });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new SvgToComponentServer().run().catch(console.error);
