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
import type { GitWorkspace } from '@shared/types/gitWorkspace';

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
  scan_start: {
    input: { projectId: string };
    output: { sessionId: string };
  };
  scan_get_report: {
    input: { sessionId: string };
    output: ScanReport;
  };
  workspace_create: {
    input: { sessionId: string };
    output: GitWorkspace;
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
