/**
 * Scanner risk service.
 *
 * Pure rule engine that turns the parsed dependency / source / script
 * reports into a deterministic {@link RiskReport}. No IPC, no React, no
 * filesystem — exported for unit testing and reuse by the future planner.
 *
 * Scoring policy (Milestone 3, deterministic)
 * -------------------------------------------
 * Start at 100 and subtract penalties:
 *
 *   blockers       → 25 each
 *   warnings       → 8  each
 *   infos          → 0  (nudge only)
 *
 * Final score → level mapping:
 *
 *   80–100 → low
 *   50–79  → medium
 *   0–49   → high
 *
 * Issue selection rules (high level):
 *
 *   blocker  : package.json missing/invalid, React not declared,
 *              deprecated lifecycle methods detected.
 *   warning  : node-sass present, missing build/test/lint scripts,
 *              missing/multiple lock files, ReactDOM.render usage,
 *              class components present, no TypeScript on a JS-heavy repo,
 *              outdated React version (16/17), legacy context API,
 *              walker truncated.
 *   info     : missing typecheck script, no source files (empty repo).
 *
 * The mapping is intentionally explicit so callers can reason about the
 * score without re-reading the function body.
 */

import type {
  DependencyReport,
  RiskReport,
  ScanIssue,
  ScanIssueCode,
  ScanIssueSeverity,
  ScanRiskLevel,
  ScriptReport,
  SourceAnalysisReport,
} from '../types/scanner.types';

const BLOCKER_PENALTY = 25;
const WARNING_PENALTY = 8;

const LEVEL_THRESHOLDS = {
  low: 80,
  medium: 50,
} as const;

export interface RiskInputs {
  readonly dependencies: DependencyReport;
  readonly sourceAnalysis: SourceAnalysisReport;
  readonly scripts: ScriptReport;
  readonly packageJsonMissing: boolean;
  readonly packageJsonInvalidReason?: string;
}

export function buildRiskReport(inputs: RiskInputs): RiskReport {
  const issues: ScanIssue[] = [];
  for (const issue of collectIssues(inputs)) {
    issues.push(issue);
  }

  const score = calculateScore(issues);
  const level = scoreToLevel(score);

  return {
    score,
    level,
    blockers: issues.filter((i) => i.severity === 'blocker'),
    warnings: issues.filter((i) => i.severity === 'warning'),
    infos: issues.filter((i) => i.severity === 'info'),
  };
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function calculateScore(issues: readonly ScanIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= penaltyFor(issue.severity);
  }
  return Math.max(0, Math.min(100, score));
}

export function scoreToLevel(score: number): ScanRiskLevel {
  if (score >= LEVEL_THRESHOLDS.low) return 'low';
  if (score >= LEVEL_THRESHOLDS.medium) return 'medium';
  return 'high';
}

function penaltyFor(severity: ScanIssueSeverity): number {
  switch (severity) {
    case 'blocker':
      return BLOCKER_PENALTY;
    case 'warning':
      return WARNING_PENALTY;
    case 'info':
      return 0;
  }
}

function* collectIssues(inputs: RiskInputs): Generator<ScanIssue> {
  yield* collectPackageJsonIssues(inputs);
  yield* collectDependencyIssues(inputs.dependencies);
  yield* collectScriptIssues(inputs.scripts);
  yield* collectSourceIssues(inputs.sourceAnalysis, inputs.dependencies);
}

function* collectPackageJsonIssues(inputs: RiskInputs): Generator<ScanIssue> {
  if (inputs.packageJsonMissing) {
    yield issue({
      severity: 'blocker',
      code: 'PACKAGE_JSON_MISSING',
      title: 'package.json not found',
      description:
        'Migrate Pilot only supports Node-based React projects. Pick a folder containing a package.json at the root.',
      ref: 'package.json',
    });
    return;
  }
  if (inputs.packageJsonInvalidReason) {
    yield issue({
      severity: 'blocker',
      code: 'PACKAGE_JSON_INVALID',
      title: 'package.json could not be parsed',
      description: `Found package.json but failed to parse it: ${inputs.packageJsonInvalidReason}`,
      ref: 'package.json',
    });
  }
}

function* collectDependencyIssues(deps: DependencyReport): Generator<ScanIssue> {
  if (!deps.reactVersion) {
    yield issue({
      severity: 'blocker',
      code: 'REACT_NOT_FOUND',
      title: 'React dependency not detected',
      description:
        'React is not listed in dependencies, devDependencies, peerDependencies, or optionalDependencies of package.json.',
      ref: 'package.json',
    });
  } else if (deps.reactMajor !== undefined && deps.reactMajor < 18) {
    yield issue({
      severity: 'warning',
      code: 'OUTDATED_REACT_VERSION',
      title: `React ${deps.reactVersion} predates React 18`,
      description:
        'V1 of Migrate Pilot targets modernization to React 18+. The migration plan will include a React upgrade step.',
      ref: 'package.json',
    });
  }

  if (deps.styling.usesNodeSass) {
    yield issue({
      severity: 'warning',
      code: 'NODE_SASS_DEPRECATED',
      title: 'node-sass is deprecated',
      description:
        'node-sass is unmaintained and tied to LibSass (also unmaintained). Plan a separate migration step to replace it with sass and validate styling/build output.',
      ref: 'package.json',
    });
  }

  if (deps.lockFiles.length === 0) {
    yield issue({
      severity: 'warning',
      code: 'MISSING_LOCK_FILE',
      title: 'No lockfile detected',
      description:
        'Reproducible installs require a lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lock). Generate one before running migrations.',
    });
  } else if (deps.lockFiles.length > 1) {
    yield issue({
      severity: 'warning',
      code: 'MULTIPLE_LOCK_FILES',
      title: 'Multiple lockfiles detected',
      description: `Found ${deps.lockFiles.join(', ')}. Pick one package manager and remove the others before migrating.`,
    });
  }
}

