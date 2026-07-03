// component-improver CORE — pure logic (no MCP transport).
// Generate extended tests + stories and enhance a component directory with
// broader coverage and variants. Split core-first during the port.

import * as fs from 'fs';
import * as path from 'path';

// HTML void elements that cannot have children
const VOID_ELEMENTS = [
  'input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed',
  'source', 'track', 'wbr', 'param', 'keygen', 'menuitem'
];

// Components that render void elements
const VOID_COMPONENTS = ['input', 'img', 'separator', 'divider'] as const;

export function isVoidElement(componentName: string): boolean {
  const lowerName = componentName.toLowerCase();
  return (VOID_COMPONENTS as readonly string[]).includes(lowerName);
}

// ============================================================================
// IMPROVE FUNCTIONS
// ============================================================================

export function generateExtendedTestCode(name: string, componentName: string): string {
  const isVoid = isVoidElement(componentName);
  const hasVariants = componentName.toLowerCase() === 'button' || componentName.toLowerCase() === 'badge';
  const hasSizes = componentName.toLowerCase() === 'button';
  
  if (isVoid) {
    // Void element tests - no children, test props instead
    return `import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ${name} } from './${name}'

describe('${name}', () => {
  // Basic rendering tests
  it('renders successfully', () => {
    render(<${name} placeholder="test input" />)
    expect(screen.getByPlaceholderText('test input')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<${name} className="custom-class" placeholder="test" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<${name} ref={ref} placeholder="test" />)
    expect(ref.current).not.toBeNull()
  })

  it('spreads additional props', () => {
    render(<${name} data-testid="test-component" placeholder="test" />)
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })

  // Accessibility tests
  it('has correct displayName', () => {
    expect(${name}.displayName).toBe('${name}')
  })

  it('renders with semantic HTML', () => {
    const { container } = render(<${name} placeholder="test" />)
    expect(container.firstChild?.nodeName).toBe('INPUT')
  })

  // Value and placeholder tests
  it('accepts value prop', () => {
    render(<${name} value="test value" readOnly />)
    expect(screen.getByDisplayValue('test value')).toBeInTheDocument()
  })

  it('handles placeholder prop', () => {
    render(<${name} placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  // Disabled state tests
  it('handles disabled state', () => {
    render(<${name} disabled placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).toBeDisabled()
  })

  it('applies disabled styles when disabled', () => {
    const { container } = render(<${name} disabled placeholder="test" />)
    expect(container.firstChild).toHaveClass('disabled:cursor-not-allowed')
  })

  // Focus management tests
  it('applies focus-visible styles', () => {
    const { container } = render(<${name} placeholder="test" />)
    expect(container.firstChild).toHaveClass('focus-visible:ring-2')
  })

  // Event handler tests
  it('handles onChange events', () => {
    const handleChange = vi.fn()
    render(<${name} onChange={handleChange} placeholder="test" />)
    const input = screen.getByPlaceholderText('test')
    fireEvent.change(input, { target: { value: 'new value' } })
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('handles onFocus events', () => {
    const handleFocus = vi.fn()
    render(<${name} onFocus={handleFocus} placeholder="test" />)
    fireEvent.focus(screen.getByPlaceholderText('test'))
    expect(handleFocus).toHaveBeenCalledTimes(1)
  })

  it('handles onBlur events', () => {
    const handleBlur = vi.fn()
    render(<${name} onBlur={handleBlur} placeholder="test" />)
    fireEvent.blur(screen.getByPlaceholderText('test'))
    expect(handleBlur).toHaveBeenCalledTimes(1)
  })

  // Type tests
  it('handles type prop', () => {
    render(<${name} type="email" placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).toHaveAttribute('type', 'email')
  })

  it('handles type password', () => {
    render(<${name} type="password" placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).toHaveAttribute('type', 'password')
  })

  // Required and validation tests
  it('handles required prop', () => {
    render(<${name} required placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).toBeRequired()
  })

  it('handles readOnly prop', () => {
    render(<${name} readOnly placeholder="test" />)
    expect(screen.getByPlaceholderText('test')).toHaveAttribute('readonly')
  })
})
`;
  }
  
  // Regular component tests - can have children
  return `import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ${name} } from './${name}'

describe('${name}', () => {
  // Basic rendering tests
  it('renders successfully', () => {
    render(<${name}>Test Content</${name}>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<${name} className="custom-class">Test</${name}>)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<${name} ref={ref}>Test</${name}>)
    expect(ref.current).not.toBeNull()
  })

  it('spreads additional props', () => {
    render(<${name} data-testid="test-component">Test</${name}>)
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
  })

  // Accessibility tests
  it('has correct displayName', () => {
    expect(${name}.displayName).toBe('${name}')
  })

  ${hasVariants ? `
  // Variant tests
  it('renders with default variant', () => {
    const { container } = render(<${name} variant="default">Default</${name}>)
    expect(container.firstChild).toHaveClass('bg-primary')
  })

  it('renders with destructive variant', () => {
    const { container } = render(<${name} variant="destructive">Destructive</${name}>)
    expect(container.firstChild).toHaveClass('bg-destructive')
  })

  it('renders with outline variant', () => {
    const { container } = render(<${name} variant="outline">Outline</${name}>)
    expect(container.firstChild).toHaveClass('border-input')
  })

  it('renders with secondary variant', () => {
    const { container } = render(<${name} variant="secondary">Secondary</${name}>)
    expect(container.firstChild).toHaveClass('bg-secondary')
  })

  it('renders with ghost variant', () => {
    const { container } = render(<${name} variant="ghost">Ghost</${name}>)
    expect(container.firstChild).toHaveClass('hover:bg-accent')
  })

  it('renders with link variant', () => {
    const { container } = render(<${name} variant="link">Link</${name}>)
    expect(container.firstChild).toHaveClass('text-primary')
  })
  ` : ''}

  ${hasSizes ? `
  // Size tests
  it('renders with default size', () => {
    const { container } = render(<${name} size="default">Default</${name}>)
    expect(container.firstChild).toHaveClass('h-10')
  })

  it('renders with small size', () => {
    const { container } = render(<${name} size="sm">Small</${name}>)
    expect(container.firstChild).toHaveClass('h-9')
  })

  it('renders with large size', () => {
    const { container } = render(<${name} size="lg">Large</${name}>)
    expect(container.firstChild).toHaveClass('h-11')
  })

  it('renders with icon size', () => {
    const { container } = render(<${name} size="icon">🚀</${name}>)
    expect(container.firstChild).toHaveClass('h-10 w-10')
  })
  ` : ''}

  // Event handler tests
  it('handles onClick events', () => {
    const handleClick = vi.fn()
    render(<${name} onClick={handleClick}>Click me</${name}>)
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('handles keyboard events', () => {
    const handleKeyDown = vi.fn()
    render(<${name} onKeyDown={handleKeyDown}>Press</${name}>)
    fireEvent.keyDown(screen.getByText('Press'), { key: 'Enter' })
    expect(handleKeyDown).toHaveBeenCalledTimes(1)
  })

  // Disabled state tests
  it('applies disabled styles when disabled', () => {
    const { container } = render(<${name} disabled>Disabled</${name}>)
    expect(container.firstChild).toHaveClass('disabled:pointer-events-none')
  })

  // Focus management tests
  it('applies focus-visible styles', () => {
    const { container } = render(<${name}>Focus</${name}>)
    expect(container.firstChild).toHaveClass('focus-visible:ring-2')
  })

  // Children rendering tests
  it('renders children correctly', () => {
    render(
      <${name}>
        <span>Child 1</span>
        <span>Child 2</span>
      </${name}>
    )
    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  // Icon support tests
  it('renders with icon', () => {
    render(<${name}><span data-testid="icon">🚀</span>With Icon</${name}>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('With Icon')).toBeInTheDocument()
  })
})
`;
}

