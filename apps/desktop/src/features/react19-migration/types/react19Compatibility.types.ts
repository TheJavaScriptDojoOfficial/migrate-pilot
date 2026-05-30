/**
 * React 19 compatibility report — domain types.
 *
 * Rework Milestone R2 — React 19 Readiness Report V2, Step 3–4.
 *
 * Step 3 widens the scanner from a `node-sass`-centric pass into a
 * generic React 19 readiness analysis. The {@link React19CompatibilityReport}
 * is the deterministic, structured output produced by the scanner and
 * surfaced on the Step 3 readiness report.
 *
 * Architectural rules
 * -------------------
 *   - Pure data: no IPC, no React, no filesystem coupling.
 *   - Deterministic: same scanner input → same report (no clock,
 *     randomness, or external services).
 *   - Forward-compatible: Planner V2 / Executor V2 can consume the same
 *     shape without re-deriving findings from the raw scanner payload.
 *   - Severities and categories are stable enums so the UI and any
 *     future analytics surface can switch on them exhaustively.
 *
 * Important non-goals (Step 3 scope boundary):
 *   - No source-file mutation
 *   - No package upgrade execution
 *   - No AI-based planning
 *   - No diff or workspace integration
 */

import type { React19CanonicalIssueCode } from '../constants/react19IssueCodes';

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Stable category identifiers grouping related compatibility findings.
 *
 *   `react-version`          The declared `react` dependency.
 *   `react-dom-version`      The declared `react-dom` dependency and its
 *                            alignment with `react`.
 *   `build-tool`             CRA / Vite / Webpack / Parcel / Next.js
 *                            tooling (versions + config presence).
 *   `typescript-readiness`   `tsconfig.json` presence, declared
 *                            `typescript` dependency, JS / TS file mix.
 *   `jsx-transform`          `compilerOptions.jsx` and Babel preset
 *                            React runtime hints.
 *   `deprecated-react-api`   `ReactDOM.render`, `ReactDOM.hydrate`,
 *                            `unmountComponentAtNode`,
 *                            `unstable_renderSubtreeIntoContainer`,
 *                            `React.createFactory`.
 *   `deprecated-lifecycle`   `componentWillMount` / `*WillReceiveProps` /
 *                            `*WillUpdate` and `UNSAFE_*` aliases.
 *   `component-patterns`     `findDOMNode`, string refs, legacy context,
 *                            class component density.
 *   `routing`                `react-router` / `react-router-dom` major.
 *   `testing`                Jest / Vitest / Testing Library / Enzyme
 *                            and adjacent tooling.
 *   `dependencies`           Generic deprecated dependency detection
 *                            (`request`, `left-pad`, `react-addons-*`,
 *                            etc.).
 *   `peer-dependencies`      Heuristic peer-risk signals
 *                            (e.g. `react-16-*`, old MUI majors).
 *   `sass-scss`              `node-sass`, `sass`, `sass-loader`, and
 *                            SCSS / Sass file presence.
 *   `package-manager`        Detected package manager + lockfile health.
 *   `validation`             Build / test / lint / typecheck script
 *                            availability.
 */
export type React19CompatibilityCategory =
  | 'react-version'
  | 'react-dom-version'
  | 'build-tool'
  | 'typescript-readiness'
  | 'jsx-transform'
  | 'deprecated-react-api'
  | 'deprecated-lifecycle'
  | 'component-patterns'
  | 'routing'
  | 'testing'
  | 'dependencies'
  | 'peer-dependencies'
  | 'sass-scss'
  | 'package-manager'
  | 'validation';

/**
 * Ordered list of categories. Used for stable rendering on the readiness
 * report so the UI never has to sort by enum identity.
 */
export const REACT_19_COMPATIBILITY_CATEGORIES_ORDERED: readonly React19CompatibilityCategory[] = [
  'react-version',
  'react-dom-version',
  'build-tool',
  'typescript-readiness',
  'jsx-transform',
  'deprecated-react-api',
  'deprecated-lifecycle',
  'component-patterns',
  'routing',
  'testing',
  'dependencies',
  'peer-dependencies',
  'sass-scss',
  'package-manager',
  'validation',
];

