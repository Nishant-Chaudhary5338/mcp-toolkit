// i18n-extractor CORE — pure logic (no MCP transport).
//
// Scan JSX for hardcoded user-facing strings (text nodes + translatable
// attributes) and produce i18n keys + a message catalog. Pure mechanical
// extraction — the perfect MCP-tool shape. Pairs with review-gate as a check.

export interface StringHit {
  text: string;
  line: number;
  source: 'jsx-text' | 'attribute';
  key: string;
}

export interface CatalogResult {
  hits: StringHit[];
  catalog: Record<string, string>;
  count: number;
}

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'label'];
// text that is only punctuation / numbers / whitespace / a single symbol isn't worth extracting
const HAS_WORD = /[A-Za-z]{2,}/;

function slugKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('_') || 'label';
}

/** Extract candidate hardcoded strings from JSX/TSX source text. */
export function extractStrings(code: string, _file = 'component'): StringHit[] {
  const hits: StringHit[] = [];
  const seen = new Set<string>();
  const lines = code.split('\n');

  lines.forEach((line, i) => {
    const ln = i + 1;
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('import')) return;

    // JSX text between tags: >Some text<
    for (const m of line.matchAll(/>\s*([^<>{}\n][^<>{}\n]*?)\s*</g)) {
      const text = m[1].trim();
      if (text && HAS_WORD.test(text) && !text.includes('{') && !seen.has(text)) {
        seen.add(text);
        hits.push({ text, line: ln, source: 'jsx-text', key: slugKey(text) });
      }
    }

    // translatable attributes
    for (const attr of TRANSLATABLE_ATTRS) {
      for (const m of line.matchAll(new RegExp(`${attr}=(["'])([^"'{}]+?)\\1`, 'g'))) {
        const text = m[2].trim();
        if (text && HAS_WORD.test(text) && !seen.has(text)) {
          seen.add(text);
          hits.push({ text, line: ln, source: 'attribute', key: slugKey(text) });
        }
      }
    }
  });

  return hits;
}

/** Build a message catalog from hits, disambiguating duplicate keys. */
export function buildCatalog(hits: StringHit[]): CatalogResult {
  const catalog: Record<string, string> = {};
  const used = new Map<string, number>();
  const finalHits: StringHit[] = [];

  for (const hit of hits) {
    let key = hit.key;
    if (catalog[key] !== undefined && catalog[key] !== hit.text) {
      const n = (used.get(hit.key) ?? 1) + 1;
      used.set(hit.key, n);
      key = `${hit.key}_${n}`;
    }
    catalog[key] = hit.text;
    finalHits.push({ ...hit, key });
  }

  return { hits: finalHits, catalog, count: Object.keys(catalog).length };
}