export function generateExtendedStoriesCode(name: string, componentName: string): string {
  const isVoid = isVoidElement(componentName);
  
  if (isVoid) {
    // Void element stories - no children, use props instead
    return `import type { Meta, StoryObj } from '@storybook/react'
import { ${name} } from './${name}'

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
    },
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
    required: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof ${name}>

export const Default: Story = {
  args: { placeholder: 'Enter text...', type: 'text' },
}

export const Email: Story = {
  args: { placeholder: 'Enter email...', type: 'email' },
}

export const Password: Story = {
  args: { placeholder: 'Enter password...', type: 'password' },
}

export const WithValue: Story = {
  args: { value: 'Pre-filled value', placeholder: 'Enter text...' },
}

export const Disabled: Story = {
  args: { placeholder: 'Disabled input', disabled: true },
}

export const Required: Story = {
  args: { placeholder: 'Required field', required: true },
}

export const ReadOnly: Story = {
  args: { value: 'Read only content', readOnly: true },
}
`;
  }
  
  // Regular component stories - can have children
  return `import type { Meta, StoryObj } from '@storybook/react'
import { ${name} } from './${name}'

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
}

export default meta
type Story = StoryObj<typeof ${name}>

export const Default: Story = {
  args: { children: '${name}', variant: 'default', size: 'default' },
}

export const Destructive: Story = {
  args: { children: 'Delete', variant: 'destructive' },
}

export const Outline: Story = {
  args: { children: 'Outline', variant: 'outline' },
}

export const Secondary: Story = {
  args: { children: 'Secondary', variant: 'secondary' },
}

export const Ghost: Story = {
  args: { children: 'Ghost', variant: 'ghost' },
}

export const Link: Story = {
  args: { children: 'Link', variant: 'link' },
}

export const Small: Story = {
  args: { children: 'Small', size: 'sm' },
}

export const Large: Story = {
  args: { children: 'Large', size: 'lg' },
}

export const Icon: Story = {
  args: { children: '🚀', size: 'icon' },
}

export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <span>📧</span>
        <span>Email</span>
      </>
    ),
  },
}
`;
}

export function improviseComponent(componentDir: string, componentName: string): { added: string[], enhanced: string[] } {
  const added: string[] = [];
  const enhanced: string[] = [];

  // Enhance test file with more comprehensive tests
  const testFile = path.join(componentDir, `${componentName}.test.tsx`);
  if (fs.existsSync(testFile)) {
    const extendedTests = generateExtendedTestCode(componentName, componentName);
    fs.writeFileSync(testFile, extendedTests);
    enhanced.push('Extended test file with comprehensive test cases');
  }

  // Enhance stories file with more variants and states
  const storiesFile = path.join(componentDir, `${componentName}.stories.tsx`);
  if (fs.existsSync(storiesFile)) {
    const extendedStories = generateExtendedStoriesCode(componentName, componentName);
    fs.writeFileSync(storiesFile, extendedStories);
    enhanced.push('Extended stories file with more variants and states');
  }

  return { added, enhanced };
}

// ============================================================================
// MAIN SERVER CLASS
// ============================================================================
