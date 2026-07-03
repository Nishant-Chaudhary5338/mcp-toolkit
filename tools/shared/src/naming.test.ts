import { describe, it, expect } from 'vitest';
import { pascal, camel, plural, singular } from './naming.js';

describe('pascal', () => {
  it('converts snake_case and kebab-case', () => {
    expect(pascal('blog_post')).toBe('BlogPost');
    expect(pascal('blog-post')).toBe('BlogPost');
    expect(pascal('blogPost')).toBe('BlogPost');
  });

  it('strips punctuation so the result is always a valid identifier (QA fuzz regression)', () => {
    // Found fuzzing every CRUD-factory generator with adversarial resource
    // names: pascal() only normalized "_"/"-" to spaces, so anything else
    // (apostrophes, periods, "!") rode along untouched and broke every
    // generator that builds a type name from it, e.g. `${pascal(resource)}Schema`.
    expect(pascal("thing's-2.0!")).toBe('Things20');
    expect(pascal('thing.name!')).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
  });

  it('falls back to "Resource" when nothing alphanumeric survives', () => {
    expect(pascal('!!!')).toBe('Resource');
    expect(pascal('')).toBe('Resource');
  });

  it('prefixes an underscore when the result would start with a digit', () => {
    expect(pascal('2fast2furious')).toBe('_2fast2furious');
  });
});

describe('camel', () => {
  it('lowercases the first letter of pascal()', () => {
    expect(camel('blog_post')).toBe('blogPost');
  });

  it('is always a valid identifier for adversarial input', () => {
    expect(camel("thing's!")).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
  });
});

describe('plural/singular', () => {
  it('round-trips common English nouns', () => {
    expect(plural('article')).toBe('articles');
    expect(plural('category')).toBe('categories');
    expect(singular('articles')).toBe('article');
    expect(singular('categories')).toBe('category');
  });
});
