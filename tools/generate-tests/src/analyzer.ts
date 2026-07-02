export interface PropField {
  name: string;
  type: string;
  optional: boolean;
}

export interface ComponentInfo {
  name: string;
  isForwardRef: boolean;
  isVoidElement: boolean;
  hasVariants: boolean;
  hasSizes: boolean;
  variantValues: string[];
  sizeValues: string[];
  propsFields: string[];
  propTypes: PropField[];
  hasChildren: boolean;
  isServerComponent: boolean;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  returnType: string;
  isAsync: boolean;
}

export interface HookInfo {
  name: string;
  params: string[];
  returnsObject: boolean;
  returnsArray: boolean;
}

export interface ClassInfo {
  name: string;
  methods: string[];
  hasConstructor: boolean;
}

export interface SourceAnalysis {
  isReactFile: boolean;
  components: ComponentInfo[];
  functions: FunctionInfo[];
  hooks: HookInfo[];
  classes: ClassInfo[];
}

const VOID_NAMES = new Set(['input', 'img', 'separator', 'divider', 'br', 'hr', 'textarea']);
const INTERACTIVE_NAMES = ['button', 'link', 'anchor', 'tab', 'toggle', 'switch', 'checkbox', 'radio'];

function isVoid(name: string): boolean {
  return VOID_NAMES.has(name.toLowerCase());
}

/** Extract values from a cva() or variants object literal — e.g. variant: { primary: '...', secondary: '...' } */
function extractVariantValues(content: string, key: 'variant' | 'size'): string[] {
  const pattern = new RegExp(`${key}\\s*:\\s*\\{([^}]*)\\}`, 's');
  const m = content.match(pattern);
  if (!m) return [];
  // Blank out the CONTENTS of string literals first, so Tailwind state prefixes
  // inside class strings (hover:, focus:, disabled:) aren't captured as keys.
  const body = m[1].replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""');
  const values: string[] = [];
  const seen = new Set<string>();
  for (const vm of body.matchAll(/(\w+)\s*:/g)) {
    if (vm[1] !== key && !seen.has(vm[1])) {
      seen.add(vm[1]);
      values.push(vm[1]);
    }
  }
  return values.slice(0, 8); // cap at 8 to avoid explosion
}

function extractPropsInterface(content: string, componentName: string): PropField[] {
  const patterns = [
    new RegExp(`interface\\s+${componentName}Props(?:\\s+extends[^{]*)\\s*\\{([^}]*)\\}`, 's'),
    new RegExp(`type\\s+${componentName}Props\\s*=\\s*(?:[^{]*&\\s*)?\\{([^}]*)\\}`, 's'),
  ];

  for (const pattern of patterns) {
    const m = content.match(pattern);
    if (!m) continue;
    const fields: PropField[] = [];
    for (const field of m[1].matchAll(/(\w+)(\??)\s*:\s*([^;\n]+)/g)) {
      fields.push({
        name: field[1],
        optional: field[2] === '?',
        type: field[3].trim(),
      });
    }
    if (fields.length > 0) return fields;
  }
  return [];
}

