/**
 * Migration plan risk service.
 *
 * Pure aggregation of per-step risks into a plan-level risk estimate plus
 * a small helper to translate scanner risk findings into plan blockers /
 * warnings copy that is friendly to display in the UI.
 *
 * Aggregation policy (deterministic):
 *
 *   - Any step at `high` risk    → plan risk is `high`.
 *   - 2+ steps at `medium` risk  → plan risk is `medium`.
 *   - Single `medium` step + the scanner risk is `medium`/`high`
 *                                → plan risk is `medium` (scanner amplifies).
 *   - Otherwise                  → plan risk is `low`.
 *
 * The scanner's own `risks.level` is used as a *floor* — the plan can never
 * be safer than the scanner thinks the project is.
 */
import type { RiskReport } from '@features/scanner';

import type {
  MigrationStep,
  MigrationStepRisk,
} from '../types/migrationPlan.types';

export function estimatePlanRisk(
  steps: readonly MigrationStep[],
  scannerRiskLevel: RiskReport['level'],
): MigrationStepRisk {
  let highs = 0;
  let mediums = 0;
  for (const step of steps) {
    if (step.risk === 'high') highs += 1;
    else if (step.risk === 'medium') mediums += 1;
  }

  if (highs > 0) return 'high';
  if (mediums >= 2) return 'medium';
  if (mediums === 1 && (scannerRiskLevel === 'medium' || scannerRiskLevel === 'high')) {
    return 'medium';
  }

  // Floor to scanner level so a "clean" plan over a high-risk scan still
  // reads as elevated.
  if (scannerRiskLevel === 'high') return 'high';
  if (scannerRiskLevel === 'medium') return 'medium';
  return 'low';
}

/**
 * Count the number of approval gates in a plan — i.e. steps whose
 * `requiresApprovalBeforeRun` flag is true. Surfaced in the plan summary so the user
 * can see at a glance how many human checkpoints to expect.
 */
export function countApprovalGates(steps: readonly MigrationStep[]): number {
  let count = 0;
  for (const step of steps) {
    if (step.requiresApprovalBeforeRun) count += 1;
  }
  return count;
}

/**
 * Count required steps (i.e. cannot be skipped at execution time).
 */
export function countRequiredSteps(steps: readonly MigrationStep[]): number {
  let count = 0;
  for (const step of steps) {
    if (step.status !== 'skipped') count += 1;
  }
  return count;
}

/**
 * Convert scanner blocker issues into short, human-readable plan blocker
 * strings. Plan blockers are surfaced near the top of the plan review to
 * make the user aware that some issues must be addressed before execution.
 */
export function deriveBlockers(scannerRisks: RiskReport): readonly string[] {
  return scannerRisks.blockers.map((issue) => `${issue.title} — ${issue.description}`);
}

/**
 * Convert scanner warning issues into short warning strings. Subset only:
 * keep the most actionable ones to avoid drowning the plan view.
 */
export function deriveWarnings(scannerRisks: RiskReport): readonly string[] {
  const out: string[] = [];
  for (const warning of scannerRisks.warnings) {
    out.push(`${warning.title}.`);
  }
  return out;
}
