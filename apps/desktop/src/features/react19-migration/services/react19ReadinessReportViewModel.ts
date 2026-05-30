/**
 * React 19 readiness report view-model builder — R2 Step 5.
 *
 * Converts a completed {@link ScanReport} into a structured
 * {@link React19ReadinessReportViewModel} for the Step 3 report UI and
 * session persistence. Pure, deterministic, no React/IPC.
 */

import type { ScanReport } from '@features/scanner';

import {
  REACT19_ISSUE_CODE_METADATA,
  getReact19IssueDisplayLabel,
} from '../constants/react19IssueCodes';
import { buildReact19RiskEngine } from './react19RiskRecommendationEngine';
import type {
  React19CompatibilityCategory,
  React19CompatibilityCategoryReport,
  React19CompatibilityCategoryStatus,
  React19CompatibilityIssue,
  React19CompatibilityReport,
} from '../types/react19Compatibility.types';
import type {
  React19MigrationPhase,
  React19RiskEngineResult,
  React19RiskRecommendation,
} from '../types/react19RiskRecommendation.types';
import type {
  React19ReadinessIssueItem,
  React19ReadinessOverallStatus,
  React19ReadinessPhaseCard,
  React19ReadinessPhaseId,
  React19ReadinessPhaseStatus,
  React19ReadinessRecommendationItem,
  React19ReadinessReportViewModel,
  React19ReadinessRiskLevel,
  React19ValidationCommandImportance,
  React19ValidationCommandItem,
} from '../types/react19ReadinessReport.types';
import type {
  React19SupportLevel,
  ReactMigrationTrack,
} from '../types/react19Migration.types';

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface React19ReadinessReportInput {
  readonly scanReport: ScanReport;
}

/**
 * Build the React 19 migration readiness report view model from scanner
 * output. Always returns a view model — even for partial / legacy reports.
 */
export function buildReact19ReadinessReportViewModel(
  input: React19ReadinessReportInput,
): React19ReadinessReportViewModel {
  const { scanReport } = input;
  const compatibility = scanReport.react19CompatibilityReport;
  const riskEngine = resolveRiskEngine(scanReport);
  const support = scanReport.react19SupportStatus;
  const context = scanReport.react19MigrationContext;

  const sourceReactVersion =
    context?.sourceReactVersion ??
    support?.sourceReactVersion ??
    scanReport.dependencies.reactVersion;

  const migrationTrack = resolveMigrationTrack(context?.track, support?.sourceReactMajor);

  const planGate = resolvePlanGenerationGate(scanReport);
  const issueBuckets = bucketCompatibilityIssues(compatibility?.issues ?? []);
  const blockers = [...issueBuckets.blockers];

  if (!planGate.canGeneratePlan) {
    for (const reason of planGate.reasons) {
      if (!blockers.some((b) => b.message === reason)) {
        blockers.unshift(makePlanGateBlocker(reason));
      }
    }
  }

  const readinessScore = computeReadinessScore(
    compatibility,
    riskEngine,
    blockers.length,
    planGate.canGeneratePlan,
  );
  const riskLevel = scoreToRiskLevel(readinessScore);
  const phaseReadiness = buildPhaseReadiness(
    compatibility,
    riskEngine,
    planGate.canGeneratePlan,
    migrationTrack,
  );
  const recommendations = buildRecommendations(
    compatibility?.issues ?? [],
    riskEngine,
    scanReport.recommendations,
  );
  const validationCommands = buildValidationCommands(scanReport);

  const overallStatus = resolveOverallStatus(
    planGate.canGeneratePlan,
    blockers.length,
    issueBuckets.warnings.length,
    support?.status ?? undefined,
  );

  return {
    ...(sourceReactVersion !== undefined ? { sourceReactVersion } : {}),
    targetReactVersion: '19',
    ...(migrationTrack !== undefined ? { migrationTrack } : {}),
    overallStatus,
    readinessScore,
    riskLevel,
    phaseReadiness,
    blockers,
    warnings: issueBuckets.warnings,
    recommendations,
    validationCommands,
    canGeneratePlan: planGate.canGeneratePlan,
    cannotGeneratePlanReasons: planGate.reasons,
    planGenerationExplanation: planGate.explanation,
    generatedAt: scanReport.generatedAt,
    projectName: scanReport.projectInfo.name,
    scanReportId: scanReport.id,
  };
}

/**
 * Shared plan-generation gate used by the report UI and migration-plan store.
 */
