/**
 * Project metadata service.
 *
 * Single source of truth for converting the raw Tauri payload (see
 * `commands::project::ReadMetadataOutput` in src-tauri) into the strongly
 * typed `ProjectMetadata` consumed by the UI.
 *
 * Architectural rules
 * -------------------
 * - No React imports. This module is pure logic so it stays trivially
 *   unit-testable and re-usable by the future scanner.
 * - No filesystem access. Reads are performed by the Tauri layer; this
 *   module only parses + interprets the result.
 * - Throws typed `ProjectMetadataReadError` so the calling hook can branch
 *   on the failure mode (cancelled vs invalid path vs IPC error).
 */

import { invokeCommand, type ProjectReadMetadataRaw } from '@shared/utils/commands';
import { runtimeConfig } from '@shared/config/runtime';

import type {
  PackageManager,
  ProjectMetadata,
  ProjectMetadataScripts,
} from '../types/projectSelection.types';

/**
 * Intermediate result returned by the read step. The validation service
 * inspects this to decide whether the project can move to `valid`.
 *
 * `packageJsonParseError` is only set when `package.json` exists but does
 * not parse as JSON — this is distinct from the file simply missing.
 */
export interface ProjectMetadataReadResult {
  readonly raw: ProjectReadMetadataRaw;
  readonly metadata: ProjectMetadata;
  readonly packageJsonParseError?: string;
  readonly packageJsonMissing: boolean;
}

export type ProjectMetadataReadErrorKind =
  | 'tauri-unavailable'
  | 'invalid-path'
  | 'ipc-error';

export class ProjectMetadataReadError extends Error {
  public readonly kind: ProjectMetadataReadErrorKind;

  public constructor(kind: ProjectMetadataReadErrorKind, message: string) {
    super(message);
    this.name = 'ProjectMetadataReadError';
    this.kind = kind;
  }
}

/**
 * Open the native folder picker. Returns `null` when the user cancels.
 *
 * Will throw `ProjectMetadataReadError('tauri-unavailable')` when called
 * outside the Tauri runtime — the UI must surface this clearly so users
 * understand the desktop shell is required.
 */
