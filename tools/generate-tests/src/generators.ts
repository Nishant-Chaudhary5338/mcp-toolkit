import type { ComponentInfo, FunctionInfo, HookInfo, ClassInfo } from './analyzer.js';
import { mockValue } from './analyzer.js';

// ============================================================================
// COMPONENT TESTS
// ============================================================================

export function generateComponentTests(info: ComponentInfo, importPath: string): string {
  const { name, isVoidElement, hasVariants, hasSizes, variantValues, sizeValues, propTypes, hasChildren } = info;

  const primaryRender = isVoidElement
    ? `<${name} data-testid="subject" placeholder="test-input" />`
    : `<${name} data-testid="subject">Test Content</${name}>`;
  const primaryGet = `screen.getByTestId('subject')`;

  // Categorise props
  const callbacks = propTypes.filter(p => /^on[A-Z]/.test(p.name));
  const boolFlags = propTypes.filter(p =>
    /^(disabled|loading|readOnly|hidden|active|checked|required|open|visible|selected|expanded)$/.test(p.name)
    || p.type.trim() === 'boolean'
  );
  const stringProps = propTypes.filter(p =>
    !p.name.startsWith('on') &&
    !['className', 'children', 'style', 'ref'].includes(p.name) &&
    !boolFlags.find(b => b.name === p.name) &&
    (p.type.includes('string') || p.name === 'label' || p.name === 'title' || p.name === 'placeholder')
  );

  const classNameRender = isVoidElement
    ? `<${name} className="x-custom" data-testid="subject" placeholder="test-input" />`
    : `<${name} className="x-custom" data-testid="subject">Test Content</${name}>`;

  let t = `import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ${name} } from '${importPath}'

describe('${name}', () => {
  // -----------------------------------------------------------------------
  // Core rendering
  // -----------------------------------------------------------------------
  it('renders without crashing', () => {
    render(${primaryRender})
    expect(${primaryGet}).toBeInTheDocument()
  })

  it('accepts and applies className', () => {
    render(${classNameRender})
    expect(${primaryGet}).toHaveClass('x-custom')
  })

  it('forwards unknown props as HTML attributes (data-*)', () => {
    render(${primaryRender})
    expect(${primaryGet}).toBeInTheDocument()
  })

  it('is accessible via aria-label', () => {
    render(<${name} aria-label="${name.toLowerCase()}-widget"${isVoidElement ? ' placeholder="test-input" />' : `>Content</${name}>`})
    expect(screen.getByLabelText('${name.toLowerCase()}-widget')).toBeInTheDocument()
  })
`;

  // String props
  for (const p of stringProps.slice(0, 4)) {
    t += `
  it('accepts ${p.name} prop', () => {
    render(<${name} ${p.name}="test-value"${isVoidElement ? ' />' : `>Content</${name}>`})
    expect(${primaryGet}).toBeInTheDocument()
  })
`;
  }

  // Callback props
  for (const cb of callbacks.slice(0, 4)) {
    const isClick = cb.name === 'onClick';
    const isChange = cb.name === 'onChange';
    const isFocus = cb.name === 'onFocus';
    const isBlur = cb.name === 'onBlur';
    const isKeyDown = cb.name === 'onKeyDown';

    if (isClick && !isVoidElement) {
      t += `
  it('fires ${cb.name} when clicked', async () => {
    const ${cb.name} = vi.fn()
    render(<${name} ${cb.name}={${cb.name}}>Click me</${name}>)
    await userEvent.click(screen.getByText('Click me'))
    expect(${cb.name}).toHaveBeenCalledTimes(1)
  })
`;
    } else if (isChange && isVoidElement) {
      t += `
  it('fires ${cb.name} when value changes', () => {
    const ${cb.name} = vi.fn()
    render(<${name} ${cb.name}={${cb.name}} placeholder="test-input" />)
    fireEvent.change(screen.getByPlaceholderText('test-input'), { target: { value: 'hello' } })
    expect(${cb.name}).toHaveBeenCalledTimes(1)
  })
`;
    } else if (isFocus) {
      t += `
  it('fires ${cb.name} when element receives focus', () => {
    const ${cb.name} = vi.fn()
    render(${primaryRender.replace('/>', ` ${cb.name}={${cb.name}} />`).replace(`>Test Content</${name}>`, ` ${cb.name}={${cb.name}}>Test Content</${name}>`)})
    fireEvent.focus(${primaryGet})
    expect(${cb.name}).toHaveBeenCalledTimes(1)
  })
`;
    } else if (isBlur) {
      t += `
  it('fires ${cb.name} when element loses focus', () => {
    const ${cb.name} = vi.fn()
    render(${primaryRender.replace('/>', ` ${cb.name}={${cb.name}} />`).replace(`>Test Content</${name}>`, ` ${cb.name}={${cb.name}}>Test Content</${name}>`)})
    fireEvent.blur(${primaryGet})
    expect(${cb.name}).toHaveBeenCalledTimes(1)
  })
`;
    } else if (isKeyDown) {
      t += `
  it('fires ${cb.name} on key press', () => {
    const ${cb.name} = vi.fn()
    render(${primaryRender.replace('/>', ` ${cb.name}={${cb.name}} />`).replace(`>Test Content</${name}>`, ` ${cb.name}={${cb.name}}>Test Content</${name}>`)})
    fireEvent.keyDown(${primaryGet}, { key: 'Enter', code: 'Enter' })
    expect(${cb.name}).toHaveBeenCalledTimes(1)
  })
`;
    }
  }

  // disabled state
  const hasDisabled = boolFlags.find(p => p.name === 'disabled');
  if (hasDisabled) {
    if (isVoidElement) {
      t += `
  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------
  it('is disabled when disabled prop is set', () => {
    render(<${name} disabled data-testid="subject" placeholder="test-input" />)
    expect(${primaryGet}).toBeDisabled()
  })

  it('does not fire onChange when disabled', () => {
    const onChange = vi.fn()
    render(<${name} disabled onChange={onChange} placeholder="test-input" />)
    fireEvent.change(screen.getByPlaceholderText('test-input'), { target: { value: 'x' } })
    expect(onChange).not.toHaveBeenCalled()
  })
`;
    } else {
      t += `
  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------
  it('shows disabled state when disabled prop is set', () => {
    render(<${name} disabled data-testid="subject">Disabled</${name}>)
    const el = ${primaryGet}
    expect(el.getAttribute('disabled') !== null || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled')).toBe(true)
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<${name} disabled onClick={onClick} data-testid="subject">Disabled</${name}>)
    await userEvent.click(${primaryGet})
    expect(onClick).not.toHaveBeenCalled()
  })
`;
    }
  }

  // loading state
  if (boolFlags.find(p => p.name === 'loading')) {
    t += `
  it('renders loading state', () => {
    render(<${name} loading data-testid="subject"${isVoidElement ? ' placeholder="test-input" />' : `>Loading content</${name}>`})
    expect(${primaryGet}).toBeInTheDocument()
  })
`;
  }

  // children
  if (hasChildren && !isVoidElement) {
    t += `
  it('renders children content', () => {
    render(<${name}><span data-testid="child">Child node</span></${name}>)
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders nested React elements', () => {
    render(<${name}><strong>Bold</strong> text</${name}>)
    expect(screen.getByText('Bold')).toBeInTheDocument()
  })
`;
  }

  // Variants
  if (hasVariants && variantValues.length > 0) {
    t += `
  // -----------------------------------------------------------------------
  // Variants
  // -----------------------------------------------------------------------`;
    for (const v of variantValues) {
      t += `
  it('renders variant="${v}" without errors', () => {
    const { container } = render(<${name} variant="${v}"${isVoidElement ? ' placeholder="test-input" />' : `>Content</${name}>`})
    expect(container.firstChild).toBeInTheDocument()
  })`;
    }
    t += '\n';
  }

  // Sizes
  if (hasSizes && sizeValues.length > 0) {
    t += `
  // -----------------------------------------------------------------------
  // Sizes
  // -----------------------------------------------------------------------`;
    for (const s of sizeValues) {
      t += `
  it('renders size="${s}" without errors', () => {
    const { container } = render(<${name} size="${s}"${isVoidElement ? ' placeholder="test-input" />' : `>Content</${name}>`})
    expect(container.firstChild).toBeInTheDocument()
  })`;
    }
    t += '\n';
  }

  // Input-specific
  if (isVoidElement) {
    t += `
  // -----------------------------------------------------------------------
  // Input-specific behaviour
  // -----------------------------------------------------------------------
  it('accepts a controlled value', () => {
    render(<${name} value="controlled" onChange={vi.fn()} placeholder="test-input" />)
    expect(screen.getByDisplayValue('controlled')).toBeInTheDocument()
  })

  it('renders placeholder text', () => {
    render(<${name} placeholder="Enter value here" />)
    expect(screen.getByPlaceholderText('Enter value here')).toBeInTheDocument()
  })
`;
  }

  // Snapshot
  t += `
  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------
  it('matches snapshot', () => {
    const { container } = render(${primaryRender})
    expect(container.firstChild).toMatchSnapshot()
  })
})
`;

  return t;
}