/* -------------------------------------------------------------------------- */
/* Severity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Severity bucket the report UI dispatches on.
 *
 *   `blocker`  Must be resolved before a React 19 migration plan can
 *              be safely generated. Mirrors the deterministic
 *              {@link React19SupportStatus} `canGeneratePlan === false`
 *              gate where applicable.
 *   `high`    Strongly recommended to address; not a hard gate but
 *              likely to fail validation later if ignored.
 *   `medium`   Should be planned; lifts the migration scope.
 *   `low`      Worth tracking but not blocking.
 *   `info`     Surfacing-only; no remediation expected.
 */
export type React19CompatibilitySeverity =
  | 'blocker'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

/* -------------------------------------------------------------------------- */
/* Issue                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Stable kebab-case issue codes the report and downstream tooling can
 * branch on. Keep additions append-only — codes are part of the
 * scanner's public contract once shipped.
 */
export type React19CompatibilityIssueCode =
  // react-version
  | 'react-not-detected'
  | 'react-version-unparseable'
  | 'react-major-below-supported'
  | 'react-major-already-target'
  | 'react-major-above-target'
  // react-dom-version
  | 'react-dom-not-detected'
  | 'react-dom-version-unparseable'
  | 'react-dom-major-mismatch'
  // build-tool
  | 'build-tool-react-scripts-very-old'
  | 'build-tool-webpack-major-too-old'
  | 'build-tool-not-detected'
  | 'build-tool-missing-build-script'
  // typescript-readiness
  | 'typescript-not-configured'
  | 'typescript-dependency-missing-but-files-present'
  | 'project-mostly-javascript'
  // jsx-transform
  | 'jsx-transform-classic'
  | 'jsx-transform-config-not-detected'
  // deprecated-react-api
  | 'react-dom-render-detected'
  | 'react-dom-hydrate-detected'
  | 'unmount-component-at-node-detected'
  | 'unstable-render-subtree-detected'
  | 'create-factory-detected'
  | 'default-props-on-function-components'
  | 'prop-types-on-function-components'
  // deprecated-lifecycle
  | 'deprecated-lifecycle-detected'
  // component-patterns
  | 'find-dom-node-detected'
  | 'string-refs-detected'
  | 'legacy-context-detected'
  | 'class-components-present'
  // routing
  | 'router-version-old'
  | 'router-version-very-old'
  | 'router-version-unknown'
  // testing
  | 'enzyme-detected'
  | 'no-modern-testing-library'
  | 'react-test-renderer-detected'
  // dependencies
  | 'node-sass-detected'
  | 'deprecated-dependency-detected'
  // peer-dependencies
  | 'peer-dependency-risk-detected'
  // sass-scss
  | 'sass-files-without-compiler'
  | 'sass-loader-very-old'
  // package-manager
  | 'package-manager-not-detected'
  | 'no-lockfile-found'
  | 'multiple-lockfiles-found'
  | 'package-manager-lockfile-mismatch'
  | 'dirty-git-state'
  // validation
  | 'missing-build-script'
  | 'missing-test-script'
  | 'missing-lint-script'
  | 'missing-typecheck-script';

/**
 * A single deterministic compatibility finding produced by the scanner.
 *
 *   `code`              Stable identifier; never user-facing copy.
 *   `canonicalCode`     Optional product-level code from
 *                         {@link React19CanonicalIssueCode} for Planner V2 /
 *                         Risk Engine R3. Detailed detection codes map here
 *                         via the centralized registry.
 *   `category`          One of {@link React19CompatibilityCategory}.
 *   `severity`          One of {@link React19CompatibilitySeverity}.
 *   `title`             Short, user-facing headline.
 *   `message`           Full sentence the UI can surface verbatim.
 *   `recommendation`    Concrete next-step copy. The scanner never runs
 *                       any remediation itself.
 *   `filePaths`         Optional sample of files that triggered the
 *                       issue (capped — never an exhaustive list).
 *   `count`             Optional usage count when the issue is a
 *                       per-file occurrence aggregate.
 *   `packageName`       Optional dependency name when the issue is
 *                       package-anchored.
 *   `currentVersion`    Optional declared version when relevant.
 *   `expectedVersion`   Optional recommended version when the scanner
 *                       can suggest one.
 */