export async function pickProjectFolder(): Promise<string | null> {
  if (!runtimeConfig.isTauri) {
    throw new ProjectMetadataReadError(
      'tauri-unavailable',
      'Project selection is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }
  try {
    const result = await invokeCommand('project_pick_folder', {});
    return result.path ?? null;
  } catch (err) {
    throw new ProjectMetadataReadError(
      'ipc-error',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Read project metadata for the given absolute path.
 *
 * The returned `metadata` is partially populated even when the project is
 * later judged invalid (e.g. React missing). The `validateMetadata` service
 * decides whether to surface it to the user.
 */
export async function readProjectMetadata(
  path: string,
): Promise<ProjectMetadataReadResult> {
  if (!runtimeConfig.isTauri) {
    throw new ProjectMetadataReadError(
      'tauri-unavailable',
      'Project selection is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: ProjectReadMetadataRaw;
  try {
    raw = await invokeCommand('project_read_metadata', { path });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The Rust layer returns `InvalidInput` for unreadable / non-directory
    // paths. Map any error string mentioning "invalid input" or "not
    // accessible" to the typed `invalid-path` kind so the UI can render a
    // dedicated message instead of a generic IPC failure.
    if (/invalid input|not accessible|not a directory/i.test(message)) {
      throw new ProjectMetadataReadError('invalid-path', message);
    }
    throw new ProjectMetadataReadError('ipc-error', message);
  }

  return interpretRawMetadata(raw);
}

/**
 * Parse the raw payload into a `ProjectMetadata` plus secondary signals.
 *
 * Pure function — exported for unit tests. Never throws; surfaces parse
 * problems via `packageJsonParseError`.
 */
export function interpretRawMetadata(raw: ProjectReadMetadataRaw): ProjectMetadataReadResult {
  const packageJsonMissing = raw.packageJsonText == null;

  let parsed: PackageJsonShape | undefined;
  let packageJsonParseError: string | undefined;
  if (raw.packageJsonText != null) {
    try {
      const value: unknown = JSON.parse(raw.packageJsonText);
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        packageJsonParseError = 'package.json does not contain a JSON object.';
      } else {
        parsed = value as PackageJsonShape;
      }
    } catch (err) {
      packageJsonParseError = err instanceof Error ? err.message : String(err);
    }
  }

  const reactVersion = readDependencyVersion(parsed, 'react');
  const reactDomVersion = readDependencyVersion(parsed, 'react-dom');
  const hasTypeScript =
    raw.tsconfigPresent ||
    readDependencyVersion(parsed, 'typescript') !== undefined;

  const scripts = pickKnownScripts(parsed?.scripts);
  const packageManager = inferPackageManager(raw.lockFiles);

  const baseMetadata: ProjectMetadata = {
    path: raw.path,
    name: deriveProjectName(parsed?.name, raw.folderName),
    packageManager,
    isGitRepository: raw.isGitRepository,
    hasTypeScript,
    scripts,
    ...(reactVersion !== undefined ? { reactVersion } : {}),
    ...(reactDomVersion !== undefined ? { reactDomVersion } : {}),
    ...(raw.currentBranch != null && raw.currentBranch.length > 0
      ? { currentBranch: raw.currentBranch }
      : {}),
  };

  return {
    raw,
    metadata: baseMetadata,
    packageJsonMissing,
    ...(packageJsonParseError !== undefined ? { packageJsonParseError } : {}),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

interface PackageJsonShape {
  readonly name?: unknown;
  readonly dependencies?: Record<string, unknown>;
  readonly devDependencies?: Record<string, unknown>;
  readonly peerDependencies?: Record<string, unknown>;
  readonly optionalDependencies?: Record<string, unknown>;
  readonly scripts?: Record<string, unknown>;
}

const KNOWN_SCRIPT_KEYS = [
  'start',
  'dev',
  'build',
  'test',
  'lint',
  'typecheck',
] as const satisfies readonly (keyof ProjectMetadataScripts)[];

function deriveProjectName(rawName: unknown, folderName: string): string {
  if (typeof rawName === 'string') {
    const trimmed = rawName.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return folderName;
}

function readDependencyVersion(
  pkg: PackageJsonShape | undefined,
  depName: string,
): string | undefined {
  if (!pkg) return undefined;
  const buckets: ReadonlyArray<Record<string, unknown> | undefined> = [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ];
  for (const bucket of buckets) {
    if (!bucket) continue;
    const raw = bucket[depName];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return undefined;
}

function pickKnownScripts(
  scripts: Record<string, unknown> | undefined,
): ProjectMetadataScripts {
  if (!scripts) return {};
  const out: { -readonly [K in keyof ProjectMetadataScripts]?: string } = {};
  for (const key of KNOWN_SCRIPT_KEYS) {
    const value = scripts[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      out[key] = value.trim();
    }
  }
  return out;
}

/**
 * Pick a single package manager from the lock files we found. Multiple
 * lock files in the same project are surfaced as a warning by the
 * validation service; the priority order here mirrors what package
 * managers actually do at install time (npm > yarn > pnpm > bun).
 */
function inferPackageManager(lockFiles: ProjectReadMetadataRaw['lockFiles']): PackageManager {
  if (lockFiles.npm) return 'npm';
  if (lockFiles.yarn) return 'yarn';
  if (lockFiles.pnpm) return 'pnpm';
  if (lockFiles.bun) return 'bun';
  return 'unknown';
}

/**
 * Convenience helper: how many lock files were detected. Used by the
 * validation service to surface a "multiple lock files" warning.
 */
export function countLockFiles(lockFiles: ProjectReadMetadataRaw['lockFiles']): number {
  return [lockFiles.npm, lockFiles.yarn, lockFiles.pnpm, lockFiles.bun].filter(
    Boolean,
  ).length;
}
