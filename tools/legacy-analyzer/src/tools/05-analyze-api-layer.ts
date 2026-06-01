// ============================================================================
// TOOL #5: analyze-api-layer
// Detects API patterns: axios/fetch/superagent usage, Next.js API routes,
// centralized vs scattered pattern, and duplicate endpoints
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, resolveSourceDir } from '../utils/file-scanner.js';
import { parseFile, extractImports } from '../utils/ast-parser.js';
import type { AnalyzeApiOutput, AnalyzerConfig } from '../types.js';

const API_CLIENTS = ['axios', 'node-fetch', 'got', 'superagent', 'ky', 'undici'] as const;
const API_INDICATORS = ['fetch(', 'axios.', 'api.', '/api/', 'useSWR', 'useQuery', 'useMutation'];

export async function analyzeApiLayer(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeApiOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  const clients: Set<string> = new Set();
  const issues: string[] = [];
  const apiEndpoints: Map<string, string[]> = new Map(); // endpoint -> files
  let centralizedFiles = 0;
  let scatteredFiles = 0;
  const duplicateEndpoints: string[] = [];

  // Files that look like API service files
  // Next.js API routes are inherently centralized (pages/api/ or app/api/)
  const isNextJsApiRoute = (f: string) => {
    const rel = f.replace(appPath, '');
    return rel.includes('/pages/api/') || rel.includes('/app/api/');
  };

  const apiServiceFiles = files.filter((f) => {
    if (isNextJsApiRoute(f)) return true;
    const lower = f.toLowerCase();
    const base = path.basename(lower, path.extname(lower));
    const API_SERVICE_NAMES = ['agent', 'api', 'http', 'client', 'request', 'fetcher', 'axios', 'service'];
    return lower.includes('/api/') || lower.includes('/service') || lower.includes('/services/') ||
      lower.includes('client.') || lower.includes('/api-client') || API_SERVICE_NAMES.includes(base);
  });

  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    const relPath = path.relative(appPath, file);
    const isApiService = apiServiceFiles.includes(file);

    // Content-based detection (works for both JS and TS files)
    const hasFetch = content.includes('fetch(');
    const hasAxios = content.includes('axios.get(') || content.includes('axios.post(') || content.includes('axios(');
    const hasSuperagent = content.includes('superagent.') || content.includes('superagent-promise');
    const hasGot = content.includes('got.get(') || content.includes('got.post(') || content.includes("from 'got'") || content.includes('from "got"');
    const hasKy = content.includes('ky.get(') || content.includes('ky.post(') || content.includes("from 'ky'") || content.includes('from "ky"');

    // Register clients detected by content
    if (hasFetch && !content.includes('axios') && !hasSuperagent) clients.add('fetch');
    if (hasAxios) clients.add('axios');
    if (hasSuperagent) clients.add('superagent');
    if (hasGot) clients.add('got');
    if (hasKy) clients.add('ky');

    const hasApiIndicator = API_INDICATORS.some((indicator) => content.includes(indicator));
    const hasApiCall = hasApiIndicator || hasFetch || hasAxios || hasSuperagent || hasGot || hasKy;

    if (hasApiCall) {
      if (isApiService) centralizedFiles++;
      else scatteredFiles++;
    }

    // Extract API endpoints (skip CDN, schema, and asset URLs)
    const EXCLUDED_URL_PATTERNS = ['w3.org', 'schemas.', 'xmlns', 'cdn.', 'fonts.', 'cdnjs.', 'unpkg.', 'jsdelivr.', 'cloudflare.com/ajax', 'localhost', '127.0.0.1', '0.0.0.0'];
    const endpointRegex = /['"`](\/api\/[^'"`\s]+|https?:\/\/[^'"`\s]+)['"`]/g;
    let endpointMatch;
    while ((endpointMatch = endpointRegex.exec(content)) !== null) {
      const endpoint = endpointMatch[1];
      if (EXCLUDED_URL_PATTERNS.some((pat) => endpoint.includes(pat))) continue;
      if (!apiEndpoints.has(endpoint)) apiEndpoints.set(endpoint, []);
      apiEndpoints.get(endpoint)!.push(relPath);
    }

    // Detect fetch without response handling (fire-and-forget)
    if (hasFetch) {
      const fetchMatches = [...content.matchAll(/fetch\s*\([^)]+\)/g)];
      for (const m of fetchMatches) {
        const idx = m.index ?? 0;
        const after = content.slice(idx, idx + 200);
        if (!after.includes('.then(') && !after.includes('await') && !after.includes('.json(')) {
          issues.push(`${relPath}: fetch() result not handled — response never read or awaited.`);
          break;
        }
      }
    }

    // Detect missing Content-Type on mutating requests
    if (hasFetch && (content.includes("method: 'POST'") || content.includes('method: "POST"') ||
        content.includes("method: 'PUT'") || content.includes("method: 'PATCH'"))) {
      if (!content.includes('Content-Type') && !content.includes('content-type')) {
        issues.push(`${relPath}: POST/PUT fetch call missing Content-Type header.`);
      }
    }

    // AST-based: detect library imports (best effort, skip if AST fails for .js)
    const parsed = parseFile(file);
    if (parsed) {
      const imports = extractImports(parsed.ast);
      const importSources = imports.map((i) => i.source);
      for (const client of API_CLIENTS) {
        if (importSources.some((s) => s.includes(client))) clients.add(client);
      }
    }
  }

  // Find duplicate endpoints
  for (const [endpoint, filesUsingIt] of apiEndpoints) {
    if (filesUsingIt.length > 1) {
      duplicateEndpoints.push(`${endpoint} (used in ${filesUsingIt.length} files)`);
    }
  }

  // Determine pattern
  let apiPattern: AnalyzeApiOutput['apiPattern'];
  if (centralizedFiles === 0 && scatteredFiles === 0) {
    apiPattern = 'none';
  } else if (centralizedFiles > 0 && scatteredFiles === 0) {
    apiPattern = 'centralized';
  } else if (scatteredFiles > centralizedFiles) {
    apiPattern = 'scattered';
  } else {
    apiPattern = 'mixed';
  }

  // Issues
  if (apiPattern === 'scattered') {
    issues.push('API calls scattered across components. Consider creating a centralized API service layer.');
  }

  if (apiPattern === 'mixed') {
    issues.push('Mixed API patterns. Some calls centralized, some scattered. Standardize for consistency.');
  }

  if (duplicateEndpoints.length > 0) {
    issues.push(`Duplicate API endpoints detected: ${duplicateEndpoints.join(', ')}`);
  }

  if (clients.size > 1) {
    issues.push(`Multiple HTTP clients detected (${Array.from(clients).join(', ')}). Consider using one consistently.`);
  }

  if (clients.size === 0 && apiPattern !== 'none') {
    issues.push('API calls detected but no recognized HTTP client found. May be using a custom wrapper.');
  }

  // Check for missing error handling
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    if ((content.includes('fetch(') || content.includes('axios.')) && !content.includes('.catch') && !content.includes('try {')) {
      issues.push(`${path.relative(appPath, file)}: API calls without error handling.`);
    }
  }

  return {
    apiPattern,
    clients: Array.from(clients),
    duplicateEndpoints,
    issues,
  };
}