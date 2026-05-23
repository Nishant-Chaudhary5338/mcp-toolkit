export interface A11yIssue {
  rule: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  element: string;
  file: string;
  line: number;
  description: string;
  fix: string;
  wcag: string;
}

type RuleCheck = (content: string, file: string) => A11yIssue[];

interface AxeRule {
  id: string;
  impact: A11yIssue['impact'];
  wcag: string;
  check: RuleCheck;
}

const VALID_ARIA_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell',
  'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition',
  'dialog', 'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell',
  'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
  'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio',
  'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
  'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
  'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
  'treegrid', 'treeitem',
]);

export const AXE_RULES: AxeRule[] = [
  {
    id: 'image-alt',
    impact: 'critical',
    wcag: '1.1.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const m of lines[i].matchAll(/<img\s[^>]*>/g)) {
          if (!m[0].includes('alt=') && !m[0].includes('aria-label=') && !m[0].includes('aria-labelledby=')) {
            issues.push({
              rule: 'image-alt', impact: 'critical', file, line: i + 1,
              element: m[0].slice(0, 100),
              description: 'Image element missing alt attribute. Screen readers cannot describe the image.',
              fix: 'Add alt attribute: <img src="..." alt="Descriptive text" />',
              wcag: '1.1.1 Non-text Content (Level A)',
            });
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'button-name',
    impact: 'critical',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<button[^>]*>\s*<\/button>/.test(line)) {
          issues.push({
            rule: 'button-name', impact: 'critical', file, line: i + 1,
            element: line.trim(),
            description: 'Button has no accessible name.',
            fix: 'Add text content, aria-label, or aria-labelledby.',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
        if (/<button[^>]*>\s*<(svg|Icon|i|span)[^>]*\/?>\s*<\/button>/.test(line) && !line.includes('aria-label')) {
          issues.push({
            rule: 'button-name', impact: 'critical', file, line: i + 1,
            element: line.trim().slice(0, 100),
            description: 'Icon-only button without aria-label.',
            fix: 'Add aria-label: <button aria-label="Close"><CloseIcon /></button>',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'link-name',
    impact: 'serious',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          (/<a[^>]*>\s*<\/a>/.test(line) || /<a[^>]*>\s*<(svg|Icon|i)[^>]*\/?>\s*<\/a>/.test(line)) &&
          !line.includes('aria-label') && !line.includes('aria-labelledby')
        ) {
          issues.push({
            rule: 'link-name', impact: 'serious', file, line: i + 1,
            element: line.trim().slice(0, 100),
            description: 'Link has no accessible name.',
            fix: 'Add text content or aria-label to the link.',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'label',
    impact: 'critical',
    wcag: '1.3.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /<input\s/.test(line) &&
          !line.includes('type="hidden"') &&
          !line.includes('type="submit"') &&
          !line.includes('type="button"') &&
          !line.includes('aria-label') &&
          !line.includes('aria-labelledby') &&
          !line.includes('id=')
        ) {
          issues.push({
            rule: 'label', impact: 'critical', file, line: i + 1,
            element: line.trim().slice(0, 100),
            description: 'Form input missing accessible label.',
            fix: 'Add aria-label, aria-labelledby, or wrap with <label>.',
            wcag: '1.3.1 Info and Relationships (Level A)',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'heading-order',
    impact: 'moderate',
    wcag: '1.3.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      let lastLevel = 0;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/<h(\d)/);
        if (m) {
          const level = parseInt(m[1]);
          if (lastLevel > 0 && level > lastLevel + 1) {
            issues.push({
              rule: 'heading-order', impact: 'moderate', file, line: i + 1,
              element: lines[i].trim().slice(0, 100),
              description: `Heading level skipped: h${lastLevel} → h${level}.`,
              fix: `Use sequential heading levels. After h${lastLevel}, use h${lastLevel + 1}.`,
              wcag: '1.3.1 Info and Relationships (Level A)',
            });
          }
          lastLevel = level;
        }
      }
      return issues;
    },
  },
  {
    id: 'tabindex',
    impact: 'serious',
    wcag: '2.4.3',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/tabindex=["'](\d+)["']/);
        if (m && parseInt(m[1]) > 0) {
          issues.push({
            rule: 'tabindex', impact: 'serious', file, line: i + 1,
            element: lines[i].trim().slice(0, 100),
            description: `Positive tabindex (${m[1]}) disrupts natural tab order.`,
            fix: 'Use tabindex="0" or tabindex="-1" for programmatic focus.',
            wcag: '2.4.3 Focus Order (Level A)',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'aria-roles',
    impact: 'serious',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/role=["'](\w+)["']/);
        if (m && !VALID_ARIA_ROLES.has(m[1])) {
          issues.push({
            rule: 'aria-roles', impact: 'serious', file, line: i + 1,
            element: lines[i].trim().slice(0, 100),
            description: `Invalid ARIA role "${m[1]}".`,
            fix: 'Use a valid ARIA role. See https://www.w3.org/TR/wai-aria-1.1/#role_definitions',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'aria-hidden-focus',
    impact: 'serious',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('aria-hidden="true"') && (line.includes('<a ') || line.includes('<button') || line.includes('<input'))) {
          issues.push({
            rule: 'aria-hidden-focus', impact: 'serious', file, line: i + 1,
            element: line.trim().slice(0, 100),
            description: 'aria-hidden="true" element contains focusable elements.',
            fix: 'Remove focusable elements from aria-hidden containers or add tabindex="-1".',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'html-has-lang',
    impact: 'serious',
    wcag: '3.1.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      if (content.includes('<html') && !content.includes('lang=')) {
        issues.push({
          rule: 'html-has-lang', impact: 'serious', file, line: 1,
          element: '<html>',
          description: 'html element missing lang attribute.',
          fix: 'Add lang attribute: <html lang="en">',
          wcag: '3.1.1 Language of Page (Level A)',
        });
      }
      return issues;
    },
  },
];

const IMPACT_ORDER: Record<A11yIssue['impact'], number> = {
  critical: 0, serious: 1, moderate: 2, minor: 3,
};

export function analyzeFile(filePath: string, content: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  for (const rule of AXE_RULES) {
    issues.push(...rule.check(content, filePath));
  }
  return issues;
}

export function filterByImpact(issues: A11yIssue[], minImpact: A11yIssue['impact']): A11yIssue[] {
  return issues.filter(i => IMPACT_ORDER[i.impact] <= IMPACT_ORDER[minImpact]);
}
