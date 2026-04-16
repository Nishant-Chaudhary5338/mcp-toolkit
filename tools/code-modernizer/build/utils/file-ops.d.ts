export declare function readFile(filePath: string): Promise<string | null>;
export declare function writeFile(filePath: string, content: string): Promise<boolean>;
export declare function renameFile(oldPath: string, newPath: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function listFiles(dirPath: string, extensions?: string[]): Promise<string[]>;
//# sourceMappingURL=file-ops.d.ts.map