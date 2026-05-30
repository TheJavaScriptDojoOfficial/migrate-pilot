/**
 * React 19 readiness report view-model — R2 Step 5.
 *
 * Pure presentation-layer types derived from {@link ScanReport} scanner
 * output. The report UI consumes this shape instead of re-deriving logic
 * inside React components.
 */

import type { React19CanonicalIssueCode } from '../constants/react19IssueCodes';
import type {
  React19CompatibilityCategory,
  React19CompatibilityIssueCode,
  React19CompatibilitySeverity,
} from './react19Compatibility.types';
import type { ReactMigrationTrack } from './react19Migration.types';

/* -------------------------------------------------------------------------- */
/* Phase readiness                                                            */
/* -------------------------------------------------------------------------- */

export type React19ReadinessPhaseStatus =
  | 'ready'
  | 'warning'
  | 'blocked'
  | 'unknown';

export type React19ReadinessPhaseId =
  | 'react-version'
  | 'react-dom-version'
  | 'dependencies'
  | 'build-tool'
  | 'typescript-readiness'
  | 'routing'
  | 'testing'
  | 'validation'
  | 'git-workspace';

export interface React19ReadinessPhaseCard {
  readonly id: React19ReadinessPhaseId;
  readonly title: string;
  readonly description: string;
  readonly status: React19ReadinessPhaseStatus;
  readonly issueCount: number;
  readonly categories: readonly React19CompatibilityCategory[];
}

/* -------------------------------------------------------------------------- */
/* Issue / recommendation rows                                                */
/* -------------------------------------------------------------------------- */

export interface React19ReadinessIssueItem {
  readonly label: string;
  readonly message: string;
  readonly recommendation: string;
  readonly severity: React19CompatibilitySeverity;
  readonly code: React19CompatibilityIssueCode;
  readonly canonicalCode?: React19CanonicalIssueCode;
  readonly packageName?: string;
  readonly count?: number;
}

export interface React19ReadinessRecommendationItem {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly canonicalCode?: React19CanonicalIssueCode;
  readonly priority: 'high' | 'medium' | 'low';
}

/* -------------------------------------------------------------------------- */
/* Validation commands                                                        */
/* -------------------------------------------------------------------------- */

export type React19ValidationCommandImportance =
  | 'critical'
  | 'recommended'
  | 'optional';

export interface React19ValidationCommandItem {
  readonly scriptName: string;
  readonly command: string;
  readonly present: boolean;
  readonly importance: React19ValidationCommandImportance;
}

/* -------------------------------------------------------------------------- */
/* Top-level view model                                                       */
/* -------------------------------------------------------------------------- */

export type React19ReadinessOverallStatus =
  | 'ready'
  | 'blocked'
  | 'warning'
  | 'unknown';

export type React19ReadinessRiskLevel = 'low' | 'medium' | 'high';

export interface React19ReadinessReportViewModel {
  readonly sourceReactVersion?: string;
  readonly targetReactVersion: '19';
  readonly migrationTrack?: ReactMigrationTrack;
  readonly overallStatus: React19ReadinessOverallStatus;
  readonly readinessScore: number;
  readonly riskLevel: React19ReadinessRiskLevel;
  readonly phaseReadiness: readonly React19ReadinessPhaseCard[];
  readonly blockers: readonly React19ReadinessIssueItem[];
  readonly warnings: readonly React19ReadinessIssueItem[];
  readonly recommendations: readonly React19ReadinessRecommendationItem[];
  readonly validationCommands: readonly React19ValidationCommandItem[];
  readonly canGeneratePlan: boolean;
  readonly cannotGeneratePlanReasons: readonly string[];
  readonly planGenerationExplanation: string;
  readonly generatedAt?: string;
  readonly projectName?: string;
  readonly scanReportId?: string;
}
