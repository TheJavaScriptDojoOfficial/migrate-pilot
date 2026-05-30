/**
 * Local capability classifier (generic execution framework).
 *
 * Pure function that decides — without an IPC round-trip — what badge a
 * plan step should display in the executable-step list. The Tauri
 * `execution_check_capability` command remains the source of truth for
 * the final "yes you can run this against the workspace" answer (it
 * additionally verifies workspace-local conditions like the presence of
 * package.json and the actual content the executor depends on).
 *
 * Architectural rules
 * -------------------
 * - The classifier NEVER decides executability from the plan step id.
 *   It always reads `step.execution` and consults the executor registry.
 * - For scripted steps backed by a registered + supported executor it
 *   reports `executable: false` with a "Capability not yet verified"
 *   reason. The IPC probe upgrades that to `executable: true` after the
 *   workspace check passes.
 * - For everything else (manual, AI, validation-only, unknown executor,
 *   missing metadata) it reports `executable: false` with a precise
 *   `badge` so the UI never has to parse `reason` strings to decide
 *   what icon / wording to show.
 */
import type { MigrationStepExecution } from '@features/migration-plan';

import type {
  ExecutionCapability,
  ExecutionCapabilityBadge,
} from '../types/execution.types';

import { getExecutorEntry } from './executorRegistry';

export interface CapabilityCandidateStep {
  readonly id: string;
  readonly execution?: MigrationStepExecution;
}

/**
 * Returns the local pre-classification for a plan step. The returned
 * `executable` flag is always `false` here — the real "yes" answer comes
 * from the Tauri command which can verify workspace state.
 */
export function localExecutionPreCapability(
  step: CapabilityCandidateStep,
): ExecutionCapability {
  return classifyStep(step);
}

/**
 * True when the local classifier believes the step *could* become
 * executable after a workspace-level capability check. Used by the
 * store to seed `pending` / `unsupported` per-step statuses.
 */
export function isPotentiallyExecutable(step: CapabilityCandidateStep): boolean {
  const cap = classifyStep(step);
  return cap.badge === 'scripted-unverified';
}

/* -------------------------------------------------------------------------- */
/* Internal classifier                                                        */
/* -------------------------------------------------------------------------- */

function classifyStep(step: CapabilityCandidateStep): ExecutionCapability {
  const execution = step.execution;

  if (execution === undefined) {
    return baseCap(step.id, 'missing-metadata', {
      reason:
        'This step has no execution metadata. The plan generator did not declare an executor for it; treat as a manual or follow-up step.',
    });
  }

  if (execution.mode === 'manual') {
    return baseCap(step.id, 'manual', {
      mode: execution.mode,
      reason:
        'This is a manual step. Migrate Pilot does not run anything for it; review and act on it yourself, then mark it as handled.',
    });
  }

  if (execution.mode === 'validation') {
    return baseCap(step.id, 'validation', {
      mode: execution.mode,
      reason:
        'This is a validation-only step. Validation execution is not implemented yet — run the listed commands manually for now.',
    });
  }

  if (execution.mode === 'ai') {
    return baseCap(step.id, 'ai-not-available', {
      mode: execution.mode,
      ...(execution.executorKey !== undefined
        ? { executorKey: execution.executorKey }
        : {}),
      reason: 'AI executor not available yet.',
    });
  }

  // mode === 'scripted'
  if (execution.executorKey === undefined) {
    return baseCap(step.id, 'unsupported-executor', {
      mode: execution.mode,
      reason:
        'This scripted step does not declare an executorKey. The execution engine cannot dispatch it.',
    });
  }

  const entry = getExecutorEntry(execution.executorKey);
  if (entry === undefined) {
    return baseCap(step.id, 'unsupported-executor', {
      mode: execution.mode,
      executorKey: execution.executorKey,
      reason: `Unknown executor "${execution.executorKey}". The execution engine cannot dispatch this step.`,
    });
  }

  if (!entry.supported) {
    return baseCap(step.id, 'unsupported-executor', {
      mode: execution.mode,
      executorKey: execution.executorKey,
      reason: `Executor "${entry.label}" is declared but not supported in this build yet.`,
    });
  }

  return baseCap(step.id, 'scripted-unverified', {
    mode: execution.mode,
    executorKey: execution.executorKey,
    reason:
      'Capability not yet verified. Click the step to verify against the workspace.',
  });
}

interface CapPartial {
  readonly mode?: ExecutionCapability['mode'];
  readonly executorKey?: string;
  readonly reason: string;
}

function baseCap(
  planStepId: string,
  badge: ExecutionCapabilityBadge,
  partial: CapPartial,
): ExecutionCapability {
  return {
    planStepId,
    executable: false,
    badge,
    ...(partial.mode !== undefined ? { mode: partial.mode } : {}),
    ...(partial.executorKey !== undefined
      ? { executorKey: partial.executorKey }
      : {}),
    reason: partial.reason,
  };
}
