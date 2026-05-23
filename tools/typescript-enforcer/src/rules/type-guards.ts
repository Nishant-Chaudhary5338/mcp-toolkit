import type { Violation, RuleCheckResult } from '../types.js';

export function checkTypeGuards(source: string, filePath: string): RuleCheckResult {
  const violations: Violation[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    const objectAssertRegex = /\bconst\s+(\w+)\s*=\s*(\w+)\s+as\s+\{/;
    const objAssertMatch = line.match(objectAssertRegex);
    if (objAssertMatch) {
      violations.push({
        rule: 'type-guards',
        severity: 'warning',
        line: i + 1,
        column: line.indexOf('as {') + 1,
        current: `const ${objAssertMatch[1]} = ${objAssertMatch[2]} as { ... }`,
        suggestion: `Use a type guard: function is${objAssertMatch[1].charAt(0).toUpperCase() + objAssertMatch[1].slice(1)}(v: unknown): v is { ... }`,
        fix: `// Replace type assertion with a type guard function:\n// function is${objAssertMatch[1].charAt(0).toUpperCase() + objAssertMatch[1].slice(1)}(v: unknown): v is { ... } {\n//   return typeof v === 'object' && v !== null && '...' in v;\n// }`,
        why: "Type assertions ('as') bypass TypeScript's type checking. Type guards validate the shape at runtime and narrow the type safely.",
      });
    }

    const funcAssertion = line.match(/(\w+)\s+as\s+(\w[\w<>, ]*)\s*[;,)]/);
    if (funcAssertion && !line.includes('//') && !objAssertMatch) {
      const castTarget = funcAssertion[2].trim();
      if (!['string', 'number', 'boolean', 'never', 'unknown', 'any', 'object'].includes(castTarget) && !castTarget.startsWith('typeof')) {
        const isInsideFunc = lines.slice(Math.max(0, i - 20), i).some(l => /(?:function|=>)\s*\{/.test(l) || /=>\s*$/.test(l));
        if (isInsideFunc) {
          violations.push({
            rule: 'type-guards',
            severity: 'info',
            line: i + 1,
            column: line.indexOf(' as ') + 1,
            current: `${funcAssertion[1]} as ${castTarget}`,
            suggestion: `Create a type guard: function is${castTarget}(v: unknown): v is ${castTarget}`,
            fix: `// Use a type guard instead of 'as' cast:\n// function is${castTarget}(v: unknown): v is ${castTarget} {\n//   return typeof v === 'object' && v !== null && '...' in v;\n// }`,
            why: "'as' assertions silence TypeScript without validating the actual shape. Type guards enforce correctness at runtime.",
          });
        }
      }
    }

    const typeofCheck = line.match(/function\s+(is\w+)\s*\(\s*(\w+)\s*:\s*(\w+)\s*\)\s*:\s*boolean\s*\{/);
    if (typeofCheck) {
      const funcName = typeofCheck[1];
      const paramName = typeofCheck[2];
      const paramType = typeofCheck[3];

      const funcEnd = findFunctionEnd(lines, i);
      const funcBody = lines.slice(i, funcEnd + 1).join('\n');
      const hasTypeof = funcBody.includes('typeof');
      const hasInstanceof = funcBody.includes('instanceof');
      const hasPropertyCheck = funcBody.includes('in ');

      if (hasTypeof || hasInstanceof || hasPropertyCheck) {
        let targetType = 'unknown';
        if (funcBody.includes("=== 'string'")) targetType = 'string';
        else if (funcBody.includes("=== 'number'")) targetType = 'number';
        else if (funcBody.includes("=== 'boolean'")) targetType = 'boolean';
        else if (funcBody.includes("=== 'object'")) targetType = 'object';
        else if (funcBody.includes('instanceof')) {
          const instanceofMatch = funcBody.match(/instanceof\s+(\w+)/);
          if (instanceofMatch) targetType = instanceofMatch[1];
        }

        violations.push({
          rule: 'type-guards',
          severity: 'info',
          line: i + 1,
          column: 1,
          current: `function ${funcName}(...): boolean`,
          suggestion: `function ${funcName}(...): value is ${targetType}`,
          fix: `// Use type predicate instead of boolean return:\n// function ${funcName}(${paramName}: ${paramType}): ${paramName} is ${targetType} {\n//   return typeof ${paramName} === '${targetType.toLowerCase()}';\n// }`,
          why: "Type predicates ('is' keyword) let TypeScript narrow the type automatically after the check, instead of just returning boolean.",
        });
      }
    }

    const arrowTypeCheck = line.match(/const\s+(is\w+)\s*=\s*\(\s*(\w+)\s*:\s*(\w+)\s*\)\s*:\s*boolean\s*=>/);
    if (arrowTypeCheck) {
      violations.push({
        rule: 'type-guards',
        severity: 'info',
        line: i + 1,
        column: 1,
        current: `const ${arrowTypeCheck[1]} = (...): boolean =>`,
        suggestion: `const ${arrowTypeCheck[1]} = (...): param is Type =>`,
        fix: `// Use type predicate:\n// const ${arrowTypeCheck[1]} = (${arrowTypeCheck[2]}: ${arrowTypeCheck[3]}): ${arrowTypeCheck[2]} is TargetType => typeof ${arrowTypeCheck[2]} === 'string'`,
        why: "Type predicates enable automatic type narrowing in if/else blocks.",
      });
    }

    const inlineTypeof = line.match(/if\s*\(\s*typeof\s+(\w+)\s*===?\s*['"](\w+)['"]\s*\)/);
    if (inlineTypeof) {
      const varName = inlineTypeof[1];
      const checkType = inlineTypeof[2];
      const nextLines = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
      const hasCast = nextLines.includes(`as ${checkType.charAt(0).toUpperCase() + checkType.slice(1)}`) ||
                      nextLines.includes(`as ${checkType}`);

      if (hasCast) {
        violations.push({
          rule: 'type-guards',
          severity: 'warning',
          line: i + 1,
          column: 1,
          current: `if (typeof ${varName} === '${checkType}') { ... as ${checkType} }`,
          suggestion: `Create a type guard function: function is${checkType.charAt(0).toUpperCase() + checkType.slice(1)}(v: unknown): v is ${checkType}`,
          fix: `// Extract to type guard to eliminate casts:\n// function is${checkType.charAt(0).toUpperCase() + checkType.slice(1)}(v: unknown): v is ${checkType} {\n//   return typeof v === '${checkType}';\n// }`,
          why: "Type guards eliminate the need for type assertions ('as') inside conditional blocks, making code safer.",
        });
      }
    }

    const instanceofCheck = line.match(/if\s*\(\s*(\w+)\s+instanceof\s+(\w+)\s*\)/);
    if (instanceofCheck) {
      const varName = instanceofCheck[1];
      const className = instanceofCheck[2];
      const nextLines = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
      const hasCast = nextLines.includes(`as ${className}`);

      if (hasCast) {
        violations.push({
          rule: 'type-guards',
          severity: 'warning',
          line: i + 1,
          column: 1,
          current: `if (${varName} instanceof ${className}) { ... as ${className} }`,
          suggestion: `Create a type guard: function is${className}(v: unknown): v is ${className}`,
          fix: `// Extract to type guard:\n// function is${className}(v: unknown): v is ${className} {\n//   return v instanceof ${className};\n// }`,
          why: "After instanceof, TypeScript should narrow the type automatically. If you still need 'as', use a type guard instead.",
        });
      }
    }

    const propertyCheck = line.match(/if\s*\(\s*['"](\w+)['"]\s+in\s+(\w+)\s*\)/);
    if (propertyCheck) {
      const propName = propertyCheck[1];
      const varName = propertyCheck[2];
      const nextLines = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
      const hasCast = nextLines.includes('as ');

      if (hasCast) {
        violations.push({
          rule: 'type-guards',
          severity: 'info',
          line: i + 1,
          column: 1,
          current: `if ('${propName}' in ${varName}) { ... as ... }`,
          suggestion: `Create a type guard for the property check`,
          fix: `// Create a type guard:\n// function has${propName.charAt(0).toUpperCase() + propName.slice(1)}(obj: unknown): obj is { ${propName}: unknown } {\n//   return typeof obj === 'object' && obj !== null && '${propName}' in obj;\n// }`,
          why: 'Type guards for property checks enable safe access without casts.',
        });
      }
    }

    const nullCheck = line.match(/function\s+(isNotNull|isNonNull|isDefined|isPresent)\s*\(\s*(\w+)\s*:\s*(\w+)\s*\)\s*:\s*boolean/);
    if (nullCheck) {
      violations.push({
        rule: 'type-guards',
        severity: 'info',
        line: i + 1,
        column: 1,
        current: `function ${nullCheck[1]}(...): boolean`,
        suggestion: `function ${nullCheck[1]}<T>(value: T | null | undefined): value is T`,
        fix: `// Use generic type predicate for null checks:\n// function ${nullCheck[1]}<T>(value: T | null | undefined): value is T {\n//   return value !== null && value !== undefined;\n// }`,
        why: "Generic type predicates preserve the non-null type through the type system.",
      });
    }
  }

  return { violations };
}

function findFunctionEnd(lines: string[], startLine: number): number {
  let depth = 0;
  for (let i = startLine; i < lines.length; i++) {
    depth += (lines[i].match(/{/g) || []).length;
    depth -= (lines[i].match(/}/g) || []).length;
    if (depth === 0 && i > startLine) return i;
  }
  return lines.length - 1;
}
