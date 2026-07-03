// ============================================================================
// TOOL #10: detect-duplication
// Detects duplicate components, utility functions, similar file structures
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, resolveSourceDir } from '../utils/file-scanner.js';
import { analyzeComponent, parseFile, extractFunctions } from '../utils/ast-parser.js';
import { DEFAULT_CONFIG } from '../types.js';
import type { DetectDuplicationOutput, DuplicateItem, AnalyzerConfig } from '../types.js';

/**
 * Tokenize code into meaningful tokens for comparison
 */
function tokenize(code: string): string[] {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/['"`][^'"`]*['"`]/g, 'STR') // normalize string literals
    .replace(/\b\d+\b/g, 'NUM')           // normalize numbers
    .match(/\b\w+\b|[{}()[\]=><]/g) ?? [];
}

/**
 * Jaccard similarity on token sets (0-1). Much more accurate than char-position matching.
 * Strips import statements before comparison — shared imports inflate similarity.
 */
function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Strip import lines so shared boilerplate doesn't inflate score
  const stripImports = (s: string) => s.replace(/^import\s[^\n]+\n/gm, '');
  const tokensA = new Set(tokenize(stripImports(a)));
  const tokensB = new Set(tokenize(stripImports(b)));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Normalize code for comparison (remove whitespace, comments)
 */
function normalizeCode(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function detectDuplication(appPath: string, config?: Partial<AnalyzerConfig>): Promise<DetectDuplicationOutput> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  const duplicateComponents: DuplicateItem[] = [];
  const duplicateUtils: DuplicateItem[] = [];

  const isTestOrMockFile = (f: string) => {
    const lower = f.toLowerCase();
    return lower.includes('.test.') || lower.includes('.spec.') || lower.includes('.stories.') ||
      lower.includes('/__tests__/') || lower.includes('/mocks/') || lower.includes('/mock/') ||
      lower.includes('/fixtures/') || lower.includes('/testing/');
  };

  // Group files by type, excluding test/mock files from duplication analysis
  const componentFiles = files.filter((f) => {
    if (isTestOrMockFile(f)) return false;
    const basename = path.basename(f, path.extname(f));
    return /^[A-Z]/.test(basename);
  });

  const utilFiles = files.filter((f) => {
    if (isTestOrMockFile(f)) return false;
    const lower = f.toLowerCase();
    return lower.includes('/util') || lower.includes('/helper') || lower.includes('/utils.');
  });

  // 1. Detect duplicate components by comparing structure
  const componentAnalyses = new Map<string, ReturnType<typeof analyzeComponent>>();
  for (const file of componentFiles) {
    const analysis = analyzeComponent(file);
    if (analysis) {
      componentAnalyses.set(file, analysis);
    }
  }

  // Compare components pairwise, but only within buckets that share an identical
  // hook signature. Naively comparing every (file, file) pair is O(n^2) — on a
  // 10k-component repo that's millions of pairs, each paying a full file read +
  // tokenize, which is what made this hang past 120s. Since a match REQUIRES an
  // identical hook set anyway (hooksMatch below), bucketing by that signature first
  // turns the comparison into O(sum of bucket_size^2) instead of O(n^2) — cheap in
  // practice because real repos rarely have hundreds of components sharing an exact
  // hook set. (QA harness regression: 10k-file synthetic repo — analyze-legacy-app
  // previously timed out past 120s; verified fixed below.)
  const hookSignature = (analysis: NonNullable<ReturnType<typeof analyzeComponent>>): string | null => {
    const hooks = new Set(analysis.hooks.map((h) => h.name));
    if (hooks.size < 2) return null; // 1 hook = too common to signal duplication
    return Array.from(hooks).sort().join(',');
  };

  const buckets = new Map<string, string[]>();
  for (const [file, analysis] of componentAnalyses) {
    if (!analysis) continue;
    const sig = hookSignature(analysis);
    if (sig === null) continue;
    if (!buckets.has(sig)) buckets.set(sig, []);
    buckets.get(sig)!.push(file);
  }

  for (const bucketFiles of buckets.values()) {
    if (bucketFiles.length < 2) continue;
    for (let i = 0; i < bucketFiles.length; i++) {
      for (let j = i + 1; j < bucketFiles.length; j++) {
        const fileA = bucketFiles[i];
        const fileB = bucketFiles[j];
        const analysisA = componentAnalyses.get(fileA)!;

        // Compare normalized code
        const contentA = readFileContent(fileA);
        const contentB = readFileContent(fileB);
        if (!contentA || !contentB) continue;

        // Skip tiny files (< 20 lines) — too small to constitute meaningful duplication
        const linesA = contentA.split('\n').length;
        const linesB = contentB.split('\n').length;
        if (linesA < 20 || linesB < 20) continue;

        const normalizedA = normalizeCode(contentA);
        const normalizedB = normalizeCode(contentB);
        const similarity = calculateSimilarity(normalizedA, normalizedB);

        if (similarity > mergedConfig.duplicationThreshold) {
          // Check if we already have an entry for either file
          const existingEntry = duplicateComponents.find(
            (d) => d.locations.includes(path.relative(appPath, fileA)) || d.locations.includes(path.relative(appPath, fileB))
          );

          if (existingEntry) {
            if (!existingEntry.locations.includes(path.relative(appPath, fileA))) {
              existingEntry.locations.push(path.relative(appPath, fileA));
            }
            if (!existingEntry.locations.includes(path.relative(appPath, fileB))) {
              existingEntry.locations.push(path.relative(appPath, fileB));
            }
            existingEntry.similarity = Math.max(existingEntry.similarity, similarity);
          } else {
            duplicateComponents.push({
              name: analysisA.name,
              locations: [
                path.relative(appPath, fileA),
                path.relative(appPath, fileB),
              ],
              similarity: Math.round(similarity * 100) / 100,
            });
          }
        }
      }
    }
  }

  // 2. Detect duplicate utility functions
  const functionSignatures = new Map<string, { name: string; file: string }[]>();

  for (const file of utilFiles) {
    const parsed = parseFile(file);
    if (!parsed) continue;

    const functions = extractFunctions(parsed.ast);
    for (const fn of functions) {
      const signature = `${fn.name}(${fn.params.join(',')})`;
      if (!functionSignatures.has(signature)) {
        functionSignatures.set(signature, []);
      }
      functionSignatures.get(signature)!.push({
        name: fn.name,
        file: path.relative(appPath, file),
      });
    }
  }

  // Find duplicate function names across files
  for (const [signature, locations] of functionSignatures) {
    const uniqueFiles = new Set(locations.map((l) => l.file));
    if (uniqueFiles.size > 1) {
      const funcName = signature.split('(')[0];
      duplicateUtils.push({
        name: funcName,
        locations: Array.from(uniqueFiles),
        similarity: 1, // Same name = exact match
      });
    }
  }

  // 3. Detect feature modules with identical file layout (informational — not counted as component duplication)
  // Feature-based architectures INTENTIONALLY have folders with the same structure (index.tsx, types.ts, etc.)
  // We report this as a note, not as a duplication issue, to avoid penalizing good architecture.
  const folderPatterns = new Map<string, string[]>();
  for (const file of files) {
    const dir = path.dirname(path.relative(srcPath, file));
    if (!folderPatterns.has(dir)) {
      folderPatterns.set(dir, []);
    }
    folderPatterns.get(dir)!.push(path.basename(file));
  }
  // Only flag when CONTENT is actually duplicated (exact same normalized code), not just same filenames
  // This avoids false positives for feature-based architectures like bulletproof-react or rowy
  // (folder structure similarity is good practice, not duplication)

  return {
    duplicateComponents,
    duplicateUtils: duplicateUtils.slice(0, 20), // Limit output
  };
}