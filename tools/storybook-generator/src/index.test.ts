import { describe, it, expect } from 'vitest';
import {
  extractPropsInterface,
  extractVariantValues,
  propTypeToControl,
  generateArgTypes,
  getMockValue,
} from './index.js';

// ---------------------------------------------------------------------------
// extractPropsInterface
// ---------------------------------------------------------------------------
describe('extractPropsInterface', () => {
  it('parses a named XxxProps interface', () => {
    const content = `
      interface ButtonProps {
        label: string;
        disabled?: boolean;
        onClick: () => void;
      }
      export function Button({ label, disabled, onClick }: ButtonProps) {}
    `;
    const props = extractPropsInterface(content, 'Button');
    const names = props.map(p => p.name);
    expect(names).toContain('label');
    expect(names).toContain('disabled');
    expect(names).toContain('onClick');
  });

  it('marks optional props correctly', () => {
    const content = `
      interface CardProps {
        title: string;
        subtitle?: string;
      }
    `;
    const props = extractPropsInterface(content, 'Card');
    const titleProp = props.find(p => p.name === 'title');
    const subtitleProp = props.find(p => p.name === 'subtitle');
    expect(titleProp?.optional).toBe(false);
    expect(subtitleProp?.optional).toBe(true);
  });

  it('falls back to generic Props interface', () => {
    const content = `
      interface Props {
        value: number;
        onChange: (v: number) => void;
      }
      export function Slider(props: Props) {}
    `;
    const props = extractPropsInterface(content, 'Slider');
    expect(props.map(p => p.name)).toContain('value');
  });

  it('parses type alias Props', () => {
    const content = `
      type TagProps = { label: string; color?: string; };
      export function Tag({ label, color }: TagProps) {}
    `;
    const props = extractPropsInterface(content, 'Tag');
    expect(props.map(p => p.name)).toContain('label');
  });

  it('returns empty array when no interface found', () => {
    const content = `export function NoProps() { return <div />; }`;
    const props = extractPropsInterface(content, 'NoProps');
    expect(props).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractVariantValues
// ---------------------------------------------------------------------------
describe('extractVariantValues', () => {
  it('extracts variant values from union type', () => {
    const content = `type ButtonProps = { variant?: 'default' | 'destructive' | 'ghost'; }`;
    const values = extractVariantValues(content, 'variant');
    expect(values).toContain('default');
    expect(values).toContain('destructive');
    expect(values).toContain('ghost');
  });

  it('extracts size values from union type', () => {
    const content = `type InputProps = { size?: 'sm' | 'md' | 'lg'; }`;
    const values = extractVariantValues(content, 'size');
    expect(values).toEqual(expect.arrayContaining(['sm', 'md', 'lg']));
  });

  it('returns empty array when no variants', () => {
    const content = `type SimpleProps = { label: string; }`;
    const values = extractVariantValues(content, 'variant');
    expect(values).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// propTypeToControl
// ---------------------------------------------------------------------------
describe('propTypeToControl', () => {
  it('maps boolean to boolean control', () => {
    expect(propTypeToControl('boolean')).toBe("control: 'boolean'");
  });

  it('maps number to number control', () => {
    expect(propTypeToControl('number')).toBe("control: 'number'");
  });

  it('maps string to text control', () => {
    expect(propTypeToControl('string')).toBe("control: 'text'");
  });

  it('maps union literal types to select control with options', () => {
    const result = propTypeToControl("'sm' | 'md' | 'lg'");
    expect(result).toContain("control: 'select'");
    expect(result).toContain('sm');
    expect(result).toContain('md');
    expect(result).toContain('lg');
  });

  it('maps callback types to action', () => {
    expect(propTypeToControl('() => void')).toBe("action: 'called'");
    expect(propTypeToControl('(value: string) => void')).toBe("action: 'called'");
  });

  it('maps string union to text control', () => {
    expect(propTypeToControl('string | null')).toBe("control: 'text'");
  });
});

// ---------------------------------------------------------------------------
// generateArgTypes
// ---------------------------------------------------------------------------
describe('generateArgTypes', () => {
  it('generates argTypes block with all props', () => {
    const props = [
      { name: 'label', type: 'string', optional: false },
      { name: 'disabled', type: 'boolean', optional: true },
      { name: 'onClick', type: '() => void', optional: true },
    ];
    const result = generateArgTypes(props);
    expect(result).toContain('argTypes');
    expect(result).toContain('label');
    expect(result).toContain('disabled');
    expect(result).toContain('onClick');
  });

  it('skips className and style props', () => {
    const props = [
      { name: 'className', type: 'string', optional: true },
      { name: 'style', type: 'React.CSSProperties', optional: true },
      { name: 'title', type: 'string', optional: false },
    ];
    const result = generateArgTypes(props);
    expect(result).not.toContain('className');
    expect(result).not.toContain('style');
    expect(result).toContain('title');
  });

  it('returns empty string for empty props array', () => {
    expect(generateArgTypes([])).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getMockValue
// ---------------------------------------------------------------------------
describe('getMockValue', () => {
  it('returns a URL for src prop', () => {
    const val = getMockValue('src', 'string', 'Avatar');
    expect(val).toBeDefined();
    if (val) expect(val).toMatch(/https?:\/\//);
  });

  it('returns a string for label prop', () => {
    const val = getMockValue('label', 'string', 'Button');
    expect(typeof val === 'string' || val === null).toBe(true);
  });

  it('returns null for callback props', () => {
    const val = getMockValue('onClick', '() => void', 'Button');
    expect(val).toBeNull();
  });
});
