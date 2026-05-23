export interface PackageInfo {
  name: string;
  version: string;
  path: string;
  type: 'app' | 'package' | 'tool' | 'config';
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  exports?: Record<string, unknown>;
}

export interface WorkspaceInfo {
  root: string;
  packageManager: string;
  turboVersion?: string;
  packages: PackageInfo[];
}