export function resolveReact19PlanGenerationGate(scanReport: ScanReport): {
  readonly canGeneratePlan: boolean;
  readonly reasons: readonly string[];
  readonly explanation: string;
} {
  return resolvePlanGenerationGate(scanReport);
}

/* -------------------------------------------------------------------------- */
/* Plan generation gate                                                       */
/* -------------------------------------------------------------------------- */

function resolvePlanGenerationGate(scanReport: ScanReport): {
  readonly canGeneratePlan: boolean;
  readonly reasons: readonly string[];
  readonly explanation: string;
} {
  const support = scanReport.react19SupportStatus;
  const context = scanReport.react19MigrationContext;
  const hasR2Data =
    support !== undefined ||
    context !== undefined ||
    scanReport.react19CompatibilityReport !== undefined;

  // Pre-R2 reports without any React 19 fields remain allowed.
  if (!hasR2Data) {
    return {
      canGeneratePlan: true,
      reasons: [],
      explanation:
        'Legacy scan report detected. Plan generation uses the pre–React 19 eligibility rules.',
    };
  }

  const reasons: string[] = [];

  if (support !== undefined && support.canGeneratePlan === false) {
    reasons.push(support.message);
  }

  if (context === undefined) {
    reasons.push(
      'A valid React 19 migration context could not be resolved for this project.',
    );
  } else if (!isSupportedSourceMajor(context.sourceReactMajor)) {
    reasons.push(
      `Source React major ${context.sourceReactMajor} is outside the supported React 16/17/18 range.`,
    );
  }

  const canGeneratePlan = reasons.length === 0;

  return {
    canGeneratePlan,
    reasons,
    explanation: canGeneratePlan
      ? 'This React 16/17/18 project has a valid migration context. You can generate a React 19 migration plan.'
      : reasons.length === 1
        ? reasons[0]!
        : `${reasons.length} eligibility issues block plan generation. Resolve the blockers below and re-run the scan.`,
  };
}

function isSupportedSourceMajor(major: number): major is 16 | 17 | 18 {
  return major === 16 || major === 17 || major === 18;
}

