#!/usr/bin/env node
import { McpServerBase, safeReadFile } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface PropField {
  name: string;
  type: string;
  optional: boolean;
}

interface ComponentInfo {
  name: string;
  file: string;
  props: PropField[];
  hasVariants: boolean;
  hasSizes: boolean;
  variantValues: string[];
  sizeValues: string[];
  isVoidElement: boolean;
  isInteractive: boolean;
  hasChildren: boolean;
  hasDisabled: boolean;
  hasLoading: boolean;
  callbacks: string[];
}

// ============================================================================
// COMPONENT ANALYSIS
// ============================================================================

const VOID_NAMES = new Set(['input', 'img', 'separator', 'divider', 'hr', 'br', 'textarea']);
const INTERACTIVE_NAMES = ['button', 'link', 'anchor', 'tab', 'toggle', 'switch', 'checkbox', 'radio'];

function scanDirectory(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'build', 'dist', '.next', '__tests__', '.turbo', '.git'].includes(entry.name)) continue;
      files.push(...scanDirectory(fullPath));
    } else if (entry.name.match(/\.(tsx|jsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.includes('.stories.')) continue;
      files.push(fullPath);
    }
  }
  return files;
}

export function extractPropsInterface(content: string, componentName: string): PropField[] {
  const patterns = [
    // Named: ButtonProps, ToolCardProps, etc.
    new RegExp(`interface\\s+${componentName}Props(?:\\s+extends[^{]*)?\\s*\\{([^}]*)\\}`, 's'),
    new RegExp(`type\\s+${componentName}Props\\s*=\\s*(?:[^{]*&\\s*)?\\{([^}]*)\\}`, 's'),
    // Generic "Props" interface (very common pattern)
    /interface\s+Props(?:\s+extends[^{]*)?\s*\{([^}]*)\}/s,
    /type\s+Props\s*=\s*(?:[^{]*&\s*)?\{([^}]*)\}/s,
    // Inline props destructured: function Foo({ bar, baz }: { bar: string; baz?: number })
    new RegExp(`(?:function|const)\\s+${componentName}\\s*\\(\\s*\\{[^}]*\\}\\s*:\\s*\\{([^}]*)\\}`, 's'),
  ];
  for (const pattern of patterns) {
    const m = content.match(pattern);
    if (!m) continue;
    const fields: PropField[] = [];
    for (const field of m[1].matchAll(/(\w+)(\??)\s*:\s*([^;\n]+)/g)) {
      fields.push({ name: field[1], optional: field[2] === '?', type: field[3].trim() });
    }
    if (fields.length > 0) return fields;
  }
  return [];
}

