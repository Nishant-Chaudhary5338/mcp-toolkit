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

// Full WAI-ARIA 1.2 non-abstract role list (landmark, widget, composite, document
// structure, live region, window, and graphics-module roles). Abstract roles
// (e.g. "widget", "structure") are intentionally excluded — authors must not use them.
const VALID_ARIA_ROLES = new Set([
  // Landmark
  'banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search',
  // Widget
  'button', 'checkbox', 'gridcell', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'progressbar', 'radio', 'scrollbar', 'searchbox', 'separator', 'slider',
  'spinbutton', 'switch', 'tab', 'tabpanel', 'textbox', 'treeitem',
  // Composite widget
  'combobox', 'grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid',
  // Document structure
  'application', 'article', 'associationlist', 'associationlistitemkey',
  'associationlistitemvalue', 'blockquote', 'caption', 'cell', 'code', 'columnheader',
  'comment', 'definition', 'deletion', 'directory', 'document', 'emphasis', 'feed', 'figure',
  'generic', 'group', 'heading', 'img', 'insertion', 'list', 'listitem', 'mark', 'math',
  'meter', 'none', 'note', 'paragraph', 'presentation', 'row', 'rowgroup', 'rowheader',
  'strong', 'subscript', 'suggestion', 'superscript', 'table', 'term', 'time', 'toolbar',
  'tooltip',
  // Live region
  'alert', 'log', 'marquee', 'status', 'timer',
  // Window
  'alertdialog', 'dialog',
  // Graphics module (ARIA Graphics)
  'graphics-document', 'graphics-object', 'graphics-symbol',
]);

// Extract a tag's full attribute string (handles multiline JSX by scanning to closing > or />)
function extractTagContent(content: string, tagStart: number): { tag: string; end: number } {
  let depth = 0;
  let i = tagStart;
  while (i < Math.min(tagStart + 800, content.length)) {
    const ch = content[i];
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; continue; }
    if (depth > 0) { i++; continue; }
    if (content.slice(i, i + 2) === '/>') return { tag: content.slice(tagStart, i + 2), end: i + 2 };
    if (ch === '>') return { tag: content.slice(tagStart, i + 1), end: i + 1 };
    i++;
  }
  return { tag: content.slice(tagStart, Math.min(tagStart + 200, content.length)), end: tagStart + 200 };
}

function lineAt(content: string, pos: number): number {
  return content.slice(0, pos).split('\n').length;
}

function snippetAt(tag: string): string {
  return tag.replace(/\n\s*/g, ' ').slice(0, 120);
}

// A forwardRef primitive spreading {...props}/{...rest} may receive its label
// (id, aria-label, etc.) from the caller — don't hard-flag it as unlabelled.
function hasSpreadProps(tag: string): boolean {
  return /\{\s*\.\.\.\w+\s*\}/.test(tag);
}