export interface React19CompatibilityIssue {
  readonly code: React19CompatibilityIssueCode;
  readonly canonicalCode?: React19CanonicalIssueCode;
  readonly category: React19CompatibilityCategory;
  readonly severity: React19CompatibilitySeverity;
  readonly title: string;
  readonly message: string;
  readonly recommendation: string;
  readonly filePaths?: readonly string[];
  readonly count?: number;
  readonly packageName?: string;
  readonly currentVersion?: string;
  readonly expectedVersion?: string;
}

/* -------------------------------------------------------------------------- */
/* Category report                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Per-category roll-up. The UI uses `status` to colour the row and
 * `topIssue` for one-line summaries when the user has not expanded the
 * category.
 *
 *   `clean`     no issues at all in this category.
 *   `info`      only `info` items.
 *   `warning`   at least one `low` or `medium` item, no `high`/`blocker`.
 *   `risk`      at least one `high` item, no `blocker`.
 *   `blocker`   at least one `blocker` item.
 */
export type React19CompatibilityCategoryStatus =
  | 'clean'
  | 'info'
  | 'warning'
  | 'risk'
  | 'blocker';

export interface React19CompatibilityCategoryReport {
  readonly category: React19CompatibilityCategory;
  readonly status: React19CompatibilityCategoryStatus;
  readonly issueCount: number;
  /** Highest-severity issue in this category, when any exist. */
  readonly topIssue?: React19CompatibilityIssue;
}

/* -------------------------------------------------------------------------- */
/* Signals                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic signals the scanner extracts and surfaces alongside the
 * issue list. Distinct from issues: these are facts about the project,
 * not findings — the UI may show them even when no issue fires.
 */
export interface React19CompatibilitySignals {
  // Build-tool presence
  readonly hasReactScripts: boolean;
  readonly hasVite: boolean;
  readonly hasWebpack: boolean;
  readonly hasParcel: boolean;
  readonly hasRollup: boolean;
  readonly hasNext: boolean;
  readonly hasBabelConfig: boolean;
  readonly hasWebpackConfig: boolean;
  readonly babelConfigFiles: readonly string[];
  readonly webpackConfigFiles: readonly string[];

  // TypeScript readiness
  readonly hasTypeScriptConfig: boolean;
  readonly hasTypeScriptDependency: boolean;
  readonly tsFileCount: number;
  readonly tsxFileCount: number;
  readonly jsFileCount: number;
  readonly jsxFileCount: number;
  readonly isMostlyJavaScript: boolean;
  readonly isMixedJsTs: boolean;

  // JSX transform
  readonly tsconfigJsxSetting?: string;
  readonly jsxTransformLooksClassic: boolean;

  // Routing
  readonly routerPackage?: string;
  readonly routerVersion?: string;
  readonly routerMajor?: number;

  // Testing
  readonly hasJest: boolean;
  readonly hasVitest: boolean;
  readonly hasTestingLibraryReact: boolean;
  readonly hasReactTestRenderer: boolean;
  readonly hasEnzyme: boolean;
  readonly enzymeAdapters: readonly string[];

  // Sass/SCSS
  readonly scssFileCount: number;
  readonly sassFileCount: number;
  readonly hasNodeSass: boolean;
  readonly hasSass: boolean;
  readonly hasSassLoader: boolean;
  readonly sassLoaderVersion?: string;

  // Package manager + lockfiles
  readonly packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  readonly lockFiles: readonly string[];

  // Validation scripts
  readonly hasBuildScript: boolean;
  readonly hasTestScript: boolean;
  readonly hasLintScript: boolean;
  readonly hasTypecheckScript: boolean;
  readonly availableValidationCommands: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Top-level report                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Headline counters for the React 19 compatibility scan. `totalIssues`
 * is the sum of all severity buckets so the UI can render a single
 * roll-up number without re-aggregating.
 */
export interface React19CompatibilitySummary {
  readonly totalIssues: number;
  readonly blockerCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly infoCount: number;
}

/**
 * Top-level React 19 compatibility report.
 *
 * Always populated by the current scanner. Consumers that load older
 * serialised reports must fall back to absence — the field on
 * {@link import('@features/scanner').ScanReport} is optional.
 */
export interface React19CompatibilityReport {
  readonly summary: React19CompatibilitySummary;
  readonly categories: readonly React19CompatibilityCategoryReport[];
  readonly issues: readonly React19CompatibilityIssue[];
  readonly signals: React19CompatibilitySignals;
}
