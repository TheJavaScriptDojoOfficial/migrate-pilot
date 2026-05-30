import type { ScanReport } from '@features/scanner';
import type {
  ReactMigrationPhase,
  ReactMigrationTrack,
} from '@features/react19-migration';

export type MigrationPlanStatus =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'blocked'
  | 'error'
  | 'approved';

export type React19PlanStepStatus = MigrationPlanStepV2Status;
export type MigrationStepStatus = MigrationPlanStepV2Status;

export type MigrationPlanStepV2Risk = 'low' | 'medium' | 'high';
export type MigrationPlanStepV2Status =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'blocked';
export type MigrationPlanStepV2ExecutionType =
  | 'scripted'
  | 'codemod'
  | 'ai-assisted'
  | 'manual'
  | 'validation-only';
export type MigrationPlanStepV2Capability =
  | 'available'
  | 'not-yet-supported'
  | 'manual-only'
  | 'blocked';
export type MigrationPlanStepV2RollbackStrategy =
  | 'git-revert'
  | 'discard-worktree-changes'
  | 'manual';

/**
 * Planner/Executor contract V2.
 *
 * This execution-aware shape is the canonical step contract for R5+.
 * R4 `React19PlanStep` remains temporarily for backward compatibility while
 * Planner V2 and the migration-plan UI are migrated incrementally.
 */
export interface MigrationPlanStepV2 {
  readonly id: string;
  readonly order: number;
  readonly phase: ReactMigrationPhase;
  readonly track: ReactMigrationTrack;

  readonly title: string;
  readonly description: string;
  readonly reason: string;

  readonly risk: MigrationPlanStepV2Risk;
  readonly status: MigrationPlanStepV2Status;

  readonly issueCodes: readonly string[];

  readonly executionType: MigrationPlanStepV2ExecutionType;
  readonly executorKey?: string;

  readonly capability: MigrationPlanStepV2Capability;
  readonly blockedReason?: string;

  readonly requiresWorkspace: boolean;
  readonly requiresApprovalBeforeRun: boolean;
  readonly requiresValidationAfterRun: boolean;

  readonly expectedChangedFiles?: readonly string[];
  readonly expectedCommands?: readonly string[];
  readonly validationCommands?: readonly string[];

  readonly rollbackStrategy: MigrationPlanStepV2RollbackStrategy;

  /**
   * Backward-compatible execution metadata for the current execution engine.
   * Planner V2 owns `executionType`/`executorKey`; this field is derived.
   */
  readonly execution?: MigrationStepExecution;

  /**
   * Transitional fields retained so older UI/screens can keep rendering while
   * migrating to V2-only fields.
   */
  readonly sourceIssueCodes?: readonly string[];
  readonly expectedChangeScope?: readonly string[];
  readonly requiresHumanReview?: boolean;
  readonly canRunInExecution?: boolean;
}

export type React19PlanStepExecutionType = MigrationPlanStepV2ExecutionType;

export type MigrationStepExecutionMode =
  | 'scripted'
  | 'ai'
  | 'manual'
  | 'validation';

export interface MigrationStepExecution {
  readonly mode: MigrationStepExecutionMode;
  readonly executorKey?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export type MigrationStepRisk = MigrationPlanStepV2Risk;
export type MigrationStepCategory =
  | 'preflight'
  | 'validation'
  | 'bridge'
  | 'dependency'
  | 'tooling'
  | 'typescript'
  | 'api'
  | 'routing'
  | 'testing';

/** @deprecated Use `MigrationPlanStepV2`. */
export type React19PlanStep = MigrationPlanStepV2;

export type MigrationStep = React19PlanStep;

export interface React19ValidationStrategy {
  readonly baselineCommands: readonly string[];
  readonly perStepCommands: readonly string[];
  readonly finalCommands: readonly string[];
  readonly missingCommands: readonly string[];
}

export interface React19PlanPhaseSummary {
  readonly totalSteps: number;
  readonly highestRisk: MigrationPlanStepV2Risk;
  readonly executionTypes: readonly React19PlanStepExecutionType[];
}

export interface React19MigrationPlanV2 {
  readonly id: string;
  readonly version: 'react19-plan-v2';
  readonly scanReportId: string;
  readonly projectPath: string;
  readonly title: string;
  readonly summaryText: string;
  readonly sourceReactVersion: string;
  readonly targetReactVersion: '19';
  readonly sourceMajor: 16 | 17 | 18;
  readonly track: ReactMigrationTrack;
  readonly strategy: 'react-19-foundation-first';
  readonly generatedAt: string;
  readonly approvedAt?: string;
  readonly status: 'draft' | 'approved';
  readonly canExecute: boolean;
  readonly blockedReasons: readonly string[];
  readonly prerequisites: readonly string[];
  readonly steps: readonly React19PlanStep[];
  readonly skippedPhases: readonly {
    phase: ReactMigrationPhase;
    reason: string;
  }[];
  readonly phaseSummary: Readonly<Record<ReactMigrationPhase, React19PlanPhaseSummary>>;
  readonly validationStrategy: React19ValidationStrategy;
  readonly highestRisk: MigrationPlanStepV2Risk;
  readonly summary: {
    readonly title: string;
    readonly description: string;
    readonly totalSteps: number;
    readonly estimatedRisk: MigrationPlanStepV2Risk;
    readonly estimatedComplexity: 'small' | 'medium' | 'large';
    readonly approvalGates: number;
    readonly requiredSteps: number;
  };
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly assumptions: readonly string[];
  readonly recommendations: readonly string[];
}

export type MigrationPlan = React19MigrationPlanV2;

export type MigrationPlanErrorKind =
  | 'no-scan-report'
  | 'scan-incomplete'
  | 'generator-failed'
  | 'plan-blocked';

export interface MigrationPlanError {
  readonly kind: MigrationPlanErrorKind;
  readonly message: string;
}

export interface MigrationPlanGeneratorInput {
  readonly scanReport: ScanReport;
}

export interface MigrationPlanState {
  readonly status: MigrationPlanStatus;
  readonly plan?: MigrationPlan;
  readonly error?: MigrationPlanError;
  readonly approved: boolean;
  readonly scanReportId?: string;
}

export function isExecutableMigrationPlanStep(step: MigrationPlanStepV2): boolean {
  if (step.status !== 'pending') return false;
  if (step.capability === 'manual-only' || step.capability === 'blocked') return false;
  return true;
}
