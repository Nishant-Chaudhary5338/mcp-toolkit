import type { Violation, RuleCheckResult } from '../types.js';

export function checkModifiers(source: string, filePath: string): RuleCheckResult {
  const violations: Violation[] = [];
  const lines = source.split('\n');

  let insideInterface = false;
  let interfaceName = '';
  let interfaceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    const ifaceStart = line.match(/^(?:export\s+)?interface\s+(\w+)/);
    if (ifaceStart) {
      insideInterface = true;
      interfaceName = ifaceStart[1];
      interfaceDepth = 0;
    }

    if (insideInterface) {
      interfaceDepth += (line.match(/\{/g) || []).length;
      interfaceDepth -= (line.match(/\}/g) || []).length;
      if (interfaceDepth <= 0 && line.includes('}')) {
        insideInterface = false;
        continue;
      }

      const propMatch = trimmed.match(/^(\w+)\s*\??\s*:\s*.+/);
      if (propMatch && !trimmed.startsWith('readonly') && interfaceDepth > 0) {
        const propName = propMatch[1];
        violations.push({
          rule: 'modifiers',
          severity: 'info',
          line: i + 1,
          column: line.indexOf(propName) + 1,
          current: trimmed.slice(0, 60),
          suggestion: `readonly ${trimmed.slice(0, 60)}`,
          fix: `// Mark interface property as readonly to prevent accidental mutation:\n// readonly ${propName}: ...`,
          why: `Interface properties in '${interfaceName}' should be readonly unless they need to be mutated. Readonly props prevent accidental modification and communicate immutability intent.`,
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    if (/^\s*return\s*\{/.test(line) && !line.includes('as const')) {
      let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      let endLine = i;
      for (let j = i + 1; j < lines.length && depth > 0; j++) {
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        if (depth <= 0) { endLine = j; break; }
      }
      const closingLine = lines[endLine] || '';
      if (!closingLine.includes('as const')) {
        violations.push({
          rule: 'modifiers',
          severity: 'info',
          line: i + 1,
          column: line.indexOf('return') + 1,
          current: 'return { ... }',
          suggestion: 'return { ... } as const',
          fix: `// Add 'as const' to preserve literal types:\n// return {\n//   key: 'value',\n// } as const`,
          why: "'as const' on returned object literals preserves literal types ('light' instead of string), enabling exhaustive checks and autocomplete.",
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    const constArrayRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*\[/g;
    let match;
    while ((match = constArrayRegex.exec(line)) !== null) {
      const restOfLine = line.slice(match.index);
      if (!restOfLine.includes('(') && !restOfLine.includes('map') && !restOfLine.includes('filter')) {
        if (!restOfLine.includes('as const')) {
          violations.push({
            rule: 'modifiers',
            severity: 'info',
            line: i + 1,
            column: match.index + 1,
            current: `const ${match[1]} = [...]`,
            suggestion: `const ${match[1]} = [...] as const`,
            fix: `// Add 'as const' to make the array readonly with literal types:\n// const ${match[1]} = [...] as const`,
            why: "'as const' makes the array readonly and infers literal types (e.g., ['a', 'b'] becomes readonly ['a', 'b'] instead of string[]).",
          });
        }
      }
    }

    const constObjectRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*\{/g;
    while ((match = constObjectRegex.exec(line)) !== null) {
      const restOfLine = line.slice(match.index);
      if (!restOfLine.includes('(') && !restOfLine.includes('as const')) {
        const objectEnd = findObjectEnd(lines, i);
        const objectBody = lines.slice(i, objectEnd + 1).join('\n');
        const hasFunctionCall = objectBody.includes('(');
        const hasSpread = objectBody.includes('...');

        if (!hasFunctionCall && !hasSpread) {
          violations.push({
            rule: 'modifiers',
            severity: 'info',
            line: i + 1,
            column: match.index + 1,
            current: `const ${match[1]} = { ... }`,
            suggestion: `const ${match[1]} = { ... } as const`,
            fix: `// Add 'as const' for deeply readonly with literal types:\n// const ${match[1]} = { ... } as const`,
            why: "'as const' makes the entire object deeply readonly and preserves literal types for all properties.",
          });
        }
      }
    }

    const interfacePropRegex = /^\s+(\w+)\s*\??\s*:\s*([^;]+);/g;
    while ((match = interfacePropRegex.exec(line)) !== null) {
      const propName = match[1];
      const propType = match[2].trim();

      if (line.includes('readonly')) continue;

      if (propName.toLowerCase().endsWith('id') || propName === 'id') {
        violations.push({
          rule: 'modifiers',
          severity: 'info',
          line: i + 1,
          column: 1,
          current: `${propName}: ${propType}`,
          suggestion: `readonly ${propName}: ${propType}`,
          fix: `// Make ID properties readonly - they shouldn't change after creation:\n// readonly ${propName}: ${propType}`,
          why: "ID properties should be readonly since they're immutable identifiers set at creation time.",
        });
      }

      if (propName.toLowerCase().includes('created') || propName.toLowerCase().includes('updated')) {
        if (propType.includes('Date') || propType.includes('number')) {
          violations.push({
            rule: 'modifiers',
            severity: 'info',
            line: i + 1,
            column: 1,
            current: `${propName}: ${propType}`,
            suggestion: `readonly ${propName}: ${propType}`,
            fix: `// Make timestamp properties readonly:\n// readonly ${propName}: ${propType}`,
            why: "Timestamp properties like createdAt/updatedAt should be readonly as they're set by the system.",
          });
        }
      }
    }

    const letVariable = line.match(/let\s+(\w+)\s*=/);
    if (letVariable) {
      const varName = letVariable[1];
      const restOfFile = lines.slice(i + 1).join('\n');
      const reassignment = restOfFile.match(new RegExp(`${varName}\\s*=`));

      if (!reassignment) {
        violations.push({
          rule: 'modifiers',
          severity: 'warning',
          line: i + 1,
          column: 1,
          current: `let ${varName} = ...`,
          suggestion: `const ${varName} = ...`,
          fix: `// Use 'const' instead of 'let' - variable is never reassigned:\n// const ${varName} = ...`,
          why: "Use 'const' by default. Only use 'let' when the variable needs to be reassigned.",
        });
      }
    }

    const typeAlias = line.match(/const\s+(\w+)\s*:\s*(\w+)\s*=/);
    if (typeAlias) {
      const varName = typeAlias[1];
      const typeName = typeAlias[2];
      const nextLines = lines.slice(i + 1, Math.min(i + 10, lines.length)).join('\n');
      const hasPropertyAccess = nextLines.includes(`${varName}.`);

      if (hasPropertyAccess && !line.includes('satisfies')) {
        violations.push({
          rule: 'modifiers',
          severity: 'info',
          line: i + 1,
          column: 1,
          current: `const ${varName}: ${typeName} = ...`,
          suggestion: `const ${varName} = ... satisfies ${typeName}`,
          fix: `// Use 'satisfies' instead of type annotation for better inference:\n// const ${varName} = ... satisfies ${typeName}`,
          why: "'satisfies' validates the type while preserving the narrower inferred type, enabling better autocomplete.",
        });
      }
    }

    const enumLike = line.match(/(?:export\s+)?const\s+(\w+_(?:TYPE|STATUS|MODE|STATE|KIND))\s*=\s*['"]([^'"]+)['"]/);
    if (enumLike) {
      violations.push({
        rule: 'modifiers',
        severity: 'info',
        line: i + 1,
        column: 1,
        current: `const ${enumLike[1]} = '${enumLike[2]}'`,
        suggestion: `const ${enumLike[1]} = '${enumLike[2]}' as const`,
        fix: `// Use 'as const' for string literal types:\n// const ${enumLike[1]} = '${enumLike[2]}' as const`,
        why: "'as const' creates a literal type ('value') instead of widening to string.",
      });
    }
  }

  return { violations };
}

function findObjectEnd(lines: string[], startLine: number): number {
  let depth = 0;
  for (let i = startLine; i < lines.length; i++) {
    depth += (lines[i].match(/{/g) || []).length;
    depth -= (lines[i].match(/}/g) || []).length;
    if (depth === 0 && i > startLine) return i;
  }
  return Math.min(startLine + 20, lines.length - 1);
}