export function analyzeSource(content: string): SourceAnalysis {
  const isReactFile = /['"]react['"]|jsx|tsx/i.test(content);
  const components: ComponentInfo[] = [];
  const functions: FunctionInfo[] = [];
  const hooks: HookInfo[] = [];
  const classes: ClassInfo[] = [];

  const seenComponents = new Set<string>();

  function buildComponent(name: string, isForwardRef: boolean): ComponentInfo {
    const propTypes = extractPropsInterface(content, name);
    const propsFields = propTypes.map(p => p.name);
    const variantValues = extractVariantValues(content, 'variant');
    const sizeValues = extractVariantValues(content, 'size');
    const hasChildren = propsFields.includes('children') || content.includes('children') && !isVoid(name);

    return {
      name,
      isForwardRef,
      isVoidElement: isVoid(name),
      hasVariants: content.includes('variant') && (content.includes('cva') || content.includes('variants')),
      hasSizes: content.includes('size') && (content.includes('cva') || content.includes('sizes')),
      variantValues: variantValues.length > 0 ? variantValues : ['default', 'destructive', 'outline', 'secondary', 'ghost'],
      sizeValues: sizeValues.length > 0 ? sizeValues : ['default', 'sm', 'lg'],
      propsFields,
      propTypes,
      hasChildren,
      isServerComponent: !content.includes("'use client'") && !content.includes('"use client"'),
    };
  }

  // forwardRef components
  for (const m of content.matchAll(/(?:export\s+)?(?:const|function)\s+(\w+)\s*=\s*(?:React\.)?forwardRef\s*[<(]/g)) {
    const name = m[1];
    if (seenComponents.has(name) || !/^[A-Z]/.test(name)) continue;
    seenComponents.add(name);
    components.push(buildComponent(name, true));
  }

  // Regular PascalCase components
  for (const m of content.matchAll(/(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?:[:<][^=]*)?(?:=\s*(?:\(|React\.)|\s*\()/g)) {
    const name = m[1];
    if (seenComponents.has(name)) continue;
    // Skip if it looks like a type/interface
    if (/Props$|Type$|Context$|State$/.test(name)) continue;
    seenComponents.add(name);
    components.push(buildComponent(name, false));
  }

  // Functions and hooks
  const seenFns = new Set<string>();
  for (const m of content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\n{]+))?/g)) {
    const name = m[1];
    if (seenFns.has(name)) continue;
    seenFns.add(name);
    if (/^use[A-Z]/.test(name)) {
      const body = content.slice(m.index ?? 0, (m.index ?? 0) + 1000);
      hooks.push({
        name,
        params: m[2].split(',').map(p => p.trim()).filter(Boolean),
        returnsObject: /return\s*\{/.test(body),
        returnsArray: /return\s*\[/.test(body),
      });
    } else if (!/^[A-Z]/.test(name) || !isReactFile) {
      functions.push({
        name,
        isAsync: m[0].includes('async'),
        params: m[2].split(',').map(p => p.trim()).filter(Boolean),
        returnType: m[3]?.trim() ?? 'unknown',
      });
    }
  }

  // Arrow function hooks
  for (const m of content.matchAll(/(?:export\s+)?const\s+(use[A-Z]\w+)\s*=\s*(?:\(([^)]*)\)|\w+)\s*(?::[^=]*)?\s*=>/g)) {
    const name = m[1];
    if (seenFns.has(name)) continue;
    seenFns.add(name);
    const body = content.slice(m.index ?? 0, (m.index ?? 0) + 1000);
    hooks.push({
      name,
      params: (m[2] || '').split(',').map(p => p.trim()).filter(Boolean),
      returnsObject: /return\s*\{/.test(body),
      returnsArray: /return\s*\[/.test(body),
    });
  }

  // Classes — must be an actual `class Name {`/`extends`/`implements` declaration
  // with a PascalCase name. Requiring the `{`/`extends` and a capital first letter
  // stops phrases like "class names" inside a JSDoc comment being captured.
  for (const m of content.matchAll(/(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Z]\w*)\s*(?:<[^>]*>)?\s*(?:extends\s+[\w.]+\s*(?:<[^>]*>)?\s*)?(?:implements\s+[^{]+)?\{/g)) {
    const body = content.slice(m.index ?? 0, (m.index ?? 0) + 1200);
    const methods: string[] = [];
    for (const mm of body.matchAll(/(?:public|private|protected|async\s+)?(\w+)\s*\(/g)) {
      if (!['if', 'for', 'while', 'switch', 'catch'].includes(mm[1])) {
        methods.push(mm[1]);
      }
    }
    classes.push({ name: m[1], methods: [...new Set(methods)], hasConstructor: body.includes('constructor(') });
  }

  return { isReactFile, components, functions, hooks, classes };
}

/**
 * Produce a plausible argument for a parameter. Prefers the declared TYPE
 * (so we never pass `undefined`/`null` to a `string`/`number` param — which
 * both fails strict typecheck and throws at runtime on `.trim()`/`.length`),
 * falling back to the parameter name only when the type is unknown.
 */
export function mockValue(param: string): string {
  const colon = param.indexOf(':');
  const namePart = (colon >= 0 ? param.slice(0, colon) : param).replace(/[?].*$/, '').replace(/\s*=(?!>).*$/, '').replace(/^\.\.\./, '').trim();
  // strip a default value (`= x`) but keep arrow `=>` in function types
  const type = (colon >= 0 ? param.slice(colon + 1) : '').replace(/\s*=(?!>).*$/, '').trim();
  const t = type.toLowerCase();

  if (t) {
    if (/^(readonly)?\s*[\w.]+\[\]$/.test(t) || /^(array|readonlyarray)</.test(t)) return '[]';
    if (t.includes('=>')) return 'vi.fn()';
    if (t.includes('|')) {
      // union: prefer a concrete literal member
      const first = t.split('|').map(s => s.trim()).find(s => s && s !== 'null' && s !== 'undefined');
      if (first) {
        if (/^\d+$/.test(first)) return first;
        if (/^'|^"/.test(first)) return first.replace(/'/g, '"');
        if (first === 'true' || first === 'false') return first;
        if (first === 'string') return '"test"';
        if (first === 'number') return '0';
        if (first === 'boolean') return 'false';
      }
    }
    if (/^string$/.test(t)) return '"test"';
    if (/^number$/.test(t)) return '0';
    if (/^boolean$/.test(t)) return 'false';
    if (/^{|^record<|^object$/.test(t)) return '{}';
  }

  const n = namePart.toLowerCase();
  if (/count|num|size|index|limit|min|max|step|rows|cols/.test(n)) return '0';
  if (/str|name|label|title|id|key|text|placeholder|description|message/.test(n)) return '"test"';
  if (/bool|flag|enabled|visible|show|disabled|active|open|loading|checked/.test(n)) return 'false';
  if (/callback|handler|fn|on[A-Z]/.test(namePart)) return 'vi.fn()';
  if (/items|list|array/.test(n)) return '[]';
  if (/obj|config|options|props/.test(n)) return '{}';
  if (/ref/.test(n)) return '{ current: null }';
  if (/children/.test(n)) return '"children"';
  // Unknown type: a string is the least likely to throw on common operations.
  return '"test"';
}
