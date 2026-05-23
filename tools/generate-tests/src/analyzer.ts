export interface ComponentInfo {
  name: string;
  isForwardRef: boolean;
  isVoidElement: boolean;
  hasVariants: boolean;
  hasSizes: boolean;
  propsFields: string[];
}

export interface FunctionInfo {
  name: string;
  params: string[];
  isAsync: boolean;
}

export interface HookInfo {
  name: string;
  params: string[];
}

export interface ClassInfo {
  name: string;
  methods: string[];
}

export interface SourceAnalysis {
  isReactFile: boolean;
  components: ComponentInfo[];
  functions: FunctionInfo[];
  hooks: HookInfo[];
  classes: ClassInfo[];
}

const VOID_NAMES = new Set(['input', 'img', 'separator', 'divider', 'br', 'hr']);
const INTERACTIVE_NAMES = ['button', 'link', 'anchor', 'tab', 'toggle', 'switch', 'checkbox', 'radio'];

function isVoid(name: string): boolean {
  return VOID_NAMES.has(name.toLowerCase());
}

function extractPropsFields(content: string, componentName: string): string[] {
  const patterns = [
    new RegExp(`interface\\s+${componentName}Props\\s*\\{([^}]*)\\}`, 's'),
    new RegExp(`type\\s+${componentName}Props\\s*=\\s*\\{([^}]*)\\}`, 's'),
  ];
  for (const pattern of patterns) {
    const m = content.match(pattern);
    if (m) {
      const fields: string[] = [];
      for (const field of m[1].matchAll(/(\w+)(?:\?)?\s*:/g)) {
        fields.push(field[1]);
      }
      return fields;
    }
  }
  return [];
}

export function analyzeSource(content: string): SourceAnalysis {
  const isReactFile = /react|jsx|tsx/i.test(content);
  const components: ComponentInfo[] = [];
  const functions: FunctionInfo[] = [];
  const hooks: HookInfo[] = [];
  const classes: ClassInfo[] = [];

  const seenComponents = new Set<string>();

  // forwardRef components
  for (const m of content.matchAll(/(?:export\s+)?(?:const|function)\s+(\w+)\s*=\s*(?:React\.)?forwardRef\s*[<(]/g)) {
    const name = m[1];
    if (seenComponents.has(name)) continue;
    seenComponents.add(name);
    components.push({
      name, isForwardRef: true, isVoidElement: isVoid(name),
      hasVariants: content.includes('variant') && content.includes('cva'),
      hasSizes: content.includes('size') && content.includes('cva'),
      propsFields: extractPropsFields(content, name),
    });
  }

  // regular PascalCase components
  for (const m of content.matchAll(/(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?:[:<][^=]*)?(?:=\s*(?:\(|React\.))/g)) {
    const name = m[1];
    if (seenComponents.has(name)) continue;
    seenComponents.add(name);
    components.push({
      name, isForwardRef: false, isVoidElement: isVoid(name),
      hasVariants: content.includes('variant') && content.includes('cva'),
      hasSizes: content.includes('size') && content.includes('cva'),
      propsFields: extractPropsFields(content, name),
    });
  }

  // functions and hooks
  const seenFns = new Set<string>();
  for (const m of content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)) {
    const name = m[1];
    if (seenFns.has(name)) continue;
    seenFns.add(name);
    if (/^use[A-Z]/.test(name)) {
      hooks.push({ name, params: m[2].split(',').map(p => p.trim()).filter(Boolean) });
    } else if (!/^[A-Z]/.test(name) || !isReactFile) {
      functions.push({ name, isAsync: m[0].includes('async'), params: m[2].split(',').map(p => p.trim()).filter(Boolean) });
    }
  }

  // arrow function hooks
  for (const m of content.matchAll(/(?:export\s+)?const\s+(use[A-Z]\w+)\s*=\s*(?:\(([^)]*)\)|\w+)\s*(?::.*?)?\s*=>/g)) {
    const name = m[1];
    if (seenFns.has(name)) continue;
    seenFns.add(name);
    hooks.push({ name, params: (m[2] || '').split(',').map(p => p.trim()).filter(Boolean) });
  }

  // classes
  for (const m of content.matchAll(/(?:export\s+)?class\s+(\w+)/g)) {
    const body = content.slice(m.index ?? 0, (m.index ?? 0) + 800);
    const methods: string[] = [];
    for (const mm of body.matchAll(/(?:async\s+)?(\w+)\s*\(/g)) {
      methods.push(mm[1]);
    }
    classes.push({ name: m[1], methods });
  }

  return { isReactFile, components, functions, hooks, classes };
}

export function mockValue(paramName: string): string {
  const n = paramName.toLowerCase().replace(/[:?].*$/, '').trim();
  if (/count|num|size|index|limit/.test(n)) return '0';
  if (/str|name|label|title|id|key|text/.test(n)) return '"test"';
  if (/bool|flag|enabled|visible|show/.test(n)) return 'true';
  if (/callback|handler|fn|on[A-Z]/.test(n)) return 'vi.fn()';
  if (/items|list|array/.test(n)) return '[]';
  if (/obj|config|options|props/.test(n)) return '{}';
  return 'undefined';
}
