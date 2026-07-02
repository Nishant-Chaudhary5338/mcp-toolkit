import { describe, it, expect } from 'vitest';
import { analyzeFile } from './index.js';

// ---------------------------------------------------------------------------
// Heavy imports
// ---------------------------------------------------------------------------
describe('analyzeFile — heavy imports', () => {
  it('flags full lodash import', () => {
    const code = `import _ from 'lodash';`;
    const issues = analyzeFile('utils.ts', code);
    expect(issues.some(i => i.type === 'heavy-import')).toBe(true);
  });

  it('flags moment.js import', () => {
    const code = `import moment from 'moment';`;
    const issues = analyzeFile('utils.ts', code);
    const issue = issues.find(i => i.type === 'heavy-import');
    expect(issue).toBeDefined();
    expect(issue?.fix).toContain('dayjs');
  });

  it('passes lodash-es (tree-shakeable)', () => {
    const code = `import { debounce } from 'lodash-es';`;
    const issues = analyzeFile('utils.ts', code);
    const heavy = issues.filter(i => i.type === 'heavy-import' && i.description.includes('lodash'));
    expect(heavy).toHaveLength(0);
  });

  it('flags wildcard lodash import', () => {
    const code = `import * as lodash from 'lodash';`;
    const issues = analyzeFile('utils.ts', code);
    expect(issues.some(i => i.type === 'heavy-import')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Memory leaks — useEffect
// ---------------------------------------------------------------------------
describe('analyzeFile — memory leaks', () => {
  it('flags useEffect with addEventListener and no cleanup', () => {
    const code = `
      useEffect(() => {
        window.addEventListener('resize', handleResize);
      }, []);
    `;
    const issues = analyzeFile('Component.tsx', code);
    expect(issues.some(i => i.type === 'memory-leak' && i.description.includes('event listener'))).toBe(true);
  });

  it('does not flag useEffect with addEventListener and cleanup', () => {
    const code = `
      useEffect(() => {
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }, []);
    `;
    const issues = analyzeFile('Component.tsx', code);
    const leaks = issues.filter(i => i.type === 'memory-leak' && i.description.includes('event listener'));
    expect(leaks).toHaveLength(0);
  });

  it('flags setInterval without clearInterval', () => {
    const code = `
      useEffect(() => {
        const id = setInterval(poll, 1000);
      }, []);
    `;
    const issues = analyzeFile('Component.tsx', code);
    expect(issues.some(i => i.type === 'memory-leak' && i.description.includes('interval'))).toBe(true);
  });

  it('flags setTimeout without clearTimeout', () => {
    const code = `
      useEffect(() => {
        const t = setTimeout(doSomething, 500);
      }, []);
    `;
    const issues = analyzeFile('Component.tsx', code);
    expect(issues.some(i => i.type === 'memory-leak' && i.description.includes('timeout'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unoptimized images
// ---------------------------------------------------------------------------
describe('analyzeFile — unoptimized images', () => {
  it('flags <img> without loading attribute', () => {
    const code = `<img src="/hero.png" alt="Hero" />`;
    const issues = analyzeFile('Page.tsx', code);
    expect(issues.some(i => i.type === 'unoptimized-image')).toBe(true);
  });

  it('passes <img> with loading="lazy"', () => {
    const code = `<img src="/hero.png" alt="Hero" loading="lazy" />`;
    const issues = analyzeFile('Page.tsx', code);
    expect(issues.some(i => i.type === 'unoptimized-image')).toBe(false);
  });

  it('passes next/image (auto-optimized)', () => {
    const code = `<Image src="/hero.png" alt="Hero" width={800} height={600} next/image />`;
    const issues = analyzeFile('Page.tsx', code);
    expect(issues.some(i => i.type === 'unoptimized-image')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deep nesting
// ---------------------------------------------------------------------------
describe('analyzeFile — deep nesting', () => {
  it('flags lines with 3+ ternary operators', () => {
    const code = `const x = a ? b ? c : d : e ? f : g;`;
    const issues = analyzeFile('utils.ts', code);
    expect(issues.some(i => i.type === 'deep-nesting')).toBe(true);
  });

  it('passes lines with only 1-2 ternaries', () => {
    const code = `const label = isLoading ? 'Loading...' : 'Submit';`;
    const issues = analyzeFile('Component.tsx', code);
    expect(issues.some(i => i.type === 'deep-nesting')).toBe(false);
  });

  it('does not count optional chaining (?.) as a ternary', () => {
    const code = `const items = data?.items ?? [];`;
    const issues = analyzeFile('Component.tsx', code);
    expect(issues.some(i => i.type === 'deep-nesting')).toBe(false);
  });

  it('does not count nullish coalescing (??) combined with optional chaining as a ternary', () => {
    const code = `const filtered = (data?.items ?? []).filter((item) => item.active);`;
    const issues = analyzeFile('Component.tsx', code);
    expect(issues.some(i => i.type === 'deep-nesting')).toBe(false);
  });

  it('still flags a genuine triple ternary alongside optional chaining', () => {
    const code = `const x = a ? b ? c : d : e ? f : g; const y = data?.items ?? [];`;
    const issues = analyzeFile('utils.ts', code);
    const issue = issues.find(i => i.type === 'deep-nesting');
    expect(issue).toBeDefined();
    expect(issue?.description).toContain('3 nested ternary');
  });
});

// ---------------------------------------------------------------------------
// Console statements
// ---------------------------------------------------------------------------
describe('analyzeFile — console statements', () => {
  it('flags console.log in source file', () => {
    const code = `console.log('debug', result);`;
    const issues = analyzeFile('service.ts', code);
    expect(issues.some(i => i.description.includes('console.log'))).toBe(true);
  });

  it('does not flag console.log in test file', () => {
    const code = `console.log('debug', result);`;
    const issues = analyzeFile('service.test.ts', code);
    expect(issues.some(i => i.description.includes('console.log'))).toBe(false);
  });
});
