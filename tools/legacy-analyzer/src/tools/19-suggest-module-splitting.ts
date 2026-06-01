// ============================================================================
// TOOL #19: suggest-module-splitting
// Detects large or generic files that should be split
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, getFileSize, resolveSourceDir } from '../utils/file-scanner.js';
import { parseFile, extractExports } from '../utils/ast-parser.js';
import {
  isKitchenSinkFile,
  suggestUtilitySplits,
} from '../utils/refactor-helpers.js';
import type { SuggestModuleSplittingOutput, ModuleSplit, AnalyzerConfig } from '../types.js';

const LARGE_FILE_THRESHOLD_BYTES = 10 * 1024; // 10KB
const LARGE_LINE_THRESHOLD = 200;
const MANY_EXPORTS_THRESHOLD = 10;

export async function suggestModuleSplitting(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<SuggestModuleSplittingOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);
  const mergedConfig = {
    largeUtilLines: config?.largeUtilLines ?? 200,
  };

  if (files.length === 0) {
    return { splits: [] };
  }

  const splits: ModuleSplit[] = [];

  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    const basename = path.basename(file, path.extname(file));
    const relPath = path.relative(srcPath, file);
    const fileSize = getFileSize(file);
    const lineCount = content.split('\n').length;

    // Check 1: Kitchen sink files (utils.js, helpers.js, etc.)
    if (isKitchenSinkFile(file)) {
      const suggestedSplits = suggestUtilitySplits(file, content);
      if (suggestedSplits.length >= 2) {
        const proposedFiles = suggestedSplits.map(
          (s) => `${basename}/${s.category}.ts`
        );
        splits.push({
          file: relPath,
          suggestion: `Split "${basename}" into ${suggestedSplits.length} domain-specific modules`,
          reason: `Kitchen sink file with ${suggestedSplits.length} distinct categories: ${suggestedSplits.map((s) => s.category).join(', ')}`,
          proposedFiles,
        });
      }
    }

    // Check 2: Large files
    if (lineCount > mergedConfig.largeUtilLines || fileSize > LARGE_FILE_THRESHOLD_BYTES) {
      const parsed = parseFile(file);
      if (parsed) {
        const exports = extractExports(parsed.ast);
        if (exports.length >= MANY_EXPORTS_THRESHOLD) {
          const exportNames = exports.map((e) => e.name);
          // Group exports by likely domain
          const groups = groupExportsByDomain(exportNames);
          if (groups.length >= 2) {
            const proposedFiles = groups.map(
              (g) => `${basename}/${g.domain}.ts`
            );
            splits.push({
              file: relPath,
              suggestion: `Split large file (${lineCount} lines, ${exports.length} exports) into domain modules`,
              reason: `File is too large (${lineCount} lines) with ${exports.length} exports spanning ${groups.length} domains`,
              proposedFiles,
            });
          }
        }
      }
    }

    // Check 3: Files with many exports (even if not large)
    const parsed = parseFile(file);
    if (parsed) {
      const exports = extractExports(parsed.ast);
      if (exports.length >= MANY_EXPORTS_THRESHOLD * 2) {
        const groups = groupExportsByDomain(exports.map((e) => e.name));
        if (groups.length >= 3) {
          const proposedFiles = groups.map(
            (g) => `${basename}/${g.domain}.ts`
          );
          splits.push({
            file: relPath,
            suggestion: `Split ${exports.length} exports into ${groups.length} focused modules`,
            reason: `Too many exports (${exports.length}) - consider splitting by responsibility`,
            proposedFiles,
          });
        }
      }
    }

    // Check 4: Generic barrel/index files that re-export everything
    if (basename === 'index' && lineCount > 50) {
      const parsed = parseFile(file);
      if (parsed) {
        const exports = extractExports(parsed.ast);
        if (exports.length > 5) {
          splits.push({
            file: relPath,
            suggestion: 'Consider removing barrel file and using direct imports',
            reason: `Barrel file with ${exports.length} re-exports can cause circular dependencies and slow builds`,
            proposedFiles: [],
          });
        }
      }
    }
  }

  // Deduplicate by file path
  const seen = new Set<string>();
  const uniqueSplits = splits.filter((s) => {
    if (seen.has(s.file)) return false;
    seen.add(s.file);
    return true;
  });

  return { splits: uniqueSplits };
}

/**
 * Group export names by likely domain/category
 */
function groupExportsByDomain(exportNames: string[]): { domain: string; names: string[] }[] {
  const domains: Record<string, string[]> = {
    date: [],
    string: [],
    validation: [],
    formatting: [],
    array: [],
    object: [],
    network: [],
    storage: [],
    dom: [],
    other: [],
  };

  for (const name of exportNames) {
    const lower = name.toLowerCase();

    if (lower.includes('date') || lower.includes('time') || lower.includes('moment') || lower.includes('dayjs')) {
      domains.date.push(name);
    } else if (lower.includes('format') || lower.includes('parse') || lower.includes('convert')) {
      domains.formatting.push(name);
    } else if (lower.includes('valid') || lower.includes('check') || lower.includes('verify') || lower.includes('is') || lower.includes('has') || lower.includes('can')) {
      domains.validation.push(name);
    } else if (lower.includes('trim') || lower.includes('capitalize') || lower.includes('slug') || lower.includes('text') || lower.includes('string') || lower.includes('replace')) {
      domains.string.push(name);
    } else if (lower.includes('sort') || lower.includes('filter') || lower.includes('map') || lower.includes('reduce') || lower.includes('group') || lower.includes('unique') || lower.includes('flatten') || lower.includes('chunk')) {
      domains.array.push(name);
    } else if (lower.includes('merge') || lower.includes('clone') || lower.includes('pick') || lower.includes('omit') || lower.includes('get') || lower.includes('set') || lower.includes('deep')) {
      domains.object.push(name);
    } else if (lower.includes('fetch') || lower.includes('request') || lower.includes('api') || lower.includes('http') || lower.includes('axios') || lower.includes('xhr')) {
      domains.network.push(name);
    } else if (lower.includes('store') || lower.includes('cache') || lower.includes('local') || lower.includes('session') || lower.includes('cookie') || lower.includes('storage')) {
      domains.storage.push(name);
    } else if (lower.includes('dom') || lower.includes('element') || lower.includes('scroll') || lower.includes('resize') || lower.includes('event') || lower.includes('click') || lower.includes('focus')) {
      domains.dom.push(name);
    } else {
      domains.other.push(name);
    }
  }

  return Object.entries(domains)
    .filter(([, names]) => names.length > 0)
    .map(([domain, names]) => ({ domain, names }));
}