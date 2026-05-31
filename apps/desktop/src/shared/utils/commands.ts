import { runtimeConfig } from '@shared/config/runtime';

/**
 * Typed bridge between the React UI and the Tauri command layer.
 *
 * IMPORTANT
 * - Every command name here must be allowlisted in `apps/desktop/src-tauri/`.
 * - The UI must NEVER pass arbitrary shell commands. Each command exposes a
 *   narrow, validated payload.
 * - When running outside Tauri (e.g. plain `vite dev`), invokeCommand throws
 *   so the UI fails loudly rather than silently using mock data.
 */

import type { Project } from '@shared/types/project';
import type { MigrationSession } from '@shared/types/migrationSession';
import type { MigrationStep } from '@shared/types/migrationStep';
import type { ScanReport } from '@shared/types/scanReport';
import type { ValidationResult } from '@shared/types/validationResult';

/**
 * Raw payload returned by the read-only `project_read_metadata` Tauri
 * command. The shape mirrors `ReadMetadataOutput` in `commands/project.rs`
 * exactly. The UI never consumes this directly — the
 * `projectMetadataService` parses it into the strongly-typed
 * `ProjectMetadata` exposed by the project-selection feature.
 */
export interface ProjectReadMetadataRaw {
  readonly path: string;
  readonly folderName: string;
  readonly packageJsonText: string | null;
  readonly lockFiles: {
    readonly npm: boolean;
    readonly yarn: boolean;
    readonly pnpm: boolean;
    readonly bun: boolean;
  };
  readonly tsconfigPresent: boolean;
  readonly isGitRepository: boolean;
  readonly currentBranch: string | null;
}

/**
 * Raw payload returned by the read-only `project_scan` Tauri command.
 *
 * Mirrors `ProjectScanRaw` in `commands/project.rs`. The UI never consumes
 * this directly — the scanner feature converts it into the strongly-typed
 * {@link import('@features/scanner/types/scanner.types').ScanReport} via
 * `scannerService.buildScanReport`.
 */
export interface ProjectScanRaw {
  readonly path: string;
  readonly folderName: string;
  readonly packageJsonText: string | null;
  readonly lockFiles: {
    readonly npm: boolean;
    readonly yarn: boolean;
    readonly pnpm: boolean;
    readonly bun: boolean;
  };
  readonly tsconfigPresent: boolean;
  /**
   * Raw `tsconfig.json` text, when present and within the read cap.
   * `null` when missing or oversized — used by the React 19 compatibility
   * scanner to inspect `compilerOptions.jsx`.
   */
  readonly tsconfigText?: string | null;
  /**
   * Whether any Babel root config file exists. Always populated by the
   * current scanner; marked optional to keep older serialised payloads
   * type-compatible.
   */
  readonly babelConfigPresent?: boolean;
  /** Names of the Babel config files actually found at the project root. */
  readonly babelConfigFiles?: readonly string[];
  /** Whether any `webpack.config.{js,cjs,ts}` exists at the project root. */
  readonly webpackConfigPresent?: boolean;
  /** Names of the webpack config files actually found. */
  readonly webpackConfigFiles?: readonly string[];
  readonly isGitRepository: boolean;
  readonly currentBranch: string | null;
  /** `null` when git cleanliness could not be determined safely. */
  readonly gitClean: boolean | null;
  readonly source: ProjectScanSourceRaw;
  readonly limits: ProjectScanLimitsRaw;
  readonly durationMs: number;
}

