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
  workspace: 'Workspace',
  dependency: 'Dependency',
  config: 'Config',
  typescript: 'TypeScript',
  source: 'Source',
  component: 'Component',
  routing: 'Routing',
  'state-management': 'State',
  testing: 'Testing',
  validation: 'Validation',
  report: 'Report',
};

/** Icon glyph paired with each category — kept consistent with the sidebar. */
export const CATEGORY_ICON: Record<MigrationStepCategory, IconName> = {
  workspace: 'workspace',
  dependency: 'plan',
  config: 'settings',
  typescript: 'report',
  source: 'diff',
  component: 'sparkles',
  routing: 'arrow-right',
  'state-management': 'shield',
  testing: 'check-circle',
  validation: 'check',
  report: 'report',
};

/** Tone used by the category chip. */
export const CATEGORY_TONE: Record<MigrationStepCategory, BadgeTone> = {
  workspace: 'info',
  dependency: 'warning',
  config: 'info',
  typescript: 'success',
  source: 'info',
  component: 'accent',
  routing: 'info',
  'state-management': 'info',
  testing: 'info',
  validation: 'success',
  report: 'neutral',
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
  generated: 'pending',
  approved: 'success',
  failed: 'error',
};

/** Plan status → header status chip label. */
export const PLAN_STATUS_LABEL: Record<MigrationPlanStatus, string> = {
  idle: 'No plan generated',
  generating: 'Generating plan',
  generated: 'Draft awaiting approval',
  approved: 'Plan approved',
  failed: 'Generation failed',
};

/** Plan-time status → tone shown on a step row. */
export const STEP_STATUS_TONE: Record<MigrationStepStatus, BadgeTone> = {
  pending: 'neutral',
  approved: 'success',
  skipped: 'warning',
  blocked: 'danger',
};
