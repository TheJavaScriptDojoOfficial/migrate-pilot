/**
 * Public barrel for the React 19 migration feature.
 *
 * Rework Milestone R1 — Product Rebaseline.
 *
 * R1 only exposes the domain types. The Scanner V2, Planner V2, and
 * Executor V2 milestones will add the screen, hooks, services, and
 * components and re-export them here.
 */
export type {
  React19MigrationContext,
  React19SupportReasonCode,
  React19SupportStatus,
  ReactMigrationPhase,
  ReactMigrationSourceMajor,
  ReactMigrationTargetMajor,
  ReactMigrationTrack,
} from './types/react19Migration.types';
export {
  REACT_MIGRATION_PHASES_BY_TRACK,
  REACT_MIGRATION_PHASES_ORDERED,
  REACT_MIGRATION_TARGET_MAJOR,
} from './types/react19Migration.types';
export {
  computeReact19MigrationContext,
  parseReactMajor,
} from './services/react19MigrationContextService';
export type {
  React19MigrationContextInput,
  React19MigrationContextResult,
} from './services/react19MigrationContextService';
