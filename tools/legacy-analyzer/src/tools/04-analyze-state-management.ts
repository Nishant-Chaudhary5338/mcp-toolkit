// ============================================================================
// TOOL #4: analyze-state-management
// Detects Redux, Context API, local state patterns, and advanced patterns
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, resolveSourceDir } from '../utils/file-scanner.js';
import { parseFile, extractImports, extractHooks } from '../utils/ast-parser.js';
import type { AnalyzeStateOutput, StatePatterns, AnalyzerConfig } from '../types.js';

export async function analyzeStateManagement(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeStateOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  let reduxUsage = 0;
  let contextUsage = 0;
  let localStateUsage = 0;

  const patterns: StatePatterns = {
    normalizedState: false,
    derivedState: false,
    reselectUsed: false,
  };

  const issues: string[] = [];
  const stateHeavyComponents: string[] = [];

  let hasEntitiesPattern = false;
  let hasIdsPattern = false;
  let hasDerivedState = false;
  let hasCreateSelector = false;
  let totalLocalStateCalls = 0;

  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    const relPath = path.relative(appPath, file);

    // AST-based analysis (best effort)
    let astHooks: { name: string }[] = [];
    let astImportSources: string[] = [];
    const parsed = parseFile(file);
    if (parsed) {
      const imports = extractImports(parsed.ast);
      astHooks = extractHooks(parsed.ast);
      astImportSources = imports.map((i) => i.source);
    }

    // Redux detection
    const hasRedux = astImportSources.some((s) =>
      s.includes('redux') || s.includes('@reduxjs/toolkit') || s.includes('react-redux')
    ) || content.includes('useSelector') || content.includes('useDispatch') || content.includes('createStore');
    if (hasRedux) reduxUsage++;

    // Context API detection
    const hasContext = content.includes('createContext') || content.includes('useContext') || content.includes('React.createContext');
    if (hasContext) contextUsage++;

    // Local state detection — covers both imported useState and React.useState namespace style
    const astStateHooks = astHooks.filter((h) => h.name === 'useState' || h.name === 'useReducer');
    const regexStateCount = (content.match(/\buseState\s*\(/g) || []).length
      + (content.match(/React\.useState\s*\(/g) || []).length
      + (content.match(/\buseReducer\s*\(/g) || []).length
      + (content.match(/React\.useReducer\s*\(/g) || []).length;

    const localStateCount = Math.max(astStateHooks.length, regexStateCount);
    if (localStateCount > 0) {
      localStateUsage++;
      totalLocalStateCalls += localStateCount;

      // Flag components with excessive local state (potential god component)
      if (localStateCount >= 3) {
        stateHeavyComponents.push(`${relPath} (${localStateCount} state variables)`);
      }
    }

    // Reselect detection
    if (content.includes('createSelector') || astImportSources.some((s) => s.includes('reselect'))) {
      hasCreateSelector = true;
    }

    // Normalized state detection
    if (content.includes('entities') && (content.includes('ids') || content.includes('allIds'))) {
      hasEntitiesPattern = true;
      hasIdsPattern = true;
    }
    if (content.includes('byId') || content.includes('entitiesById')) {
      hasEntitiesPattern = true;
    }

    // Derived state detection
    const hasMemo = content.includes('useMemo') || content.includes('React.useMemo');
    if (hasMemo && localStateCount > 0) hasDerivedState = true;
    if (content.includes('getDerived') || content.includes('selectDerived')) hasDerivedState = true;

    // Mixed Redux + excessive local state
    if (hasRedux && localStateCount > 5) {
      issues.push(`${relPath}: Mix of Redux and excessive local state (${localStateCount} useState calls). Consider consolidating.`);
    }

    // Large Redux slices
    if (content.includes('createSlice') && content.split('\n').length > 200) {
      issues.push(`${relPath}: Large Redux slice. Consider splitting into smaller slices.`);
    }
  }

  patterns.normalizedState = hasEntitiesPattern && hasIdsPattern;
  patterns.derivedState = hasDerivedState;
  patterns.reselectUsed = hasCreateSelector;

  let stateType: AnalyzeStateOutput['stateType'];
  const hasRedux = reduxUsage > 0;
  const hasContext = contextUsage > 0;
  const hasLocal = localStateUsage > 0;

  if (hasRedux && (hasContext || hasLocal)) {
    stateType = 'mixed';
  } else if (hasRedux) {
    stateType = 'redux';
  } else if (hasContext) {
    stateType = 'context';
  } else if (hasLocal) {
    stateType = 'local';
  } else {
    stateType = 'none';
  }

  if (stateType === 'mixed') {
    issues.push('Mixed state management detected (Redux + Context/Local). Consider standardizing on one approach.');
  }

  if (hasRedux && !hasCreateSelector) {
    issues.push('Redux used without Reselect. Consider using memoized selectors for performance.');
  }

  if (contextUsage > 5) {
    issues.push(`High Context API usage (${contextUsage} files). Consider if some contexts should be Redux stores or Zustand.`);
  }

  if (stateType === 'local' && totalLocalStateCalls > 5) {
    issues.push(`All state is local useState (${totalLocalStateCalls} calls across ${localStateUsage} files). Consider extracting to Context or Zustand for complex shared state.`);
  }

  if (stateHeavyComponents.length > 0) {
    issues.push(`Components with many state variables (potential god components): ${stateHeavyComponents.join(', ')}`);
  }

  return {
    stateType,
    patterns,
    issues,
  };
}
