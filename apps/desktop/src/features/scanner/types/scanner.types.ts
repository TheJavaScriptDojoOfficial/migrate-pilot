/**
 * Milestone 3 — Scanner types.
 *
 * Why these live in a feature folder, not in `shared/types/`:
 *   `shared/types/scanReport.ts` holds an older sketch reserved for the
 *   orchestrator-driven scan path (streamed from a Python sidecar). The
 *   Milestone 3 scanner is a deterministic, read-only Rust pass that runs
 *   synchronously over the canonicalised project path and produces the
 *   structures below. Keeping these in `features/scanner/types/` makes the
 *   feature self-contained and safe to refactor without touching the rest
 *   of the codebase.
 */

import type { PackageManager } from '@features/project-selection';
import type {
  React19CompatibilityReport,
  React19MigrationContext,
  React19ReadinessReportViewModel,
  React19RiskEngineResult,
  React19SupportStatus,
} from '@features/react19-migration';

/* -------------------------------------------------------------------------- */
/* State machine                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of a scan attempt.
 *
 *   idle       → no scan has run yet for the current project
 *   scanning   → IPC in flight; raw walker still running in Rust
 *   completed  → ScanReport is available
 *   failed     → IPC or parsing failure (path inaccessible, JSON broken, …)
 */
export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'failed';

/* -------------------------------------------------------------------------- */
/* Report value types                                                         */
/* -------------------------------------------------------------------------- */

export type ScanRiskLevel = 'low' | 'medium' | 'high';

export type ScanIssueSeverity = 'blocker' | 'warning' | 'info';

/**
 * Stable issue codes the UI can branch on (icon, copy, follow-up action).
 * Add a new code here whenever a new rule is introduced — the union is
 * exhaustively switched in the risk service.
 */
export type ScanIssueCode =
  | 'PACKAGE_JSON_MISSING'
  | 'PACKAGE_JSON_INVALID'
  | 'REACT_NOT_FOUND'
  | 'NODE_SASS_DEPRECATED'
  | 'MISSING_LOCK_FILE'
  | 'MULTIPLE_LOCK_FILES'
  | 'MISSING_BUILD_SCRIPT'
  | 'MISSING_TEST_SCRIPT'
  | 'MISSING_LINT_SCRIPT'
  | 'MISSING_TYPECHECK_SCRIPT'
  | 'NO_TYPESCRIPT'
  | 'CLASS_COMPONENTS_PRESENT'
  | 'DEPRECATED_LIFECYCLES_PRESENT'
  | 'REACT_DOM_RENDER_USAGE'
  | 'LEGACY_CONTEXT_API'
  | 'OUTDATED_REACT_VERSION'
  | 'SCAN_TRUNCATED'
  | 'NO_SOURCE_FILES';

export interface ScanIssue {
  readonly severity: ScanIssueSeverity;
  readonly code: ScanIssueCode;
  readonly title: string;
  readonly description: string;
  /**
   * Optional pointer at the file/path that triggered the issue. Used when
   * the rule is anchored to a specific file (e.g. `package.json`).
   */
  readonly ref?: string;
}

/* -------------------------------------------------------------------------- */
/* Project info                                                               */
/* -------------------------------------------------------------------------- */

export interface ScanProjectInfo {
  readonly path: string;
  readonly name: string;
  readonly isGitRepository: boolean;
  readonly currentBranch?: string;
  /** "unknown" when the scanner could not safely determine cleanliness. */
  readonly gitClean: 'clean' | 'dirty' | 'unknown';
  readonly hasTypeScript: boolean;
  /** Crude bucket: small / medium / large based on source-file count. */
  readonly complexity: 'small' | 'medium' | 'large';
  /** Wall-clock duration of the scan in milliseconds. */
  readonly durationMs: number;
}

/* -------------------------------------------------------------------------- */
/* Dependency report                                                          */
/* -------------------------------------------------------------------------- */

export interface DeprecatedPackage {
  readonly name: string;
  readonly version: string;
  readonly reason: string;
  readonly recommendedReplacement?: string;
}

export interface DependencyReport {
  readonly reactVersion?: string;
  readonly reactDomVersion?: string;
  readonly reactScriptsVersion?: string;
  readonly reactMajor?: number;
  readonly packageManager: PackageManager;
  readonly lockFiles: readonly string[];
  readonly deprecatedPackages: readonly DeprecatedPackage[];
  readonly styling: {
    readonly usesNodeSass: boolean;
    readonly nodeSassVersion?: string;
    readonly usesSass: boolean;
    readonly sassVersion?: string;
  };
  readonly routing: {
    readonly packageName?: string;
    readonly version?: string;
  };
  readonly stateManagement: {
    readonly redux?: string;
    readonly reduxToolkit?: string;
    readonly mobx?: string;
    readonly zustand?: string;
  };
  readonly testing: {
    readonly jest?: string;
    readonly testingLibraryReact?: string;
    readonly cypress?: string;
    readonly playwright?: string;
    readonly vitest?: string;
  };
  readonly tooling: {
    readonly typescript?: string;
    readonly eslint?: string;
    readonly prettier?: string;
  };
}

