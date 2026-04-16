#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// ============================================================================
// PATHS (ES module compatible)
// ============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// templates/ lives alongside build/ at the tool root
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
// ============================================================================
// NAME VALIDATION
// ============================================================================
function validateComponentName(name) {
    if (name.includes('-')) {
        const suggestion = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return { valid: false, suggestion, error: `Component name "${name}" contains hyphens. Use "${suggestion}" instead.` };
    }
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        return { valid: false, error: `Component name "${name}" must be PascalCase.` };
    }
    return { valid: true };
}
// ============================================================================
// TEMPLATE READER
// ============================================================================
function readTemplate(componentName) {
    const templatePath = path.join(TEMPLATES_DIR, `${componentName}.tsx`);
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${componentName}. Available: ${getAvailableTemplates().join(', ')}`);
    }
    const content = fs.readFileSync(templatePath, 'utf-8');
    // Fix @/lib/utils import for standalone use
    return content.replace(/import\s+\{?\s*cn\s*\}?\s+from\s+["']@\/lib\/utils["']/g, 'import { cn } from "../../lib/utils"');
}
function getAvailableTemplates() {
    if (!fs.existsSync(TEMPLATES_DIR))
        return [];
    return fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.tsx')).map(f => f.replace('.tsx', ''));
}
// ============================================================================
// VOID ELEMENT DETECTION
// ============================================================================
const VOID_COMPONENTS = ['input', 'img', 'separator', 'divider'];
function isVoidElement(name) {
    return VOID_COMPONENTS.includes(name.toLowerCase());
}
// ============================================================================
// CODE GENERATORS
// ============================================================================
function generateTypesCode(name, templateContent) {
    const typeExports = [];
    const re = /^export\s+(?:interface|type)\s+(\w+)/gm;
    let m;
    while ((m = re.exec(templateContent)) !== null)
        typeExports.push(m[1]);
    if (typeExports.length > 0) {
        return `// Re-exports of types defined in ${name}.tsx\nexport type { ${typeExports.join(', ')} } from './${name}'\n`;
    }
    return `import * as React from "react"\n\nexport interface ${name}ExtendedProps {\n  className?: string\n  children?: React.ReactNode\n}\n`;
}
function generateTestCode(name, templateContent) {
    const isVoid = isVoidElement(name);
    const hasCva = templateContent.includes('cva(');
    const hasVariants = hasCva && templateContent.includes('variant:');
    const hasSizes = hasCva && templateContent.includes('size:');
    const hasDisplayName = templateContent.includes('.displayName');
    const displayNameTest = hasDisplayName
        ? `\n  it('has correct displayName', () => {\n    expect(${name}.displayName).toBe('${name}')\n  })\n` : '';
    const variantTest = hasVariants && !isVoid
        ? `\n  it('renders destructive variant', () => {\n    const { container } = render(<${name} variant="destructive">Delete</${name}>)\n    expect(container.firstChild).toBeInTheDocument()\n  })\n` : '';
    const sizeTest = hasSizes && !isVoid
        ? `\n  it('renders sm size', () => {\n    const { container } = render(<${name} size="sm">Small</${name}>)\n    expect(container.firstChild).toBeInTheDocument()\n  })\n` : '';
    if (isVoid) {
        return `import { describe, it, expect } from 'vitest'\nimport { render, screen } from '@testing-library/react'\nimport { ${name} } from './${name}'\n\ndescribe('${name}', () => {\n  it('renders successfully', () => {\n    render(<${name} placeholder="test input" />)\n    expect(screen.getByPlaceholderText('test input')).toBeInTheDocument()\n  })\n${displayNameTest}})\n`;
    }
    return `import { describe, it, expect } from 'vitest'\nimport { render, screen } from '@testing-library/react'\nimport { ${name} } from './${name}'\n\ndescribe('${name}', () => {\n  it('renders successfully', () => {\n    render(<${name}>Test Content</${name}>)\n    expect(screen.getByText('Test Content')).toBeInTheDocument()\n  })\n\n  it('applies custom className', () => {\n    const { container } = render(<${name} className="custom-class">Test</${name}>)\n    expect(container.firstChild).toHaveClass('custom-class')\n  })\n${variantTest}${sizeTest}${displayNameTest}})\n`;
}
function generateStoriesCode(name) {
    const isVoid = isVoidElement(name);
    if (isVoid) {
        return `import type { Meta, StoryObj } from '@storybook/react'\nimport { ${name} } from './${name}'\n\nconst meta: Meta<typeof ${name}> = {\n  title: 'Components/${name}',\n  component: ${name},\n  tags: ['autodocs'],\n}\n\nexport default meta\ntype Story = StoryObj<typeof ${name}>\n\nexport const Default: Story = {\n  args: { placeholder: 'Enter text...', type: 'text' },\n}\n`;
    }
    return `import type { Meta, StoryObj } from '@storybook/react'\nimport { ${name} } from './${name}'\n\nconst meta: Meta<typeof ${name}> = {\n  title: 'Components/${name}',\n  component: ${name},\n  tags: ['autodocs'],\n}\n\nexport default meta\ntype Story = StoryObj<typeof ${name}>\n\nexport const Default: Story = {\n  args: { children: '${name}', variant: 'default' },\n}\n\nexport const Destructive: Story = {\n  args: { children: '${name}', variant: 'destructive' },\n}\n`;
}
function generateDocsCode(name, templateContent) {
    const exportMatches = templateContent.match(/export\s*\{([^}]+)\}/);
    const exports = exportMatches ? exportMatches[1].split(',').map(e => e.trim()) : [name];
    return `# ${name} Component\n\nA ${name.toLowerCase()} component built with shadcn/ui patterns.\n\n## Exports\n${exports.map(e => `- \`${e}\``).join('\n')}\n\n## Usage\n\n\`\`\`tsx\nimport { ${name} } from './${name}'\n\n<${name}>Click me</${name}>\n\`\`\`\n`;
}
function generateIndexCode(name) {
    return `export * from './${name}'\n`;
}
// ============================================================================
// REVIEW / FIX HELPERS
// ============================================================================
function runTypeScriptCheck(componentDir) {
    try {
        const tsconfig = findTsconfig(componentDir);
        if (!tsconfig)
            return { errors: ['No tsconfig.json found'], passed: false };
        execSync(`npx tsc --noEmit --project ${tsconfig}`, { cwd: componentDir, stdio: 'pipe', timeout: 30000 });
        return { errors: [], passed: true };
    }
    catch (error) {
        const err = error;
        const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
        return { errors: output.split('\n').filter((l) => l.trim()), passed: false };
    }
}
function checkAccessibility(componentDir, componentName) {
    const issues = [];
    const mainFile = path.join(componentDir, `${componentName}.tsx`);
    if (!fs.existsSync(mainFile)) {
        issues.push('Component file not found');
        return issues;
    }
    const content = fs.readFileSync(mainFile, 'utf-8');
    if (!content.includes('aria-') && !content.includes('role='))
        issues.push('Consider adding ARIA attributes');
    if (!content.includes('focus-visible'))
        issues.push('Consider adding focus-visible styles');
    if (!content.includes('displayName'))
        issues.push('Consider adding displayName for React DevTools');
    return issues;
}
function findTsconfig(dir) {
    let current = dir;
    while (current !== '/' && current !== '.') {
        const tsconfig = path.join(current, 'tsconfig.json');
        if (fs.existsSync(tsconfig))
            return tsconfig;
        current = path.dirname(current);
    }
    return null;
}
// ============================================================================
// MAIN SERVER CLASS
// ============================================================================
class ComponentFactoryServer extends McpServerBase {
    constructor() {
        super({ name: 'component-factory', version: '2.0.0' });
    }
    registerTools() {
        this.addTool('generate_component', 'Generate a React component using actual shadcn/ui source code with TypeScript types, tests, and Storybook stories', {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Component name in PascalCase (e.g., Button, Card, Input)' },
                outputPath: { type: 'string', description: 'Output directory path' },
                includeTests: { type: 'boolean', description: 'Generate Vitest test file', default: true },
                includeStories: { type: 'boolean', description: 'Generate Storybook stories', default: true },
                includeTypes: { type: 'boolean', description: 'Generate separate types file', default: true },
                includeDocs: { type: 'boolean', description: 'Generate documentation file', default: true },
            },
            required: ['name', 'outputPath'],
        }, this.handleGenerateComponent.bind(this));
        this.addTool('list_templates', 'List all available shadcn/ui component templates', { type: 'object', properties: {} }, this.handleListTemplates.bind(this));
        this.addTool('generate_component_library', 'Generate multiple components at once using shadcn/ui templates', {
            type: 'object',
            properties: {
                components: { type: 'array', items: { type: 'string' }, description: 'List of component names in PascalCase' },
                outputPath: { type: 'string', description: 'Base output directory path' },
                includeTests: { type: 'boolean', default: true },
                includeStories: { type: 'boolean', default: true },
            },
            required: ['components', 'outputPath'],
        }, this.handleGenerateLibrary.bind(this));
        this.addTool('check_component_exists', 'Check if a component already exists at the specified path', {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Component name' },
                outputPath: { type: 'string', description: 'Output directory path' },
            },
            required: ['name', 'outputPath'],
        }, this.handleCheckExists.bind(this));
        this.addTool('review_component', 'Review a generated component for TypeScript errors and accessibility issues. Returns a quality score and suggestions.', {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the component directory' },
            },
            required: ['path'],
        }, this.handleReviewComponent.bind(this));
        this.addTool('fix_component', 'Auto-fix common issues in a component: broken import paths, missing displayName, @/lib/utils → relative path', {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the component directory' },
            },
            required: ['path'],
        }, this.handleFixComponent.bind(this));
        this.addTool('improve_component', 'Improve a component by expanding tests with edge cases, adding more Storybook story variants, and enhancing docs', {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to the component directory' },
            },
            required: ['path'],
        }, this.handleImproveComponent.bind(this));
    }
    async handleGenerateComponent(args) {
        const { name, outputPath, includeTests = true, includeStories = true, includeTypes = true, includeDocs = true } = args;
        const validation = validateComponentName(name);
        if (!validation.valid) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, error: validation.error, suggestion: validation.suggestion }, null, 2) }],
                isError: true,
            };
        }
        try {
            const componentName = name.toLowerCase();
            const templateContent = readTemplate(componentName);
            const componentDir = path.join(outputPath, name);
            const resolvedDir = path.resolve(componentDir);
            if (fs.existsSync(resolvedDir))
                fs.rmSync(resolvedDir, { recursive: true, force: true });
            fs.mkdirSync(resolvedDir, { recursive: true });
            const files = [];
            const componentPath = path.join(componentDir, `${name}.tsx`);
            fs.writeFileSync(componentPath, templateContent);
            files.push(componentPath);
            if (includeTypes) {
                const typesPath = path.join(componentDir, `${name}.types.ts`);
                fs.writeFileSync(typesPath, generateTypesCode(name, templateContent));
                files.push(typesPath);
            }
            if (includeTests) {
                const testPath = path.join(componentDir, `${name}.test.tsx`);
                fs.writeFileSync(testPath, generateTestCode(name, templateContent));
                files.push(testPath);
            }
            if (includeStories) {
                const storiesPath = path.join(componentDir, `${name}.stories.tsx`);
                fs.writeFileSync(storiesPath, generateStoriesCode(name));
                files.push(storiesPath);
            }
            if (includeDocs) {
                const docsPath = path.join(componentDir, `${name}.docs.md`);
                fs.writeFileSync(docsPath, generateDocsCode(name, templateContent));
                files.push(docsPath);
            }
            const indexPath = path.join(componentDir, 'index.ts');
            fs.writeFileSync(indexPath, generateIndexCode(name));
            files.push(indexPath);
            return this.success({
                componentName: name,
                outputDirectory: componentDir,
                source: 'shadcn/ui template',
                filesGenerated: files.length,
                files,
                message: `Successfully generated ${name} component with ${files.length} files`,
            });
        }
        catch (error) {
            return this.error(error);
        }
    }
    async handleListTemplates(_args) {
        const templates = getAvailableTemplates();
        return this.success({ templates, count: templates.length, message: `Found ${templates.length} shadcn/ui component templates` });
    }
    async handleGenerateLibrary(args) {
        const { components, outputPath, includeTests = true, includeStories = true } = args;
        const results = [];
        for (const componentName of components) {
            const result = await this.handleGenerateComponent({ name: componentName, outputPath, includeTests, includeStories, includeTypes: true, includeDocs: true });
            results.push(JSON.parse(result.content[0].text || '{}'));
        }
        return this.success({ totalComponents: components.length, results, message: `Generated ${components.length} components` });
    }
    async handleCheckExists(args) {
        const { name, outputPath } = args;
        const componentDir = path.join(outputPath, name);
        const exists = fs.existsSync(componentDir);
        return this.success({
            exists,
            path: componentDir,
            files: exists ? fs.readdirSync(componentDir) : [],
            message: exists ? `Component ${name} already exists` : `Component ${name} does not exist`,
        });
    }
    async handleReviewComponent(args) {
        const { path: componentPath } = args;
        if (!fs.existsSync(componentPath))
            throw new Error(`Component path does not exist: ${componentPath}`);
        const componentName = path.basename(componentPath);
        const tsResult = runTypeScriptCheck(componentPath);
        const a11yIssues = checkAccessibility(componentPath, componentName);
        // Grade calculation
        let score = 100;
        if (!tsResult.passed)
            score -= 30;
        score -= Math.min(a11yIssues.length * 10, 30);
        const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
        const suggestions = [];
        if (!tsResult.passed)
            suggestions.push('Fix TypeScript compilation errors');
        if (a11yIssues.length > 0)
            suggestions.push('Address accessibility issues');
        return this.success({
            component: componentName,
            grade,
            score,
            typescriptErrors: tsResult.errors,
            accessibilityIssues: a11yIssues,
            suggestions,
            summary: score >= 75 ? 'Good quality component' : 'Needs improvement',
        });
    }
    async handleFixComponent(args) {
        const { path: componentPath } = args;
        if (!fs.existsSync(componentPath))
            throw new Error(`Component path does not exist: ${componentPath}`);
        const componentName = path.basename(componentPath);
        const mainFile = path.join(componentPath, `${componentName}.tsx`);
        const fixed = [];
        const remaining = [];
        if (!fs.existsSync(mainFile)) {
            remaining.push('Component .tsx file not found');
            return this.success({ component: componentName, fixed, remaining });
        }
        let content = fs.readFileSync(mainFile, 'utf-8');
        let modified = false;
        // Fix @/lib/utils import paths
        if (content.includes('@/lib/utils')) {
            content = content.replace(/import\s+\{?\s*cn\s*\}?\s+from\s+["']@\/lib\/utils["']/g, 'import { cn } from "../../lib/utils"');
            fixed.push('Fixed @/lib/utils import → relative path');
            modified = true;
        }
        // Fix @/components/* imports
        if (content.match(/from\s+["']@\/components\//)) {
            content = content.replace(/from\s+["']@\/components\//g, 'from "../../components/');
            fixed.push('Fixed @/components/* imports → relative paths');
            modified = true;
        }
        // Add missing displayName (only for forwardRef components without it)
        if (content.includes('React.forwardRef') && !content.includes('.displayName')) {
            content = content + `\n${componentName}.displayName = '${componentName}';\n`;
            fixed.push(`Added ${componentName}.displayName`);
            modified = true;
        }
        if (modified) {
            fs.writeFileSync(mainFile, content);
        }
        else {
            remaining.push('No auto-fixable issues found');
        }
        // Re-run review after fixes
        const tsResult = runTypeScriptCheck(componentPath);
        const a11yIssues = checkAccessibility(componentPath, componentName);
        return this.success({
            component: componentName,
            fixed,
            remaining,
            afterFix: {
                typescriptPassed: tsResult.passed,
                accessibilityIssues: a11yIssues,
            },
            message: fixed.length > 0 ? `Applied ${fixed.length} fix(es)` : 'No changes needed',
        });
    }
    async handleImproveComponent(args) {
        const { path: componentPath } = args;
        if (!fs.existsSync(componentPath))
            throw new Error(`Component path does not exist: ${componentPath}`);
        const componentName = path.basename(componentPath);
        const enhanced = [];
        // Read actual component for context-aware improvements
        const componentFile = path.join(componentPath, `${componentName}.tsx`);
        const templateContent = fs.existsSync(componentFile) ? fs.readFileSync(componentFile, 'utf-8') : '';
        // Improve test file
        const testFile = path.join(componentPath, `${componentName}.test.tsx`);
        if (fs.existsSync(testFile)) {
            const improvedTests = generateExtendedTestCode(componentName, templateContent);
            fs.writeFileSync(testFile, improvedTests);
            enhanced.push('Updated tests with edge cases and event handling');
        }
        // Improve stories file
        const storiesFile = path.join(componentPath, `${componentName}.stories.tsx`);
        if (fs.existsSync(storiesFile)) {
            const improvedStories = generateExtendedStoriesCode(componentName, templateContent);
            fs.writeFileSync(storiesFile, improvedStories);
            enhanced.push('Extended stories with more variants and states');
        }
        // Improve docs
        const docsFile = path.join(componentPath, `${componentName}.docs.md`);
        if (fs.existsSync(docsFile)) {
            const improvedDocs = generateDocsCode(componentName, templateContent);
            fs.writeFileSync(docsFile, improvedDocs);
            enhanced.push('Updated documentation');
        }
        return this.success({
            component: componentName,
            enhanced,
            message: enhanced.length > 0 ? `Improved ${enhanced.length} file(s)` : 'No files found to improve',
        });
    }
}
// ============================================================================
// EXTENDED CODE GENERATORS (for improve_component)
// ============================================================================
function generateExtendedTestCode(name, templateContent) {
    const isVoid = ['input', 'img', 'separator', 'divider'].includes(name.toLowerCase());
    const hasCva = templateContent.includes('cva(');
    const hasVariants = hasCva && templateContent.includes('variant:');
    const hasSizes = hasCva && templateContent.includes('size:');
    const hasDisplayName = templateContent.includes('.displayName');
    if (isVoid) {
        return `import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ${name} } from './${name}'

describe('${name}', () => {
  it('renders successfully', () => {
    render(<${name} placeholder="test input" />)
    expect(screen.getByPlaceholderText('test input')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<${name} className="custom-class" placeholder="test" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<${name} ref={ref} placeholder="test" />)
    expect(ref.current).not.toBeNull()
  })

  it('handles onChange events', () => {
    const handleChange = vi.fn()
    render(<${name} onChange={handleChange} placeholder="test" />)
    const input = screen.getByPlaceholderText('test')
    fireEvent.change(input, { target: { value: 'new value' } })
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('handles disabled state', () => {
    render(<${name} disabled placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).toBeDisabled()
  })
${hasDisplayName ? `
  it('has correct displayName', () => {
    expect(${name}.displayName).toBe('${name}')
  })
` : ''}})
`;
    }
    return `import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ${name} } from './${name}'

describe('${name}', () => {
  it('renders successfully', () => {
    render(<${name}>Test Content</${name}>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<${name} className="custom-class">Test</${name}>)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<${name} ref={ref}>Test</${name}>)
    expect(ref.current).not.toBeNull()
  })

  it('handles onClick events', () => {
    const handleClick = vi.fn()
    render(<${name} onClick={handleClick}>Click me</${name}>)
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('spreads additional props', () => {
    render(<${name} data-testid="test-component">Test</${name}>)
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })
${hasVariants ? `
  it('renders destructive variant', () => {
    const { container } = render(<${name} variant="destructive">Delete</${name}>)
    expect(container.firstChild).toBeInTheDocument()
  })
` : ''}${hasSizes ? `
  it('renders sm size', () => {
    const { container } = render(<${name} size="sm">Small</${name}>)
    expect(container.firstChild).toBeInTheDocument()
  })
` : ''}${hasDisplayName ? `
  it('has correct displayName', () => {
    expect(${name}.displayName).toBe('${name}')
  })
` : ''}})
`;
}
function generateExtendedStoriesCode(name, templateContent) {
    const hasCva = templateContent.includes('cva(');
    const hasVariants = hasCva && templateContent.includes('variant:');
    const hasSizes = hasCva && templateContent.includes('size:');
    return `import type { Meta, StoryObj } from '@storybook/react'
import { ${name} } from './${name}'

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof ${name}>

export const Default: Story = {
  args: { children: '${name}', variant: 'default' },
}
${hasVariants ? `
export const Destructive: Story = {
  args: { children: 'Delete', variant: 'destructive' },
}

export const Outline: Story = {
  args: { children: 'Outline', variant: 'outline' },
}

export const Ghost: Story = {
  args: { children: 'Ghost', variant: 'ghost' },
}
` : ''}${hasSizes ? `
export const Small: Story = {
  args: { children: 'Small', size: 'sm' },
}

export const Large: Story = {
  args: { children: 'Large', size: 'lg' },
}
` : ''}
export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
}
`;
}
new ComponentFactoryServer().run().catch(console.error);
//# sourceMappingURL=index.js.map