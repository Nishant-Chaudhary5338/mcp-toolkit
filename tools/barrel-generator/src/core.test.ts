import { describe, it, expect } from 'vitest';
import { buildBarrel } from './core.js';

describe('buildBarrel', () => {
  it('re-exports source modules and skips index/test/stories/css', () => {
    const r = buildBarrel(['Button.tsx', 'Input.tsx', 'index.ts', 'Button.test.tsx', 'Button.stories.tsx', 'styles.css', 'utils.ts']);
    expect(r.code).toContain("export * from './Button';");
    expect(r.code).toContain("export * from './Input';");
    expect(r.code).toContain("export * from './utils';");
    expect(r.code).not.toContain('Button.test');
    expect(r.code).not.toContain('styles');
    expect(r.count).toBe(3);
    expect(r.filename).toBe('index.ts');
  });

  it('emits named exports for PascalCase when named:true', () => {
    const r = buildBarrel(['Button.tsx', 'helpers.ts'], { named: true });
    expect(r.code).toContain("export { Button } from './Button';");
    expect(r.code).toContain("export * from './helpers';");
  });

  it('handles an empty folder', () => {
    const r = buildBarrel(['index.ts', 'notes.md']);
    expect(r.count).toBe(0);
    expect(r.code).toContain('export {};');
  });
});
