// ============================================================================
// TOOL #9: detect-anti-patterns
// Detects prop drilling, tight coupling, duplicated logic, large utility files,
// god components, inline JSX callbacks, a11y violations, bad fetch patterns
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, resolveSourceDir } from '../utils/file-scanner.js';
import { analyzeComponent, parseFile, extractImports, extractFunctions } from '../utils/ast-parser.js';
import { buildImportGraph, calculateCoupling } from '../utils/import-tracker.js';
import { DEFAULT_CONFIG } from '../types.js';
import type { DetectAntiPatternsOutput, AntiPattern, AnalyzerConfig } from '../types.js';

export async function detectAntiPatterns(appPath: string, config?: Partial<AnalyzerConfig>): Promise<DetectAntiPatternsOutput> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);
  const graph = await buildImportGraph(appPath);

  const antiPatterns: AntiPattern[] = [];

  // ── 1. Prop drilling ─────────────────────────────────────────────────────
  const propDrillingFiles: string[] = [];
  for (const file of files) {
    const analysis = analyzeComponent(file);
    if (!analysis) continue;
    if (analysis.props.length > 5) {
      const content = readFileContent(file);
      if (!content) continue;
      const spreadProps = content.match(/\.\.\.\w+Props/g) || [];
      const passingProps = content.match(/<[A-Z]\w+[^>]*\w+=\{[^}]+\}/g) || [];
      if (spreadProps.length > 0 && passingProps.length > 3) {
        propDrillingFiles.push(path.relative(appPath, file));
      }
    }
  }
  if (propDrillingFiles.length > 0) {
    antiPatterns.push({
      type: 'prop-drilling',
      description: `Components passing props through multiple levels (${propDrillingFiles.length} files). Consider using Context or state management.`,
      files: propDrillingFiles.slice(0, 10),
    });
  }

  // ── 2. Tight coupling ────────────────────────────────────────────────────
  const tightCouplingPairs: string[] = [];
  const processedPairs = new Set<string>();
  for (const fileA of files) {
    for (const fileB of files) {
      if (fileA === fileB) continue;
      const pairKey = [fileA, fileB].sort().join('|');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);
      const coupling = calculateCoupling(graph, fileA, fileB);
      if (coupling >= 3) {
        tightCouplingPairs.push(
          `${path.relative(appPath, fileA)} <-> ${path.relative(appPath, fileB)} (coupling: ${coupling})`
        );
      }
    }
  }
  if (tightCouplingPairs.length > 0) {
    antiPatterns.push({
      type: 'tight-coupling',
      description: 'Tightly coupled components detected. Consider extracting shared logic or using dependency injection.',
      files: tightCouplingPairs.slice(0, 10),
    });
  }

  // ── 3. Large utility files ───────────────────────────────────────────────
  const utilFiles = files.filter((f) => {
    const lower = f.toLowerCase();
    return lower.includes('/util') || lower.includes('/helper') || lower.includes('/utils.');
  });
  for (const utilFile of utilFiles) {
    const content = readFileContent(utilFile);
    if (!content) continue;
    const lines = content.split('\n').length;
    if (lines > mergedConfig.largeUtilLines) {
      const parsed = parseFile(utilFile);
      if (!parsed) continue;
      const functions = extractFunctions(parsed.ast);
      antiPatterns.push({
        type: 'large-utility-file',
        description: `Utility file has ${lines} lines with ${functions.length} functions. Consider splitting into smaller modules.`,
        files: [path.relative(appPath, utilFile)],
      });
    }
  }

  // ── 4. Duplicated logic patterns ─────────────────────────────────────────
  const functionBodies: Map<string, string[]> = new Map();
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    const patterns = [
      { name: 'date-formatting', regex: /formatDate|dateFormat|toLocaleDateString|moment\(|dayjs\(/g },
      { name: 'currency-formatting', regex: /formatCurrency|currencyFormat|Intl\.NumberFormat.*style.*currency/g },
      { name: 'validation', regex: /validate\w+|isValid\w+|checkValid/g },
      { name: 'api-error-handling', regex: /catch\s*\([^)]*\)\s*\{[^}]*error/g },
    ];
    for (const pattern of patterns) {
      const matches = content.match(pattern.regex);
      if (matches && matches.length > 0) {
        if (!functionBodies.has(pattern.name)) functionBodies.set(pattern.name, []);
        functionBodies.get(pattern.name)!.push(path.relative(appPath, file));
      }
    }
  }
  for (const [pattern, fileList] of functionBodies) {
    if (fileList.length > 3) {
      antiPatterns.push({
        type: 'duplicated-logic',
        description: `Repeated "${pattern}" pattern found in ${fileList.length} files. Consider extracting to a shared utility.`,
        files: fileList.slice(0, 10),
      });
    }
  }

  // ── 5. God components ────────────────────────────────────────────────────
  const godComponentFiles: string[] = [];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    const analysis = analyzeComponent(file);
    const relPath = path.relative(appPath, file);

    const responsibilities = new Set<string>();

    // Detect state via both AST (if available) and regex (for namespace style)
    const hasUseState = analysis?.hooks.some((h) => h.name === 'useState') ||
      /\buseState\s*\(|React\.useState\s*\(/.test(content);
    const hasUseEffect = analysis?.hooks.some((h) => h.name === 'useEffect') ||
      /\buseEffect\s*\(|React\.useEffect\s*\(/.test(content);
    const hasUseReducer = analysis?.hooks.some((h) => h.name === 'useReducer') ||
      /\buseReducer\s*\(|React\.useReducer\s*\(/.test(content);

    if (hasUseState || hasUseReducer) responsibilities.add('state');
    if (hasUseEffect) responsibilities.add('effects');

    // API calls
    if (content.includes('fetch(') || content.includes('axios.') || content.includes('.get(') || content.includes('.post(')) {
      responsibilities.add('api-calls');
    }

    // Routing
    const importSources = analysis?.imports.map((i) => i.source.toLowerCase()) || [];
    if (importSources.some((s) => s.includes('router') || s.includes('navigate'))) responsibilities.add('routing');

    // Store
    if (importSources.some((s) => s.includes('redux') || s.includes('store') || s.includes('zustand'))) responsibilities.add('store');

    // Form handling
    if (content.includes('onSubmit') || content.includes('FormData') || content.includes('handleSubmit')) {
      responsibilities.add('form-handling');
    }

    // Heavy rendering
    const jsxElements = analysis?.jsxElements.length || (content.match(/<[A-Z][a-zA-Z]*/g) || []).length;
    if (jsxElements > 15) responsibilities.add('heavy-rendering');

    // Count state variables
    const stateVarCount = (content.match(/\buseState\s*\(/g) || []).length +
      (content.match(/React\.useState\s*\(/g) || []).length;

    const lines = content.split('\n').length;

    // Lower thresholds: a 100-line component with 3+ responsibilities IS a god component
    if (responsibilities.size >= 3 && (lines > 80 || stateVarCount >= 3)) {
      const detail = `${lines} lines, ${responsibilities.size} responsibilities (${Array.from(responsibilities).join(', ')}), ${stateVarCount} state vars`;
      godComponentFiles.push(`${relPath} — ${detail}`);
    }
  }
  if (godComponentFiles.length > 0) {
    antiPatterns.push({
      type: 'god-component',
      description: `God component(s) detected — too many responsibilities in a single file. Break into feature-specific sub-components.`,
      files: godComponentFiles.slice(0, 10),
    });
  }

  // ── 6. Inline JSX callbacks ───────────────────────────────────────────────
  const inlineCallbackFiles: { file: string; count: number; examples: string[] }[] = [];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    // Detect onClick/onChange/onSubmit/onBlur etc with inline arrow functions
    const matches = [...content.matchAll(/on[A-Z]\w*=\{(?:\([^)]*\)|[a-z_]\w*)\s*=>/g)];
    if (matches.length >= 2) {
      inlineCallbackFiles.push({
        file: path.relative(appPath, file),
        count: matches.length,
        examples: matches.slice(0, 2).map((m) => m[0].slice(0, 60)),
      });
    }
  }
  if (inlineCallbackFiles.length > 0) {
    const total = inlineCallbackFiles.reduce((s, f) => s + f.count, 0);
    antiPatterns.push({
      type: 'inline-callbacks',
      description: `${total} inline arrow function callbacks in JSX across ${inlineCallbackFiles.length} file(s). Each creates a new function reference on every render — extract to useCallback or named handlers.`,
      files: inlineCallbackFiles.map((f) => `${f.file} (${f.count} callbacks)`).slice(0, 10),
    });
  }

  // ── 7. Fetch/async without error handling ─────────────────────────────────
  const noErrorHandlingFiles: string[] = [];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    const hasFetch = content.includes('fetch(') || content.includes('axios.');
    if (!hasFetch) continue;
    const hasCatch = content.includes('.catch(') || content.includes('try {') || content.includes('try{');
    if (!hasCatch) {
      noErrorHandlingFiles.push(path.relative(appPath, file));
    }
  }
  if (noErrorHandlingFiles.length > 0) {
    antiPatterns.push({
      type: 'missing-error-handling',
      description: `${noErrorHandlingFiles.length} file(s) make API calls without try/catch or .catch(). Unhandled rejections will silently fail in production.`,
      files: noErrorHandlingFiles.slice(0, 10),
    });
  }

  // ── 8. React namespace style (React.useState instead of imported) ─────────
  const namespacedReactFiles: string[] = [];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    const namespacedHooks = (content.match(/React\.(useState|useEffect|useCallback|useMemo|useRef|useContext|useReducer)\s*\(/g) || []);
    if (namespacedHooks.length >= 2) {
      namespacedReactFiles.push(`${path.relative(appPath, file)} (${namespacedHooks.length} namespace calls)`);
    }
  }
  if (namespacedReactFiles.length > 0) {
    antiPatterns.push({
      type: 'react-namespace-style',
      description: `Files use React.useState/useEffect/etc instead of named imports. Prefer: import { useState, useEffect } from 'react'`,
      files: namespacedReactFiles.slice(0, 10),
    });
  }

  // ── 9. Images without alt text ────────────────────────────────────────────
  const noAltFiles: { file: string; count: number }[] = [];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    // Find <img> tags that don't have alt=
    const imgMatches = [...content.matchAll(/<img\b([^>]*)>/g)];
    const noAltCount = imgMatches.filter((m) => !m[1].includes('alt=')).length;
    if (noAltCount > 0) {
      noAltFiles.push({ file: path.relative(appPath, file), count: noAltCount });
    }
  }
  if (noAltFiles.length > 0) {
    const total = noAltFiles.reduce((s, f) => s + f.count, 0);
    antiPatterns.push({
      type: 'missing-alt-text',
      description: `${total} <img> element(s) missing alt attribute across ${noAltFiles.length} file(s). Required for accessibility (WCAG 2.1 1.1.1).`,
      files: noAltFiles.map((f) => `${f.file} (${f.count} images)`).slice(0, 10),
    });
  }

  // ── 10. Non-semantic HTML structure ──────────────────────────────────────
  const nonSemanticFiles: string[] = [];
  const semanticDivPatterns = [
    /className=["'`]header["'`]/,
    /className=["'`]footer["'`]/,
    /className=["'`]main["'`]/,
    /className=["'`]nav["'`]/,
    /className=["'`]navigation["'`]/,
    /className=["'`]sidebar["'`]/,
    /className=["'`]article["'`]/,
    /className=["'`]section["'`]/,
  ];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    const hasNonSemantic = semanticDivPatterns.some((p) => p.test(content));
    if (hasNonSemantic) {
      // Confirm it's using div, not the semantic element itself
      const hasDivHeader = content.match(/<div\b[^>]*className=["'`](?:header|footer|main|nav|sidebar|article|section)["'`]/);
      if (hasDivHeader) {
        nonSemanticFiles.push(path.relative(appPath, file));
      }
    }
  }
  if (nonSemanticFiles.length > 0) {
    antiPatterns.push({
      type: 'non-semantic-html',
      description: `${nonSemanticFiles.length} file(s) use <div className="header/footer/main/nav"> instead of semantic HTML elements (<header>, <footer>, <main>, <nav>). Hurts SEO and accessibility.`,
      files: nonSemanticFiles.slice(0, 10),
    });
  }

  // ── 11. Form inputs without labels ───────────────────────────────────────
  const noLabelFiles: string[] = [];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    const inputs = [...content.matchAll(/<input\b([^>]*)>/g)];
    const hasLabel = content.includes('<label') || content.includes('htmlFor') || content.includes('aria-label');
    if (inputs.length > 0 && !hasLabel) {
      noLabelFiles.push(path.relative(appPath, file));
    }
  }
  if (noLabelFiles.length > 0) {
    antiPatterns.push({
      type: 'unlabeled-inputs',
      description: `${noLabelFiles.length} file(s) have form <input> elements without associated <label> or aria-label. Screen readers cannot identify these fields (WCAG 2.1 1.3.1).`,
      files: noLabelFiles.slice(0, 10),
    });
  }

  // ── 12. Placeholder/external images in production code ───────────────────
  const placeholderImageFiles: string[] = [];
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;
    if (content.includes('via.placeholder.com') || content.includes('placeholder.com') || content.includes('placehold.it') || content.includes('dummyimage.com')) {
      placeholderImageFiles.push(path.relative(appPath, file));
    }
  }
  if (placeholderImageFiles.length > 0) {
    antiPatterns.push({
      type: 'placeholder-images',
      description: `${placeholderImageFiles.length} file(s) use external placeholder image services. Replace with real assets before production.`,
      files: placeholderImageFiles.slice(0, 10),
    });
  }

  return {
    antiPatterns,
  };
}
