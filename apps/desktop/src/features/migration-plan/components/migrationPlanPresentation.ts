/**
 * Shared presentational constants for migration plan components.
 *
 * Centralising category labels, icons, and risk badge tones keeps the
 * components free of magic strings — when a new category is added to
 * `MigrationStepCategory`, the TypeScript switch in this module forces
 * every visual mapping to be updated.
 */
import type { BadgeTone } from '@shared/ui/Badge';
import type { IconName } from '@shared/ui/Icon';
import type { StatusKind } from '@shared/ui/StatusIndicator';

import type {
  MigrationPlanStatus,
  MigrationPlanStepV2Capability,
  MigrationPlanStepV2ExecutionType,
  MigrationPlanStepV2RollbackStrategy,
  MigrationStepCategory,
  MigrationStepRisk,
  MigrationStepStatus,
  PlanQualityStatusLevel,
} from '../types/migrationPlan.types';

/** Human-readable category label shown in chips and step rows. */
export const CATEGORY_LABEL: Record<MigrationStepCategory, string> = {
  preflight: 'Preflight',
  validation: 'Validation',
  bridge: 'React bridge',
  dependency: 'Dependency',
  tooling: 'Tooling',
  typescript: 'TypeScript',
  api: 'API compatibility',
  routing: 'Routing',
  testing: 'Testing',
};

/** Icon glyph paired with each category — kept consistent with the sidebar. */
export const CATEGORY_ICON: Record<MigrationStepCategory, IconName> = {
  preflight: 'help',
  validation: 'check',
  bridge: 'arrow-right',
  dependency: 'plan',
  tooling: 'settings',
  typescript: 'report',
  api: 'sparkles',
  routing: 'arrow-right',
  testing: 'check-circle',
};

/** Tone used by the category chip. */
export const CATEGORY_TONE: Record<MigrationStepCategory, BadgeTone> = {
  preflight: 'warning',
  validation: 'success',
  bridge: 'accent',
  dependency: 'warning',
  tooling: 'info',
  typescript: 'success',
  api: 'danger',
  routing: 'info',
  testing: 'info',
};

/** Risk → badge tone (matches the scanner risk card). */
export const RISK_TONE: Record<MigrationStepRisk, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

/** Plan status → header status chip kind. */
export const PLAN_STATUS_KIND: Record<MigrationPlanStatus, StatusKind> = {
  idle: 'idle',
  generating: 'running',
  ready: 'pending',
  blocked: 'error',
  error: 'error',
  approved: 'success',
};

/** Plan status → header status chip label. */
export const PLAN_STATUS_LABEL: Record<MigrationPlanStatus, string> = {
  idle: 'No plan generated',
  generating: 'Generating plan',
  ready: 'Plan ready for approval',
  blocked: 'Plan blocked',
  error: 'Generation failed',
  approved: 'Plan approved',
};

/** Plan-time status → tone shown on a step row. */
export const STEP_STATUS_TONE: Record<MigrationStepStatus, BadgeTone> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  skipped: 'warning',
  blocked: 'danger',
};

/**
 * Plan Step Contract V2 — capability → tone/label.
 *
 * The capability chip is the single piece of metadata that tells the
 * user whether the execution engine can dispatch a step today. Keeping
 * the tone/label tables here ensures every surface (step card, phase
 * breakdown, plan-quality card) renders the same colour for the same
 * capability.
 */
export const CAPABILITY_TONE: Record<MigrationPlanStepV2Capability, BadgeTone> = {
  available: 'success',
  'not-yet-supported': 'warning',
  'manual-only': 'info',
  blocked: 'danger',
};

export const CAPABILITY_LABEL: Record<MigrationPlanStepV2Capability, string> = {
  available: 'Executable',
  'not-yet-supported': 'Not yet supported',
  'manual-only': 'Manual only',
  blocked: 'Blocked',
};

/** Short execution-type label used on the step header chips. */
export const EXECUTION_TYPE_LABEL: Record<MigrationPlanStepV2ExecutionType, string> = {
  scripted: 'Scripted',
  codemod: 'Codemod',
  'ai-assisted': 'AI-assisted',
  manual: 'Manual',
  'validation-only': 'Validation',
};

/**
 * Execution-type tone. Validation-only is intentionally neutral — it is
 * not "available" in the executor sense, so flagging it green next to a
 * green "Executable" capability would confuse the user.
 */
export const EXECUTION_TYPE_TONE: Record<MigrationPlanStepV2ExecutionType, BadgeTone> = {
  scripted: 'info',
  codemod: 'accent',
  'ai-assisted': 'accent',
  manual: 'warning',
  'validation-only': 'neutral',
};

export const ROLLBACK_LABEL: Record<MigrationPlanStepV2RollbackStrategy, string> = {
  'git-revert': 'Git revert',
  'discard-worktree-changes': 'Discard worktree changes',
  manual: 'Manual rollback',
};

/**
 * Plan Quality Status (R5 Step 14) → badge tone/label.
 *
 * Kept here so the Plan UI and any future surfaces (e.g. workflow
 * sidebar, execution preflight) render the same colour and label for
 * the same plan-level health verdict.
 */
export const PLAN_QUALITY_STATUS_TONE: Record<PlanQualityStatusLevel, BadgeTone> = {
  good: 'success',
  'needs-review': 'warning',
  blocked: 'danger',
};

export const PLAN_QUALITY_STATUS_LABEL: Record<PlanQualityStatusLevel, string> = {
  good: 'Good',
  'needs-review': 'Needs review',
  blocked: 'Blocked',
};
