// ============================================================================
// naming — shared string helpers for the CRUD-factory code generators.
// One implementation so every generator names files, types, and routes
// identically (that consistency is what lets crud-composer wire them together).
// ============================================================================

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "blog_post" | "blog-post" | "blogPost" → "BlogPost". Always returns a valid
 * TS identifier: strips any character that isn't ASCII alphanumeric (quotes,
 * punctuation, non-ASCII), falls back to "Resource" if nothing alphanumeric
 * survives, and prefixes an underscore if the result would start with a
 * digit. Found by fuzzing the CRUD-factory generators with adversarial
 * resource names (e.g. "thing's-2.0!") — every generator emitted syntactically
 * invalid TS/JSX because this shared helper didn't sanitize its input.
 */
export function pascal(s: string): string {
  const words = s
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  const result = words.map((w) => cap(w.toLowerCase())).join('');
  if (!result) return 'Resource';
  return /^[0-9]/.test(result) ? `_${result}` : result;
}

/** "blog_post" → "blogPost". */
export function camel(s: string): string {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** "Article" → "Articles", "Category" → "Categories". */
export function plural(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return word.replace(/y$/i, 'ies');
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/s$/i.test(word)) return word;
  return `${word}s`;
}

/** "Articles" → "Article", "Categories" → "Category". */
export function singular(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, 'y');
  if (/ses$/i.test(word)) return word.replace(/es$/i, '');
  if (/[^s]s$/i.test(word)) return word.replace(/s$/i, '');
  return word;
}

/** "publishedAt" → "Published At". */
export function toLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
