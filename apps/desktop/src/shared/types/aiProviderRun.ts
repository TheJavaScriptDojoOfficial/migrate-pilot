export type AITaskKind =
  | 'PROJECT_SUMMARY'
  | 'SCAN_INTERPRETATION'
  | 'PLAN_GENERATION'
  | 'STEP_IMPLEMENTATION'
  | 'AI_REVIEW'
  | 'AUTO_FIX'
  | 'VALIDATION_ANALYSIS'
  | 'SUMMARY_GENERATION';

export type AIRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AIProviderRun {
  readonly id: string;
  readonly sessionId: string;
  readonly stepId?: string;
  readonly providerId: string;
  readonly model?: string;
  readonly task: AITaskKind;
  readonly status: AIRunStatus;
  readonly promptArtifactPath?: string;
  readonly responseArtifactPath?: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly costUsd?: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly errorMessage?: string;
}