function resolveMigrationTrack(
  track: ReactMigrationTrack | undefined,
  sourceMajor: number | undefined,
): ReactMigrationTrack | undefined {
  if (track !== undefined) return track;
  if (sourceMajor === 16) return 'react-16-to-19';
  if (sourceMajor === 17) return 'react-17-to-19';
  if (sourceMajor === 18) return 'react-18-to-19';
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Issue bucketing                                                            */
/* -------------------------------------------------------------------------- */

function bucketCompatibilityIssues(issues: readonly React19CompatibilityIssue[]): {
  readonly blockers: readonly React19ReadinessIssueItem[];
  readonly warnings: readonly React19ReadinessIssueItem[];
} {
  const blockers: React19ReadinessIssueItem[] = [];
  const warnings: React19ReadinessIssueItem[] = [];

  for (const issue of issues) {
    const item = toIssueItem(issue);
    if (issue.severity === 'blocker') {
      blockers.push(item);
    } else if (issue.severity === 'high' || issue.severity === 'medium' || issue.severity === 'low') {
      warnings.push(item);
    }
  }

  return {
    blockers: sortIssues(blockers),
    warnings: sortIssues(warnings),
  };
}

function makePlanGateBlocker(message: string): React19ReadinessIssueItem {
  return {
    label: 'Plan generation blocked',
    message,
    recommendation: 'Fix the eligibility issue and re-run the React 19 compatibility scan.',
    severity: 'blocker',
    code: 'react-not-detected',
  };
}

function toIssueItem(issue: React19CompatibilityIssue): React19ReadinessIssueItem {
  return {
    label: getReact19IssueDisplayLabel(issue),
    message: issue.message,
    recommendation: issue.recommendation,
    severity: issue.severity,
    code: issue.code,
    ...(issue.canonicalCode !== undefined ? { canonicalCode: issue.canonicalCode } : {}),
    ...(issue.packageName !== undefined ? { packageName: issue.packageName } : {}),
    ...(issue.count !== undefined ? { count: issue.count } : {}),
  };
}

const SEVERITY_RANK: Record<React19CompatibilityIssue['severity'], number> = {
  blocker: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function sortIssues(
  items: readonly React19ReadinessIssueItem[],
): readonly React19ReadinessIssueItem[] {
  return [...items].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

const BLOCKER_PENALTY = 25;
const HIGH_PENALTY = 10;
const MEDIUM_PENALTY = 5;
const LOW_PENALTY = 2;
const INVALID_CONTEXT_PENALTY = 40;

function computeReadinessScore(
  compatibility: React19CompatibilityReport | undefined,
  riskEngine: React19RiskEngineResult | undefined,
  extraBlockers: number,
  canGeneratePlan: boolean,
): number {
  let score = 100;

  if (compatibility !== undefined) {
    const { summary } = compatibility;
    score -= summary.blockerCount * BLOCKER_PENALTY;
    score -= summary.highCount * HIGH_PENALTY;
    score -= summary.mediumCount * MEDIUM_PENALTY;
    score -= summary.lowCount * LOW_PENALTY;
  } else if (riskEngine !== undefined) {
    score -= riskEngine.summary.blockers * BLOCKER_PENALTY;
    score -= riskEngine.summary.high * HIGH_PENALTY;
    score -= riskEngine.summary.medium * MEDIUM_PENALTY;
    score -= riskEngine.summary.low * LOW_PENALTY;
  }

  score -= extraBlockers * BLOCKER_PENALTY;

  if (!canGeneratePlan) {
    score -= INVALID_CONTEXT_PENALTY;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreToRiskLevel(score: number): React19ReadinessRiskLevel {
  if (score >= 80) return 'low';
  if (score >= 50) return 'medium';
  return 'high';
}

/* -------------------------------------------------------------------------- */
/* Phase readiness                                                            */
/* -------------------------------------------------------------------------- */

interface PhaseDefinition {
  readonly id: React19ReadinessPhaseId;
  readonly title: string;
  readonly description: string;
  readonly categories: readonly React19CompatibilityCategory[];
}

const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    id: 'react-version',
    title: 'React version compatibility',
    description: 'Declared React major is supported for the React 19 pilot.',
    categories: ['react-version'],
  },
  {
    id: 'react-dom-version',
    title: 'React DOM compatibility',
    description: 'react-dom is declared and aligned with the React major.',
    categories: ['react-dom-version'],
  },
  {
    id: 'dependencies',
    title: 'Dependency compatibility',
    description: 'Deprecated packages and peer-risk signals for React 19.',
    categories: ['dependencies', 'peer-dependencies', 'sass-scss'],
  },
  {
    id: 'build-tool',
    title: 'Build tool readiness',
    description: 'CRA, Vite, Webpack, or other build tooling is modern enough.',
    categories: ['build-tool', 'jsx-transform'],
  },
  {
    id: 'typescript-readiness',
    title: 'TypeScript readiness',
    description: 'tsconfig, typescript dependency, and JS/TS mix.',
    categories: ['typescript-readiness'],
  },
  {
    id: 'routing',
    title: 'Routing readiness',
    description: 'react-router major and migration scope.',
    categories: ['routing'],
  },
  {
    id: 'testing',
    title: 'Testing readiness',
    description: 'Jest, Vitest, Testing Library, and Enzyme signals.',
    categories: ['testing'],
  },
  {
    id: 'validation',
    title: 'Validation readiness',
    description: 'Build, test, lint, and typecheck scripts for migration gates.',
    categories: ['validation'],
  },
  {
    id: 'git-workspace',
    title: 'Git / workspace readiness',
    description: 'Package manager, lockfiles, and clean Git baseline.',
    categories: ['package-manager'],
  },
];

function buildPhaseReadiness(
  compatibility: React19CompatibilityReport | undefined,
  riskEngine: React19RiskEngineResult | undefined,
  canGeneratePlan: boolean,
  migrationTrack: ReactMigrationTrack | undefined,
): readonly React19ReadinessPhaseCard[] {
  if (riskEngine !== undefined && riskEngine.items.length > 0) {
    return buildPhaseReadinessFromRiskEngine(
      riskEngine,
      canGeneratePlan,
      migrationTrack,
    );
  }

  const categoryMap = new Map<React19CompatibilityCategory, React19CompatibilityCategoryReport>();
  if (compatibility !== undefined) {
    for (const row of compatibility.categories) {
      categoryMap.set(row.category, row);
    }
  }

  return PHASE_DEFINITIONS.map((phase) => {
    const reports = phase.categories
      .map((c) => categoryMap.get(c))
      .filter((r): r is React19CompatibilityCategoryReport => r !== undefined);

    const issueCount = reports.reduce((sum, r) => sum + r.issueCount, 0);
    const worstStatus = worstCategoryStatus(reports.map((r) => r.status));

    let status = categoryStatusToPhaseStatus(worstStatus, issueCount);

    if (phase.id === 'react-version' && !canGeneratePlan) {
      status = 'blocked';
    }
    if (phase.id === 'react-dom-version' && !canGeneratePlan && migrationTrack === undefined) {
      status = 'blocked';
    }
    if (compatibility === undefined) {
      status = 'unknown';
    }

    return {
      id: phase.id,
      title: phase.title,
      description: phase.description,
      status,
      issueCount,
      categories: phase.categories,
    };
  });
}

function buildPhaseReadinessFromRiskEngine(
  riskEngine: React19RiskEngineResult,
  canGeneratePlan: boolean,
  migrationTrack: ReactMigrationTrack | undefined,
): readonly React19ReadinessPhaseCard[] {
  return PHASE_DEFINITIONS.map((phase) => {
    const mapped = PHASE_TO_RISK_PHASES[phase.id];
    const items = mapped.flatMap((riskPhase) => riskEngine.byPhase[riskPhase] ?? []);
    const issueCount = items.length;
    const status = riskItemsToPhaseStatus(items, issueCount);

    const adjustedStatus =
      phase.id === 'react-version' && !canGeneratePlan
        ? 'blocked'
        : phase.id === 'react-dom-version' &&
            !canGeneratePlan &&
            migrationTrack === undefined
          ? 'blocked'
          : status;

    return {
      id: phase.id,
      title: phase.title,
      description: phase.description,
      status: adjustedStatus,
      issueCount,
      categories: phase.categories,
    };
  });
}

function riskItemsToPhaseStatus(
  items: readonly React19RiskRecommendation[],
  issueCount: number,
): React19ReadinessPhaseStatus {
  if (items.some((item) => item.riskLevel === 'blocker')) return 'blocked';
  if (items.some((item) => item.riskLevel === 'high' || item.riskLevel === 'medium')) {
    return 'warning';
  }
  if (items.some((item) => item.riskLevel === 'low' || item.riskLevel === 'info')) {
    return issueCount === 0 ? 'ready' : 'warning';
  }
  return issueCount === 0 ? 'ready' : 'unknown';
}

function worstCategoryStatus(
  statuses: readonly React19CompatibilityCategoryStatus[],
): React19CompatibilityCategoryStatus {
  if (statuses.length === 0) return 'clean';
  const rank: Record<React19CompatibilityCategoryStatus, number> = {
    clean: 0,
    info: 1,
    warning: 2,
    risk: 3,
    blocker: 4,
  };
  return statuses.reduce((worst, current) =>
    rank[current] > rank[worst] ? current : worst,
  );
}

function categoryStatusToPhaseStatus(
  status: React19CompatibilityCategoryStatus,
  issueCount: number,
): React19ReadinessPhaseStatus {
  switch (status) {
    case 'clean':
      return 'ready';
    case 'info':
      return issueCount === 0 ? 'ready' : 'warning';
    case 'warning':
    case 'risk':
      return 'warning';
    case 'blocker':
      return 'blocked';
  }
}

/* -------------------------------------------------------------------------- */
/* Recommendations                                                            */
/* -------------------------------------------------------------------------- */

function buildRecommendations(
  issues: readonly React19CompatibilityIssue[],
  riskEngine: React19RiskEngineResult | undefined,
  legacyRecommendations: ScanReport['recommendations'],
): readonly React19ReadinessRecommendationItem[] {
  const seen = new Set<string>();
  const out: React19ReadinessRecommendationItem[] = [];

  if (riskEngine !== undefined && riskEngine.items.length > 0) {
    for (const risk of riskEngine.items) {
      if (risk.riskLevel === 'info') continue;
      const key = risk.canonicalCode ?? risk.sourceIssueCode;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        id: key,
        label: risk.title,
        detail: risk.recommendation,
        ...(risk.canonicalCode !== undefined ? { canonicalCode: risk.canonicalCode } : {}),
        priority: riskLevelToPriority(risk.riskLevel),
      });
    }
  } else {
    for (const issue of issues) {
      if (issue.severity === 'info') continue;

      const key = issue.canonicalCode ?? issue.code;
      if (seen.has(key)) continue;
      seen.add(key);

      const meta =
        issue.canonicalCode !== undefined
          ? REACT19_ISSUE_CODE_METADATA[issue.canonicalCode]
          : undefined;

      out.push({
        id: key,
        label: getReact19IssueDisplayLabel(issue),
        detail: meta?.defaultRecommendation ?? issue.recommendation,
        ...(issue.canonicalCode !== undefined ? { canonicalCode: issue.canonicalCode } : {}),
        priority: severityToPriority(issue.severity),
      });
    }
  }

  for (const rec of legacyRecommendations) {
    if (seen.has(rec.id)) continue;
    if (/node-sass/i.test(rec.title) && !issues.some((i) => i.code === 'node-sass-detected')) {
      continue;
    }
    seen.add(rec.id);
    out.push({
      id: rec.id,
      label: rec.title,
      detail: rec.detail,
      priority: rec.priority,
    });
  }

  return out.sort(
    (a, b) => priorityRank(b.priority) - priorityRank(a.priority),
  );
}

function severityToPriority(
  severity: React19CompatibilityIssue['severity'],
): React19ReadinessRecommendationItem['priority'] {
  switch (severity) {
    case 'blocker':
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

function priorityRank(priority: React19ReadinessRecommendationItem['priority']): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
  }
}

function riskLevelToPriority(
  riskLevel: React19RiskRecommendation['riskLevel'],
): React19ReadinessRecommendationItem['priority'] {
  switch (riskLevel) {
    case 'blocker':
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
    case 'info':
      return 'low';
  }
}

function resolveRiskEngine(scanReport: ScanReport): React19RiskEngineResult | undefined {
  if (scanReport.react19RiskEngine !== undefined) {
    return scanReport.react19RiskEngine;
  }
  const hasReact19Data =
    scanReport.react19CompatibilityReport !== undefined ||
    scanReport.react19MigrationContext !== undefined ||
    scanReport.react19SupportStatus !== undefined;
  if (!hasReact19Data) return undefined;
  return buildReact19RiskEngine(scanReport);
}

const PHASE_TO_RISK_PHASES: Readonly<
  Record<React19ReadinessPhaseId, readonly React19MigrationPhase[]>
> = {
  'react-version': ['preflight', 'react-bridge'],
  'react-dom-version': ['dependency-modernization'],
  dependencies: ['dependency-modernization'],
  'build-tool': ['tooling', 'api-compatibility'],
  'typescript-readiness': ['typescript-readiness'],
  routing: ['routing-readiness'],
  testing: ['testing-readiness'],
  validation: ['validation-readiness'],
  'git-workspace': ['preflight'],
};

/* -------------------------------------------------------------------------- */
/* Validation commands                                                        */
/* -------------------------------------------------------------------------- */

const VALIDATION_SCRIPT_DEFS: ReadonlyArray<{
  readonly scriptName: string;
  readonly importance: React19ValidationCommandImportance;
  readonly aliases?: readonly string[];
}> = [
  { scriptName: 'build', importance: 'critical' },
  { scriptName: 'test', importance: 'recommended' },
  { scriptName: 'lint', importance: 'recommended' },
  {
    scriptName: 'typecheck',
    importance: 'optional',
    aliases: ['type-check', 'tsc'],
  },
];

function buildValidationCommands(scanReport: ScanReport): readonly React19ValidationCommandItem[] {
  const scripts = scanReport.scripts.raw;
  const pm = scanReport.dependencies.packageManager;
  const runPrefix = pm === 'unknown' ? 'npm run' : `${pm} run`;

  const signals = scanReport.react19CompatibilityReport?.signals;

  return VALIDATION_SCRIPT_DEFS.map((def) => {
    const resolvedName = resolveScriptName(scripts, def.scriptName, def.aliases);
    const present =
      resolvedName !== undefined ||
      (def.scriptName === 'build' && signals?.hasBuildScript === true) ||
      (def.scriptName === 'test' && signals?.hasTestScript === true) ||
      (def.scriptName === 'lint' && signals?.hasLintScript === true) ||
      (def.scriptName === 'typecheck' && signals?.hasTypecheckScript === true);

    const scriptName = resolvedName ?? def.scriptName;

    return {
      scriptName,
      command: `${runPrefix} ${scriptName}`,
      present,
      importance: def.importance,
    };
  });
}

function resolveScriptName(
  scripts: Readonly<Record<string, string>>,
  primary: string,
  aliases: readonly string[] | undefined,
): string | undefined {
  if (scripts[primary] !== undefined) return primary;
  if (aliases === undefined) return undefined;
  for (const alias of aliases) {
    if (scripts[alias] !== undefined) return alias;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Overall status                                                             */
/* -------------------------------------------------------------------------- */

function resolveOverallStatus(
  canGeneratePlan: boolean,
  blockerCount: number,
  warningCount: number,
  supportLevel: React19SupportLevel | undefined,
): React19ReadinessOverallStatus {
  if (!canGeneratePlan || blockerCount > 0) return 'blocked';
  if (supportLevel === 'unknown') return 'unknown';
  if (supportLevel === 'warning') return 'warning';
  if (warningCount > 0) return 'warning';
  return 'ready';
}
