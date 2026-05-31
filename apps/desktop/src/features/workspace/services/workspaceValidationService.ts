/**
 * Workspace validation service (Phase R5 Step 14).
 *
 * Pure helpers that validate {@link WorkspaceState} against the Phase R5
 * "original project read-only" rules without touching the filesystem.
 *
 * The execution screen consults {@link validateWorkspaceState} before
 * unblocking any plan-step dispatch — if the persisted workspace is
 * missing required fields or accidentally points at the original
 * project path, execution stays blocked with a clear reason.
 *
 * Architectural rules
 * -------------------
 * - No React, no IPC, no filesystem access. Pure state-level checks.
 * - The Tauri layer is still the authoritative validator at creation
 *   time; this service only exists so the UI can keep state honest
 *   between renders / reloads without a round-trip.
 */
import { isPathInside } from './workspacePathService';
import type {
  WorkspacePackageManager,
  WorkspaceState,
  WorkspaceStateValidation,
  WorkspaceStrategy,
} from '../types/workspace.types';

const KNOWN_STRATEGIES: ReadonlySet<WorkspaceStrategy> =
  new Set<WorkspaceStrategy>(['git-worktree', 'copy']);

const KNOWN_PACKAGE_MANAGERS: ReadonlySet<WorkspacePackageManager> =
  new Set<WorkspacePackageManager>(['npm', 'yarn', 'pnpm', 'unknown']);

/**
 * Validate a persisted {@link WorkspaceState} against the Phase R5
 * acceptance rules.
 *
 * Returns a list of human-readable reasons rather than throwing so the
 * UI can render every issue at once. The function is intentionally
 * lenient about case-sensitivity (paths are compared verbatim — the
 * filesystem layer does the canonicalisation work) and never performs
 * IO.
 *
 * Caller contract: pass the full `WorkspaceState` plus the currently
 * approved `planId`. The plan-id check is the most common reason a
 * persisted workspace becomes invalid (the user regenerated the plan
 * after a workspace was created).
 */
export function validateWorkspaceState(
  state: WorkspaceState | undefined,
  approvedPlanId: string | undefined,
): WorkspaceStateValidation {
  const reasons: string[] = [];

  if (state === undefined) {
    reasons.push('Workspace state has not been persisted yet.');
    return { valid: false, reasons };
  }

  if (!isNonEmptyString(state.workspacePath)) {
    reasons.push('Workspace path is missing.');
  }
  if (!isNonEmptyString(state.originalProjectPath)) {
    reasons.push('Original project path is missing.');
  }
  if (
    isNonEmptyString(state.workspacePath) &&
    isNonEmptyString(state.originalProjectPath)
  ) {
    if (state.workspacePath === state.originalProjectPath) {
      reasons.push(
        'Workspace path equals the original project path — execution would mutate the source project.',
      );
    } else if (isPathInside(state.workspacePath, state.originalProjectPath)) {
      reasons.push(
        'Workspace path lives inside the original project — workspace must be sibling to the source.',
      );
    }
  }
  if (!isNonEmptyString(state.branchName)) {
    reasons.push('Migration branch name is missing.');
  }
  if (!KNOWN_STRATEGIES.has(state.strategy)) {
    reasons.push(`Unknown workspace strategy "${state.strategy}".`);
  }
  if (!isNonEmptyString(state.planId)) {
    reasons.push('Workspace is not bound to an approved plan id.');
  } else if (
    approvedPlanId !== undefined &&
    state.planId !== approvedPlanId
  ) {
    reasons.push(
      'Saved workspace was created for a different plan id. Recreate the workspace.',
    );
  }
  if (
    state.packageManager !== undefined &&
    !KNOWN_PACKAGE_MANAGERS.has(state.packageManager)
  ) {
    reasons.push(`Unknown package manager "${state.packageManager}".`);
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Convenience predicate. Returns `true` when the persisted workspace
 * passes every state-level rule for the supplied plan id.
 */
export function isValidWorkspaceState(
  state: WorkspaceState | undefined,
  approvedPlanId: string | undefined,
): boolean {
  return validateWorkspaceState(state, approvedPlanId).valid;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
