import { describe, it, expect } from 'vitest';
import { extractComponents, analyzeComponent } from './index.js';

const SIMPLE_COMPONENT = `
import React from 'react';

export function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}
`;

const MEMO_MISSING = `
export function Card({ title }: { title: string }) {
  return <div>{title}</div>;
}
`;

const INLINE_OBJECT = `
export function Avatar({ src }: { src: string }) {
  return <img src={src} style={{ borderRadius: '50%', width: 40 }} />;
}
`;

const INLINE_FUNCTION = `
export function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map(item => (
        <li onClick={() => console.log(item)}>{item}</li>
      ))}
    </ul>
  );
}
`;

const WITH_MEMO = `
import React from 'react';

const Tag = React.memo(function Tag({ label }: { label: string }) {
  return <span>{label}</span>;
});
export default Tag;
`;

describe('extractComponents', () => {
  it('extracts function component names', () => {
    const names = extractComponents(SIMPLE_COMPONENT);
    expect(names).toContain('Button');
  });

  it('extracts PascalCase components only', () => {
    const content = `
      export function helper() {}
      export function MyWidget() { return <div />; }
      export const myUtil = () => 42;
    `;
    const names = extractComponents(content);
    expect(names).toContain('MyWidget');
    expect(names).not.toContain('helper');
    expect(names).not.toContain('myUtil');
  });

  it('returns empty array for non-component files', () => {
    const content = `export const config = { debug: true };`;
    const names = extractComponents(content);
    expect(names).toHaveLength(0);
  });

  it('finds multiple components in one file', () => {
    const content = `
      export function Header() { return <header />; }
      export function Footer() { return <footer />; }
    `;
    const names = extractComponents(content);
    expect(names).toContain('Header');
    expect(names).toContain('Footer');
  });
});

describe('analyzeComponent — missing memo', () => {
  it('flags component without React.memo', () => {
    const profile = analyzeComponent(MEMO_MISSING, 'Card', 'Card.tsx');
    expect(profile.hasMemo).toBe(false);
    const memoIssue = profile.issues.find(i => i.type === 'missing-memo');
    expect(memoIssue).toBeDefined();
  });

  it('does not flag memo-wrapped component', () => {
    const profile = analyzeComponent(WITH_MEMO, 'Tag', 'Tag.tsx');
    expect(profile.hasMemo).toBe(true);
    const memoIssue = profile.issues.find(i => i.type === 'missing-memo');
    expect(memoIssue).toBeUndefined();
  });
});

describe('analyzeComponent — inline objects', () => {
  it('flags inline style object literals', () => {
    const profile = analyzeComponent(INLINE_OBJECT, 'Avatar', 'Avatar.tsx');
    const inlineIssues = profile.issues.filter(i => i.type === 'inline-object');
    expect(inlineIssues.length).toBeGreaterThan(0);
  });

  it('reports the correct file path', () => {
    const profile = analyzeComponent(INLINE_OBJECT, 'Avatar', 'src/Avatar.tsx');
    expect(profile.file).toBe('src/Avatar.tsx');
  });
});

describe('analyzeComponent — inline functions', () => {
  it('flags arrow functions in JSX props', () => {
    const profile = analyzeComponent(INLINE_FUNCTION, 'List', 'List.tsx');
    const fnIssues = profile.issues.filter(i => i.type === 'inline-function');
    expect(fnIssues.length).toBeGreaterThan(0);
  });
});

describe('analyzeComponent — useCallback', () => {
  it('detects useCallback usage', () => {
    const content = `
      import { useCallback } from 'react';
      export function Form({ onSubmit }: { onSubmit: () => void }) {
        const handleSubmit = useCallback(() => onSubmit(), [onSubmit]);
        return <form onSubmit={handleSubmit} />;
      }
    `;
    const profile = analyzeComponent(content, 'Form', 'Form.tsx');
    expect(profile.hasUseCallback).toBe(true);
  });

  it('detects useMemo usage', () => {
    const content = `
      import { useMemo } from 'react';
      export function Table({ data }: { data: number[] }) {
        const sorted = useMemo(() => [...data].sort(), [data]);
        return <table>{sorted}</table>;
      }
    `;
    const profile = analyzeComponent(content, 'Table', 'Table.tsx');
    expect(profile.hasUseMemo).toBe(true);
  });
});
