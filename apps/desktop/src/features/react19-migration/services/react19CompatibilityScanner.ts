/**
 * React 19 compatibility scanner — deterministic compute service.
 *
 * Rework Milestone R2 — React 19 Readiness Report V2, Step 3–4.
 *
 * Step 3 widens the scanner from a `node-sass`-centric pass into a
 * generic React 19 readiness analysis. This service is the single
 * deterministic entry point that turns the existing scanner inputs
 * (already extracted dependency / source / script signals + the parsed
 * `package.json`) into a full {@link React19CompatibilityReport}.
 *
 * Architectural rules
 * -------------------
 *   - Pure: no React, no IPC, no filesystem, no clock, no randomness.
 *   - Deterministic: same input → same output.
 *   - The scanner NEVER fabricates data. Every issue is anchored to a
 *     concrete, observable signal. When a signal is missing the issue
 *     is either omitted or downgraded to `info` with an explicit
 *     "manual review" recommendation.
 *   - Side-effect-free. Callers are guaranteed a report even for
 *     malformed or partial inputs.
 *   - Backward-compatible: every input field is optional and `node-sass`
 *     remains detected — but it is now one finding inside a broader
 *     compatibility scan, not the central model.
 */

import type {
  React19SupportStatus,
} from '../types/react19Migration.types';
import type {
  React19CompatibilityCategory,
  React19CompatibilityCategoryReport,
  React19CompatibilityCategoryStatus,
  React19CompatibilityIssue,
  React19CompatibilityIssueCode,
  React19CompatibilityReport,
  React19CompatibilitySeverity,
  React19CompatibilitySignals,
  React19CompatibilitySummary,
} from '../types/react19Compatibility.types';
import { REACT_19_COMPATIBILITY_CATEGORIES_ORDERED } from '../types/react19Compatibility.types';
import { resolveReact19CanonicalIssueCode } from '../constants/react19IssueCodes';

/* -------------------------------------------------------------------------- */
/* Public input                                                               */
/* -------------------------------------------------------------------------- */

export type React19CompatibilityPackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'unknown';

/**
 * Subset of `package.json` the compatibility scanner consumes. The
 * scannerService.ts already parses the manifest into this shape; we
 * re-declare it here so the React 19 feature has no inbound dependency
 * on the scanner feature.
 */
export interface React19PackageManifest {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly scripts: Readonly<Record<string, string>>;
}

/**
 * Signals the compatibility scanner reads from the deterministic source
 * walk. Mirrors `SourceAnalysisReport` but only the fields this service
 * cares about, kept optional so older scanner builds that did not emit a
 * field still produce a report.
 */
export interface React19SourceSignals {
  readonly classComponentIndicators?: number;
  readonly reactDomRenderUsages?: number;
  readonly reactDomHydrateUsages?: number;
  readonly unmountComponentAtNodeUsages?: number;
  readonly unstableRenderSubtreeUsages?: number;
  readonly createFactoryUsages?: number;
  readonly findDomNodeUsages?: number;
  readonly stringRefUsages?: number;
  readonly legacyContextIndicators?: number;
  readonly enzymeUsageIndicators?: number;
  readonly deprecatedLifecycleSampleFiles?: readonly string[];
  readonly deprecatedLifecycleTotalCount?: number;
  readonly defaultPropsUsages?: number;
  readonly defaultPropsSampleFiles?: readonly string[];
  readonly propTypesUsages?: number;
  readonly propTypesSampleFiles?: readonly string[];
  readonly scssFileCount?: number;
  readonly sassFileCount?: number;
  readonly jsFileCount?: number;
  readonly jsxFileCount?: number;
  readonly tsFileCount?: number;
  readonly tsxFileCount?: number;
}

