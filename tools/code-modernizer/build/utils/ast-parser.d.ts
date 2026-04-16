import type { ParsedFile, ImportInfo, FunctionInfo } from '../types.js';
export declare function parseFile(filePath: string): ParsedFile | null;
export declare function extractImports(ast: unknown): ImportInfo[];
export declare function hasJSX(ast: unknown): boolean;
export declare function extractFunctions(ast: unknown): FunctionInfo[];
//# sourceMappingURL=ast-parser.d.ts.map