function* collectScriptIssues(scripts: ScriptReport): Generator<ScanIssue> {
  if (!scripts.hasBuild) {
    yield issue({
      severity: 'warning',
      code: 'MISSING_BUILD_SCRIPT',
      title: 'No build script defined',
      description:
        'Migrate Pilot validates each migration step against the project build script. Add a `build` script to package.json before execution.',
      ref: 'package.json#scripts.build',
    });
  }
  if (!scripts.hasTest) {
    yield issue({
      severity: 'warning',
      code: 'MISSING_TEST_SCRIPT',
      title: 'No test script defined',
      description:
        'Without a test script, regression validation will be limited to build + type-check only.',
      ref: 'package.json#scripts.test',
    });
  }
  if (!scripts.hasLint) {
    yield issue({
      severity: 'warning',
      code: 'MISSING_LINT_SCRIPT',
      title: 'No lint script defined',
      description:
        'A `lint` script provides static validation between migration steps. Adding one is highly recommended before migrating.',
      ref: 'package.json#scripts.lint',
    });
  }
  if (!scripts.hasTypecheck) {
    yield issue({
      severity: 'info',
      code: 'MISSING_TYPECHECK_SCRIPT',
      title: 'No typecheck script defined',
      description:
        'Once TypeScript is introduced, a `typecheck` script (e.g. `tsc --noEmit`) catches regressions per step.',
      ref: 'package.json#scripts.typecheck',
    });
  }
}

function* collectSourceIssues(
  source: SourceAnalysisReport,
  deps: DependencyReport,
): Generator<ScanIssue> {
  if (source.isEmpty && !deps.reactVersion) {
    // package.json + React already handled above; nothing to add here.
    return;
  }

  if (source.isEmpty) {
    yield issue({
      severity: 'info',
      code: 'NO_SOURCE_FILES',
      title: 'No JS / TS / style source files found',
      description:
        'The scanner did not find any .js / .jsx / .ts / .tsx / .css / .scss / .sass files inside the project. Confirm the folder you selected is a real React workspace.',
    });
  }

  const jsHeavy = source.jsFiles + source.jsxFiles;
  const tsTotal = source.tsFiles + source.tsxFiles;
  const tsPresent = deps.tooling.typescript !== undefined || tsTotal > 0;

  if (!tsPresent && jsHeavy >= 5) {
    yield issue({
      severity: 'warning',
      code: 'NO_TYPESCRIPT',
      title: 'TypeScript not detected on a JS/JSX-heavy project',
      description:
        'Adding TypeScript is one of the migration goals. The plan will include a foundation step to introduce tsconfig.json and progressively convert files.',
    });
  }

  if (source.classComponentIndicators > 0) {
    yield issue({
      severity: 'warning',
      code: 'CLASS_COMPONENTS_PRESENT',
      title: `${source.classComponentIndicators} file${source.classComponentIndicators === 1 ? '' : 's'} look like class components`,
      description:
        'Class components add migration risk because of legacy lifecycle methods, refs, and context. Plan to convert them to function components in small batches.',
    });
  }

  if (source.deprecatedLifecycleIndicators.length > 0) {
    const summary = source.deprecatedLifecycleIndicators
      .map((u) => `${u.method} (${u.fileCount})`)
      .join(', ');
    yield issue({
      severity: 'blocker',
      code: 'DEPRECATED_LIFECYCLES_PRESENT',
      title: 'Deprecated React lifecycle methods detected',
      description: `Found: ${summary}. These cause warnings on React 17 and break in concurrent rendering. Replace before upgrading React.`,
    });
  }

  if (source.reactDomRenderUsages > 0) {
    yield issue({
      severity: 'warning',
      code: 'REACT_DOM_RENDER_USAGE',
      title: `ReactDOM.render usage detected in ${source.reactDomRenderUsages} file${source.reactDomRenderUsages === 1 ? '' : 's'}`,
      description:
        'ReactDOM.render is deprecated in React 18. Plan a step to migrate to createRoot from react-dom/client.',
    });
  }

  if (source.legacyContextIndicators > 0) {
    yield issue({
      severity: 'warning',
      code: 'LEGACY_CONTEXT_API',
      title: 'Legacy context API patterns detected',
      description:
        'Patterns like contextTypes, childContextTypes, or getChildContext were found. Plan to migrate to React.createContext.',
    });
  }

  if (source.truncated) {
    yield issue({
      severity: 'info',
      code: 'SCAN_TRUNCATED',
      title: 'Scan truncated at the file limit',
      description:
        'The repository is larger than the deterministic scanner limit. Counts and indicators are lower bounds — re-running on a sub-folder may give a more accurate picture.',
    });
  }
}

function issue(args: {
  readonly severity: ScanIssueSeverity;
  readonly code: ScanIssueCode;
  readonly title: string;
  readonly description: string;
  readonly ref?: string;
}): ScanIssue {
  return {
    severity: args.severity,
    code: args.code,
    title: args.title,
    description: args.description,
    ...(args.ref !== undefined ? { ref: args.ref } : {}),
  };
}
