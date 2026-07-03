// ============================================================================
// TOOL #3: analyze-components
// Scans all components: count, large components, complex components
// ============================================================================

import * as path from 'path';
import * as fs from 'fs';
import { findSourceFiles, resolveSourceDirs } from '../utils/file-scanner.js';
import { analyzeComponent } from '../utils/ast-parser.js';
import { DEFAULT_CONFIG } from '../types.js';
import type { AnalyzeComponentsOutput, ComponentInfo, AnalyzerConfig } from '../types.js';

export async function analyzeComponents(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeComponentsOutput> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const srcPaths = resolveSourceDirs(appPath);
  const files = await findSourceFiles(srcPaths);

  // Include all JS/JSX/TS/TSX files — apps like CRA use lowercase App.js or index.js
  const componentFiles = files;

  let totalComponents = 0;
  const largeComponents: ComponentInfo[] = [];
  const complexComponents: ComponentInfo[] = [];

  for (const file of componentFiles) {
    const relPath = path.relative(appPath, file);

    // Read raw content first (works for both JS and TS)
    let content: string;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    // Try AST analysis — may fail for plain JS files
    const analysis = analyzeComponent(file);

    const responsibilities: string[] = [];
    const importSources = (analysis?.imports ?? []).map((i) => i.source.toLowerCase());

    // All responsibility checks use regex on raw content (works for both JS and TS)
    const hasState = /\buseState\s*\(|React\.useState\s*\(|\buseReducer\s*\(|React\.useReducer\s*\(/.test(content)
      || (analysis?.hooks.some((h) => h.name === 'useState' || h.name === 'useReducer') ?? false);
    if (hasState) responsibilities.push('state-management');

    const hasEffect = /\buseEffect\s*\(|React\.useEffect\s*\(/.test(content)
      || (analysis?.hooks.some((h) => h.name === 'useEffect') ?? false);
    if (hasEffect) responsibilities.push('side-effects');

    if (content.includes('fetch(') || content.includes('axios.') || importSources.some((s) => s.includes('api'))) {
      responsibilities.push('api-calls');
    }
    if (importSources.some((s) => s.includes('router') || s.includes('navigate'))) {
      responsibilities.push('routing');
    }
    if (content.includes('onSubmit') || content.includes('FormData') || content.includes('handleSubmit')) {
      responsibilities.push('form-handling');
    }

    const jsxTagCount = (content.match(/<[A-Z][a-zA-Z]*|<[a-z]+[\s>]/g) || []).length;
    const astJsxCount = analysis?.jsxElements.length ?? 0;
    if (astJsxCount > 15 || jsxTagCount > 15) responsibilities.push('heavy-rendering');

    const lines = content.split('\n').length;
    const stateVarCount = (content.match(/\buseState\s*\(|React\.useState\s*\(/g) || []).length;
    const hookCount = analysis?.hooks.length ?? 0;
    const jsxDepth = analysis?.jsxMaxDepth ?? 0;
    const componentName = analysis?.name ?? path.basename(file, path.extname(file));

    const componentInfo: ComponentInfo = {
      name: componentName,
      file: relPath,
      lines,
      jsxMaxDepth: jsxDepth,
      responsibilities,
    };

    // Skip non-component files (no JSX, no hooks, not enough evidence).
    // Plain .ts files can never contain JSX (TypeScript rejects JSX syntax
    // outside .tsx/.jsx), so the content-based regexes below are unreliable
    // there — generics like `Record<string, X>` and comparisons like `a < b`
    // false-match the JSX tag regex, and `return (a, b) => …` false-matches
    // the return-paren check. Trust only the AST's real JSX node count for
    // those files; keep the looser heuristics for .tsx/.jsx (and plain .js,
    // since CRA-era apps put JSX in .js).
    const isPlainTs = path.extname(file) === '.ts';
    const isLikelyComponent = isPlainTs
      ? astJsxCount > 0
      : astJsxCount > 0 || jsxTagCount > 0 || content.includes('return (') || content.includes('return(');
    if (!isLikelyComponent) continue;

    totalComponents++;

    if (lines > mergedConfig.largeComponentLines) {
      largeComponents.push(componentInfo);
    }

    // Complex: multiple responsibilities, or deep nesting, or many hooks, or many state vars
    const isComplex =
      responsibilities.length >= 3 ||
      jsxDepth > 6 ||
      hookCount >= 5 ||
      stateVarCount >= 3;

    if (isComplex) complexComponents.push(componentInfo);
  }

  return {
    totalComponents,
    largeComponents: largeComponents.sort((a, b) => b.lines - a.lines),
    complexComponents: complexComponents.sort((a, b) => b.responsibilities.length - a.responsibilities.length),
  };
}