// ============================================================================
// FUNCTION TESTS
// ============================================================================

export function generateFunctionTests(info: FunctionInfo, importPath: string): string {
  const { name, params, isAsync, returnType } = info;
  const args = params.map(p => mockValue(p)).join(', ');
  const call = `${name}(${args})`;
  const isPromise = isAsync || returnType?.includes('Promise');

  let t = `import { describe, it, expect, vi } from 'vitest'
import { ${name} } from '${importPath}'

describe('${name}', () => {
  it('is defined and is a function', () => {
    expect(${name}).toBeDefined()
    expect(typeof ${name}).toBe('function')
  })

  it('returns a value for valid input', ${isPromise ? 'async ' : ''}() => {
    const result = ${isPromise ? 'await ' : ''}${call}
    expect(result).toBeDefined()
  })
`;

  if (isPromise) {
    t += `
  it('returns a Promise', () => {
    const result = ${name}(${args})
    expect(result).toBeInstanceOf(Promise)
  })

  it('resolves without throwing for valid input', async () => {
    await expect(${call}).resolves.not.toThrow()
  })
`;
  }

  if (params.length === 0) {
    t += `
  it('can be called with no arguments', ${isPromise ? 'async ' : ''}() => {
    expect(${isPromise ? 'async ' : ''}() => ${isPromise ? 'await ' : ''}${name}()).not.toThrow()
  })
`;
  }

  t += `})
`;
  return t;
}

