#!/usr/bin/env node
import { McpServerBase, safeReadJson } from '@mcp-showcase/shared';
import { renderReportHTML } from '@mcp-showcase/ui-kit';
import { toHealthReport } from './health-report.js';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface LighthouseMetrics {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  speedIndex: number;
}

interface LighthouseAudit {
  name: string;
  score: number;
  title: string;
  description: string;
}

interface LighthouseResult {
  url: string;
  metrics: LighthouseMetrics;
  audits: LighthouseAudit[];
  timestamp: string;
}

// ============================================================================
// LIGHTHOUSE RUNNER
// ============================================================================

function runLighthouse(url: string, outputPath: string, categories: string[] = ['performance', 'accessibility', 'best-practices', 'seo']): LighthouseResult {
  // url and outputPath are direct MCP tool-call arguments — the double-quote
  // wrapping here didn't escape embedded quotes/backticks/`$(...)`, so a
  // crafted url or outputPath could break out of the shell string and inject
  // commands (QA fuzz finding, the most directly reachable injection vector
  // found this session — no crafted repo needed, just a malicious tool call).
  // execFileSync passes each argument as a literal argv entry: no shell, no
  // quoting to break.
  const categoryFlags = categories.map((c) => `--only-categories=${c}`);
  const argv = ['lighthouse', url, '--output=json', `--output-path=${outputPath}`, ...categoryFlags, '--chrome-flags=--headless --no-sandbox --disable-gpu'];

  try {
    execFileSync('npx', argv, { encoding: 'utf-8', timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
  } catch {
    // lighthouse may exit non-zero but still produce output
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Lighthouse did not produce output at ${outputPath}. Ensure Chrome is available and the URL is reachable.`);
  }

  const report = safeReadJson<{
    categories?: Record<string, { score?: number }>;
    audits?: Record<string, { score: number | null; numericValue?: number; title?: string; description?: string }>;
    finalUrl?: string;
  }>(outputPath);
  if (!report) throw new Error('Could not parse Lighthouse report JSON');

  const cats = report.categories || {};
  const audits = report.audits || {};

  const metrics: LighthouseMetrics = {
    performance: Math.round((cats.performance?.score || 0) * 100),
    accessibility: Math.round((cats.accessibility?.score || 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
    seo: Math.round((cats.seo?.score || 0) * 100),
    pwa: Math.round((cats.pwa?.score || 0) * 100),
    firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
    largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
    totalBlockingTime: audits['total-blocking-time']?.numericValue || 0,
    cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0,
    speedIndex: audits['speed-index']?.numericValue || 0,
  };

  const auditList: LighthouseAudit[] = Object.entries(audits)
    .filter(([, a]) => a.score !== null && a.score < 1)
    .map(([key, a]) => ({
      name: key,
      score: Math.round((a.score || 0) * 100),
      title: a.title || key,
      description: (a.description || '').slice(0, 200),
    }))
    .sort((a, b) => a.score - b.score);

  return { url, metrics, audits: auditList, timestamp: new Date().toISOString() };
}

export function analyzeHtmlFile(filePath: string): { score: number; issues: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  let score = 100;

  if (!content.includes('<title>') || content.includes('<title></title>')) {
    issues.push('Missing or empty <title> tag');
    score -= 10;
  }
  if (!content.includes('name="description"')) {
    issues.push('Missing meta description');
    score -= 5;
  }
  if (!content.includes('name="viewport"')) {
    issues.push('Missing viewport meta tag');
    score -= 10;
  }
  if (!content.includes('lang=')) {
    issues.push('Missing lang attribute on html element');
    score -= 5;
  }

  const imgNoAlt = content.match(/<img(?![^>]*alt=)[^>]*>/g);
  if (imgNoAlt) {
    issues.push(`${imgNoAlt.length} images without alt attribute`);
    score -= imgNoAlt.length * 5;
  }

  const scriptBlocks = content.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
  for (const script of scriptBlocks) {
    if (script.length > 10000) {
      issues.push('Large inline script detected (>10KB). Consider external file.');
      score -= 10;
    }
  }

  if (content.match(/<script(?![^>]*defer)(?![^>]*async)(?![^>]*type=["']module["'])[^>]*src=/)) {
    issues.push('Render-blocking script without defer/async attribute');
    score -= 10;
  }

  if (!content.includes('rel="icon"') && !content.includes("rel='icon'")) {
    issues.push('Missing favicon link');
    score -= 3;
  }

  // Check for Open Graph tags
  if (!content.includes('og:title')) {
    issues.push('Missing Open Graph meta tags (og:title, og:description, og:image)');
    score -= 3;
  }

  // Check for Twitter Card meta tags
  if (!content.includes('twitter:card')) {
    issues.push('Missing Twitter Card meta tags (twitter:card, twitter:title, twitter:description)');
    score -= 2;
  }

  // Check for canonical URL
  if (!content.includes('rel="canonical"') && !content.includes("rel='canonical'")) {
    issues.push('Missing canonical URL (rel="canonical"). Prevents duplicate content SEO issues.');
    score -= 3;
  }

  // Check for charset declaration
  if (!content.includes('charset=') && !content.includes('charset =')) {
    issues.push('Missing charset meta tag (e.g. <meta charset="UTF-8">)');
    score -= 3;
  }

  // Check for semantic HTML landmarks
  if (!content.includes('<main') && !content.includes('<header') && !content.includes('<nav')) {
    issues.push('No semantic HTML landmarks detected (<main>, <header>, <nav>). Hurts accessibility and SEO.');
    score -= 5;
  }

  // Check for JSON-LD structured data
  if (!content.includes('application/ld+json')) {
    issues.push('No JSON-LD structured data found. Adding schema.org markup improves rich search results.');
    score -= 2;
  }

  // Check for theme-color meta
  if (!content.includes('theme-color')) {
    issues.push('Missing theme-color meta tag for mobile browser chrome styling.');
    score -= 1;
  }

  return { score: Math.max(0, score), issues };
}

// ============================================================================
// MAIN SERVER
// ============================================================================

class LighthouseRunnerServer extends McpServerBase {
  constructor() {
    super({ name: 'lighthouse-runner', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'run_lighthouse',
      'Run a full Lighthouse audit against a live URL. Returns performance, accessibility, best-practices, and SEO scores with failing audits.',
      {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to audit (must be a running server, e.g. http://localhost:3000)' },
          outputPath: { type: 'string', description: 'Where to write the JSON report (default: /tmp/lighthouse-report.json)' },
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Categories to audit: performance, accessibility, best-practices, seo, pwa (default: all except pwa)',
          },
        },
        required: ['url'],
      },
      (args) => this.handleRunLighthouse(args)
    );

    this.addTool(
      'collect_metrics',
      'Extract Core Web Vitals (LCP, FID/TBT, CLS, FCP, SI) from an existing Lighthouse JSON report or by running a new audit.',
      {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to audit (used if reportPath not provided)' },
          reportPath: { type: 'string', description: 'Path to existing Lighthouse JSON report file' },
        },
      },
      (args) => this.handleCollectMetrics(args)
    );

    this.addTool(
      'compare_audits',
      'Compare two Lighthouse JSON reports to measure performance regressions or improvements.',
      {
        type: 'object',
        properties: {
          baselinePath: { type: 'string', description: 'Path to baseline Lighthouse JSON report' },
          currentPath: { type: 'string', description: 'Path to current Lighthouse JSON report to compare against baseline' },
        },
        required: ['baselinePath', 'currentPath'],
      },
      (args) => this.handleCompareAudits(args)
    );

    this.addTool(
      'static_audit',
      'Analyze HTML files for SEO and performance issues without running a live server (title, meta tags, images, scripts, favicon, OG tags).',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to HTML file or directory containing HTML files' },
        },
        required: ['path'],
      },
      (args) => this.handleStaticAudit(args)
    );
  }

  private async handleRunLighthouse(args: unknown) {
    const { url, outputPath = '/tmp/lighthouse-report.json', categories } = args as {
      url: string;
      outputPath?: string;
      categories?: string[];
    };
    try {
      const result = runLighthouse(url, outputPath, categories);
      return this.success({ result });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleCollectMetrics(args: unknown) {
    const { url, reportPath } = args as { url?: string; reportPath?: string };
    try {
      let result: LighthouseResult;
      if (reportPath && fs.existsSync(reportPath)) {
        const report = safeReadJson<{
          categories?: Record<string, { score?: number }>;
          audits?: Record<string, { score: number | null; numericValue?: number; title?: string; description?: string }>;
          finalUrl?: string;
        }>(reportPath);
        if (!report) throw new Error(`Could not parse report: ${reportPath}`);
        const cats = report.categories || {};
        const audits = report.audits || {};
        result = {
          url: report.finalUrl || url || 'unknown',
          metrics: {
            performance: Math.round((cats.performance?.score || 0) * 100),
            accessibility: Math.round((cats.accessibility?.score || 0) * 100),
            bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
            seo: Math.round((cats.seo?.score || 0) * 100),
            pwa: Math.round((cats.pwa?.score || 0) * 100),
            firstContentfulPaint: audits['first-contentful-paint']?.numericValue || 0,
            largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || 0,
            totalBlockingTime: audits['total-blocking-time']?.numericValue || 0,
            cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || 0,
            speedIndex: audits['speed-index']?.numericValue || 0,
          },
          audits: [],
          timestamp: new Date().toISOString(),
        };
      } else if (url) {
        result = runLighthouse(url, '/tmp/lh-metrics.json');
      } else {
        throw new Error('Provide either url or reportPath');
      }

      const cwv = {
        LCP: { value: result.metrics.largestContentfulPaint, unit: 'ms', target: 2500, status: result.metrics.largestContentfulPaint <= 2500 ? 'good' : result.metrics.largestContentfulPaint <= 4000 ? 'needs-improvement' : 'poor' },
        TBT: { value: result.metrics.totalBlockingTime, unit: 'ms', target: 200, status: result.metrics.totalBlockingTime <= 200 ? 'good' : result.metrics.totalBlockingTime <= 600 ? 'needs-improvement' : 'poor' },
        CLS: { value: result.metrics.cumulativeLayoutShift, unit: 'score', target: 0.1, status: result.metrics.cumulativeLayoutShift <= 0.1 ? 'good' : result.metrics.cumulativeLayoutShift <= 0.25 ? 'needs-improvement' : 'poor' },
        FCP: { value: result.metrics.firstContentfulPaint, unit: 'ms', target: 1800, status: result.metrics.firstContentfulPaint <= 1800 ? 'good' : result.metrics.firstContentfulPaint <= 3000 ? 'needs-improvement' : 'poor' },
        SI: { value: result.metrics.speedIndex, unit: 'ms', target: 3400, status: result.metrics.speedIndex <= 3400 ? 'good' : 'needs-improvement' },
      };

      return this.success({ coreWebVitals: cwv, scores: result.metrics });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleCompareAudits(args: unknown) {
    const { baselinePath, currentPath } = args as { baselinePath: string; currentPath: string };
    try {
      type LhReport = {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { numericValue?: number }>;
      };
      const baseline = safeReadJson<LhReport>(baselinePath);
      const current = safeReadJson<LhReport>(currentPath);
      if (!baseline) throw new Error(`Could not read baseline: ${baselinePath}`);
      if (!current) throw new Error(`Could not read current: ${currentPath}`);

      const bCats = baseline.categories || {};
      const cCats = current.categories || {};
      const bAudits = baseline.audits || {};
      const cAudits = current.audits || {};

      const diff = {
        performance: Math.round(((cCats.performance?.score || 0) - (bCats.performance?.score || 0)) * 100),
        accessibility: Math.round(((cCats.accessibility?.score || 0) - (bCats.accessibility?.score || 0)) * 100),
        bestPractices: Math.round(((cCats['best-practices']?.score || 0) - (bCats['best-practices']?.score || 0)) * 100),
        seo: Math.round(((cCats.seo?.score || 0) - (bCats.seo?.score || 0)) * 100),
        LCP_ms: (cAudits['largest-contentful-paint']?.numericValue || 0) - (bAudits['largest-contentful-paint']?.numericValue || 0),
        TBT_ms: (cAudits['total-blocking-time']?.numericValue || 0) - (bAudits['total-blocking-time']?.numericValue || 0),
        CLS: (cAudits['cumulative-layout-shift']?.numericValue || 0) - (bAudits['cumulative-layout-shift']?.numericValue || 0),
      };

      const verdict = diff.performance >= 0 ? 'improved' : 'regressed';
      return this.success({ diff, verdict, performanceChange: `${diff.performance > 0 ? '+' : ''}${diff.performance} points` });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleStaticAudit(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const files: string[] = [];

      if (stat.isDirectory()) {
        const scan = (dir: string) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory() && !['node_modules', 'build', 'dist', '.next'].includes(entry.name)) scan(full);
            else if (entry.name.endsWith('.html')) files.push(full);
          }
        };
        scan(targetPath);
      } else {
        files.push(targetPath);
      }

      const results = files.map(f => ({ file: f, ...analyzeHtmlFile(f) }));
      const avgScore = results.length > 0 ? results.reduce((a, r) => a + r.score, 0) / results.length : 100;

      const staticResult = {
        filesAudited: results.length,
        averageScore: Math.round(avgScore),
        results,
      };

      return this.successWithUI(
        staticResult as unknown as Record<string, unknown>,
        {
          uri: 'ui://lighthouse-runner/report',
          html: renderReportHTML(toHealthReport(staticResult, new Date().toISOString().slice(0, 10))),
        }
      );
    } catch (error) {
      return this.error(error);
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new LighthouseRunnerServer().run().catch(console.error);
