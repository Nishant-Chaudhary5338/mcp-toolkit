import { describe, it, expect, vi, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { readFile, writeFile, renameFile, listFiles } from './file-ops.js';

const tmpDir = path.join(os.tmpdir(), 'mcp-code-modernizer-test-' + process.pid);

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('readFile', () => {
  it('returns file content as string', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const file = path.join(tmpDir, 'test.ts');
    await fs.writeFile(file, 'const x = 1;');
    expect(await readFile(file)).toBe('const x = 1;');
  });

  it('returns null for a non-existent file', async () => {
    expect(await readFile('/does/not/exist.ts')).toBeNull();
  });
});

describe('writeFile', () => {
  it('creates the file and returns true', async () => {
    const file = path.join(tmpDir, 'sub', 'out.ts');
    const result = await writeFile(file, 'export {}');
    expect(result).toBe(true);
    expect(await fs.readFile(file, 'utf-8')).toBe('export {}');
  });
});

describe('renameFile', () => {
  it('renames an existing file', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const src = path.join(tmpDir, 'a.js');
    const dst = path.join(tmpDir, 'a.ts');
    await fs.writeFile(src, '');
    const result = await renameFile(src, dst);
    expect(result.success).toBe(true);
    await expect(fs.access(dst)).resolves.toBeUndefined();
  });

  it('returns failure for a non-existent source', async () => {
    const result = await renameFile('/no/such/file.js', '/no/such/file.ts');
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });
});

describe('listFiles', () => {
  it('returns all files in a directory recursively', async () => {
    const sub = path.join(tmpDir, 'src');
    await fs.mkdir(sub, { recursive: true });
    await fs.writeFile(path.join(sub, 'a.ts'), '');
    await fs.writeFile(path.join(sub, 'b.tsx'), '');
    const files = await listFiles(tmpDir);
    expect(files.length).toBe(2);
  });

  it('filters by extension when provided', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'a.ts'), '');
    await fs.writeFile(path.join(tmpDir, 'b.js'), '');
    const files = await listFiles(tmpDir, ['.ts']);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/a\.ts$/);
  });

  it('returns empty array for non-existent directory', async () => {
    const files = await listFiles('/no/such/dir');
    expect(files).toEqual([]);
  });
});
