// ============================================================================
// TOOL #8: analyze-assets
// Detects large images/videos, assets inside src, unused assets
// ============================================================================

import * as path from 'path';
import { findAssetFiles, getFileSize, findSourceFiles, readFileContent } from '../utils/file-scanner.js';
import { DEFAULT_CONFIG } from '../types.js';
import type { AnalyzeAssetsOutput, AssetInfo, AnalyzerConfig } from '../types.js';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.avi', '.mov'];

export async function analyzeAssets(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeAssetsOutput> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const assetFiles = await findAssetFiles(appPath);
  const sourceFiles = await findSourceFiles(appPath);

  const largeAssets: AssetInfo[] = [];
  const assetIssues: string[] = [];
  const referencedAssets: Set<string> = new Set();

  // Analyze each asset
  for (const asset of assetFiles) {
    const sizeBytes = getFileSize(asset);
    const sizeKB = sizeBytes / 1024;
    const ext = path.extname(asset).toLowerCase();
    const relPath = path.relative(appPath, asset);

    let type = 'unknown';
    if (IMAGE_EXTENSIONS.includes(ext)) type = 'image';
    else if (VIDEO_EXTENSIONS.includes(ext)) type = 'video';
    else type = 'font';

    // Check if large
    if (type === 'image' && sizeKB > mergedConfig.largeAssetImageKB) {
      largeAssets.push({ file: relPath, sizeKB: Math.round(sizeKB * 10) / 10, type });
    } else if (type === 'video' && sizeKB > mergedConfig.largeAssetVideoMB * 1024) {
      largeAssets.push({ file: relPath, sizeKB: Math.round(sizeKB * 10) / 10, type });
    }
  }

  // Check which assets are referenced in source files
  for (const sourceFile of sourceFiles) {
    const content = readFileContent(sourceFile);
    if (!content) continue;

    for (const asset of assetFiles) {
      const basename = path.basename(asset);
      // Check if asset filename appears in source
      if (content.includes(basename)) {
        referencedAssets.add(asset);
      }
    }
  }

  // Find unused assets
  const unusedAssets: string[] = [];
  for (const asset of assetFiles) {
    if (!referencedAssets.has(asset)) {
      unusedAssets.push(path.relative(appPath, asset));
    }
  }

  // Check for assets inside src/
  const srcAssets = assetFiles.filter((f) => {
    const rel = path.relative(appPath, f);
    return rel.startsWith('src' + path.sep);
  });

  if (srcAssets.length > 0) {
    assetIssues.push(`${srcAssets.length} assets found inside src/. Consider moving to public/ for better caching.`);
  }

  // Issues
  if (largeAssets.length > 0) {
    assetIssues.push(`${largeAssets.length} large assets detected. Consider optimizing or using CDN.`);
  }

  if (unusedAssets.length > 0) {
    assetIssues.push(`${unusedAssets.length} potentially unused assets detected.`);
  }

  // Check for non-optimized formats
  const pngAssets = assetFiles.filter((f) => f.endsWith('.png'));
  if (pngAssets.length > 5) {
    assetIssues.push(`${pngAssets.length} PNG files found. Consider converting to WebP for better performance.`);
  }

  return {
    totalAssets: assetFiles.length,
    largeAssets: largeAssets.sort((a, b) => b.sizeKB - a.sizeKB),
    unusedAssets: unusedAssets.slice(0, 20), // Limit output
    assetIssues,
  };
}