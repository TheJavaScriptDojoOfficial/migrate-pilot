export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'unknown';
export type BuildTool = 'cra' | 'vite' | 'webpack' | 'parcel' | 'rollup' | 'unknown';

export interface DependencySummary {
  readonly name: string;
  readonly version: string;
  readonly devOnly: boolean;
  /** Reason this dependency is flagged risky, if any. */
  readonly riskReason?: string;
}

export interface FileInventoryCounts {
  readonly js: number;
  readonly jsx: number;
  readonly ts: number;
  readonly tsx: number;
  readonly cssLike: number;
  readonly tests: number;
  readonly other: number;
}

export interface ScanReport {
  readonly id: string;
  readonly projectId: string;
  readonly generatedAt: string;
  readonly packageManager: PackageManager;
  readonly buildTool: BuildTool;
  readonly reactVersion?: string;
  readonly hasTypeScript: boolean;
  readonly hasTests: boolean;
  readonly hasLint: boolean;
  readonly routingLibrary?: string;
  readonly stateLibraries: readonly string[];
  readonly riskScore: number;
  readonly fileCounts: FileInventoryCounts;
  readonly riskyDependencies: readonly DependencySummary[];
  readonly recommendations: readonly string[];
}