export interface ProjectScanSourceRaw {
  readonly totalFilesScanned: number;
  readonly jsFiles: number;
  readonly jsxFiles: number;
  readonly tsFiles: number;
  readonly tsxFiles: number;
  readonly styleFiles: number;
  /** Subset of `styleFiles`: number of `.scss` files. */
  readonly scssFiles?: number;
  /** Subset of `styleFiles`: number of `.sass` files. */
  readonly sassFiles?: number;
  readonly jsonFiles: number;
  readonly classComponentIndicators: number;
  readonly deprecatedLifecycleIndicators: readonly ProjectScanLifecycleRaw[];
  readonly reactDomRenderUsages: number;
  /** Files calling `ReactDOM.hydrate(`. */
  readonly reactDomHydrateUsages?: number;
  /** Files calling `unmountComponentAtNode(`. */
  readonly unmountComponentAtNodeUsages?: number;
  /** Files referencing `unstable_renderSubtreeIntoContainer`. */
  readonly unstableRenderSubtreeUsages?: number;
  /** Files calling `React.createFactory(`. */
  readonly createFactoryUsages?: number;
  /** Files referencing any form of `findDOMNode`. */
  readonly findDomNodeUsages?: number;
  /** Files containing string-ref syntax (`ref="something"`). */
  readonly stringRefUsages?: number;
  readonly legacyContextIndicators: number;
  readonly routerUsageIndicators: number;
  /** Files importing from `enzyme`. */
  readonly enzymeUsageIndicators?: number;
  /** Files containing `.defaultProps` assignments. */
  readonly defaultPropsUsages?: number;
  /** Sample paths (up to 5) with `.defaultProps` assignments. */
  readonly defaultPropsSampleFiles?: readonly string[];
  /** Files containing `.propTypes` assignments. */
  readonly propTypesUsages?: number;
  /** Sample paths (up to 5) with `.propTypes` assignments. */
  readonly propTypesSampleFiles?: readonly string[];
  readonly scannedDirectories: readonly string[];
  readonly skippedDirectories: readonly string[];
}

export interface ProjectScanLifecycleRaw {
  readonly method: string;
  readonly fileCount: number;
  readonly exampleFile: string | null;
}

export interface ProjectScanLimitsRaw {
  readonly maxFiles: number;
  readonly maxFileBytes: number;
  readonly filesSkippedTooLarge: number;
  readonly truncated: boolean;
}

/**
 * Raw payload returned by the read-only `workspace_preflight` Tauri command
 * (Milestone 5). Mirrors `WorkspacePreflightRaw` in
 * `src-tauri/src/commands/workspace.rs`. The UI never consumes this
 * directly — the workspace feature converts it into the strongly-typed
 * {@link import('@features/workspace').WorkspacePreflight} via
 * `workspaceService.runPreflight`.
 */
export interface WorkspaceIssueRaw {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
  readonly detail?: string;
}

export interface WorkspacePreflightRaw {
  readonly sourcePath: string;
  readonly projectName: string;
  readonly isGitRepository: boolean;
  readonly gitAvailable: boolean;
  readonly currentBranch?: string | null;
  /** `"clean" | "dirty" | "unknown"`. */
  readonly gitCleanliness: string;
  /** `"git-worktree" | "copy"`. */
  readonly recommendedStrategy: string;
  readonly fallbackAvailable: boolean;
  readonly proposedBranchName: string;
  readonly proposedWorkspacePath: string;
  readonly blockers: readonly WorkspaceIssueRaw[];
  readonly warnings: readonly WorkspaceIssueRaw[];
}