export interface React19CompatibilityScanInput {
  /**
   * Outcome of the existing Step 2 support computation. Reused so the
   * scanner does not re-derive React/React-DOM eligibility on its own.
   */
  readonly supportStatus?: React19SupportStatus;
  /** Parsed `package.json` (same buckets the scanner already extracts). */
  readonly manifest?: React19PackageManifest;
  /** Raw `tsconfig.json` text when present (capped). */
  readonly tsconfigText?: string;
  /** `tsconfig.json` exists at the project root. */
  readonly hasTsconfig?: boolean;
  /** Babel config files found at the project root. */
  readonly babelConfigFiles?: readonly string[];
  /** webpack config files found at the project root. */
  readonly webpackConfigFiles?: readonly string[];
  /** Source signal counts from the deterministic walker. */
  readonly source?: React19SourceSignals;
  /** Detected package manager (matches the scanner's lockfile inference). */
  readonly packageManager?: React19CompatibilityPackageManager;
  /** Lockfiles actually present in the project root. */
  readonly lockFiles?: readonly string[];
  /** Git cleanliness from the deterministic scanner (`clean` / `dirty`). */
  readonly gitClean?: 'clean' | 'dirty' | 'unknown';
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Compute the React 19 compatibility report for a single project.
 *
 * Always returns a report — even for empty input — so the report screen
 * can render a deterministic surface in every state.
 */
export function computeReact19CompatibilityReport(
  input: React19CompatibilityScanInput,
): React19CompatibilityReport {
  const ctx = buildContext(input);
  const issues: React19CompatibilityIssue[] = [];

  collectReactVersionIssues(ctx, issues);
  collectReactDomIssues(ctx, issues);
  collectBuildToolIssues(ctx, issues);
  collectTypeScriptIssues(ctx, issues);
  collectJsxTransformIssues(ctx, issues);
  collectDeprecatedReactApiIssues(ctx, issues);
  collectDeprecatedLifecycleIssues(ctx, issues);
  collectComponentPatternIssues(ctx, issues);
  collectDefaultPropsAndPropTypesIssues(ctx, issues);
  collectRoutingIssues(ctx, issues);
  collectTestingIssues(ctx, issues);
  collectDeprecatedDependencyIssues(ctx, issues);
  collectPeerDependencyIssues(ctx, issues);
  collectSassScssIssues(ctx, issues);
  collectPackageManagerIssues(ctx, issues);
  collectGitStateIssues(ctx, issues);
  collectValidationIssues(ctx, issues);

  const issuesWithCanonical = attachCanonicalCodes(issues);
  const summary = buildSummary(issuesWithCanonical);
  const categories = buildCategoryReports(issuesWithCanonical);
  const signals = buildSignals(ctx);

  return {
    summary,
    categories,
    issues: issuesWithCanonical,
    signals,
  };
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Pre-computed lookups derived once from the input so each rule is a
 * pure inspection of structured data.
 */
interface ScanContext {
  readonly input: React19CompatibilityScanInput;
  readonly manifest: React19PackageManifest;
  readonly source: React19SourceSignals;
  readonly packageManager: React19CompatibilityPackageManager;
  readonly lockFiles: readonly string[];
  readonly tsconfigText: string;
  readonly hasTsconfig: boolean;
  readonly babelConfigFiles: readonly string[];
  readonly webpackConfigFiles: readonly string[];

  // Cached version lookups.
  readonly reactVersion?: string;
  readonly reactMajor?: number;
  readonly reactDomVersion?: string;
  readonly reactDomMajor?: number;

  // Build-tool versions when declared.
  readonly reactScriptsVersion?: string;
  readonly viteVersion?: string;
  readonly webpackVersion?: string;
  readonly parcelVersion?: string;
  readonly rollupVersion?: string;
  readonly nextVersion?: string;
  readonly typescriptVersion?: string;

  // Routing
  readonly routerPackage?: string;
  readonly routerVersion?: string;
  readonly routerMajor?: number;

  // Sass / SCSS
  readonly nodeSassVersion?: string;
  readonly sassVersion?: string;
  readonly sassLoaderVersion?: string;

  // Testing
  readonly jestVersion?: string;
  readonly vitestVersion?: string;
  readonly testingLibraryReactVersion?: string;
  readonly reactTestRendererVersion?: string;
  readonly enzymeVersion?: string;
  readonly enzymeAdapters: readonly string[];
}

const EMPTY_RECORD: Readonly<Record<string, string>> = Object.freeze({});

function emptyManifest(): React19PackageManifest {
  return {
    dependencies: EMPTY_RECORD,
    devDependencies: EMPTY_RECORD,
    peerDependencies: EMPTY_RECORD,
    optionalDependencies: EMPTY_RECORD,
    scripts: EMPTY_RECORD,
  };
}

function buildContext(input: React19CompatibilityScanInput): ScanContext {
  const manifest = input.manifest ?? emptyManifest();
  const source = input.source ?? {};
  const packageManager = input.packageManager ?? 'unknown';
  const lockFiles = input.lockFiles ?? [];
  const tsconfigText = input.tsconfigText ?? '';
  const hasTsconfig = input.hasTsconfig ?? tsconfigText.length > 0;
  const babelConfigFiles = input.babelConfigFiles ?? [];
  const webpackConfigFiles = input.webpackConfigFiles ?? [];

  const reactVersion =
    input.supportStatus?.sourceReactVersion ??
    readVersion(manifest, 'react');
  const reactMajor = input.supportStatus?.sourceReactMajor ?? parseMajor(reactVersion);
  const reactDomVersion =
    input.supportStatus?.reactDomVersion ?? readVersion(manifest, 'react-dom');
  const reactDomMajor =
    input.supportStatus?.reactDomMajor ?? parseMajor(reactDomVersion);

  const reactScriptsVersion = readVersion(manifest, 'react-scripts');
  const viteVersion = readVersion(manifest, 'vite');
  const webpackVersion = readVersion(manifest, 'webpack');
  const parcelVersion = readVersion(manifest, 'parcel');
  const rollupVersion = readVersion(manifest, 'rollup');
  const nextVersion = readVersion(manifest, 'next');
  const typescriptVersion = readVersion(manifest, 'typescript');

  const routerDom = readVersion(manifest, 'react-router-dom');
  const routerCore = readVersion(manifest, 'react-router');
  const routerPackage =
    routerDom !== undefined
      ? 'react-router-dom'
      : routerCore !== undefined
        ? 'react-router'
        : undefined;
  const routerVersion = routerDom ?? routerCore;
  const routerMajor = parseMajor(routerVersion);

  const nodeSassVersion = readVersion(manifest, 'node-sass');
  const sassVersion = readVersion(manifest, 'sass');
  const sassLoaderVersion = readVersion(manifest, 'sass-loader');

  const jestVersion = readVersion(manifest, 'jest');
  const vitestVersion = readVersion(manifest, 'vitest');
  const testingLibraryReactVersion = readVersion(manifest, '@testing-library/react');
  const reactTestRendererVersion = readVersion(manifest, 'react-test-renderer');
  const enzymeVersion = readVersion(manifest, 'enzyme');
  const enzymeAdapters = collectMatchingDependencies(manifest, /^enzyme-adapter-/);

  // Build a mutable shape first so we can attach the long list of optional
  // version fields without producing a complex spread union (which TS5 will
  // reject under exactOptionalPropertyTypes).
  const ctx: { -readonly [K in keyof ScanContext]: ScanContext[K] } = {
    input,
    manifest,
    source,
    packageManager,
    lockFiles,
    tsconfigText,
    hasTsconfig,
    babelConfigFiles,
    webpackConfigFiles,
    enzymeAdapters,
  };
  if (reactVersion !== undefined) ctx.reactVersion = reactVersion;
  if (reactMajor !== undefined) ctx.reactMajor = reactMajor;
  if (reactDomVersion !== undefined) ctx.reactDomVersion = reactDomVersion;
  if (reactDomMajor !== undefined) ctx.reactDomMajor = reactDomMajor;
  if (reactScriptsVersion !== undefined) ctx.reactScriptsVersion = reactScriptsVersion;
  if (viteVersion !== undefined) ctx.viteVersion = viteVersion;
  if (webpackVersion !== undefined) ctx.webpackVersion = webpackVersion;
  if (parcelVersion !== undefined) ctx.parcelVersion = parcelVersion;
  if (rollupVersion !== undefined) ctx.rollupVersion = rollupVersion;
  if (nextVersion !== undefined) ctx.nextVersion = nextVersion;
  if (typescriptVersion !== undefined) ctx.typescriptVersion = typescriptVersion;
  if (routerPackage !== undefined) ctx.routerPackage = routerPackage;
  if (routerVersion !== undefined) ctx.routerVersion = routerVersion;
  if (routerMajor !== undefined) ctx.routerMajor = routerMajor;
  if (nodeSassVersion !== undefined) ctx.nodeSassVersion = nodeSassVersion;
  if (sassVersion !== undefined) ctx.sassVersion = sassVersion;
  if (sassLoaderVersion !== undefined) ctx.sassLoaderVersion = sassLoaderVersion;
  if (jestVersion !== undefined) ctx.jestVersion = jestVersion;
  if (vitestVersion !== undefined) ctx.vitestVersion = vitestVersion;
  if (testingLibraryReactVersion !== undefined)
    ctx.testingLibraryReactVersion = testingLibraryReactVersion;
  if (reactTestRendererVersion !== undefined)
    ctx.reactTestRendererVersion = reactTestRendererVersion;
  if (enzymeVersion !== undefined) ctx.enzymeVersion = enzymeVersion;
  return ctx as ScanContext;
}

/* -------------------------------------------------------------------------- */
/* Rule: react-version                                                        */
/* -------------------------------------------------------------------------- */

const SUPPORTED_REACT_MAJOR_MIN = 16 as const;
const TARGET_REACT_MAJOR = 19 as const;

function collectReactVersionIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  if (ctx.reactVersion === undefined) {
    out.push({
      code: 'react-not-detected',
      category: 'react-version',
      severity: 'blocker',
      title: 'React dependency not detected',
      message:
        'No `react` entry was found in `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`.',
      recommendation:
        'Confirm the project really is a React app and add `react` (and `react-dom`) to package.json before continuing.',
      packageName: 'react',
    });
    return;
  }

  if (ctx.reactMajor === undefined) {
    out.push({
      code: 'react-version-unparseable',
      category: 'react-version',
      severity: 'blocker',
      title: 'React version is not parseable',
      message:
        'A `react` entry exists but its version range did not yield a numeric major (workspace:*, file:..., latest, …).',
      recommendation:
        'Pin `react` to a standard semver range (for example `^18.3.1`) and re-run the scan.',
      packageName: 'react',
      currentVersion: ctx.reactVersion,
    });
    return;
  }

  if (ctx.reactMajor < SUPPORTED_REACT_MAJOR_MIN) {
    out.push({
      code: 'react-major-below-supported',
      category: 'react-version',
      severity: 'blocker',
      title: `React ${ctx.reactMajor} is below the supported range`,
      message:
        'Migrate Pilot V1 supports source projects on React 16, 17, or 18. Earlier majors are out of scope for this pilot.',
      recommendation:
        'Run an upstream upgrade to at least React 16 before using the React 19 migration pilot.',
      packageName: 'react',
      currentVersion: ctx.reactVersion,
      expectedVersion: '>=16 <19',
    });
    return;
  }

  if (ctx.reactMajor === TARGET_REACT_MAJOR) {
    out.push({
      code: 'react-major-already-target',
      category: 'react-version',
      severity: 'info',
      title: 'Project already runs React 19',
      message:
        'No migration is required because this project is already on the React 19 target major.',
      recommendation:
        'Use Migrate Pilot on a different React 16/17/18 project — or skip the migration workflow for this one.',
      packageName: 'react',
      currentVersion: ctx.reactVersion,
    });
    return;
  }

  if (ctx.reactMajor > TARGET_REACT_MAJOR) {
    out.push({
      code: 'react-major-above-target',
      category: 'react-version',
      severity: 'blocker',
      title: `React ${ctx.reactMajor} is above the React 19 target`,
      message:
        'This project declares a React major above 19. Migrate Pilot V1 only plans up to React 19.',
      recommendation:
        'Use a different tool to plan migrations beyond React 19.',
      packageName: 'react',
      currentVersion: ctx.reactVersion,
      expectedVersion: '19.x',
    });
    return;
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: react-dom-version                                                    */
/* -------------------------------------------------------------------------- */

function collectReactDomIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  if (ctx.reactVersion === undefined || ctx.reactMajor === undefined) {
    return;
  }
  if (ctx.reactMajor < SUPPORTED_REACT_MAJOR_MIN || ctx.reactMajor > TARGET_REACT_MAJOR) {
    return;
  }

  if (ctx.reactDomVersion === undefined) {
    out.push({
      code: 'react-dom-not-detected',
      category: 'react-dom-version',
      severity: 'blocker',
      title: '`react-dom` is not declared',
      message:
        'A React app must declare `react-dom`. The scanner could not find any version in the manifest.',
      recommendation:
        'Add `react-dom` at the same major as `react` and re-run the scan.',
      packageName: 'react-dom',
    });
    return;
  }
  if (ctx.reactDomMajor === undefined) {
    out.push({
      code: 'react-dom-version-unparseable',
      category: 'react-dom-version',
      severity: 'blocker',
      title: '`react-dom` version is not parseable',
      message:
        'A `react-dom` entry exists but its version range did not yield a numeric major.',
      recommendation:
        'Pin `react-dom` to a standard semver range matching `react` and re-run the scan.',
      packageName: 'react-dom',
      currentVersion: ctx.reactDomVersion,
    });
    return;
  }
  if (ctx.reactDomMajor !== ctx.reactMajor) {
    out.push({
      code: 'react-dom-major-mismatch',
      category: 'react-dom-version',
      severity: 'blocker',
      title: '`react` and `react-dom` majors disagree',
      message: `Detected react@${ctx.reactMajor} but react-dom@${ctx.reactDomMajor}. The migration cannot proceed until both packages share a major.`,
      recommendation:
        'Align `react-dom` to the same major as `react` (and re-run install) before continuing.',
      packageName: 'react-dom',
      currentVersion: ctx.reactDomVersion,
      expectedVersion: `${ctx.reactMajor}.x`,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: build-tool                                                           */
/* -------------------------------------------------------------------------- */

const REACT_SCRIPTS_VERY_OLD_THRESHOLD = 4 as const;
const WEBPACK_MIN_RECOMMENDED_MAJOR = 5 as const;

function collectBuildToolIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const reactScriptsMajor = parseMajor(ctx.reactScriptsVersion);
  if (
    ctx.reactScriptsVersion !== undefined &&
    reactScriptsMajor !== undefined &&
    reactScriptsMajor < REACT_SCRIPTS_VERY_OLD_THRESHOLD
  ) {
    out.push({
      code: 'build-tool-react-scripts-very-old',
      category: 'build-tool',
      severity: 'high',
      title: `react-scripts ${reactScriptsMajor} is very old`,
      message:
        'react-scripts below 4.x predates modern React build tooling and will struggle with React 18+ APIs.',
      recommendation:
        'Plan a build-tool upgrade — either bump `react-scripts` to a modern major or migrate to Vite.',
      packageName: 'react-scripts',
      currentVersion: ctx.reactScriptsVersion,
    });
  }

  const webpackMajor = parseMajor(ctx.webpackVersion);
  if (
    ctx.webpackVersion !== undefined &&
    webpackMajor !== undefined &&
    webpackMajor < WEBPACK_MIN_RECOMMENDED_MAJOR
  ) {
    out.push({
      code: 'build-tool-webpack-major-too-old',
      category: 'build-tool',
      severity: 'high',
      title: `webpack ${webpackMajor} is below the recommended major`,
      message:
        'webpack below 5 is unsupported by most modern React loaders and Babel presets used during a React 19 migration.',
      recommendation:
        'Plan a webpack upgrade to v5+ before adopting React 19 source patterns.',
      packageName: 'webpack',
      currentVersion: ctx.webpackVersion,
      expectedVersion: '>=5',
    });
  }

  const knownBuildTool =
    ctx.reactScriptsVersion !== undefined ||
    ctx.viteVersion !== undefined ||
    ctx.webpackVersion !== undefined ||
    ctx.parcelVersion !== undefined ||
    ctx.rollupVersion !== undefined ||
    ctx.nextVersion !== undefined ||
    ctx.babelConfigFiles.length > 0 ||
    ctx.webpackConfigFiles.length > 0;

  if (!knownBuildTool && Object.keys(ctx.manifest.dependencies).length > 0) {
    out.push({
      code: 'build-tool-not-detected',
      category: 'build-tool',
      severity: 'info',
      title: 'No standard React build tool detected',
      message:
        'No `react-scripts`, `vite`, `webpack`, `parcel`, `rollup`, `next`, or root Babel/webpack config was found.',
      recommendation:
        'If this project relies on a custom or hidden build tool, add a manual review step to the React 19 migration plan.',
    });
  }

  if (
    ctx.manifest.scripts['build'] === undefined &&
    ctx.reactScriptsVersion === undefined
  ) {
    // Only flag at this category when React-scripts is also absent so we
    // do not duplicate the validation-category warning for plain
    // missing-build-script.
    out.push({
      code: 'build-tool-missing-build-script',
      category: 'build-tool',
      severity: 'medium',
      title: 'No `build` script declared',
      message:
        'package.json does not expose a `build` script and no React-scripts shim is present.',
      recommendation:
        'Add a deterministic `build` script (e.g. `vite build`, `webpack --mode production`) before running React 19 migrations.',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: typescript-readiness                                                 */
/* -------------------------------------------------------------------------- */

function collectTypeScriptIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const ts = ctx.source.tsFileCount ?? 0;
  const tsx = ctx.source.tsxFileCount ?? 0;
  const tsTotal = ts + tsx;
  const hasTsDep = ctx.typescriptVersion !== undefined;

  if (!ctx.hasTsconfig && !hasTsDep && tsTotal === 0) {
    out.push({
      code: 'typescript-not-configured',
      category: 'typescript-readiness',
      severity: 'info',
      title: 'TypeScript is not configured',
      message:
        'No tsconfig.json, no `typescript` dependency, and no .ts/.tsx files were detected.',
      recommendation:
        'TypeScript adoption is optional for the React 19 migration. Treat it as a separate, independent track.',
    });
  } else if (!ctx.hasTsconfig && tsTotal > 0) {
    out.push({
      code: 'typescript-not-configured',
      category: 'typescript-readiness',
      severity: 'medium',
      title: 'TypeScript files exist without a tsconfig.json',
      message: `Detected ${tsTotal} TypeScript file${tsTotal === 1 ? '' : 's'} but no tsconfig.json at the project root.`,
      recommendation:
        'Add a tsconfig.json (or fix the missing root config) so the React 19 migration plan can typecheck per step.',
    });
  }

  if (!hasTsDep && tsTotal > 0) {
    out.push({
      code: 'typescript-dependency-missing-but-files-present',
      category: 'typescript-readiness',
      severity: 'medium',
      title: '`typescript` dependency missing but TS files exist',
      message: `Detected ${tsTotal} .ts/.tsx file${tsTotal === 1 ? '' : 's'} but `+
        '`typescript` is not declared in dependencies or devDependencies.',
      recommendation:
        'Add `typescript` as a devDependency so the migration runner can typecheck consistently.',
      packageName: 'typescript',
    });
  }

  const js = (ctx.source.jsFileCount ?? 0) + (ctx.source.jsxFileCount ?? 0);
  if (js >= 5 && tsTotal === 0) {
    out.push({
      code: 'project-mostly-javascript',
      category: 'typescript-readiness',
      severity: 'info',
      title: 'Project looks mostly JavaScript',
      message:
        'Most source files are .js/.jsx with no .ts/.tsx counterparts. React 19 migration does not require TypeScript adoption.',
      recommendation:
        'If a TypeScript migration is desired, plan it as a separate track after the React 19 upgrade is stable.',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: jsx-transform                                                        */
/* -------------------------------------------------------------------------- */

const TSCONFIG_JSX_RE = /"jsx"\s*:\s*"([^"]+)"/i;
const BABEL_REACT_RUNTIME_RE = /["']runtime["']\s*:\s*["'](classic|automatic)["']/i;

function collectJsxTransformIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const tsconfigJsx = readTsconfigJsxSetting(ctx.tsconfigText);
  const babelRuntime = readBabelReactRuntimeFromText(ctx.tsconfigText);
  const reactMajor = ctx.reactMajor;

  const looksClassic = (() => {
    if (tsconfigJsx === 'react') return true;
    if (babelRuntime === 'classic') return true;
    return false;
  })();

  if (looksClassic) {
    out.push({
      code: 'jsx-transform-classic',
      category: 'jsx-transform',
      severity: 'medium',
      title: 'JSX transform looks classic',
      message:
        'tsconfig "jsx" or Babel React runtime indicates the classic JSX transform. React 17+ recommends the automatic transform.',
      recommendation:
        'Plan a step to switch to the automatic JSX transform (`"jsx": "react-jsx"` or `runtime: "automatic"`) before upgrading React.',
    });
    return;
  }

  if (
    !ctx.hasTsconfig &&
    ctx.babelConfigFiles.length === 0 &&
    reactMajor !== undefined &&
    reactMajor < 17
  ) {
    out.push({
      code: 'jsx-transform-config-not-detected',
      category: 'jsx-transform',
      severity: 'info',
      title: 'JSX transform config not detected',
      message:
        'No tsconfig or Babel root config was found, so the JSX transform setting could not be confirmed.',
      recommendation:
        'Add a manual review step in the migration plan to confirm React is using the automatic JSX transform.',
    });
  }
}

function readTsconfigJsxSetting(text: string): string | undefined {
  if (text.length === 0) return undefined;
  const m = text.match(TSCONFIG_JSX_RE);
  if (!m || m[1] === undefined) return undefined;
  return m[1];
}

function readBabelReactRuntimeFromText(text: string): string | undefined {
  if (text.length === 0) return undefined;
  const m = text.match(BABEL_REACT_RUNTIME_RE);
  if (!m || m[1] === undefined) return undefined;
  return m[1];
}

/* -------------------------------------------------------------------------- */
/* Rule: deprecated-react-api                                                 */
/* -------------------------------------------------------------------------- */

interface DeprecatedApiRule {
  readonly code: React19CompatibilityIssueCode;
  readonly title: string;
  readonly message: string;
  readonly recommendation: string;
  readonly severity: React19CompatibilitySeverity;
  readonly count: (s: React19SourceSignals) => number;
}

const DEPRECATED_API_RULES: readonly DeprecatedApiRule[] = [
  {
    code: 'react-dom-render-detected',
    severity: 'high',
    title: 'ReactDOM.render usage detected',
    message:
      '`ReactDOM.render` is removed in React 19. Mount calls must move to `createRoot` from `react-dom/client`.',
    recommendation:
      'Replace each ReactDOM.render call with createRoot during the React 18 bridge phase.',
    count: (s) => s.reactDomRenderUsages ?? 0,
  },
  {
    code: 'react-dom-hydrate-detected',
    severity: 'high',
    title: 'ReactDOM.hydrate usage detected',
    message:
      '`ReactDOM.hydrate` is removed in React 19. SSR hydration must move to `hydrateRoot`.',
    recommendation:
      'Replace each hydrate call with hydrateRoot from react-dom/client.',
    count: (s) => s.reactDomHydrateUsages ?? 0,
  },
  {
    code: 'unmount-component-at-node-detected',
    severity: 'high',
    title: 'unmountComponentAtNode usage detected',
    message:
      '`unmountComponentAtNode` is removed in React 19. Roots must be unmounted via `root.unmount()`.',
    recommendation:
      'Track each call site and switch to root.unmount() once createRoot is adopted.',
    count: (s) => s.unmountComponentAtNodeUsages ?? 0,
  },
  {
    code: 'unstable-render-subtree-detected',
    severity: 'high',
    title: 'unstable_renderSubtreeIntoContainer usage detected',
    message:
      '`unstable_renderSubtreeIntoContainer` is a long-deprecated React internal that does not exist in React 19.',
    recommendation:
      'Replace with portals (`createPortal`) before upgrading.',
    count: (s) => s.unstableRenderSubtreeUsages ?? 0,
  },
  {
    code: 'create-factory-detected',
    severity: 'medium',
    title: 'React.createFactory usage detected',
    message:
      '`React.createFactory` is deprecated and removed in modern React.',
    recommendation:
      'Replace with direct `React.createElement` calls or JSX.',
    count: (s) => s.createFactoryUsages ?? 0,
  },
];

function collectDeprecatedReactApiIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  for (const rule of DEPRECATED_API_RULES) {
    const count = rule.count(ctx.source);
    if (count > 0) {
      out.push({
        code: rule.code,
        category: 'deprecated-react-api',
        severity: rule.severity,
        title: rule.title,
        message: `${rule.message} (detected in ${count} file${count === 1 ? '' : 's'}).`,
        recommendation: rule.recommendation,
        count,
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: deprecated-lifecycle                                                 */
/* -------------------------------------------------------------------------- */

function collectDeprecatedLifecycleIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const total = ctx.source.deprecatedLifecycleTotalCount ?? 0;
  const samples = ctx.source.deprecatedLifecycleSampleFiles ?? [];
  if (total <= 0) return;
  out.push({
    code: 'deprecated-lifecycle-detected',
    category: 'deprecated-lifecycle',
    severity: 'high',
    title: 'Deprecated React lifecycle methods detected',
    message: `Files using deprecated lifecycle methods (componentWillMount / WillReceiveProps / WillUpdate or UNSAFE_*) were detected in ${total} file${total === 1 ? '' : 's'}. These warn on React 17 and break under concurrent rendering.`,
    recommendation:
      'Migrate to componentDidMount / getDerivedStateFromProps or to function components with hooks before upgrading.',
    count: total,
    ...(samples.length > 0 ? { filePaths: samples } : {}),
  });
}

/* -------------------------------------------------------------------------- */
/* Rule: component-patterns                                                   */
/* -------------------------------------------------------------------------- */

function collectComponentPatternIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const findDom = ctx.source.findDomNodeUsages ?? 0;
  if (findDom > 0) {
    out.push({
      code: 'find-dom-node-detected',
      category: 'component-patterns',
      severity: 'high',
      title: 'findDOMNode usage detected',
      message: `findDOMNode is removed in React 19. Detected in ${findDom} file${findDom === 1 ? '' : 's'}.`,
      recommendation:
        'Replace findDOMNode usage with refs (createRef / useRef) before upgrading.',
      count: findDom,
    });
  }

  const stringRefs = ctx.source.stringRefUsages ?? 0;
  if (stringRefs > 0) {
    out.push({
      code: 'string-refs-detected',
      category: 'component-patterns',
      severity: 'high',
      title: 'String refs detected',
      message: `String refs (\`ref="something"\`) are removed in React 19. Detected in ${stringRefs} file${stringRefs === 1 ? '' : 's'}.`,
      recommendation:
        'Replace string refs with callback refs or useRef before upgrading.',
      count: stringRefs,
    });
  }

  const legacyContext = ctx.source.legacyContextIndicators ?? 0;
  if (legacyContext > 0) {
    out.push({
      code: 'legacy-context-detected',
      category: 'component-patterns',
      severity: 'medium',
      title: 'Legacy context API detected',
      message: `Legacy context patterns (childContextTypes / contextTypes / getChildContext) were detected in ${legacyContext} file${legacyContext === 1 ? '' : 's'}.`,
      recommendation:
        'Migrate to React.createContext during the api-compatibility phase.',
      count: legacyContext,
    });
  }

  const classCount = ctx.source.classComponentIndicators ?? 0;
  if (classCount > 0) {
    out.push({
      code: 'class-components-present',
      category: 'component-patterns',
      severity: classCount > 25 ? 'medium' : 'info',
      title: `${classCount} file${classCount === 1 ? '' : 's'} look like class components`,
      message:
        'Class components are still supported in React 19 but increase migration complexity (lifecycle methods, refs, context).',
      recommendation:
        'Track class component density to size the source-modernization phase. Conversion is optional in V1.',
      count: classCount,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: defaultProps / propTypes on function components                      */
/* -------------------------------------------------------------------------- */

function collectDefaultPropsAndPropTypesIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const defaultPropsCount = ctx.source.defaultPropsUsages ?? 0;
  if (defaultPropsCount > 0) {
    const samples = ctx.source.defaultPropsSampleFiles ?? [];
    out.push({
      code: 'default-props-on-function-components',
      category: 'deprecated-react-api',
      severity: 'medium',
      title: 'Default props on function components',
      message: `Possible \`.defaultProps\` assignments were detected in ${defaultPropsCount} file${defaultPropsCount === 1 ? '' : 's'}. React 19 removes \`defaultProps\` support on function components.`,
      recommendation:
        'Prefer ES default parameters or destructuring defaults instead of `.defaultProps` on function components.',
      count: defaultPropsCount,
      ...(samples.length > 0 ? { filePaths: samples } : {}),
    });
  }

  const propTypesCount = ctx.source.propTypesUsages ?? 0;
  if (propTypesCount > 0) {
    const samples = ctx.source.propTypesSampleFiles ?? [];
    out.push({
      code: 'prop-types-on-function-components',
      category: 'deprecated-react-api',
      severity: 'medium',
      title: 'PropTypes on function components',
      message: `PropTypes usage was detected in ${propTypesCount} file${propTypesCount === 1 ? '' : 's'} and may need review for React 19 compatibility.`,
      recommendation:
        'Migrate to TypeScript types or a runtime validation library compatible with React 19.',
      count: propTypesCount,
      ...(samples.length > 0 ? { filePaths: samples } : {}),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: git state                                                            */
/* -------------------------------------------------------------------------- */

function collectGitStateIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  if (ctx.input.gitClean === 'dirty') {
    out.push({
      code: 'dirty-git-state',
      category: 'package-manager',
      severity: 'high',
      title: 'Uncommitted Git changes detected',
      message:
        'The working tree has uncommitted changes. Migration workspaces work best from a clean baseline.',
      recommendation:
        'Commit, stash, or discard existing changes before creating a migration workspace.',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Canonical code attachment                                                  */
/* -------------------------------------------------------------------------- */

function attachCanonicalCodes(
  issues: readonly React19CompatibilityIssue[],
): React19CompatibilityIssue[] {
  return issues.map((issue) => {
    const canonicalCode = resolveReact19CanonicalIssueCode(issue.code);
    if (canonicalCode === undefined) return issue;
    if (issue.canonicalCode === canonicalCode) return issue;
    return { ...issue, canonicalCode };
  });
}

/* -------------------------------------------------------------------------- */
/* Rule: routing                                                              */
/* -------------------------------------------------------------------------- */

function collectRoutingIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  if (ctx.routerPackage === undefined) return;
  if (ctx.routerMajor === undefined) {
    out.push({
      code: 'router-version-unknown',
      category: 'routing',
      severity: 'info',
      title: `${ctx.routerPackage} version cannot be parsed`,
      message: `${ctx.routerPackage} is declared but the version range did not yield a numeric major.`,
      recommendation: 'Pin the router version to a normal semver range and re-run the scan.',
      packageName: ctx.routerPackage,
      ...(ctx.routerVersion !== undefined ? { currentVersion: ctx.routerVersion } : {}),
    });
    return;
  }
  if (ctx.routerMajor <= 3) {
    out.push({
      code: 'router-version-very-old',
      category: 'routing',
      severity: 'high',
      title: `${ctx.routerPackage} v${ctx.routerMajor} is very old`,
      message: 'Routers older than v4 will not work cleanly with React 19 source patterns.',
      recommendation: 'Plan a router upgrade (at minimum v5/v6) before the React 19 upgrade phase.',
      packageName: ctx.routerPackage,
      ...(ctx.routerVersion !== undefined ? { currentVersion: ctx.routerVersion } : {}),
    });
  } else if (ctx.routerMajor < 6) {
    out.push({
      code: 'router-version-old',
      category: 'routing',
      severity: 'medium',
      title: `${ctx.routerPackage} v${ctx.routerMajor} is older than v6`,
      message: 'react-router v4/v5 are still functional but lack modern data-router APIs.',
      recommendation: 'Plan an optional router upgrade after the React 19 migration is stable.',
      packageName: ctx.routerPackage,
      ...(ctx.routerVersion !== undefined ? { currentVersion: ctx.routerVersion } : {}),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: testing                                                              */
/* -------------------------------------------------------------------------- */

function collectTestingIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const enzymeUsageCount = ctx.source.enzymeUsageIndicators ?? 0;
  if (ctx.enzymeVersion !== undefined || ctx.enzymeAdapters.length > 0 || enzymeUsageCount > 0) {
    out.push({
      code: 'enzyme-detected',
      category: 'testing',
      severity: 'high',
      title: 'Enzyme detected',
      message:
        'Enzyme has no officially supported React 18 / 19 adapter and is incompatible with concurrent React rendering.',
      recommendation:
        'Plan a migration to @testing-library/react before upgrading React.',
      packageName: 'enzyme',
      ...(ctx.enzymeVersion !== undefined ? { currentVersion: ctx.enzymeVersion } : {}),
      ...(enzymeUsageCount > 0 ? { count: enzymeUsageCount } : {}),
    });
  }

  if (
    ctx.testingLibraryReactVersion === undefined &&
    ctx.vitestVersion === undefined &&
    ctx.jestVersion === undefined &&
    enzymeUsageCount === 0
  ) {
    out.push({
      code: 'no-modern-testing-library',
      category: 'testing',
      severity: 'info',
      title: 'No modern testing setup detected',
      message:
        'Neither Jest, Vitest, nor @testing-library/react was found.',
      recommendation:
        'Tests are not required for React 19 migration to run, but adding them strengthens the validation gate.',
    });
  }

  if (ctx.reactTestRendererVersion !== undefined) {
    out.push({
      code: 'react-test-renderer-detected',
      category: 'testing',
      severity: 'low',
      title: 'react-test-renderer detected',
      message:
        'react-test-renderer is in maintenance mode and will not receive React 19 updates.',
      recommendation:
        'Migrate test snapshots to @testing-library/react during the testing-modernization track.',
      packageName: 'react-test-renderer',
      currentVersion: ctx.reactTestRendererVersion,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: dependencies (deprecated)                                            */
/* -------------------------------------------------------------------------- */

interface DeprecatedDependencyRule {
  readonly nameOrPattern: string | RegExp;
  readonly severity: React19CompatibilitySeverity;
  readonly reason: string;
  readonly recommendation: string;
  readonly displayName?: string;
}

const DEPRECATED_DEPENDENCY_RULES: readonly DeprecatedDependencyRule[] = [
  {
    nameOrPattern: 'request',
    severity: 'medium',
    reason: 'request is deprecated and unmaintained.',
    recommendation: 'Replace with `undici`, `got`, or built-in `fetch`.',
  },
  {
    nameOrPattern: 'left-pad',
    severity: 'low',
    reason: 'left-pad is unmaintained and trivially replaceable.',
    recommendation: 'Replace with `String.prototype.padStart`.',
  },
  {
    nameOrPattern: /^react-addons-/,
    severity: 'high',
    reason: 'react-addons-* packages are React 0.14 era utilities removed long before React 19.',
    recommendation: 'Remove and replace with their modern in-tree equivalents.',
  },
  {
    nameOrPattern: 'react-hot-loader',
    severity: 'medium',
    reason: 'react-hot-loader is superseded by React Refresh and is incompatible with React 18+ behaviour.',
    recommendation: 'Migrate to React Refresh (@vitejs/plugin-react / react-refresh).',
  },
  {
    nameOrPattern: 'eslint-loader',
    severity: 'low',
    reason: 'eslint-loader is unmaintained.',
    recommendation: 'Use eslint-webpack-plugin or `eslint .` directly.',
  },
  {
    nameOrPattern: 'node-pre-gyp',
    severity: 'low',
    reason: 'node-pre-gyp is deprecated in favour of @mapbox/node-pre-gyp / prebuilt binaries.',
    recommendation: 'Track this as a transitive risk; usually surfaced via a deeper dependency.',
  },
  {
    nameOrPattern: 'core-js',
    severity: 'info',
    reason: 'core-js@2 is end-of-life. Modern Babel presets target core-js@3.',
    recommendation: 'Confirm core-js is on v3; otherwise plan an upgrade.',
  },
  {
    nameOrPattern: 'uuid',
    severity: 'info',
    reason: 'uuid v3/v4 are unmaintained.',
    recommendation: 'Confirm uuid is on a supported major (>=8 ideally).',
  },
];

function collectDeprecatedDependencyIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  // node-sass remains detected, but is now one finding inside this generic
  // pass — not the centre of the scanner.
  if (ctx.nodeSassVersion !== undefined) {
    out.push({
      code: 'node-sass-detected',
      category: 'sass-scss',
      severity: 'medium',
      title: 'node-sass detected',
      message:
        'node-sass is unmaintained since 2020 and tied to LibSass (also unmaintained). It frequently fails to install on modern Node.',
      recommendation: 'Replace `node-sass` with `sass` (Dart Sass).',
      packageName: 'node-sass',
      currentVersion: ctx.nodeSassVersion,
      expectedVersion: 'sass (Dart Sass)',
    });
  }

  for (const rule of DEPRECATED_DEPENDENCY_RULES) {
    const matches = matchDependencies(ctx.manifest, rule.nameOrPattern);
    for (const match of matches) {
      out.push({
        code: 'deprecated-dependency-detected',
        category: 'dependencies',
        severity: rule.severity,
        title: `${match.name} flagged as deprecated`,
        message: rule.reason,
        recommendation: rule.recommendation,
        packageName: match.name,
        currentVersion: match.version,
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: peer-dependencies                                                    */
/* -------------------------------------------------------------------------- */

interface PeerRiskRule {
  readonly pattern: RegExp;
  readonly reason: string;
}

const PEER_RISK_RULES: readonly PeerRiskRule[] = [
  {
    pattern: /react-?16/i,
    reason: 'Package name suggests it is pinned to React 16 — likely needs an alternative on React 19.',
  },
  {
    pattern: /react-?17/i,
    reason: 'Package name suggests it is pinned to React 17 — likely needs an alternative on React 19.',
  },
  {
    pattern: /^enzyme-adapter-react-/i,
    reason: 'Enzyme adapters are tightly bound to a specific React major and have no official React 18+ adapter.',
  },
  {
    pattern: /^@material-ui\/(core|icons|styles|system)/i,
    reason: 'Material UI v4 (`@material-ui/*`) is end-of-life. v5+ ships under `@mui/*`.',
  },
  {
    pattern: /^material-ui$/i,
    reason: 'Pre-v4 Material UI is end-of-life and incompatible with React 17+.',
  },
];

function collectPeerDependencyIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  for (const rule of PEER_RISK_RULES) {
    const matches = matchDependencies(ctx.manifest, rule.pattern);
    for (const match of matches) {
      out.push({
        code: 'peer-dependency-risk-detected',
        category: 'peer-dependencies',
        severity: 'medium',
        title: `${match.name} may need a peer review`,
        message: rule.reason,
        recommendation:
          'Add a manual review step in the migration plan to confirm React 19 peer compatibility (or upgrade the package).',
        packageName: match.name,
        currentVersion: match.version,
      });
    }
  }

  // react-bootstrap heuristic — only flag on very old majors when parseable.
  const reactBootstrap = readVersion(ctx.manifest, 'react-bootstrap');
  const reactBootstrapMajor = parseMajor(reactBootstrap);
  if (
    reactBootstrap !== undefined &&
    reactBootstrapMajor !== undefined &&
    reactBootstrapMajor < 2
  ) {
    out.push({
      code: 'peer-dependency-risk-detected',
      category: 'peer-dependencies',
      severity: 'medium',
      title: `react-bootstrap v${reactBootstrapMajor} is older than v2`,
      message:
        'react-bootstrap below v2 was built for React 16 idioms and may not be compatible with React 18+ rendering.',
      recommendation: 'Plan an optional react-bootstrap upgrade.',
      packageName: 'react-bootstrap',
      currentVersion: reactBootstrap,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: sass-scss                                                            */
/* -------------------------------------------------------------------------- */

const SASS_LOADER_VERY_OLD_THRESHOLD = 10 as const;

function collectSassScssIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const scss = ctx.source.scssFileCount ?? 0;
  const sass = ctx.source.sassFileCount ?? 0;
  const total = scss + sass;
  const hasCompiler = ctx.sassVersion !== undefined || ctx.nodeSassVersion !== undefined;

  if (total > 0 && !hasCompiler) {
    out.push({
      code: 'sass-files-without-compiler',
      category: 'sass-scss',
      severity: 'medium',
      title: 'SCSS / Sass files exist without a Sass compiler',
      message: `Detected ${total} .scss/.sass file${total === 1 ? '' : 's'} but neither \`sass\` nor \`node-sass\` is declared in the manifest.`,
      recommendation: 'Add `sass` to the project so styles continue to compile during a React 19 migration.',
    });
  }

  const sassLoaderMajor = parseMajor(ctx.sassLoaderVersion);
  if (
    ctx.sassLoaderVersion !== undefined &&
    sassLoaderMajor !== undefined &&
    sassLoaderMajor < SASS_LOADER_VERY_OLD_THRESHOLD
  ) {
    out.push({
      code: 'sass-loader-very-old',
      category: 'sass-scss',
      severity: 'low',
      title: `sass-loader ${sassLoaderMajor} is old`,
      message:
        'sass-loader below 10 predates Dart-Sass-first defaults and may need a config update during the build-tool upgrade.',
      recommendation: 'Plan an optional sass-loader upgrade alongside other tooling changes.',
      packageName: 'sass-loader',
      currentVersion: ctx.sassLoaderVersion,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Rule: package-manager                                                      */
/* -------------------------------------------------------------------------- */

function collectPackageManagerIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  if (ctx.packageManager === 'unknown') {
    out.push({
      code: 'package-manager-not-detected',
      category: 'package-manager',
      severity: 'high',
      title: 'Package manager not detected',
      message:
        'No `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, or `bun.lock` was found at the project root.',
      recommendation: 'Run a clean install with the project\'s preferred package manager to generate a lockfile.',
    });
  }

  if (ctx.lockFiles.length === 0) {
    out.push({
      code: 'no-lockfile-found',
      category: 'package-manager',
      severity: 'high',
      title: 'No lockfile found',
      message: 'Reproducible installs require a lockfile.',
      recommendation: 'Generate a lockfile (`npm install` / `yarn` / `pnpm install` / `bun install`).',
    });
  } else if (ctx.lockFiles.length > 1) {
    out.push({
      code: 'multiple-lockfiles-found',
      category: 'package-manager',
      severity: 'medium',
      title: 'Multiple lockfiles found',
      message: `Found ${ctx.lockFiles.length} lockfiles: ${ctx.lockFiles.join(', ')}.`,
      recommendation: 'Pick a single package manager and remove the other lockfiles.',
    });
  }

  if (ctx.packageManager !== 'unknown' && ctx.lockFiles.length > 0) {
    const expected = LOCKFILE_BY_PM[ctx.packageManager];
    if (expected !== undefined && !ctx.lockFiles.some((f) => sameLockfile(f, expected))) {
      out.push({
        code: 'package-manager-lockfile-mismatch',
        category: 'package-manager',
        severity: 'low',
        title: 'Detected package manager does not match lockfiles',
        message: `Inferred ${ctx.packageManager} but lockfile(s) ${ctx.lockFiles.join(', ')} suggest a different manager.`,
        recommendation: 'Confirm the active package manager and remove orphaned lockfiles.',
      });
    }
  }
}

const LOCKFILE_BY_PM: Readonly<Record<React19CompatibilityPackageManager, string | undefined>> = {
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
  bun: 'bun.lockb',
  unknown: undefined,
};

function sameLockfile(a: string, b: string): boolean {
  if (a === b) return true;
  if (b === 'bun.lockb' && a === 'bun.lock') return true;
  if (a === 'bun.lockb' && b === 'bun.lock') return true;
  return false;
}

/* -------------------------------------------------------------------------- */
/* Rule: validation                                                           */
/* -------------------------------------------------------------------------- */

function collectValidationIssues(
  ctx: ScanContext,
  out: React19CompatibilityIssue[],
): void {
  const scripts = ctx.manifest.scripts;
  const has = (name: string): boolean => scripts[name] !== undefined;

  if (!has('build')) {
    out.push({
      code: 'missing-build-script',
      category: 'validation',
      severity: 'high',
      title: 'No `build` script',
      message: 'The migration runner uses the `build` script as a per-step validation gate.',
      recommendation: 'Add a `build` script to package.json before running migrations.',
    });
  }
  if (!has('test')) {
    out.push({
      code: 'missing-test-script',
      category: 'validation',
      severity: 'medium',
      title: 'No `test` script',
      message: 'Without a `test` script, regression validation is limited to build + typecheck.',
      recommendation: 'Add a `test` script (Jest, Vitest, etc.) to harden each migration step.',
    });
  }
  if (!has('lint')) {
    out.push({
      code: 'missing-lint-script',
      category: 'validation',
      severity: 'low',
      title: 'No `lint` script',
      message: 'A `lint` script provides a fast static gate between migration steps.',
      recommendation: 'Add `eslint .` or your project\'s equivalent.',
    });
  }
  const tsTotal = (ctx.source.tsFileCount ?? 0) + (ctx.source.tsxFileCount ?? 0);
  const hasTypecheck =
    has('typecheck') ||
    has('type-check') ||
    has('tsc');
  const tsPresent = ctx.typescriptVersion !== undefined || ctx.hasTsconfig || tsTotal > 0;
  if (!hasTypecheck) {
    out.push({
      code: 'missing-typecheck-script',
      category: 'validation',
      severity: tsPresent ? 'low' : 'info',
      title: 'No `typecheck` script',
      message: tsPresent
        ? 'TypeScript is configured but no `typecheck` script is wired up.'
        : 'No `typecheck` script is wired up.',
      recommendation: 'Add `tsc --noEmit` (or the equivalent) so each migration step can validate types.',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

function buildSummary(
  issues: readonly React19CompatibilityIssue[],
): React19CompatibilitySummary {
  let blockerCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'blocker':
        blockerCount += 1;
        break;
      case 'high':
        highCount += 1;
        break;
      case 'medium':
        mediumCount += 1;
        break;
      case 'low':
        lowCount += 1;
        break;
      case 'info':
        infoCount += 1;
        break;
    }
  }
  return {
    totalIssues: issues.length,
    blockerCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
  };
}

const SEVERITY_RANK: Record<React19CompatibilitySeverity, number> = {
  blocker: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function buildCategoryReports(
  issues: readonly React19CompatibilityIssue[],
): readonly React19CompatibilityCategoryReport[] {
  const byCategory = new Map<React19CompatibilityCategory, React19CompatibilityIssue[]>();
  for (const c of REACT_19_COMPATIBILITY_CATEGORIES_ORDERED) {
    byCategory.set(c, []);
  }
  for (const issue of issues) {
    const list = byCategory.get(issue.category);
    if (list !== undefined) {
      list.push(issue);
    }
  }

  const out: React19CompatibilityCategoryReport[] = [];
  for (const category of REACT_19_COMPATIBILITY_CATEGORIES_ORDERED) {
    const list = byCategory.get(category) ?? [];
    if (list.length === 0) {
      out.push({ category, status: 'clean', issueCount: 0 });
      continue;
    }
    const sorted = [...list].sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
    );
    const top = sorted[0]!;
    out.push({
      category,
      status: severityToCategoryStatus(top.severity),
      issueCount: list.length,
      topIssue: top,
    });
  }
  return out;
}

function severityToCategoryStatus(
  severity: React19CompatibilitySeverity,
): React19CompatibilityCategoryStatus {
  switch (severity) {
    case 'blocker':
      return 'blocker';
    case 'high':
      return 'risk';
    case 'medium':
      return 'warning';
    case 'low':
      return 'warning';
    case 'info':
      return 'info';
  }
}

function buildSignals(ctx: ScanContext): React19CompatibilitySignals {
  const tsFileCount = ctx.source.tsFileCount ?? 0;
  const tsxFileCount = ctx.source.tsxFileCount ?? 0;
  const jsFileCount = ctx.source.jsFileCount ?? 0;
  const jsxFileCount = ctx.source.jsxFileCount ?? 0;
  const tsTotal = tsFileCount + tsxFileCount;
  const jsTotal = jsFileCount + jsxFileCount;

  const tsconfigJsxSetting = readTsconfigJsxSetting(ctx.tsconfigText);
  const babelRuntime = readBabelReactRuntimeFromText(ctx.tsconfigText);
  const jsxTransformLooksClassic =
    tsconfigJsxSetting === 'react' || babelRuntime === 'classic';

  const validationCommands: string[] = [];
  for (const name of ['build', 'test', 'lint', 'typecheck', 'type-check', 'tsc']) {
    if (ctx.manifest.scripts[name] !== undefined && !validationCommands.includes(name)) {
      validationCommands.push(name);
    }
  }

  return {
    hasReactScripts: ctx.reactScriptsVersion !== undefined,
    hasVite: ctx.viteVersion !== undefined,
    hasWebpack: ctx.webpackVersion !== undefined,
    hasParcel: ctx.parcelVersion !== undefined,
    hasRollup: ctx.rollupVersion !== undefined,
    hasNext: ctx.nextVersion !== undefined,
    hasBabelConfig: ctx.babelConfigFiles.length > 0,
    hasWebpackConfig: ctx.webpackConfigFiles.length > 0,
    babelConfigFiles: ctx.babelConfigFiles,
    webpackConfigFiles: ctx.webpackConfigFiles,

    hasTypeScriptConfig: ctx.hasTsconfig,
    hasTypeScriptDependency: ctx.typescriptVersion !== undefined,
    tsFileCount,
    tsxFileCount,
    jsFileCount,
    jsxFileCount,
    isMostlyJavaScript: jsTotal > 0 && tsTotal === 0,
    isMixedJsTs: jsTotal > 0 && tsTotal > 0,

    ...(tsconfigJsxSetting !== undefined ? { tsconfigJsxSetting } : {}),
    jsxTransformLooksClassic,

    ...(ctx.routerPackage !== undefined ? { routerPackage: ctx.routerPackage } : {}),
    ...(ctx.routerVersion !== undefined ? { routerVersion: ctx.routerVersion } : {}),
    ...(ctx.routerMajor !== undefined ? { routerMajor: ctx.routerMajor } : {}),

    hasJest: ctx.jestVersion !== undefined,
    hasVitest: ctx.vitestVersion !== undefined,
    hasTestingLibraryReact: ctx.testingLibraryReactVersion !== undefined,
    hasReactTestRenderer: ctx.reactTestRendererVersion !== undefined,
    hasEnzyme:
      ctx.enzymeVersion !== undefined ||
      ctx.enzymeAdapters.length > 0 ||
      (ctx.source.enzymeUsageIndicators ?? 0) > 0,
    enzymeAdapters: ctx.enzymeAdapters,

    scssFileCount: ctx.source.scssFileCount ?? 0,
    sassFileCount: ctx.source.sassFileCount ?? 0,
    hasNodeSass: ctx.nodeSassVersion !== undefined,
    hasSass: ctx.sassVersion !== undefined,
    hasSassLoader: ctx.sassLoaderVersion !== undefined,
    ...(ctx.sassLoaderVersion !== undefined ? { sassLoaderVersion: ctx.sassLoaderVersion } : {}),

    packageManager: ctx.packageManager,
    lockFiles: ctx.lockFiles,

    hasBuildScript: ctx.manifest.scripts['build'] !== undefined,
    hasTestScript: ctx.manifest.scripts['test'] !== undefined,
    hasLintScript: ctx.manifest.scripts['lint'] !== undefined,
    hasTypecheckScript:
      ctx.manifest.scripts['typecheck'] !== undefined ||
      ctx.manifest.scripts['type-check'] !== undefined ||
      ctx.manifest.scripts['tsc'] !== undefined,
    availableValidationCommands: validationCommands,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function readVersion(
  manifest: React19PackageManifest,
  name: string,
): string | undefined {
  const buckets: ReadonlyArray<Readonly<Record<string, string>>> = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];
  for (const bucket of buckets) {
    const v = bucket[name];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

interface DependencyMatch {
  readonly name: string;
  readonly version: string;
}

function matchDependencies(
  manifest: React19PackageManifest,
  pattern: string | RegExp,
): readonly DependencyMatch[] {
  const seen = new Set<string>();
  const out: DependencyMatch[] = [];
  const buckets: ReadonlyArray<Readonly<Record<string, string>>> = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];
  const test = (name: string): boolean =>
    typeof pattern === 'string' ? name === pattern : pattern.test(name);

  for (const bucket of buckets) {
    for (const [name, version] of Object.entries(bucket)) {
      if (seen.has(name)) continue;
      if (test(name)) {
        seen.add(name);
        out.push({ name, version });
      }
    }
  }
  return out;
}

function collectMatchingDependencies(
  manifest: React19PackageManifest,
  pattern: RegExp,
): readonly string[] {
  return matchDependencies(manifest, pattern).map((m) => m.name);
}

/**
 * Mirrors the parser used by `parseReactMajor` in the migration-context
 * service but lives here so the compatibility scanner has no inbound
 * dependency on a sibling service. Conservative: returns `undefined` for
 * any range that does not contain a clear leading numeric major.
 */
export function parseMajor(version: string | undefined): number | undefined {
  if (version === undefined) return undefined;
  const trimmed = version.trim();
  if (trimmed.length === 0) return undefined;
  if (UNPARSEABLE_PROTOCOL_RE.test(trimmed)) return undefined;
  if (trimmed === '*' || /^[a-z][a-z0-9-]*$/i.test(trimmed)) return undefined;
  const match = trimmed.match(/(\d+)/);
  if (!match || match[1] === undefined) return undefined;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}

const UNPARSEABLE_PROTOCOL_RE =
  /^(workspace:|file:|link:|npm:|git\+|git:|https?:|portal:|catalog:)/i;