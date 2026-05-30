/**
 * Local capability classifier (Milestone 6).
 *
 * Pure function that decides whether a plan step *type* could ever be
 * executed by the scripted executor that ships in this milestone. It is
 * cheaper than calling the Tauri command and is used to:
 *
 *   1. Render the "Executor not available for this step yet" badge in the
 *      step list immediately, without an IPC round-trip per step.
 *   2. Short-circuit the run button when the user picks an obviously
 *      unsupported step.
 *
 * The Tauri `execution_check_capability` command is still the source of
 * truth — it additionally verifies that the workspace `package.json`
 * actually contains node-sass before answering "yes". The local
 * classifier never returns `executable: true`; it only returns
 * `unsupported` for everything that is not the node-sass step.
 */
import type { ExecutionCapability } from '../types/execution.types';

/** Plan step id emitted by the rule-based generator for the node-sass swap. */
export const NODE_SASS_PLAN_STEP_ID = 'dependency.replace-node-sass';

/**
 * Returns the local pre-classification for a plan step. The returned
 * `executable` flag is always `false` here — the real "yes" answer comes
 * from the Tauri command which can verify workspace state.
 *
 * The caller can use this to immediately mark unsupported steps in the
 * step list without paying the IPC cost.
 */
export function localExecutionPreCapability(
  step: { readonly id: string },
): ExecutionCapability {
  if (step.id === NODE_SASS_PLAN_STEP_ID) {
    return {
      planStepId: step.id,
      executable: false,
      reason: 'Capability not yet verified. Click the step to verify against the workspace.',
    };
  }
  return {
    planStepId: step.id,
    executable: false,
    reason: 'Executor not available for this step yet',
  };
}

/**
 * True when this plan step is the only one Milestone 6 can execute.
 * Helper used by the screen to flag executable steps without exposing the
 * raw constant to call-sites. Accepts either a full {@link MigrationStep}
 * or any object that exposes an `id` field — keeps the store helpers free
 * of plan-feature imports.
 */
export function isPotentiallyExecutable(step: { readonly id: string }): boolean {
  return step.id === NODE_SASS_PLAN_STEP_ID;
}
