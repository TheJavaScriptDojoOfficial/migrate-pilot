/**
 * Milestone 4 — Migration Plan types.
 *
 * Why these live in the feature folder (and not `shared/types/`):
 *   `shared/types/migrationStep.ts` is an older sketch reserved for the
 *   orchestrator/execution layer (carries `sessionId`, `commitSha`,
 *   `targetFiles`, etc.). The Milestone 4 plan is a deterministic, in-memory,
 *   rule-based artifact produced from a ScanReport. Keeping its types feature-
 *   local keeps the planner self-contained and safe to evolve without
 *   destabilising the eventual execution-layer contracts.
 */
import type { ScanReport, ScanRiskLevel } from '@features/scanner';

/* -------------------------------------------------------------------------- */
/* State machine                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of the plan generation flow.
 *
 *   idle        → no plan generated yet for the current ScanReport
 *   generating  → generator is running (deterministic; usually <50ms)
 *   generated   → a draft plan exists and is awaiting human approval
 *   approved    → the user has approved the plan; downstream steps unlock
 *   failed      → generation hit an unrecoverable error (very rare for the
 *                 rule-based generator; reserved for guardrail violations)
 */
export type MigrationPlanStatus =
  | 'idle'
  | 'generating'
  | 'generated'
  | 'approved'
  | 'failed';

/**
 * Per-step lifecycle. Note this is *plan-time* status, not execution status —
 * the execution engine will track its own state later.
 */
export type MigrationStepStatus =
  | 'pending'
  | 'approved'
  | 'skipped'
  | 'blocked';

/** Risk classification of an individual plan step. */
export type MigrationStepRisk = 'low' | 'medium' | 'high';

/**
 * Category drives icon, color and grouping. The union is exhaustively
 * switched everywhere — add new values here when the planner grows.
 */
export type MigrationStepCategory =
  | 'workspace'
  | 'dependency'
  | 'config'
  | 'typescript'
  | 'source'
  | 'component'
  | 'routing'
  | 'state-management'
  | 'testing'
  | 'validation'
  | 'report';

/** Coarse complexity bucket inherited from the ScanReport. */
export type MigrationPlanComplexity = 'small' | 'medium' | 'large';

/* -------------------------------------------------------------------------- */
/* Plan + Step                                                                */
/* -------------------------------------------------------------------------- */

export interface MigrationStep {
  readonly id: string;
  /** 1-indexed position within the plan. Stable for the lifetime of the plan. */
  readonly order: number;
  readonly title: string;
  readonly description: string;
  readonly category: MigrationStepCategory;
  readonly risk: MigrationStepRisk;
  readonly status: MigrationStepStatus;
  /** A required step cannot be skipped; the user must address it (or abort). */
  readonly required: boolean;
  /** True when this step must not auto-execute without explicit human ack. */
  readonly approvalRequired: boolean;
  /** Short rationale visible in the UI. Always explains *why*. */
  readonly reason: string;
  /** Likely files or areas affected. Always heuristic. */
  readonly expectedFiles?: readonly string[];
  /** Coarse modules / areas the step touches (e.g. "components/", "routing"). */
  readonly expectedAreas?: readonly string[];
  /** Suggested validation commands to run after this step. */
  readonly validationCommands?: readonly string[];
  /** Ordered ids of steps that must complete first. */
  readonly dependsOn?: readonly string[];
}

/**
 * Headline summary surfaced at the top of the plan review.
 *
 * Derived from the steps array, not stored separately. The generator fills
 * these fields once at build time so the UI does not have to recompute
 * aggregates on every render.
 */
export interface MigrationPlanSummary {
  readonly title: string;
  readonly description: string;
  readonly totalSteps: number;
  readonly estimatedRisk: MigrationStepRisk;
  readonly estimatedComplexity: MigrationPlanComplexity;
  /** Number of steps requiring explicit human approval (high-risk gates). */
  readonly approvalGates: number;
  /** Number of required (non-optional) steps. */
  readonly requiredSteps: number;
}

/**
 * Strategy keyword. Reserved for future fan-out (e.g. `screen-flow-first`).
 * V1 only generates the foundation-first strategy.
 */
export type MigrationPlanStrategy = 'foundation-first';

/** Public lifecycle of a generated plan persisted to the store. */
export type MigrationPlanLifecycle = 'draft' | 'approved';

export interface MigrationPlan {
  readonly id: string;
  /** Links the plan back to the ScanReport it was generated from. */
  readonly scanReportId: string;
  readonly projectPath: string;
  readonly generatedAt: string;
  readonly strategy: MigrationPlanStrategy;
  readonly status: MigrationPlanLifecycle;
  /** ISO timestamp the user approved the plan. */
  readonly approvedAt?: string;
  readonly summary: MigrationPlanSummary;
  readonly steps: readonly MigrationStep[];
  /** Working assumptions the generator made (e.g. "package manager is npm"). */
  readonly assumptions: readonly string[];
  /** Hard blockers surfaced by the generator that should be addressed first. */
  readonly blockers: readonly string[];
  /** Soft warnings that do not block plan approval. */
  readonly warnings: readonly string[];
  /** Generator-side recommendations (distinct from scanner recommendations). */
  readonly recommendations: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type MigrationPlanErrorKind =
  | 'no-scan-report'
  | 'scan-incomplete'
  | 'generator-failed';

export interface MigrationPlanError {
  readonly kind: MigrationPlanErrorKind;
  readonly message: string;
}

/* -------------------------------------------------------------------------- */
/* Generator input                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The deterministic generator only depends on a finished ScanReport.
 * Extracted as its own interface so the generator service can be tested
 * with hand-built fixtures (no scanner/IPC required).
 */
export interface MigrationPlanGeneratorInput {
  readonly scanReport: ScanReport;
}

/* -------------------------------------------------------------------------- */
/* Store-shaped state                                                         */
/* -------------------------------------------------------------------------- */

export interface MigrationPlanState {
  readonly status: MigrationPlanStatus;
  readonly plan?: MigrationPlan;
  readonly error?: MigrationPlanError;
  /**
   * Captured at generation time so we can detect when the upstream ScanReport
   * has changed (and consequently invalidate the plan).
   */
  readonly scanReportId?: string;
}

/* Re-export the scanner risk level alias so external callers can map the
 * plan-level estimated risk to scanner level without crossing layers. */
export type { ScanRiskLevel };
