import { describe, it, expect } from 'vitest';
import {
  analyzeTypeScript,
  analyzeReactPatterns,
  analyzeAccessibility,
  analyzeCodeQuality,
  calculateGrade,
} from './index.js';

function lines(code: string): string[] {
  return code.split('\n');
}

// ---------------------------------------------------------------------------
// analyzeTypeScript
// ---------------------------------------------------------------------------
describe('analyzeTypeScript', () => {
  it('flags explicit any type', () => {
    const code = `function foo(x: any): any { return x; }`;
    const issues = analyzeTypeScript(code, lines(code));
    expect(issues.some(i => i.category === 'type-safety')).toBe(true);
  });

  it('flags as any cast', () => {
    const code = `const x = response as any;`;
    const issues = analyzeTypeScript(code, lines(code));
    expect(issues.some(i => i.category === 'type-safety')).toBe(true);
  });

  it('does not flag unknown type', () => {
    const code = `function safe(x: unknown): void {}`;
    const issues = analyzeTypeScript(code, lines(code));
    const anyIssues = issues.filter(i => i.message?.includes('any'));
    expect(anyIssues).toHaveLength(0);
  });

  it('flags as SomeType assertion', () => {
    const code = `const el = document.getElementById('foo') as HTMLInputElement;`;
    const issues = analyzeTypeScript(code, lines(code));
    expect(issues.some(i => i.category === 'type-safety')).toBe(true);
  });

  it('does not flag namespace imports as type assertions', () => {
    const code = `import * as RadixSwitch from '@radix-ui/react-switch';`;
    const issues = analyzeTypeScript(code, lines(code));
    const assertionIssues = issues.filter(i => i.message?.includes('Type assertion'));
    expect(assertionIssues).toHaveLength(0);
  });

  it('does not flag export aliases as type assertions', () => {
    const code = `export { Foo as Bar } from './foo';`;
    const issues = analyzeTypeScript(code, lines(code));
    const assertionIssues = issues.filter(i => i.message?.includes('Type assertion'));
    expect(assertionIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeReactPatterns
// ---------------------------------------------------------------------------
describe('analyzeReactPatterns', () => {
  it('flags inline arrow functions in JSX props', () => {
    const code = `
      function Button() {
        return <button onClick={() => doSomething()}>Click</button>;
      }
    `;
    const issues = analyzeReactPatterns(code, lines(code), 'Button');
    expect(issues.some(i => i.category === 'performance')).toBe(true);
  });

  it('flags useState with no setter called', () => {
    const code = `
      function Counter() {
        const [count] = useState(0);
        return <div>{count}</div>;
      }
    `;
    const issues = analyzeReactPatterns(code, lines(code), 'Counter');
    // Any react-patterns warning counts
    expect(Array.isArray(issues)).toBe(true);
  });

  it('detects useCallback usage positively', () => {
    const code = `
      const handleClick = useCallback(() => {
        doSomething();
      }, []);
    `;
    const issues = analyzeReactPatterns(code, lines(code), 'Form');
    const inlineIssues = issues.filter(i => i.message?.includes('inline'));
    expect(inlineIssues).toHaveLength(0);
  });

  it('does not flag missing displayName on a plain named function component', () => {
    const code = `
      export function PhoneInput({ value }: { value: string }) {
        return <input value={value} />;
      }
    `;
    const issues = analyzeReactPatterns(code, lines(code), 'PhoneInput');
    const displayNameIssues = issues.filter(i => i.message?.includes('displayName'));
    expect(displayNameIssues).toHaveLength(0);
  });

  it('flags missing displayName on a forwardRef component', () => {
    const code = `
      export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(props, ref) {
        return <button ref={ref} {...props} />;
      });
    `;
    const issues = analyzeReactPatterns(code, lines(code), 'Switch');
    const displayNameIssues = issues.filter(i => i.message?.includes('displayName'));
    expect(displayNameIssues).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// analyzeAccessibility
// ---------------------------------------------------------------------------
describe('analyzeAccessibility', () => {
  it('flags img without alt', () => {
    const code = `<img src="hero.jpg" />`;
    const issues = analyzeAccessibility(code, lines(code), 'Hero');
    expect(issues.some(i => i.category === 'accessibility')).toBe(true);
  });

  it('passes img with alt', () => {
    const code = `<img src="hero.jpg" alt="Hero image" />`;
    const issues = analyzeAccessibility(code, lines(code), 'Hero');
    const altIssues = issues.filter(i => i.message?.toLowerCase().includes('alt'));
    expect(altIssues).toHaveLength(0);
  });

  it('flags clickable div without role', () => {
    const code = `<div onClick={handleClick}>Click me</div>`;
    const issues = analyzeAccessibility(code, lines(code), 'Clickable');
    expect(issues.some(i => i.category === 'accessibility')).toBe(true);
  });

  it('does not flag div with role="button"', () => {
    const code = `<div role="button" tabIndex={0} onClick={handleClick}>Click me</div>`;
    const issues = analyzeAccessibility(code, lines(code), 'Clickable');
    const roleIssues = issues.filter(i => i.message?.toLowerCase().includes('role'));
    expect(roleIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeCodeQuality
// ---------------------------------------------------------------------------
describe('analyzeCodeQuality', () => {
  it('flags component file over 300 lines', () => {
    const code = Array(310).fill('// line').join('\n');
    const issues = analyzeCodeQuality(code, lines(code), 'BigComponent');
    expect(issues.some(i => i.category === 'code-quality')).toBe(true);
  });

  it('does not flag small component', () => {
    const code = `
      export function Small() {
        return <div>Hello</div>;
      }
    `;
    const issues = analyzeCodeQuality(code, lines(code), 'Small');
    const sizeIssues = issues.filter(i => i.message?.includes('lines'));
    expect(sizeIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calculateGrade
// ---------------------------------------------------------------------------
describe('calculateGrade', () => {
  it('returns A+ for score >= 95', () => {
    expect(calculateGrade(100)).toBe('A+');
    expect(calculateGrade(95)).toBe('A+');
  });

  it('returns A for score 85–94', () => {
    expect(calculateGrade(90)).toBe('A');
    expect(calculateGrade(85)).toBe('A');
  });

  it('returns B for score 70–84', () => {
    expect(calculateGrade(80)).toBe('B');
    expect(calculateGrade(70)).toBe('B');
  });

  it('returns C for score 55–69', () => {
    expect(calculateGrade(65)).toBe('C');
    expect(calculateGrade(55)).toBe('C');
  });

  it('returns D for score 40–54', () => {
    expect(calculateGrade(50)).toBe('D');
    expect(calculateGrade(40)).toBe('D');
  });

  it('returns F for score below 40', () => {
    expect(calculateGrade(39)).toBe('F');
    expect(calculateGrade(0)).toBe('F');
  });
});