/* -------------------------------------------------------------------------- */
/* Source analysis                                                            */
/* -------------------------------------------------------------------------- */

export interface DeprecatedLifecycleUsage {
  readonly method: string;
  readonly fileCount: number;
  readonly exampleFile?: string;
}

export interface SourceAnalysisReport {
  readonly totalFilesScanned: number;
  readonly jsFiles: number;
  readonly jsxFiles: number;
  readonly tsFiles: number;
  readonly tsxFiles: number;
  readonly styleFiles: number;
  readonly jsonFiles: number;
  readonly classComponentIndicators: number;
  readonly deprecatedLifecycleIndicators: readonly DeprecatedLifecycleUsage[];
  readonly reactDomRenderUsages: number;
  readonly legacyContextIndicators: number;
  readonly routerUsageIndicators: number;
  readonly scannedDirectories: readonly string[];
  readonly skippedDirectories: readonly string[];
  readonly truncated: boolean;
  readonly filesSkippedTooLarge: number;
  /** Convenience: true when no source files were found. */
  readonly isEmpty: boolean;
}

/* -------------------------------------------------------------------------- */
/* Scripts report                                                             */
/* -------------------------------------------------------------------------- */

export interface ScriptReport {
  readonly hasStart: boolean;
  readonly hasDev: boolean;
  readonly hasBuild: boolean;
  readonly hasTest: boolean;
  readonly hasLint: boolean;
  readonly hasTypecheck: boolean;
  readonly raw: Readonly<Record<string, string>>;
}

/* -------------------------------------------------------------------------- */
/* Risk + recommendations                                                     */
/* -------------------------------------------------------------------------- */

export interface RiskReport {
  /** 0–100. Higher = better readiness. */
  readonly score: number;
  readonly level: ScanRiskLevel;
  readonly blockers: readonly ScanIssue[];
  readonly warnings: readonly ScanIssue[];
  readonly infos: readonly ScanIssue[];
}

export interface Recommendation {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly priority: 'high' | 'medium' | 'low';
  /** Optional related issue codes that motivated this recommendation. */
  readonly relatedCodes?: readonly ScanIssueCode[];
}

/* -------------------------------------------------------------------------- */
/* Top-level report                                                           */
/* -------------------------------------------------------------------------- */

export interface ScanReport {
  readonly id: string;
  readonly projectPath: string;
  readonly generatedAt: string;
  readonly projectInfo: ScanProjectInfo;
  readonly dependencies: DependencyReport;
  readonly sourceAnalysis: SourceAnalysisReport;
  readonly scripts: ScriptReport;
  readonly risks: RiskReport;
  readonly recommendations: readonly Recommendation[];
  /**
   * React 19 migration context — present iff the project is a supported
   * React 16 / 17 / 18 source. Consumers should fall back to
   * `react19SupportStatus.reason` when this is absent.
   *
   * Optional for backward compatibility with consumers compiled against
   * the pre-R2 `ScanReport` shape; the current scanner always populates
   * it together with `react19SupportStatus`.
   */
  readonly react19MigrationContext?: React19MigrationContext;
  /**
   * Structured outcome describing whether a React 19 migration can be
   * planned for this project. Always populated by the current scanner;
   * marked optional so older serialised reports still satisfy the type.
   */
  readonly react19SupportStatus?: React19SupportStatus;
  /**
   * React 19 compatibility report (R2 step 3). Generic, deterministic
   * compatibility scan covering React/React-DOM versions, build tooling,
   * deprecated React APIs, lifecycle methods, component patterns,
   * routing, testing, deprecated dependencies, peer-risk signals,
   * Sass/SCSS, package manager health, and validation script
   * availability.
   *
   * Optional so older serialised reports remain type-compatible. The
   * current scanner always populates it.
   */
  readonly react19CompatibilityReport?: React19CompatibilityReport;
  /**
   * React 19 readiness report view model (R2 step 5). Structured report
   * output for the Step 3 UI and session persistence. Optional for older
   * serialised reports — callers can rebuild via
   * `buildReact19ReadinessReportViewModel`.
   */
  readonly react19ReadinessReport?: React19ReadinessReportViewModel;
  /**
   * React 19 risk/recommendation engine output (R3). Planner-consumable
   * normalized mapping from issue code → phase/risk/recommendation/
   * execution capability/validation requirements.
   *
   * Optional for backward compatibility with persisted pre-R3 reports.
   */
  readonly react19RiskEngine?: React19RiskEngineResult;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type ScanErrorKind =
  | 'tauri-unavailable'
  | 'invalid-path'
  | 'ipc-error'
  | 'no-project-selected'
  | 'parse-error';

export interface ScanError {
  readonly kind: ScanErrorKind;
  readonly message: string;
}

/* -------------------------------------------------------------------------- */
/* Store-shaped state                                                         */
/* -------------------------------------------------------------------------- */

export interface ScannerState {
  readonly status: ScanStatus;
  readonly report?: ScanReport;
  readonly error?: ScanError;
  /** ISO timestamp when the most recent scan attempt started. */
  readonly startedAt?: string;
}
