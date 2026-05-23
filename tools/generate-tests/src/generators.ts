import type { ComponentInfo, FunctionInfo, HookInfo, ClassInfo } from './analyzer.js';
import { mockValue } from './analyzer.js';

export function generateComponentTests(info: ComponentInfo): string {
  const { name, isVoidElement, hasVariants, hasSizes } = info;
  const renderProps = isVoidElement ? 'placeholder="test"' : `>Test Content</${name}>`;
  const getEl = isVoidElement
    ? 'screen.getByPlaceholderText("test")'
    : 'screen.getByText("Test Content")';

  let t = `import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ${name} } from './${name}'

describe('${name}', () => {
  it('renders without crashing', () => {
    render(<${name} ${renderProps} />)
    expect(${getEl}).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<${name} className="custom" ${renderProps} />)
    expect(container.firstChild).toHaveClass('custom')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<${name} ref={ref} ${renderProps} />)
    expect(ref.current).not.toBeNull()
  })

  it('spreads extra props via data-testid', () => {
    render(<${name} data-testid="el" ${renderProps} />)
    expect(screen.getByTestId('el')).toBeInTheDocument()
  })

  it('supports aria-label for accessibility', () => {
    render(<${name} aria-label="label" ${renderProps} />)
    expect(screen.getByLabelText('label')).toBeInTheDocument()
  })
`;

  if (hasVariants) {
    for (const v of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']) {
      t += `
  it('renders variant="${v}"', () => {
    const { container } = render(<${name} variant="${v}" ${renderProps} />)
    expect(container.firstChild).toBeInTheDocument()
  })
`;
    }
  }

  if (hasSizes) {
    for (const s of ['default', 'sm', 'lg', 'icon']) {
      t += `
  it('renders size="${s}"', () => {
    const { container } = render(<${name} size="${s}" ${renderProps} />)
    expect(container.firstChild).toBeInTheDocument()
  })
`;
    }
  }

  if (isVoidElement) {
    t += `
  it('handles value prop', () => {
    render(<${name} value="hello" readOnly />)
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('handles disabled state', () => {
    render(<${name} disabled placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).toBeDisabled()
  })

  it('calls onChange', () => {
    const onChange = vi.fn()
    render(<${name} onChange={onChange} placeholder="test" />)
    fireEvent.change(screen.getByPlaceholderText('test'), { target: { value: 'x' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
`;
  } else {
    t += `
  it('calls onClick', () => {
    const onClick = vi.fn()
    render(<${name} onClick={onClick}>Click me</${name}>)
    fireEvent.click(screen.getByText('Click me'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders children', () => {
    render(<${name}><span>Child</span></${name}>)
    expect(screen.getByText('Child')).toBeInTheDocument()
  })
`;
  }

  t += `})
`;
  return t;
}

export function generateFunctionTests(info: FunctionInfo): string {
  const { name, params, isAsync } = info;
  const args = params.map(p => mockValue(p)).join(', ');
  const call = isAsync ? `await ${name}(${args})` : `${name}(${args})`;

  return `import { describe, it, expect } from 'vitest'

describe('${name}', () => {
  it('is defined', () => {
    expect(${name}).toBeDefined()
  })

  it('returns a value for valid input', ${isAsync ? 'async ' : ''}() => {
    const result = ${call}
    expect(result).toBeDefined()
  })
})
`;
}

export function generateHookTests(info: HookInfo): string {
  const { name, params } = info;
  const args = params.map(p => mockValue(p)).join(', ');

  return `import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'

describe('${name}', () => {
  it('returns a value', () => {
    const { result } = renderHook(() => ${name}(${args}))
    expect(result.current).toBeDefined()
  })

  it('does not throw on unmount', () => {
    const { unmount } = renderHook(() => ${name}(${args}))
    expect(() => unmount()).not.toThrow()
  })
})
`;
}

export function generateClassTests(info: ClassInfo): string {
  const { name, methods } = info;
  const methodTests = methods
    .filter(m => m !== 'constructor')
    .map(m => `
  it('${m} is callable', () => {
    expect(typeof instance.${m}).toBe('function')
  })
`)
    .join('');

  return `import { describe, it, expect, beforeEach } from 'vitest'
import { ${name} } from './${name.toLowerCase()}'

describe('${name}', () => {
  let instance: ${name}

  beforeEach(() => {
    instance = new ${name}()
  })

  it('creates an instance', () => {
    expect(instance).toBeInstanceOf(${name})
  })
${methodTests}})
`;
}
