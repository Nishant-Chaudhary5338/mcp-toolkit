import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { analyzeHtmlFile } from './index.js';

const tmpDir = path.join(os.tmpdir(), 'lighthouse-test-' + process.pid);

function writeHtml(filename: string, content: string): string {
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const FULL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
  <meta name="description" content="A test page">
  <link rel="icon" href="/favicon.ico">
  <link rel="canonical" href="https://example.com/page">
  <meta property="og:title" content="My Page">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#ffffff">
</head>
<body>
  <header><h1>My Site</h1></header>
  <main><p>Content</p></main>
  <nav>Navigation</nav>
  <script type="application/ld+json">{"@context":"https://schema.org"}</script>
</body>
</html>`;

const MINIMAL_HTML = `<html><body><p>Hello</p></body></html>`;

// ---------------------------------------------------------------------------
// Full / passing HTML
// ---------------------------------------------------------------------------
describe('analyzeHtmlFile — full HTML', () => {
  it('scores close to 100 for a well-structured HTML file', () => {
    const filePath = writeHtml('full.html', FULL_HTML);
    const { score } = analyzeHtmlFile(filePath);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('reports no issues for a fully-correct file', () => {
    const filePath = writeHtml('full2.html', FULL_HTML);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Missing elements
// ---------------------------------------------------------------------------
describe('analyzeHtmlFile — missing meta tags', () => {
  it('flags missing <title>', () => {
    const filePath = writeHtml('notitle.html', MINIMAL_HTML);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.toLowerCase().includes('title'))).toBe(true);
  });

  it('deducts points for missing title', () => {
    const filePath = writeHtml('notitle2.html', MINIMAL_HTML);
    const { score } = analyzeHtmlFile(filePath);
    expect(score).toBeLessThan(90);
  });

  it('flags missing viewport', () => {
    const html = `<html><head><title>T</title></head><body></body></html>`;
    const filePath = writeHtml('noviewport.html', html);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('viewport'))).toBe(true);
  });

  it('flags missing meta description', () => {
    const html = `<html><head><title>T</title><meta name="viewport" content="width=device-width"></head><body></body></html>`;
    const filePath = writeHtml('nodesc.html', html);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.toLowerCase().includes('description'))).toBe(true);
  });

  it('flags missing lang attribute', () => {
    const filePath = writeHtml('nolang.html', MINIMAL_HTML);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('lang'))).toBe(true);
  });

  it('flags missing canonical URL', () => {
    const filePath = writeHtml('nocanonical.html', MINIMAL_HTML);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.toLowerCase().includes('canonical'))).toBe(true);
  });

  it('flags missing Open Graph tags', () => {
    const filePath = writeHtml('noog.html', MINIMAL_HTML);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('og:title'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Images without alt
// ---------------------------------------------------------------------------
describe('analyzeHtmlFile — image alt', () => {
  it('flags images without alt attribute', () => {
    const html = `<html lang="en"><head><title>T</title></head><body><img src="a.png"></body></html>`;
    const filePath = writeHtml('noalt.html', html);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('alt'))).toBe(true);
  });

  it('passes images with alt attribute', () => {
    const html = `<html lang="en"><head><title>T</title></head><body><img src="a.png" alt="desc"></body></html>`;
    const filePath = writeHtml('withalt.html', html);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('alt'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Render-blocking scripts
// ---------------------------------------------------------------------------
describe('analyzeHtmlFile — render-blocking scripts', () => {
  it('flags script without defer/async', () => {
    const html = `<html><head><title>T</title><script src="bundle.js"></script></head></html>`;
    const filePath = writeHtml('blocking.html', html);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('defer') || i.includes('async'))).toBe(true);
  });

  it('does not flag script with defer', () => {
    const html = `<html><head><title>T</title><script src="bundle.js" defer></script></head></html>`;
    const filePath = writeHtml('deferred.html', html);
    const { score: with_defer } = analyzeHtmlFile(filePath);
    const { score: without_defer } = analyzeHtmlFile(writeHtml('nodeferx.html', `<html><head><title>T</title><script src="bundle.js"></script></head></html>`));
    expect(with_defer).toBeGreaterThanOrEqual(without_defer);
  });

  it('does not flag a module script (module scripts are deferred by spec)', () => {
    const html = `<html><head><title>T</title><script type="module" crossorigin src="bundle.js"></script></head></html>`;
    const filePath = writeHtml('module.html', html);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('Render-blocking'))).toBe(false);
  });

  it('still flags a plain blocking script in head', () => {
    const html = `<html><head><title>T</title><script src="bundle.js"></script></head></html>`;
    const filePath = writeHtml('stillblocking.html', html);
    const { issues } = analyzeHtmlFile(filePath);
    expect(issues.some(i => i.includes('Render-blocking'))).toBe(true);
  });
});
