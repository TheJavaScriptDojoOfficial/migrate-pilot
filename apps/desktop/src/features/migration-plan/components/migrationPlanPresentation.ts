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
  MigrationStepCategory,
  MigrationStepRisk,
  MigrationStepStatus,
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
