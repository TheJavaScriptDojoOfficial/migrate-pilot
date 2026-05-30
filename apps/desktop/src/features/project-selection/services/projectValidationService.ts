/**
 * Project validation service.
 *
 * Pure rule engine that turns the read step's output into a
 * `ProjectSelectionState`. Lives separately from `projectMetadataService`
 * so the validation policy can be tested in isolation and re-used by the
 * future scanner without dragging in IPC concerns.
 *
 * Severity policy (Milestone 2)
 * -----------------------------
 * Errors  → block "Continue to Scan". The project is not migration-ready.
 *           - package.json missing
 *           - package.json invalid JSON
 *           - React not declared as a dependency
 *
 * Warnings → never block. Surfaced so the user knows what to expect later.
 *           - Not a Git repository
 *           - No lockfile detected
 *           - Unknown package manager
 *           - Multiple lockfiles detected
 *
 * Anything beyond these (deprecated deps, deep AST signals, …) is the
 * scanner's job, not project selection's.
 */

import { countLockFiles, type ProjectMetadataReadResult } from './projectMetadataService';
import type {
  ProjectSelectionState,
  ProjectValidationIssue,
} from '../types/projectSelection.types';

export function validateProjectRead(
  read: ProjectMetadataReadResult,
): ProjectSelectionState {
  const issues: ProjectValidationIssue[] = [];

  if (read.packageJsonMissing) {
    issues.push({
      type: 'error',
      code: 'PACKAGE_JSON_MISSING',
      title: 'package.json not found',
      description:
        "We could not find a package.json at the project root. Migrate Pilot only supports Node-based React projects.",
    });
  } else if (read.packageJsonParseError) {
    issues.push({
      type: 'error',
      code: 'PACKAGE_JSON_INVALID',
      title: 'package.json could not be parsed',
      description: `Found package.json but failed to parse it: ${read.packageJsonParseError}`,
    });
  } else if (read.metadata.reactVersion === undefined) {
    issues.push({
      type: 'error',
      code: 'REACT_NOT_FOUND',
      title: 'React dependency not detected',
      description:
        'React is not listed in dependencies, devDependencies, peerDependencies, or optionalDependencies of package.json.',
    });
  }

  if (!read.metadata.isGitRepository) {
    issues.push({
      type: 'warning',
      code: 'GIT_NOT_FOUND',
      title: 'Folder is not a Git repository',
      description:
        'Migrate Pilot prefers Git so changes can run inside an isolated worktree. You can continue, but workspace creation will require a Git repo later.',
    });
  }

  const lockfileCount = countLockFiles(read.raw.lockFiles);
  if (lockfileCount === 0) {
    issues.push({
      type: 'warning',
      code: 'LOCK_FILE_NOT_FOUND',
      title: 'No lockfile detected',
      description:
        'No package-lock.json, yarn.lock, pnpm-lock.yaml, or bun lockfile was found. Reproducible installs may not be possible until one is generated.',
    });
  } else if (lockfileCount > 1) {
    issues.push({
      type: 'warning',
      code: 'UNKNOWN_PACKAGE_MANAGER',
      title: 'Multiple lockfiles detected',
      description:
        'More than one lockfile was found. Migrate Pilot will prefer npm > yarn > pnpm > bun, but you should clean up to a single lockfile before running migrations.',
    });
  } else if (read.metadata.packageManager === 'unknown') {
    // Defensive: lockfileCount === 1 but inferPackageManager returned
    // unknown. Should not happen given current rules, but surface it.
    issues.push({
      type: 'warning',
      code: 'UNKNOWN_PACKAGE_MANAGER',
      title: 'Package manager could not be determined',
      description:
        'A lockfile was found but did not match any known package manager fingerprint.',
    });
  }

  const hasErrors = issues.some((i) => i.type === 'error');
  return {
    status: hasErrors ? 'invalid' : 'valid',
    metadata: read.metadata,
    issues,
  };
}

/**
 * Build an `error` state from a metadata read failure (path not accessible,
 * IPC failed, Tauri unavailable, etc.). Keeps the UI shape consistent with
 * the validation path so the rendering code only deals with one type.
 */
export function buildErrorState(
  issue: ProjectValidationIssue,
): ProjectSelectionState {
  return {
    status: 'error',
    issues: [issue],
  };
}

/**
 * Build a `valid` / `invalid` state directly from a vetted metadata
 * snapshot — used to rebuild state from persistence without re-running
 * the full read pipeline. Reserved for later milestones.
 */
export const INITIAL_PROJECT_SELECTION_STATE: ProjectSelectionState = {
  status: 'idle',
  issues: [],
};
