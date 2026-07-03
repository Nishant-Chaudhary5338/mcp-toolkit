#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeCra, type CraPackageJson } from '@mcp-showcase/craconfig-analyzer/build/core.js';
import { planRemap } from '@mcp-showcase/dependency-remapper/build/core.js';
import { translateWebpack } from '@mcp-showcase/webpack-config-translator/build/core.js';
import { generateViteProject } from '@mcp-showcase/vite-project-scaffolder/build/core.js';
import { migrateSource } from '@mcp-showcase/env-var-migrator/build/core.js';
import { migrateTest } from '@mcp-showcase/jest-to-vitest-migrator/build/core.js';
import { deriveScaffoldOptions, collectManualReview, gradeMigration, buildNextSteps, type JournalEntry } from './core.js';

const SKIP = new Set(['node_modules', 'build', 'dist', '.git']);
function walk(dir: string, test: (name: string) => boolean): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...walk(full, test)); }
    else if (test(e.name)) out.push(full);
  }
  return out;
}
function readJson(p: string): Record<string, unknown> | undefined { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } }
function exists(...p: string[]): boolean { return fs.existsSync(path.join(...p)); }

class CraToViteServer extends McpServerBase {
  constructor() { super({ name: 'cra-to-vite', version: '1.0.0' }); }

  protected registerTools(): void {
    this.addTool(
      'migrate',
      'Orchestrate a CRA -> Vite migration: analyze the project, plan dependency + webpack changes, scaffold the Vite shell, and summarize env + test migration. Returns a ModernizationReport { profile, depRemap, webpackTranslation, scaffoldFiles, envMigration, testMigration, manualReview, journal, grade }. Writes the Vite shell into outDir when dryRun:false. The actual src env/test rewrites are run explicitly afterward via env-var-migrator and jest-to-vitest-migrator (dryRun:false).',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'CRA project root.' },
          outDir: { type: 'string', description: 'Where to write the Vite shell (default <path>-vite). Only written when dryRun:false.' },
          dryRun: { type: 'boolean', description: 'Analyze + plan without writing. Default true.' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: root, outDir, dryRun = true } = (args ?? {}) as { path?: string; outDir?: string; dryRun?: boolean };
        if (!root) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(root)) throw new Error(`Path does not exist: ${root}`);
          const journal: JournalEntry[] = [];

          // 1. ANALYZE
          const packageJson = (readJson(path.join(root, 'package.json')) ?? {}) as CraPackageJson & { name?: string };
          const srcFiles = walk(path.join(root, 'src'), (n) => /\.(tsx?|jsx?)$/.test(n));
          const sources = srcFiles.map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n') +
            (exists(root, 'public', 'index.html') ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '');
          const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'].filter((f) => exists(root, f));
          const profile = analyzeCra({
            packageJson, sources,
            hasConfigDir: exists(root, 'config', 'webpack.config.js'),
            hasCraco: exists(root, 'craco.config.js'),
            hasJestConfig: exists(root, 'jest.config.js') || exists(root, 'jest.config.ts'),
            hasSetupProxy: exists(root, 'src', 'setupProxy.js'),
            hasSetupTests: exists(root, 'src', 'setupTests.js') || exists(root, 'src', 'setupTests.ts'),
            envFiles,
            jsconfig: readJson(path.join(root, 'jsconfig.json')) as { compilerOptions?: { baseUrl?: string } } | undefined,
          });
          if (!profile.isCRA) { journal.push({ step: 'analyze', ok: false, note: 'Not a CRA project (no react-scripts).' }); return this.error(new Error('Not a CRA project — nothing to migrate.')); }
          journal.push({ step: 'analyze', ok: true, note: `CRA${profile.reactScriptsVersion ? ' ' + profile.reactScriptsVersion : ''}, ${srcFiles.length} src files, test runner ${profile.testRunner}` });

          // 2. PLAN deps
          const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
          const depRemap = planRemap(deps, { svgr: profile.svgReactComponentImport, sass: profile.sass });
          journal.push({ step: 'plan-deps', ok: true, note: `remove ${depRemap.remove.length}, add ${depRemap.add.length}, unmapped ${depRemap.unmapped.length}` });

          // 3. TRANSLATE webpack/craco
          let webpackTranslation: ReturnType<typeof translateWebpack> | null = null;
          const cfgPath = exists(root, 'craco.config.js') ? path.join(root, 'craco.config.js') : exists(root, 'config', 'webpack.config.js') ? path.join(root, 'config', 'webpack.config.js') : null;
          if (cfgPath) { webpackTranslation = translateWebpack(fs.readFileSync(cfgPath, 'utf8')); journal.push({ step: 'translate-webpack', ok: true, note: `${webpackTranslation.plugins.length} plugin(s), ${webpackTranslation.manualReview.length} to review` }); }

          // 4. SCAFFOLD the Vite shell
          // profile.hasSetupTests is nested under jestConfig on the real
          // craconfig-analyzer profile — flatten it explicitly here rather than
          // relying on structural typing, which would silently leave it
          // undefined (the optional field is absent, not just unset).
          const scaffoldOpts = deriveScaffoldOptions({ ...profile, hasSetupTests: profile.jestConfig.hasSetupTests }, packageJson.name ?? 'App');
          const scaffold = generateViteProject(scaffoldOpts);
          const target = outDir ?? `${root}-vite`;
          if (!dryRun) { for (const f of scaffold.files) { const abs = path.join(target, f.path); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, f.code, 'utf8'); } }
          journal.push({ step: 'scaffold', ok: true, note: `${scaffold.files.length} Vite shell files${dryRun ? ' (dry-run)' : ' written to ' + target}` });

          // 5. ENV + TEST migration SUMMARY (read-only; run the dedicated tools to apply)
          let envRewrites = 0; let dynamicEnv = 0;
          for (const f of srcFiles) { const r = migrateSource(fs.readFileSync(f, 'utf8')); envRewrites += r.count; dynamicEnv += r.dynamicAccess.length; }
          const testFiles = walk(path.join(root, 'src'), (n) => /\.(test|spec)\.(tsx?|jsx?)$/.test(n));
          let testRewrites = 0; for (const f of testFiles) testRewrites += migrateTest(fs.readFileSync(f, 'utf8')).count;
          journal.push({ step: 'migrate-summary', ok: true, note: `${envRewrites} env rewrites, ${testRewrites} test rewrites, ${dynamicEnv} dynamic env` });

          const unsupported = (webpackTranslation?.plugins ?? []).filter((p) => p.status === 'unsupported').map((p) => p.name);
          const manualReview = collectManualReview(profile, unsupported, dynamicEnv);
          const grade = gradeMigration(journal, manualReview);

          return this.successWithDashboard('Cra To Vite', {
            profile, depRemap, webpackTranslation,
            scaffoldFiles: scaffold.files.map((f) => f.path),
            envMigration: { rewrites: envRewrites, dynamicAccess: dynamicEnv, envFiles },
            testMigration: { rewrites: testRewrites, files: testFiles.length },
            manualReview, journal, grade,
            outputPath: dryRun ? null : target,
            nextSteps: buildNextSteps(root),
          });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new CraToViteServer().run().catch(console.error);
