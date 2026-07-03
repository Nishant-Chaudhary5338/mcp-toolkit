#!/usr/bin/env node
import { McpServerBase, safeReadFile, isServerComponent, NEXTJS_ROUTE_FILES, resolveRelativeImport } from '@mcp-showcase/shared';
import { renderResultHTML } from '@mcp-showcase/ui-kit';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeSource } from './analyzer.js';
import { generateComponentTests, generateFunctionTests, generateHookTests, generateClassTests, assembleTestFile } from './generators.js';
import { toResultReport, type GenerateTestsResult } from './result-report.js';

function scanDirectory(dir: string, exts: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const SKIP = new Set(['node_modules', 'build', 'dist', '.next', '.turbo', '.git', 'coverage', 'out']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      files.push(...scanDirectory(full, exts));
    } else if (
      exts.some(e => entry.name.endsWith(e)) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.') &&
      !entry.name.includes('.stories.') &&
      !entry.name.includes('.types.')
    ) {
      files.push(full);
    }
  }
  return files;
}

function testFilePath(sourceFile: string): string {
  const dir = path.dirname(sourceFile);
  const ext = path.extname(sourceFile);
  const base = path.basename(sourceFile, ext);
  const testExt = ext.includes('x') ? '.test.tsx' : '.test.ts';
  return path.join(dir, `${base}${testExt}`);
}

class GenerateTestsServer extends McpServerBase {
  constructor() {
    super({ name: 'generate-tests', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_tests',
      'Analyze a TypeScript/React source file and generate a Vitest test file for all exported components, functions, hooks, and classes.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to source file to generate tests for' },
          outputPath: { type: 'string', description: 'Where to write the test file (defaults to <name>.test.tsx alongside the source)' },
          overwrite: { type: 'boolean', description: 'Overwrite existing test file (default: false)' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: srcPath, outputPath, overwrite = false } = (args ?? {}) as {
          path: string;
          outputPath?: string;
          overwrite?: boolean;
        };
        try {
          const resolved = path.resolve(srcPath);
          if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);

          const content = safeReadFile(resolved);
          if (content === null) throw new Error(`File too large or unreadable: ${resolved}`);

          // Skip Next.js server-only route files — they can't be rendered with RTL
          const fileName = path.basename(resolved);
          if (NEXTJS_ROUTE_FILES.has(fileName) && isServerComponent(resolved, content)) {
            return this.success({
              message: `Skipped ${fileName}: Next.js Server Component route files require integration-style tests`,
              isServerComponent: true,
              file: resolved,
            });
          }

          const analysis = analyzeSource(content);

          // Compute the destination first so the import specifier is correct
          // relative to where the test file will actually live.
          const dest = outputPath ? path.resolve(outputPath) : testFilePath(resolved);
          const importPath = resolveRelativeImport(dest, resolved);

          const testSections: string[] = [];

          for (const c of analysis.components) {
            testSections.push(generateComponentTests(c, importPath));
          }
          for (const h of analysis.hooks) {
            testSections.push(generateHookTests(h, importPath));
          }
          for (const f of analysis.functions) {
            testSections.push(generateFunctionTests(f, importPath));
          }
          for (const cl of analysis.classes) {
            testSections.push(generateClassTests(cl, importPath));
          }

          if (testSections.length === 0) {
            return this.success({ message: 'No exportable symbols found to generate tests for', analysis });
          }

          const testContent = assembleTestFile(testSections);

          if (fs.existsSync(dest) && !overwrite) {
            return this.success({
              message: `Test file already exists: ${dest}. Pass overwrite: true to replace it.`,
              testContent,
              dest,
            });
          }

          fs.writeFileSync(dest, testContent, 'utf-8');

          const successResult: GenerateTestsResult = {
            message: `Generated ${testSections.length} test suite(s)`,
            dest,
            testContent,
            analysis: {
              components: analysis.components.map(c => c.name),
              hooks: analysis.hooks.map(h => h.name),
              functions: analysis.functions.map(f => f.name),
              classes: analysis.classes.map(c => c.name),
            },
          };
          return this.successWithUI(successResult as unknown as Record<string, unknown>, {
            uri: 'ui://generate-tests/report',
            html: renderResultHTML(toResultReport(successResult, new Date().toISOString().slice(0, 10))),
          });
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'generate_tests_for_directory',
      'Scan a directory and generate test files for all source files that do not already have tests.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory to scan' },
          overwrite: { type: 'boolean', description: 'Overwrite existing test files (default: false)' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: dirPath, overwrite = false } = (args ?? {}) as { path: string; overwrite?: boolean };
        try {
          const resolved = path.resolve(dirPath);
          const files = scanDirectory(resolved);
          const generated: string[] = [];
          const skipped: string[] = [];

          for (const file of files) {
            const content = safeReadFile(file);
            if (content === null) continue;
            // Skip Next.js server-only route files
            const fname = path.basename(file);
            if (NEXTJS_ROUTE_FILES.has(fname) && isServerComponent(file, content)) continue;
            const analysis = analyzeSource(content);
            const hasSymbols = analysis.components.length + analysis.hooks.length + analysis.functions.length + analysis.classes.length > 0;
            if (!hasSymbols) continue;

            const dest = testFilePath(file);
            if (fs.existsSync(dest) && !overwrite) {
              skipped.push(path.relative(resolved, file));
              continue;
            }

            const importPath = resolveRelativeImport(dest, file);
            const sections: string[] = [];
            for (const c of analysis.components) sections.push(generateComponentTests(c, importPath));
            for (const h of analysis.hooks) sections.push(generateHookTests(h, importPath));
            for (const f of analysis.functions) sections.push(generateFunctionTests(f, importPath));
            for (const cl of analysis.classes) sections.push(generateClassTests(cl, importPath));

            fs.writeFileSync(dest, assembleTestFile(sections), 'utf-8');
            generated.push(path.relative(resolved, dest));
          }

          return this.success({
            summary: `Generated ${generated.length} test files, skipped ${skipped.length} (already exist)`,
            generated,
            skipped,
          });
        } catch (error) {
          return this.error(error);
        }
      }
    );
  }
}

new GenerateTestsServer().run().catch(console.error);