export const AXE_RULES: AxeRule[] = [
  // -------------------------------------------------------------------------
  // 1. image-alt (CRITICAL)
  // -------------------------------------------------------------------------
  {
    id: 'image-alt',
    impact: 'critical',
    wcag: '1.1.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      let pos = 0;
      while (true) {
        const idx = content.indexOf('<img', pos);
        if (idx === -1) break;
        const { tag, end } = extractTagContent(content, idx);
        const lc = tag.toLowerCase();
        if (!lc.includes('alt=') && !lc.includes('aria-label=') && !lc.includes('aria-labelledby=') && !lc.includes('aria-hidden=')) {
          issues.push({
            rule: 'image-alt', impact: 'critical', file, line: lineAt(content, idx),
            element: snippetAt(tag),
            description: 'Image element missing alt attribute. Screen readers cannot describe this image.',
            fix: 'Add alt="Descriptive text" (or alt="" for decorative images with aria-hidden="true")',
            wcag: '1.1.1 Non-text Content (Level A)',
          });
        }
        pos = end;
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 2. button-name (CRITICAL)
  // -------------------------------------------------------------------------
  {
    id: 'button-name',
    impact: 'critical',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      // Match <button ...>...</button> blocks
      const btnRegex = /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g;
      for (const m of content.matchAll(btnRegex)) {
        const attrs = m[1] ?? '';
        const inner = (m[2] ?? '').trim().replace(/<[^>]+>/g, '').trim();
        const hasLabel = attrs.includes('aria-label=') || attrs.includes('aria-labelledby=') || attrs.includes('title=');
        if (!inner && !hasLabel) {
          const lineNum = lineAt(content, m.index ?? 0);
          issues.push({
            rule: 'button-name', impact: 'critical', file, line: lineNum,
            element: snippetAt(m[0]),
            description: 'Button has no accessible name — screen readers will announce it as "button" with no context.',
            fix: 'Add text content, aria-label="Action name", or aria-labelledby pointing to a label.',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      // Also catch self-closing icon buttons: <button><Icon /></button>
      for (const m of content.matchAll(/<button\b([^>]*)>\s*<([A-Z][A-Za-z]+|svg|i|span)[^>]*\/?\s*>\s*<\/button>/g)) {
        const attrs = m[1] ?? '';
        if (!attrs.includes('aria-label=') && !attrs.includes('aria-labelledby=') && !attrs.includes('title=')) {
          issues.push({
            rule: 'button-name', impact: 'critical', file, line: lineAt(content, m.index ?? 0),
            element: snippetAt(m[0]),
            description: 'Icon-only button missing accessible label.',
            fix: 'Add aria-label="Close" (or appropriate action) to the button.',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 3. link-name (SERIOUS)
  // -------------------------------------------------------------------------
  {
    id: 'link-name',
    impact: 'serious',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      for (const m of content.matchAll(/<a\b([\s\S]*?)>([\s\S]*?)<\/a>/g)) {
        const attrs = m[1] ?? '';
        const inner = (m[2] ?? '').trim().replace(/<[^>]+>/g, '').trim();
        const hasLabel = attrs.includes('aria-label=') || attrs.includes('aria-labelledby=') || attrs.includes('title=');
        if (!inner && !hasLabel) {
          issues.push({
            rule: 'link-name', impact: 'serious', file, line: lineAt(content, m.index ?? 0),
            element: snippetAt(m[0]),
            description: 'Link has no accessible name.',
            fix: 'Add visible text or aria-label="Destination description" to the link.',
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 4. label (CRITICAL) — input without accessible label
  // -------------------------------------------------------------------------
  {
    id: 'label',
    impact: 'critical',
    wcag: '1.3.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      let pos = 0;
      while (true) {
        const idx = content.indexOf('<input', pos);
        if (idx === -1) break;
        const { tag, end } = extractTagContent(content, idx);
        const lc = tag.toLowerCase();
        const isHidden = lc.includes('type="hidden"') || lc.includes("type='hidden'") || lc.includes('type={');
        const isSubmit = lc.includes('type="submit"') || lc.includes('type="button"') || lc.includes('type="reset"');
        if (!isHidden && !isSubmit) {
          const hasLabel = lc.includes('aria-label=') || lc.includes('aria-labelledby=') || lc.includes('id=')
            || lc.includes('aria-describedby=');
          if (!hasLabel && !hasSpreadProps(tag)) {
            issues.push({
              rule: 'label', impact: 'critical', file, line: lineAt(content, idx),
              element: snippetAt(tag),
              description: 'Form input missing accessible label.',
              fix: 'Add aria-label="Field name", or pair with a <label htmlFor="..."> and matching id.',
              wcag: '1.3.1 Info and Relationships (Level A)',
            });
          }
        }
        pos = end;
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 5. select-name (SERIOUS) — select without label
  // -------------------------------------------------------------------------
  {
    id: 'select-name',
    impact: 'serious',
    wcag: '1.3.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      let pos = 0;
      while (true) {
        const idx = content.indexOf('<select', pos);
        if (idx === -1) break;
        const { tag, end } = extractTagContent(content, idx);
        const lc = tag.toLowerCase();
        if (!lc.includes('aria-label=') && !lc.includes('aria-labelledby=') && !lc.includes('id=')) {
          issues.push({
            rule: 'select-name', impact: 'serious', file, line: lineAt(content, idx),
            element: snippetAt(tag),
            description: 'Select element missing accessible label.',
            fix: 'Add aria-label or pair with <label htmlFor="..."> using a matching id.',
            wcag: '1.3.1 Info and Relationships (Level A)',
          });
        }
        pos = end;
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 6. heading-order (MODERATE)
  // -------------------------------------------------------------------------
  {
    id: 'heading-order',
    impact: 'moderate',
    wcag: '1.3.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const headings: { level: number; pos: number }[] = [];
      for (const m of content.matchAll(/<h([1-6])\b/g)) {
        headings.push({ level: parseInt(m[1]), pos: m.index ?? 0 });
      }
      for (let i = 1; i < headings.length; i++) {
        const prev = headings[i - 1];
        const curr = headings[i];
        if (curr.level > prev.level + 1) {
          issues.push({
            rule: 'heading-order', impact: 'moderate', file, line: lineAt(content, curr.pos),
            element: content.slice(curr.pos, curr.pos + 80).replace(/\n\s*/g, ' '),
            description: `Heading level skipped: h${prev.level} → h${curr.level}.`,
            fix: `Use h${prev.level + 1} instead. Heading levels should not skip.`,
            wcag: '1.3.1 Info and Relationships (Level A)',
          });
        }
      }
      // Multiple h1s
      const h1Count = (content.match(/<h1[\s>]/g) ?? []).length;
      if (h1Count > 1) {
        const firstH1 = content.indexOf('<h1');
        issues.push({
          rule: 'heading-order', impact: 'moderate', file, line: lineAt(content, firstH1),
          element: '<h1>',
          description: `${h1Count} <h1> elements found — a page should have only one h1.`,
          fix: 'Use only one <h1> per page/route. Demote secondary headings to h2.',
          wcag: '1.3.1 Info and Relationships (Level A)',
        });
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 7. tabindex (SERIOUS) — positive tabindex values
  // -------------------------------------------------------------------------
  {
    id: 'tabindex',
    impact: 'serious',
    wcag: '2.4.3',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      // Both tabIndex={N} (JSX) and tabindex="N" (HTML)
      for (const m of content.matchAll(/tab(?:I|i)ndex=(?:\{["']?|["'])([1-9]\d*)["'}\]?]/g)) {
        issues.push({
          rule: 'tabindex', impact: 'serious', file, line: lineAt(content, m.index ?? 0),
          element: content.slice(m.index ?? 0, (m.index ?? 0) + 80).replace(/\n\s*/g, ' '),
          description: `Positive tabIndex (${m[1]}) breaks the natural keyboard tab order.`,
          fix: 'Use tabIndex={0} to include in focus order, or tabIndex={-1} for programmatic focus only.',
          wcag: '2.4.3 Focus Order (Level A)',
        });
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 8. aria-roles (SERIOUS)
  // -------------------------------------------------------------------------
  {
    id: 'aria-roles',
    impact: 'serious',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      for (const m of content.matchAll(/role=["'{`](\w+)["'}`]/g)) {
        const role = m[1];
        if (!VALID_ARIA_ROLES.has(role)) {
          issues.push({
            rule: 'aria-roles', impact: 'serious', file, line: lineAt(content, m.index ?? 0),
            element: content.slice(m.index ?? 0, (m.index ?? 0) + 80).replace(/\n\s*/g, ' '),
            description: `Invalid ARIA role "${role}". Assistive technology won't recognise it.`,
            fix: `Use a valid WAI-ARIA role. Common alternatives: "region", "main", "navigation", "button", "dialog".`,
            wcag: '4.1.2 Name, Role, Value (Level A)',
          });
        }
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 9. aria-hidden-focus (SERIOUS)
  // -------------------------------------------------------------------------
  {
    id: 'aria-hidden-focus',
    impact: 'serious',
    wcag: '4.1.2',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('aria-hidden="true"') || line.includes("aria-hidden='true'") || line.includes('aria-hidden={true}')) {
          if (/<(a|button|input|select|textarea)\b/.test(line)) {
            issues.push({
              rule: 'aria-hidden-focus', impact: 'serious', file, line: i + 1,
              element: line.trim().slice(0, 100),
              description: 'aria-hidden="true" applied to an element with focusable children.',
              fix: 'Move aria-hidden to a wrapper, or add tabIndex={-1} to all focusable descendants.',
              wcag: '4.1.2 Name, Role, Value (Level A)',
            });
          }
        }
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 10. click-events-have-key-events (SERIOUS) — non-interactive elements with onClick
  // -------------------------------------------------------------------------
  {
    id: 'click-events-have-key-events',
    impact: 'serious',
    wcag: '2.1.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      const NON_INTERACTIVE = ['div', 'span', 'p', 'li', 'td', 'th', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav'];
      for (const tag of NON_INTERACTIVE) {
        for (const m of content.matchAll(new RegExp(`<${tag}\\b([\\s\\S]*?)>`, 'g'))) {
          const attrs = m[1] ?? '';
          if (!attrs.includes('onClick') && !attrs.includes('onClick=')) continue;
          const hasKeyboard = attrs.includes('onKeyDown') || attrs.includes('onKeyPress') || attrs.includes('onKeyUp');
          const hasRole = attrs.includes('role=');
          const hasTabIndex = attrs.includes('tabIndex') || attrs.includes('tabindex');
          if (!hasKeyboard || !hasRole || !hasTabIndex) {
            const missing: string[] = [];
            if (!hasKeyboard) missing.push('onKeyDown handler');
            if (!hasRole) missing.push('role attribute');
            if (!hasTabIndex) missing.push('tabIndex={0}');
            issues.push({
              rule: 'click-events-have-key-events', impact: 'serious', file, line: lineAt(content, m.index ?? 0),
              element: snippetAt(m[0]),
              description: `<${tag}> with onClick is keyboard-inaccessible. Missing: ${missing.join(', ')}.`,
              fix: `Add role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handler()} to make it keyboard-accessible, or replace with a <button>.`,
              wcag: '2.1.1 Keyboard (Level A)',
            });
          }
        }
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 11. html-has-lang (SERIOUS)
  // -------------------------------------------------------------------------
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
          description: '<html> element missing lang attribute.',
          fix: 'Add lang="en" (or appropriate BCP 47 language code): <html lang="en">',
          wcag: '3.1.1 Language of Page (Level A)',
        });
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 12. img-redundant-alt (MINOR)
  // -------------------------------------------------------------------------
  {
    id: 'img-redundant-alt',
    impact: 'minor',
    wcag: '1.1.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      for (const m of content.matchAll(/alt=["'](?:image|photo|picture|icon|graphic|logo)\s*(?:of\s+)?["']/gi)) {
        issues.push({
          rule: 'img-redundant-alt', impact: 'minor', file, line: lineAt(content, m.index ?? 0),
          element: m[0],
          description: `Redundant alt text: "${m[0]}" — screen readers already announce the element as an image.`,
          fix: 'Use descriptive text like alt="Dashboard showing monthly revenue" instead of generic alt="image".',
          wcag: '1.1.1 Non-text Content (Level A)',
        });
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 13. no-autofocus (MODERATE)
  // -------------------------------------------------------------------------
  {
    id: 'no-autofocus',
    impact: 'moderate',
    wcag: '3.2.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      for (const m of content.matchAll(/\bautoFocus\b|\bautofocus\b/g)) {
        issues.push({
          rule: 'no-autofocus', impact: 'moderate', file, line: lineAt(content, m.index ?? 0),
          element: content.slice(m.index ?? 0, (m.index ?? 0) + 80).replace(/\n\s*/g, ' '),
          description: 'autoFocus can disorient screen reader and keyboard users.',
          fix: 'Remove autoFocus. If focus management is needed, use programmatic focus via useRef/useEffect after user interaction.',
          wcag: '3.2.1 On Focus (Level A)',
        });
      }
      return issues;
    },
  },

  // -------------------------------------------------------------------------
  // 14. textarea-label (SERIOUS)
  // -------------------------------------------------------------------------
  {
    id: 'textarea-label',
    impact: 'serious',
    wcag: '1.3.1',
    check: (content, file) => {
      const issues: A11yIssue[] = [];
      let pos = 0;
      while (true) {
        const idx = content.indexOf('<textarea', pos);
        if (idx === -1) break;
        const { tag, end } = extractTagContent(content, idx);
        const lc = tag.toLowerCase();
        const hasLabel = lc.includes('aria-label=') || lc.includes('aria-labelledby=') || lc.includes('id=')
          || lc.includes('aria-describedby=');
        if (!hasLabel && !hasSpreadProps(tag)) {
          issues.push({
            rule: 'textarea-label', impact: 'serious', file, line: lineAt(content, idx),
            element: snippetAt(tag),
            description: 'Textarea missing accessible label.',
            fix: 'Add aria-label or pair with <label htmlFor="..."> using a matching id.',
            wcag: '1.3.1 Info and Relationships (Level A)',
          });
        }
        pos = end;
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
    try {
      issues.push(...rule.check(content, filePath));
    } catch { /* skip failed rules */ }
  }
  return issues;
}

export function filterByImpact(issues: A11yIssue[], minImpact: A11yIssue['impact']): A11yIssue[] {
  return issues.filter(i => IMPACT_ORDER[i.impact] <= IMPACT_ORDER[minImpact]);
}
