// ============================================================================
// naming — shared string helpers for the CRUD-factory code generators.
// One implementation so every generator names files, types, and routes
// identically (that consistency is what lets crud-composer wire them together).
// ============================================================================

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "blog_post" | "blog-post" | "blogPost" → "BlogPost". */
export function pascal(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => cap(w.toLowerCase()))
    .join('');
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
