import type { Violation, RuleCheckResult } from '../types.js';

export function checkGenerics(source: string, filePath: string): RuleCheckResult {
  const violations: Violation[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    const hookNoTypeRegex = /\b(useRef|useMemo|useReducer|useContext)\s*\(/g;
    let hookMatch;
    while ((hookMatch = hookNoTypeRegex.exec(line)) !== null) {
      const hookName = hookMatch[1];
      const upToHook = line.slice(hookMatch.index);
      if (upToHook.startsWith(`${hookName}<`)) continue;

      let suggestion = '';
      let why = '';
      if (hookName === 'useRef') {
        suggestion = `useRef<HTMLElement>(null) or useRef<ReturnType<typeof setTimeout>>(null)`;
        why = 'Untyped useRef defaults to MutableRefObject<null>. Specify the ref target type for proper DOM/timer typing.';
      } else if (hookName === 'useMemo') {
        suggestion = `useMemo<ReturnType>(() => ...)`;
        why = 'Explicit type param on useMemo documents the intended memoized value type and catches computation errors.';
      } else if (hookName === 'useReducer') {
        suggestion = `useReducer<State, Action>(reducer, initialState)`;
        why = 'Typed reducers ensure state transitions are correct and action payloads are validated.';
      } else {
        suggestion = `${hookName}<Type>(...)`;
        why = 'React hooks benefit from explicit type parameters for better type safety and IDE support.';
      }

      violations.push({
        rule: 'generics',
        severity: 'warning',
        line: i + 1,
        column: hookMatch.index + 1,
        current: `${hookName}(...)`,
        suggestion,
        fix: `// Add explicit type parameter:\n// ${suggestion}`,
        why,
      });
    }

    const castReturnRegex = /function\s+(\w+)\s*\([^)]*\):\s*(any|unknown)\s*\{/;
    const castMatch = line.match(castReturnRegex);
    if (castMatch) {
      violations.push({
        rule: 'generics',
        severity: 'warning',
        line: i + 1,
        column: 1,
        current: `function ${castMatch[1]}(...): ${castMatch[2]}`,
        suggestion: `function ${castMatch[1]}<T>(...): T`,
        fix: `// Make the function generic: function ${castMatch[1]}<T>(...): T {\n// Then call it with explicit type: ${castMatch[1]}<ReturnType>(...)`,
        why: 'Generic functions preserve type information through the call chain. Returning any/unknown loses type safety.',
      });
    }

    const assertReturnRegex = /return\s+(\w+)\s+as\s+(\w+)/g;
    let assertMatch;
    while ((assertMatch = assertReturnRegex.exec(line)) !== null) {
      const funcContext = findFunctionContext(lines, i);
      if (funcContext && !funcContext.includes('<')) {
        violations.push({
          rule: 'generics',
          severity: 'info',
          line: i + 1,
          column: assertMatch.index + 1,
          current: `return ${assertMatch[1]} as ${assertMatch[2]}`,
          suggestion: `Make the enclosing function generic: <T>(): T`,
          fix: `// Consider making the function generic instead of casting:\n// function parseResponse<T>(data: unknown): T { return data as T; }`,
          why: 'Type assertions in returns indicate the function could be generic to preserve type information.',
        });
      }
    }

    const objEntriesRegex = /Object\.(entries|keys|values)\s*\(/g;
    let objMatch;
    while ((objMatch = objEntriesRegex.exec(line)) !== null) {
      if (!line.includes('as ') && !line.includes('<')) {
        violations.push({
          rule: 'generics',
          severity: 'info',
          line: i + 1,
          column: objMatch.index + 1,
          current: `Object.${objMatch[1]}(...)`,
          suggestion: `Use Object.${objMatch[1]}(obj) with type narrowing or Object.${objMatch[1]}<K extends keyof T>(obj: T)`,
          fix: `// Add type parameter: Object.${objMatch[1]}<string, ValueType>(obj)`,
          why: `Object.${objMatch[1]} returns string[] or [string, any][] without type information. Use generics or type assertions for type safety.`,
        });
      }
    }

    const collectionRegex = /new\s+(Array|Map|Set)\s*\(/g;
    let collMatch;
    while ((collMatch = collectionRegex.exec(line)) !== null) {
      if (!line.includes('<')) {
        violations.push({
          rule: 'generics',
          severity: 'warning',
          line: i + 1,
          column: collMatch.index + 1,
          current: `new ${collMatch[1]}(...)`,
          suggestion: `new ${collMatch[1]}<Type>(...)`,
          fix: `// Add type parameter: new ${collMatch[1]}<SpecificType>(...)`,
          why: `Untyped collections default to ${collMatch[1]}<any>. Always specify the element type.`,
        });
      }
    }

    const callbackRegex = /callback:\s*\([^)]*\)\s*=>\s*void/g;
    let cbMatch;
    while ((cbMatch = callbackRegex.exec(line)) !== null) {
      violations.push({
        rule: 'generics',
        severity: 'info',
        line: i + 1,
        column: cbMatch.index + 1,
        current: 'callback: (...) => void',
        suggestion: 'callback: <T>(arg: T) => void or use a generic type parameter',
        fix: '// Make callback generic: <T>(value: T) => void',
        why: 'Generic callbacks preserve the type of the argument, enabling better type inference in the caller.',
      });
    }

    const utilityPatterns = [
      { regex: /function\s+(clone|deepClone|merge|assign|extend)\s*\(/, name: 'clone/merge' },
      { regex: /function\s+(filter|find|map|reduce)\w*\s*\(/, name: 'collection operation' },
      { regex: /function\s+(pick|omit|pluck|get|set)\s*\(/, name: 'property access' },
    ];

    for (const pattern of utilityPatterns) {
      const utilMatch = line.match(pattern.regex);
      if (utilMatch && !line.includes('<')) {
        violations.push({
          rule: 'generics',
          severity: 'info',
          line: i + 1,
          column: 1,
          current: line.trim(),
          suggestion: `Make ${utilMatch[1]} generic: function ${utilMatch[1]}<T>(...): T`,
          fix: `// Add generic type parameter: <T extends Record<string, unknown>>(obj: T)`,
          why: `Utility functions like ${pattern.name} should be generic to work with any type while preserving type information.`,
        });
      }
    }

    const classMatch = line.match(/class\s+(\w+)/);
    if (classMatch) {
      const classEnd = findClassEnd(lines, i);
      const classBody = lines.slice(i, classEnd).join('\n');
      const assertionCount = (classBody.match(/\bas\s+\w+/g) || []).length;
      const genericCount = (classBody.match(/<\w+>/g) || []).length;

      if (assertionCount >= 3 && genericCount === 0) {
        violations.push({
          rule: 'generics',
          severity: 'warning',
          line: i + 1,
          column: 1,
          current: `class ${classMatch[1]} (has ${assertionCount} type assertions)`,
          suggestion: `class ${classMatch[1]}<T> { ... }`,
          fix: `// Consider making the class generic:\n// class ${classMatch[1]}<T> {\n//   private data: T;\n//   constructor(data: T) { this.data = data; }\n// }`,
          why: `Class has ${assertionCount} type assertions but no generics. Generic classes avoid repeated assertions by maintaining type information.`,
        });
      }
    }
  }

  return { violations };
}

function findFunctionContext(lines: string[], currentLine: number): string | null {
  for (let i = currentLine; i >= 0; i--) {
    const match = lines[i].match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(/);
    if (match) return match[0];
  }
  return null;
}

function findClassEnd(lines: string[], startLine: number): number {
  let depth = 0;
  for (let i = startLine; i < lines.length; i++) {
    depth += (lines[i].match(/{/g) || []).length;
    depth -= (lines[i].match(/}/g) || []).length;
    if (depth === 0 && i > startLine) return i;
  }
  return lines.length;
}
