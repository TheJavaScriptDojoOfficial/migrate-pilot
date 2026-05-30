import type { ValidationStatus } from '@shared/constants/stepStates';

export interface ValidationResult {
  readonly id: string;
  readonly stepId: string;
  readonly status: ValidationStatus;
  readonly command: string;
  readonly exitCode?: number;
  readonly durationMs?: number;
  /** Pointer to a file artifact (validation-log.txt). Never store full log inline. */
  readonly logArtifactPath?: string;
  readonly errorSummary?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}