// ============================================================================
// HOOK TESTS
// ============================================================================

export function generateHookTests(info: HookInfo, importPath: string): string {
  const { name, params, returnsObject, returnsArray } = info;
  const args = params.map(p => mockValue(p)).join(', ');

  let t = `import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ${name} } from '${importPath}'

describe('${name}', () => {
  it('mounts without throwing', () => {
    expect(() => renderHook(() => ${name}(${args}))).not.toThrow()
  })

  it('returns a defined value', () => {
    const { result } = renderHook(() => ${name}(${args}))
    expect(result.current).toBeDefined()
  })

  it('unmounts without throwing', () => {
    const { unmount } = renderHook(() => ${name}(${args}))
    expect(() => unmount()).not.toThrow()
  })

  it('survives a re-render with same props', () => {
    const { rerender, result } = renderHook(
      (p: Parameters<typeof ${name}>) => ${name}(...p),
      { initialProps: [${args}] as Parameters<typeof ${name}> }
    )
    expect(() => rerender([${args}] as Parameters<typeof ${name}>)).not.toThrow()
    expect(result.current).toBeDefined()
  })
`;

  if (returnsObject) {
    t += `
  it('returns an object', () => {
    const { result } = renderHook(() => ${name}(${args}))
    expect(typeof result.current).toBe('object')
    expect(result.current).not.toBeNull()
  })
`;
  }

  if (returnsArray) {
    t += `
  it('returns an array', () => {
    const { result } = renderHook(() => ${name}(${args}))
    expect(Array.isArray(result.current)).toBe(true)
  })
`;
  }

  t += `})
`;
  return t;
}

// ============================================================================
// CLASS TESTS
// ============================================================================

export function generateClassTests(info: ClassInfo, importPath: string): string {
  const { name, methods, hasConstructor } = info;
  const publicMethods = methods.filter(m => m !== 'constructor' && !m.startsWith('_') && !['render', 'componentDidMount', 'componentWillUnmount'].includes(m));

  let t = `import { describe, it, expect, beforeEach } from 'vitest'
import { ${name} } from '${importPath}'

describe('${name}', () => {
  let instance: ${name}

  beforeEach(() => {
    instance = new ${name}()
  })

  it('can be instantiated', () => {
    expect(instance).toBeInstanceOf(${name})
  })

  it('is truthy after construction', () => {
    expect(instance).toBeTruthy()
  })
`;

  for (const method of publicMethods.slice(0, 10)) {
    t += `
  it('has a callable ${method} method', () => {
    expect(typeof instance.${method}).toBe('function')
  })

  it('${method}() returns a defined value or void', () => {
    expect(() => instance.${method}()).not.toThrow()
  })
`;
  }

  t += `})
`;
  return t;
}

// ============================================================================
// FILE ASSEMBLY
// ============================================================================

/**
 * Combine per-symbol test suites into one file with a SINGLE, de-duplicated set
 * of imports. Each generator emits its own `import` header; naively concatenating
 * them produces duplicate `import … from 'vitest'`/source imports (a duplicate-
 * identifier compile error). This merges named + default specifiers per module.
 */
export function assembleTestFile(sections: string[]): string {
  const importRe = /^\s*import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"]\s*;?\s*$/;
  const defaults = new Map<string, string>();
  const named = new Map<string, Set<string>>();
  const order: string[] = [];
  const bodies: string[] = [];

  for (const section of sections) {
    const bodyLines: string[] = [];
    for (const line of section.split('\n')) {
      const m = line.match(importRe);
      if (m) {
        const [, def, namedList, mod] = m;
        if (!named.has(mod)) {
          named.set(mod, new Set());
          order.push(mod);
        }
        if (def) defaults.set(mod, def);
        if (namedList) {
          for (const s of namedList.split(',').map(x => x.trim()).filter(Boolean)) {
            named.get(mod)!.add(s);
          }
        }
      } else {
        bodyLines.push(line);
      }
    }
    bodies.push(bodyLines.join('\n').replace(/^\n+|\n+$/g, ''));
  }

  const importLines = order.map((mod) => {
    const def = defaults.get(mod);
    const names = [...named.get(mod)!];
    const namedPart = names.length ? `{ ${names.join(', ')} }` : '';
    const clause = [def, namedPart].filter(Boolean).join(', ');
    return `import ${clause} from '${mod}'`;
  });

  return `${importLines.join('\n')}\n\n${bodies.join('\n\n')}\n`;
}
