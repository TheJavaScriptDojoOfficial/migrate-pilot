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
  React19PackageManager,
  React19SupportLevel,
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

/* React 19 compatibility report (R2 step 3) */
export type {
  React19CompatibilityCategory,
  React19CompatibilityCategoryReport,
  React19CompatibilityCategoryStatus,
  React19CompatibilityIssue,
  React19CompatibilityIssueCode,
  React19CompatibilityReport,
  React19CompatibilitySeverity,
  React19CompatibilitySignals,
  React19CompatibilitySummary,
} from './types/react19Compatibility.types';
export { REACT_19_COMPATIBILITY_CATEGORIES_ORDERED } from './types/react19Compatibility.types';
export {
  REACT19_DETAILED_TO_CANONICAL,
  REACT19_ISSUE_CODE_METADATA,
  REACT19_ISSUE_CODES,
  getReact19IssueDisplayLabel,
  isReact19CanonicalIssueCode,
  resolveReact19CanonicalIssueCode,
} from './constants/react19IssueCodes';
export type {
  React19CanonicalIssueCode,
  React19IssueCodeMetadata,
} from './constants/react19IssueCodes';
export { computeReact19CompatibilityReport } from './services/react19CompatibilityScanner';
export type {
  React19CompatibilityPackageManager,
  React19CompatibilityScanInput,
  React19PackageManifest,
  React19SourceSignals,
} from './services/react19CompatibilityScanner';
