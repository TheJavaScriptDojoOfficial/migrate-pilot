import type { StepState } from '@shared/constants/stepStates';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface MigrationStep {
  readonly id: string;
  readonly sessionId: string;
  /** 1-indexed position within the plan. */
  readonly order: number;
  readonly title: string;
  readonly description: string;
  readonly state: StepState;
  readonly risk: RiskLevel;
  /** Files predicted to change. */
  readonly targetFiles: readonly string[];
  /** Validation command(s) to run after the step (e.g. "npm run typecheck"). */
  readonly validationCommands: readonly string[];
  /** Git commit SHA after a successful commit, if any. */
  readonly commitSha?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}
