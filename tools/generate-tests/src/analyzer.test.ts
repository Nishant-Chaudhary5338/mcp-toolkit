import { describe, it, expect } from 'vitest';
import { analyzeSource, mockValue } from './analyzer.js';

describe('analyzeSource — components', () => {
  it('detects a forwardRef component', () => {
    const src = `export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => <button ref={ref} {...props} />)`;
    const { components } = analyzeSource(src);
    expect(components.some(c => c.name === 'Button' && c.isForwardRef)).toBe(true);
  });

  it('detects a regular PascalCase component', () => {
    const src = `export const Card = (props: CardProps) => <div {...props} />`;
    const { components } = analyzeSource(src);
    expect(components.some(c => c.name === 'Card')).toBe(true);
  });

  it('marks input-like components as void elements', () => {
    const src = `export const Input = React.forwardRef((props, ref) => <input ref={ref} {...props} />)`;
    const { components } = analyzeSource(src);
    const input = components.find(c => c.name === 'Input');
    expect(input?.isVoidElement).toBe(true);
  });

  it('detects cva-based variants', () => {
    const src = `const btn = cva('base', { variants: { variant: { default: '', destructive: '' } } })`;
    const { components } = analyzeSource(`export const Btn = (props) => <button className={btn({variant: props.variant})} />\n${src}`);
    const b = components.find(c => c.name === 'Btn');
    expect(b?.hasVariants).toBe(true);
  });
});

describe('analyzeSource — functions', () => {
  it('detects exported functions', () => {
    const src = `export function formatDate(date: Date): string { return date.toISOString() }`;
    const { functions } = analyzeSource(src);
    expect(functions.some(f => f.name === 'formatDate')).toBe(true);
  });

  it('detects async functions', () => {
    const src = `export async function fetchUser(id: string) { return fetch('/users/' + id) }`;
    const { functions } = analyzeSource(src);
    const fn = functions.find(f => f.name === 'fetchUser');
    expect(fn?.isAsync).toBe(true);
  });
});

describe('analyzeSource — hooks', () => {
  it('detects function declaration hooks', () => {
    const src = `export function useCounter(initial: number) { return useState(initial) }`;
    const { hooks } = analyzeSource(src);
    expect(hooks.some(h => h.name === 'useCounter')).toBe(true);
  });

  it('detects arrow function hooks', () => {
    const src = `export const useTheme = () => useContext(ThemeContext)`;
    const { hooks } = analyzeSource(src);
    expect(hooks.some(h => h.name === 'useTheme')).toBe(true);
  });
});

describe('analyzeSource — classes', () => {
  it('detects class declarations', () => {
    const src = `export class EventEmitter { emit(event: string) {} on(event: string, handler: () => void) {} }`;
    const { classes } = analyzeSource(src);
    expect(classes.some(c => c.name === 'EventEmitter')).toBe(true);
  });
});

describe('mockValue', () => {
  it('returns number string for count-like names', () => {
    expect(mockValue('count')).toBe('0');
    expect(mockValue('numItems')).toBe('0');
  });

  it('returns string literal for name-like params', () => {
    expect(mockValue('name')).toBe('"test"');
    expect(mockValue('label')).toBe('"test"');
  });

  it('returns vi.fn() for callback-like params', () => {
    expect(mockValue('callback')).toBe('vi.fn()');
    expect(mockValue('handler')).toBe('vi.fn()');
  });

  it('returns array for list-like params', () => {
    expect(mockValue('items')).toBe('[]');
  });

  it('falls back to a string literal for unknown params (never undefined, which throws on typed sigs)', () => {
    expect(mockValue('something')).toBe('"test"');
  });

  it('prefers the declared type over the name (no undefined for typed params)', () => {
    expect(mockValue('x: string')).toBe('"test"');
    expect(mockValue('n: number')).toBe('0');
    expect(mockValue('flag: boolean')).toBe('false');
    expect(mockValue('cb: () => void')).toBe('vi.fn()');
    expect(mockValue('rows: string[]')).toBe('[]');
  });
});