export function extractVariantValues(content: string, key: 'variant' | 'size'): string[] {
  // Strategy 1: cva() object pattern: size: { sm: {...}, md: {...} }
  const cvaPattern = new RegExp(`${key}\\s*:\\s*\\{([^}]*)\\}`, 's');
  const cvaMatch = content.match(cvaPattern);
  if (cvaMatch) {
    const values: string[] = [];
    for (const vm of cvaMatch[1].matchAll(/['"`]?(\w+)['"`]?\s*:/g)) {
      if (vm[1] !== key) values.push(vm[1]);
    }
    if (values.length > 0) return values.slice(0, 8);
  }

  // Strategy 2: TypeScript interface/type union literal: size?: 'small' | 'medium' | 'large'
  const unionPattern = new RegExp(`${key}\\??\\s*:\\s*((?:'[^']+'|"[^"]+"|\`[^\`]+\`|\\|?\\s*)+)`, 's');
  const unionMatch = content.match(unionPattern);
  if (unionMatch) {
    const values: string[] = [];
    for (const vm of unionMatch[1].matchAll(/['"`]([^'"`]+)['"`]/g)) {
      values.push(vm[1]);
    }
    if (values.length > 0) return values.slice(0, 8);
  }

  return [];
}

function analyzeComponent(content: string, filePath: string): ComponentInfo | null {
  const fileName = path.basename(filePath, path.extname(filePath));
  const nameMatch = content.match(/export\s+(?:default\s+)?(?:const|function)\s+([A-Z]\w+)/);
  const name = nameMatch ? nameMatch[1] : fileName.replace(/[^a-zA-Z0-9]/g, '');

  const isComponent = /(?:export\s+(?:default\s+)?)?(?:const|function)\s+[A-Z]\w+/.test(content) ||
    content.includes('React.FC') || content.includes('forwardRef');
  if (!isComponent) return null;

  const props = extractPropsInterface(content, name);
  const variantValues = extractVariantValues(content, 'variant');
  const sizeValues = extractVariantValues(content, 'size');

  const hasVariants = variantValues.length > 0 || (content.includes('variant') && (content.includes('cva') || content.includes("'default'")));
  const hasSizes = sizeValues.length > 0 || (content.includes('size') && content.includes('cva'));
  const isVoidElement = VOID_NAMES.has(name.toLowerCase());
  const isInteractive = INTERACTIVE_NAMES.some(i => name.toLowerCase().includes(i));
  const hasChildren = props.some(p => p.name === 'children') || (content.includes('children') && !isVoidElement);
  const hasDisabled = props.some(p => p.name === 'disabled') || content.includes('disabled');
  const hasLoading = props.some(p => p.name === 'loading' || p.name === 'isLoading');
  const callbacks = props.filter(p => /^on[A-Z]/.test(p.name)).map(p => p.name).slice(0, 5);

  return {
    name, file: filePath, props, hasVariants, hasSizes,
    variantValues: variantValues.length > 0 ? variantValues : (hasVariants ? ['default', 'destructive', 'outline', 'secondary', 'ghost'] : []),
    sizeValues: sizeValues.length > 0 ? sizeValues : (hasSizes ? ['sm', 'default', 'lg'] : []),
    isVoidElement, isInteractive, hasChildren, hasDisabled, hasLoading, callbacks,
  };
}

// ============================================================================
// ARGTYPE GENERATION
// ============================================================================

export function propTypeToControl(propType: string): string {
  const t = propType.trim();
  if (t === 'boolean') return "control: 'boolean'";
  if (t === 'number') return "control: 'number'";
  if (/string\s*\|/.test(t) || /\|\s*string/.test(t)) return "control: 'text'";
  if (t === 'string') return "control: 'text'";
  if (t.includes('|') && !t.includes('=>')) {
    const options = t.split('|').map(o => o.trim().replace(/['"]/g, '')).filter(Boolean);
    return `control: 'select', options: [${options.map(o => `'${o}'`).join(', ')}]`;
  }
  if (t.startsWith('(') || t.includes('=>')) return "action: 'called'";
  return "control: 'text'";
}

export function generateArgTypes(props: PropField[]): string {
  if (props.length === 0) return '';
  const lines = props
    .filter(p => !['className', 'style', 'ref'].includes(p.name))
    .map(p => {
      const control = propTypeToControl(p.type);
      if (control.startsWith('action:')) {
        return `    ${p.name}: { ${control} },`;
      }
      return `    ${p.name}: { ${control} },`;
    });
  return lines.length > 0 ? `  argTypes: {\n${lines.join('\n')}\n  },` : '';
}

// ============================================================================
// MOCK DATA GENERATION
// ============================================================================

export function getMockValue(propName: string, propType: string, componentName: string): string | null {
  const t = propType.trim().toLowerCase();
  const n = propName.toLowerCase();

  // Boolean props
  if (t === 'boolean') return 'false';

  // Number props
  if (t === 'number') {
    if (n.includes('count') || n.includes('total') || n.includes('length')) return '5';
    if (n.includes('min')) return '0';
    if (n.includes('max')) return '100';
    if (n.includes('step')) return '1';
    if (n.includes('width') || n.includes('height') || n.includes('size')) return '200';
    if (n.includes('index')) return '0';
    return '42';
  }

  // String props — give contextual defaults
  if (t === 'string') {
    if (n === 'label' || n === 'title') return `'${componentName} label'`;
    if (n === 'placeholder') return `'Enter ${n}...'`;
    if (n === 'id') return `'${n}-1'`;
    if (n === 'name') return `'${n}-field'`;
    if (n === 'value') return `'example value'`;
    if (n.includes('text') || n.includes('content') || n.includes('message') || n.includes('description')) return `'Sample ${n} text'`;
    if (n.includes('url') || n.includes('href') || n.includes('src')) return `'https://example.com'`;
    if (n.includes('icon')) return `'star'`;
    if (n.includes('color')) return `'#3b82f6'`;
    if (n.includes('className') || n.includes('class')) return `''`;
    if (n.includes('variant')) return `'default'`;
    if (n.includes('size')) return `'md'`;
    return `'Example ${propName}'`;
  }

  // Union types: pick first value
  const unionMatch = propType.match(/^'([^']+)'/);
  if (unionMatch) return `'${unionMatch[1]}'`;

  // React.ReactNode / JSX.Element / ReactElement
  if (t.includes('reactnode') || t.includes('reactelement') || t.includes('jsx.element') || t.includes('react.fc')) {
    return `'Content here'`;
  }

  // Array types: provide an example array
  if (t.endsWith('[]') || t.startsWith('array<')) {
    return '[]';
  }

  // Callback/function — skip (handled separately via callbacks)
  if (t.includes('=>') || t.startsWith('function') || t === '() => void') return null;

  // Object types — provide empty object or null
  if (t === 'object' || t.startsWith('{')) return 'undefined';

  return null;
}

// ============================================================================
// STORY GENERATION
// ============================================================================

function generateStory(info: ComponentInfo): string {
  const { name, props, hasVariants, hasSizes, isVoidElement, isInteractive, hasChildren, hasDisabled, hasLoading, callbacks, variantValues, sizeValues } = info;

  const renderContent = isVoidElement ? `placeholder="${name} text"` : (hasChildren ? `>{...}</${name}>` : '');
  const defaultChild = hasChildren && !isVoidElement ? `\n  args: {\n    children: '${name} content',\n  },` : '';
  const selfClose = isVoidElement ? ' />' : '';
  const argTypes = generateArgTypes(props);

  // Storybook @storybook/test imports for play functions
  const hasPlayFn = isInteractive && (callbacks.length > 0 || hasDisabled);

  let out = `import type { Meta, StoryObj } from '@storybook/react';`;
  if (hasPlayFn) {
    out += `\nimport { within, userEvent, expect } from '@storybook/test';`;
  }
  out += `\nimport { ${name} } from './${name}';\n`;

  // Meta
  out += `\nconst meta: Meta<typeof ${name}> = {\n`;
  out += `  title: 'Components/${name}',\n`;
  out += `  component: ${name},\n`;
  out += `  tags: ['autodocs'],\n`;
  out += `  parameters: {\n`;
  out += `    layout: '${isVoidElement ? 'centered' : 'centered'}',\n`;
  out += `    docs: {\n`;
  out += `      description: {\n`;
  out += `        component: '${name} component — see the Args table for all available props.',\n`;
  out += `      },\n`;
  out += `    },\n`;
  out += `  },\n`;
  if (argTypes) out += `${argTypes}\n`;
  out += `};\n\nexport default meta;\ntype Story = StoryObj<typeof ${name}>;\n`;

  // ── Default story (includes required props with mock data) ────────────────
  const requiredProps = props.filter(p => !p.optional && !['className', 'children', 'style', 'ref'].includes(p.name) && !p.name.startsWith('on'));
  const defaultArgs: string[] = [];
  if (hasChildren && !isVoidElement) defaultArgs.push(`    children: '${name} content'`);
  for (const p of requiredProps) {
    const mockVal = getMockValue(p.name, p.type, name);
    if (mockVal !== null) defaultArgs.push(`    ${p.name}: ${mockVal}`);
  }
  const defaultArgsBlock = defaultArgs.length > 0 ? `\n  args: {\n${defaultArgs.join(',\n')},\n  },` : (defaultChild || '');
  out += `\n// ----- Default -----\nexport const Default: Story = {${defaultArgsBlock}\n};\n`;

  // ── Playground (all controls enabled) ─────────────────────────────────────
  out += `\n// ----- Playground (edit any prop in the Controls panel) -----\nexport const Playground: Story = {\n  args: {`;
  if (hasChildren && !isVoidElement) out += `\n    children: '${name} content',`;
  for (const p of props.filter(p => !['className', 'children', 'style', 'ref'].includes(p.name) && !p.name.startsWith('on'))) {
    const mockVal = getMockValue(p.name, p.type, name);
    if (mockVal !== null) out += `\n    ${p.name}: ${mockVal},`;
  }
  out += `\n  },\n};\n`;

  // ── Variant stories ────────────────────────────────────────────────────────
  if (hasVariants && variantValues.length > 0) {
    out += `\n// ----- Variants -----\n`;
    for (const v of variantValues) {
      const storyName = v.charAt(0).toUpperCase() + v.slice(1);
      out += `export const ${storyName}: Story = {\n  args: {\n    variant: '${v}',`;
      if (hasChildren && !isVoidElement) out += `\n    children: '${storyName} variant',`;
      out += `\n  },\n};\n`;
    }

    // AllVariants composite
    out += `\n// ----- All variants side-by-side -----\nexport const AllVariants: Story = {\n  render: () => (\n    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>\n`;
    for (const v of variantValues) {
      if (isVoidElement) {
        out += `      <${name} variant="${v}" placeholder="${v}" />\n`;
      } else {
        out += `      <${name} variant="${v}">${v}</${name}>\n`;
      }
    }
    out += `    </div>\n  ),\n};\n`;
  }

  // ── Size stories ───────────────────────────────────────────────────────────
  if (hasSizes && sizeValues.length > 0) {
    out += `\n// ----- Sizes -----\n`;
    for (const s of sizeValues) {
      const storyName = `Size${s.charAt(0).toUpperCase() + s.slice(1)}`;
      out += `export const ${storyName}: Story = {\n  args: {\n    size: '${s}',`;
      if (hasChildren && !isVoidElement) out += `\n    children: '${s} size',`;
      out += `\n  },\n};\n`;
    }
  }

  // ── Disabled state ─────────────────────────────────────────────────────────
  if (hasDisabled) {
    out += `\n// ----- Disabled state -----\nexport const Disabled: Story = {\n  args: {\n    disabled: true,`;
    if (hasChildren && !isVoidElement) out += `\n    children: 'Disabled',`;
    out += `\n  },\n};\n`;
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (hasLoading) {
    out += `\n// ----- Loading state -----\nexport const Loading: Story = {\n  args: {\n    loading: true,`;
    if (hasChildren && !isVoidElement) out += `\n    children: 'Loading...',`;
    out += `\n  },\n};\n`;
  }

  // ── Callback story (Actions panel) ─────────────────────────────────────────
  if (callbacks.length > 0) {
    out += `\n// ----- With callbacks (check Actions panel) -----\nexport const WithCallbacks: Story = {\n  args: {`;
    for (const cb of callbacks) {
      out += `\n    ${cb}: () => console.log('${cb} fired'),`;
    }
    if (hasChildren && !isVoidElement) out += `\n    children: 'Click me',`;
    out += `\n  },\n};\n`;
  }

  // ── Accessibility story ────────────────────────────────────────────────────
  out += `\n// ----- Accessibility (with ARIA attributes) -----\nexport const Accessibility: Story = {\n  args: {\n    'aria-label': '${name} accessible label',`;
  if (hasChildren && !isVoidElement) out += `\n    children: 'Accessible ${name}',`;
  out += `\n  },\n};\n`;

  // ── Interactive play function (for button/input-like components) ───────────
  if (isInteractive && callbacks.includes('onClick')) {
    out += `\n// ----- Interactive (automated interaction test) -----\nexport const Interactive: Story = {\n  args: {\n    onClick: () => {},`;
    if (hasChildren && !isVoidElement) out += `\n    children: 'Click me',`;
    out += `\n  },\n  play: async ({ canvasElement }) => {\n    const canvas = within(canvasElement);\n    const el = canvas.getByRole('button');\n    await userEvent.click(el);\n    await expect(el).toBeInTheDocument();\n  },\n};\n`;
  }

  if (isVoidElement && callbacks.includes('onChange')) {
    out += `\n// ----- Input interaction test -----\nexport const InputInteraction: Story = {\n  args: {\n    placeholder: 'Type here...',\n    onChange: () => {},\n  },\n  play: async ({ canvasElement }) => {\n    const canvas = within(canvasElement);\n    const input = canvas.getByRole('textbox');\n    await userEvent.type(input, 'Hello world');\n    await expect(input).toHaveValue('Hello world');\n  },\n};\n`;
  }

  return out;
}

function findExistingStories(dir: string): string[] {
  const stories: string[] = [];
  if (!fs.existsSync(dir)) return stories;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.endsWith('.stories.tsx') || entry.name.endsWith('.stories.ts')) {
      stories.push(entry.name.replace(/\.(stories\.(tsx|ts))$/, ''));
    }
  }
  return stories;
}

// ============================================================================
// MAIN SERVER
// ============================================================================

class StorybookGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'storybook-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_stories',
      'Analyze React component files and generate comprehensive Storybook story files: Default, Playground, all variants, sizes, disabled, loading, callbacks, accessibility, and interactive play functions.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to component file or directory' },
          outputPath: { type: 'string', description: 'Directory to write story files (defaults to same directory as component)' },
          overwrite: { type: 'boolean', description: 'Overwrite existing story files (default: false)' },
        },
        required: ['path'],
      },
      (args) => this.handleGenerate(args)
    );

    this.addTool(
      'check_story_coverage',
      'Report which components already have Storybook stories and which are missing them.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory to scan for components and stories' },
        },
        required: ['path'],
      },
      (args) => this.handleCoverage(args)
    );
  }

  private async handleGenerate(args: unknown) {
    const { path: targetPath, outputPath, overwrite = false } = args as {
      path: string;
      outputPath?: string;
      overwrite?: boolean;
    };
    try {
      const stat = fs.statSync(targetPath);
      const isDir = stat.isDirectory();
      const files = isDir ? scanDirectory(targetPath) : [targetPath];
      const results: unknown[] = [];

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const info = analyzeComponent(content, file);
        if (!info) continue;

        const dir = path.dirname(file);
        const existingStories = findExistingStories(dir);
        if (existingStories.includes(info.name) && !overwrite) {
          results.push({ file, skipped: true, reason: 'Story already exists. Pass overwrite: true to replace.' });
          continue;
        }

        const storyContent = generateStory(info);
        const storyDir = outputPath || dir;
        const storyPath = path.join(storyDir, `${info.name}.stories.tsx`);

        fs.mkdirSync(path.dirname(storyPath), { recursive: true });
        fs.writeFileSync(storyPath, storyContent);

        // Count stories by counting "export const"
        const storiesCount = (storyContent.match(/^export const /gm) || []).length;

        results.push({
          file,
          storyPath,
          component: info.name,
          storiesCount,
          stories: storyContent.match(/^export const (\w+):/gm)?.map(s => s.replace(/^export const (\w+):.*$/, '$1')) ?? [],
          props: info.props.map(p => p.name),
        });
      }

      const generated = results.filter((r: any) => !r.skipped).length;
      const skipped = results.filter((r: any) => r.skipped).length;
      return this.success({ generated, skipped, results });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleCoverage(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const isDir = stat.isDirectory();
      const files = isDir ? scanDirectory(targetPath) : [targetPath];
      const components: unknown[] = [];
      let withStories = 0;
      let withoutStories = 0;

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const info = analyzeComponent(content, file);
        if (!info) continue;

        const dir = path.dirname(file);
        const storiesPath = path.join(dir, `${info.name}.stories.tsx`);
        const hasStories = fs.existsSync(storiesPath);

        if (hasStories) withStories++;
        else withoutStories++;

        components.push({
          name: info.name,
          file,
          hasStories,
          storiesPath: hasStories ? storiesPath : null,
          propsCount: info.props.length,
          hasVariants: info.hasVariants,
          hasSizes: info.hasSizes,
        });
      }

      const total = components.length;
      return this.success({
        summary: {
          totalComponents: total,
          withStories,
          withoutStories,
          coveragePercent: total > 0 ? Math.round((withStories / total) * 100) : 100,
        },
        components,
      });
    } catch (error) {
      return this.error(error);
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new StorybookGeneratorServer().run().catch(console.error);
