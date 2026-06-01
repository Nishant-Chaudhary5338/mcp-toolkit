// ============================================================================
// TOOL #7: analyze-styling
// Detects CSS/SCSS/Tailwind/styled-components, inline styles, hardcoded values
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, findStyleFiles, resolveSourceDir } from '../utils/file-scanner.js';
import { parseFile, extractImports } from '../utils/ast-parser.js';
import type { AnalyzeStylingOutput, AnalyzerConfig } from '../types.js';

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_REGEX = /rgba?\s*\([^)]+\)/g;
const INLINE_STYLE_REGEX = /style\s*=\s*\{\{/g;
const CLASSNAME_REGEX = /className\s*=\s*[{"'`]/g;

const STYLING_LIBS = [
  'styled-components',
  '@emotion/react',
  '@emotion/styled',
  'tailwindcss',
  '@stitches/react',
  'linaria',
  'twin.macro',
];

export async function analyzeStyling(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeStylingOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);
  const styleFiles = await findStyleFiles(appPath);

  const stylingType: Set<string> = new Set();
  const issues: string[] = [];
  let inlineStylesCount = 0;
  const hardcodedColors: Set<string> = new Set();
  const classNameCounts: Map<string, number> = new Map();

  // Check for CSS/SCSS files
  if (styleFiles.length > 0) {
    const hasCSS = styleFiles.some((f) => f.endsWith('.css'));
    const hasSCSS = styleFiles.some((f) => f.endsWith('.scss') || f.endsWith('.sass') || f.endsWith('.less'));
    const hasModules = styleFiles.some((f) => f.includes('.module.'));

    if (hasCSS) stylingType.add('CSS');
    if (hasSCSS) stylingType.add('SCSS/Less');
    if (hasModules) stylingType.add('CSS Modules');
  }

  // Analyze source files for styling patterns
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    const parsed = parseFile(file);
    if (!parsed) continue;

    const imports = extractImports(parsed.ast);
    const importSources = imports.map((i) => i.source);

    // Detect styling libraries
    for (const lib of STYLING_LIBS) {
      if (importSources.some((s) => s.includes(lib))) {
        if (lib.includes('styled')) stylingType.add('styled-components');
        else if (lib.includes('emotion')) stylingType.add('Emotion');
        else if (lib.includes('tailwind')) stylingType.add('Tailwind');
        else if (lib.includes('stitches')) stylingType.add('Stitches');
        else if (lib.includes('linaria')) stylingType.add('Linaria');
        else stylingType.add(lib);
      }
    }

    // Count inline styles
    const inlineMatches = content.match(INLINE_STYLE_REGEX);
    if (inlineMatches) {
      inlineStylesCount += inlineMatches.length;
    }

    // Extract hardcoded colors
    const hexMatches = content.match(HEX_COLOR_REGEX);
    if (hexMatches) {
      for (const color of hexMatches) {
        hardcodedColors.add(color.toLowerCase());
      }
    }

    const rgbMatches = content.match(RGB_REGEX);
    if (rgbMatches) {
      for (const color of rgbMatches) {
        hardcodedColors.add(color);
      }
    }

    // Count className usage for duplicate detection
    const classNameMatches = content.match(/className\s*=\s*["'`]([^"'`]+)["'`]/g);
    if (classNameMatches) {
      for (const match of classNameMatches) {
        const classes = match.replace(/className\s*=\s*["'`]/, '').replace(/["'`]$/, '');
        const classList = classes.split(/\s+/);
        for (const cls of classList) {
          if (cls.trim()) {
            classNameCounts.set(cls, (classNameCounts.get(cls) || 0) + 1);
          }
        }
      }
    }
  }

  // Find duplicate classes (used in many files)
  const duplicateClasses: string[] = [];
  for (const [cls, count] of classNameCounts) {
    if (count > 10) {
      duplicateClasses.push(cls);
    }
  }

  // Issues
  if (stylingType.size === 0) {
    issues.push('No styling solution detected. May be using inline styles only or a custom solution.');
  }

  if (stylingType.size > 2) {
    issues.push(`Multiple styling solutions detected (${Array.from(stylingType).join(', ')}). Consider standardizing.`);
  }

  if (inlineStylesCount > 20) {
    issues.push(`High inline styles usage (${inlineStylesCount} instances). Consider using CSS classes or styled-components.`);
  }

  if (hardcodedColors.size > 10) {
    issues.push(`${hardcodedColors.size} hardcoded colors found. Consider using CSS variables or a theme system.`);
  }

  if (duplicateClasses.length > 0) {
    issues.push(`Potential duplicate class definitions detected: ${duplicateClasses.slice(0, 5).join(', ')}${duplicateClasses.length > 5 ? '...' : ''}`);
  }

  return {
    stylingType: Array.from(stylingType),
    inlineStylesCount,
    hardcodedColors: Array.from(hardcodedColors).slice(0, 20), // Limit output
    duplicateClasses: duplicateClasses.slice(0, 10),
    issues,
  };
}