export interface WorkspaceCommandLogRaw {
  readonly command: string;
  /** `"passed" | "failed"`. */
  readonly status: string;
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface WorkspaceCreationResultRaw {
  readonly id: string;
  readonly sourcePath: string;
  readonly workspacePath: string;
  /** `"git-worktree" | "copy"`. */
  readonly strategy: string;
  readonly branchName?: string | null;
  readonly createdAt: string;
  readonly commandLogs: readonly WorkspaceCommandLogRaw[];
}

/**
 * Phase R5 — Session artifact write (workspace.json + plan-snapshot.json).
 *
 * Mirrors `WorkspaceArtifactWriteResultRaw` in
 * `src-tauri/src/commands/workspace.rs`. The bridge accepts an
 * allowlist of artifact names and never writes outside the workspace.
 */
export interface WorkspaceArtifactEntryRaw {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly bytesWritten: number;
}

export interface WorkspaceArtifactWriteResultRaw {
  readonly workspacePath: string;
  readonly artifacts: readonly WorkspaceArtifactEntryRaw[];
}

/** Allowed names for {@link CommandPayloads.workspace_write_session_artifact}. */
export type WorkspaceSessionArtifactName =
  | 'workspace.json'
  | 'plan-snapshot.json';

export interface WorkspaceSessionArtifactInputRaw {
  readonly name: WorkspaceSessionArtifactName;
  readonly contents: string;
}

/**
 * Raw payloads returned by the Milestone 6 execution commands.
 *
 * Mirrors the Rust types in `src-tauri/src/commands/execution.rs`. The UI
 * never consumes these directly — the execution feature converts them into
 * the strongly-typed
 * {@link import('@features/execution').ExecutionStepRun} /
 * {@link import('@features/execution').ExecutionCapability} via
 * `executionService`.
 */
export interface ExecutionRequestRaw {
  /** `"scripted" | "ai" | "manual" | "validation"`. */
  readonly mode: string;
  /** Generic executor key (e.g. `"package-json-dependency-update"`). */
  readonly executorKey?: string;
  /** Free-form executor params; each executor validates its own schema. */
  readonly params?: Record<string, unknown>;
}

export interface ExecutionCapabilityRaw {
  readonly planStepId: string;
  readonly executable: boolean;
  /** Coarse classification used by the UI. See `ExecutionCapabilityBadge`. */
  readonly badge?: string | null;
  /** `"scripted" | "ai" | "manual" | "validation"` (when known). */
  readonly mode?: string | null;
  /** Generic executor key declared by the plan step (when known). */
  readonly executorKey?: string | null;
  readonly reason: string;
  readonly missingRequirements?: readonly string[];
}

export interface ExecutionLogEntryRaw {
  readonly timestamp: string;
  /** `"info" | "warning" | "error" | "success"`. */
  readonly level: string;
  readonly message: string;
  readonly detail?: string | null;
}

export interface ExecutionChangedFileRaw {
  readonly path: string;
  /** `"modified" | "created" | "deleted"`. */
  readonly changeType: string;
  readonly summary: string;
}

export interface ExecutionErrorRaw {
  readonly code: string;
  readonly message: string;
  readonly detail?: string | null;
}

export interface ExecutionStepRunRaw {
  readonly id: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle: string;
  readonly workspacePath: string;
  /** `"running" | "completed" | "failed"`. */
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt?: string | null;
  /** Generic executor key that produced this run. */
  readonly executorKey: string;
  /** `"scripted" | "ai" | "manual" | "validation"`. */
  readonly mode: string;
  readonly changedFiles: readonly ExecutionChangedFileRaw[];
  readonly logs: readonly ExecutionLogEntryRaw[];
  readonly error?: ExecutionErrorRaw | null;
  /**
   * True when the captured run requires the user to manually verify
   * the outcome before treating the step as done. Set by executors
   * that intentionally do not auto-verify (manual-instruction
   * checklists, AI-assisted bounded edits). Optional/null when the
   * source executor did not emit the flag.
   */
  readonly requiresManualVerification?: boolean | null;
}

/**
 * Raw payloads returned by the Milestone 7 diff review commands.
 *
 * Mirrors the Rust types in `src-tauri/src/commands/diff.rs`. The UI
 * never consumes these directly — the diff-review feature converts them
 * into the strongly-typed
 * {@link import('@features/diff-review').DiffReviewSession} /
 * {@link import('@features/diff-review').DiffReviewDecision} via
 * `diffReviewService`.
 */
export interface DiffCommandLogRaw {
  readonly command: string;
  /** `"passed" | "failed"`. */
  readonly status: string;
  readonly stdout?: string | null;
  readonly stderr?: string | null;
}

export interface DiffFileRaw {
  readonly path: string;
  /** `"modified" | "created" | "deleted" | "renamed" | "unknown"`. */
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly diffText: string;
  readonly isBinary?: boolean | null;
  readonly tooLarge?: boolean | null;
}

export interface DiffReviewRaw {
  readonly workspacePath: string;
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly branchName?: string | null;
  readonly loadedAt: string;
  readonly files: readonly DiffFileRaw[];
  readonly commandLogs: readonly DiffCommandLogRaw[];
}

export interface DiffReviewDecisionRaw {
  /** `"approved" | "rejected"`. */
  readonly decision: string;
  readonly workspacePath: string;
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly decidedAt: string;
  readonly revertedFiles: readonly string[];
  readonly manualCleanupFiles: readonly string[];
  readonly commandLogs: readonly DiffCommandLogRaw[];
}

export interface CommandPayloads {
  project_select: {
    input: { suggestedPath?: string };
    output: Project;
  };
  project_pick_folder: {
    input: Record<string, never>;
    output: { path: string | null };
  };
  project_read_metadata: {
    input: { path: string };
    output: ProjectReadMetadataRaw;
  };
  project_scan: {
    input: { path: string };
    output: ProjectScanRaw;
  };
  scan_start: {
    input: { projectId: string };
    output: { sessionId: string };
  };
  scan_get_report: {
    input: { sessionId: string };
    output: ScanReport;
  };
  workspace_preflight: {
    input: { sourcePath: string; projectName: string };
    output: WorkspacePreflightRaw;
  };
  workspace_create: {
    input: {
      sourcePath: string;
      workspacePath: string;
      branchName: string;
      strategy: 'git-worktree' | 'copy';
    };
    output: WorkspaceCreationResultRaw;
  };
  workspace_write_session_artifact: {
    input: {
      workspacePath: string;
      artifacts: readonly WorkspaceSessionArtifactInputRaw[];
    };
    output: WorkspaceArtifactWriteResultRaw;
  };
  execution_check_capability: {
    input: {
      workspacePath: string;
      sourcePath: string;
      planStepId: string;
      stepTitle: string;
      execution: ExecutionRequestRaw;
    };
    output: ExecutionCapabilityRaw;
  };
  execution_run_step: {
    input: {
      workspacePath: string;
      sourcePath: string;
      planId: string;
      planStepId: string;
      stepTitle: string;
      execution: ExecutionRequestRaw;
    };
    output: ExecutionStepRunRaw;
  };
  diff_load: {
    input: {
      workspacePath: string;
      sourcePath: string;
      executionRunId: string;
      planId: string;
      planStepId: string;
      changedFiles: readonly string[];
    };
    output: DiffReviewRaw;
  };
  diff_approve: {
    input: {
      workspacePath: string;
      executionRunId: string;
      planId: string;
      planStepId: string;
    };
    output: DiffReviewDecisionRaw;
  };
  diff_reject: {
    input: {
      workspacePath: string;
      sourcePath: string;
      executionRunId: string;
      planId: string;
      planStepId: string;
      changedFiles: readonly string[];
    };
    output: DiffReviewDecisionRaw;
  };
  step_execute: {
    input: { sessionId: string; stepId: string };
    output: MigrationStep;
  };
  step_validate: {
    input: { sessionId: string; stepId: string };
    output: ValidationResult;
  };
  artifact_read_text: {
    input: { sessionId: string; relativePath: string };
    output: { content: string; truncated: boolean };
  };
  session_get: {
    input: { sessionId: string };
    output: MigrationSession;
  };
}

export type CommandName = keyof CommandPayloads;

/**
 * Invoke a Tauri command with a typed payload and typed response.
 *
 * The actual call to `@tauri-apps/api/core::invoke` is loaded lazily so
 * the bundle works in a browser context (Vite dev preview) for storybook /
 * component playgrounds. In that mode, calls throw immediately.
 */
export async function invokeCommand<TName extends CommandName>(
  name: TName,
  payload: CommandPayloads[TName]['input'],
): Promise<CommandPayloads[TName]['output']> {
  if (!runtimeConfig.isTauri) {
    throw new Error(
      `Tauri command "${name}" called outside of a Tauri runtime. ` +
        'Run the app via `npm run tauri:dev` to enable backend commands.',
    );
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<CommandPayloads[TName]['output']>(name, payload as Record<string, unknown>);
}
