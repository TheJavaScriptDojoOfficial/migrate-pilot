/**
 * Scanner service.
 *
 * Single entry-point for running a deterministic, read-only scan and
 * converting the raw Tauri payload into a strongly-typed
 * {@link ScanReport}.
 *
 * Architectural rules
 * -------------------
 * - No React imports. Pure logic so this module is trivially unit-testable
 *   and reusable by future planning code.
 * - No filesystem access from JS. The walker runs in Rust; this service
 *   only parses + interprets the result.
 * - Throws typed `ScannerServiceError` so the calling hook can branch on
 *   the failure mode without parsing strings.
 */

import {
  invokeCommand,
  type ProjectScanLifecycleRaw,
  type ProjectScanRaw,
} from '@shared/utils/commands';
import { runtimeConfig } from '@shared/config/runtime';

import { buildRecommendations } from './scannerRecommendationService';
import { buildRiskReport } from './scannerRiskService';

import type { PackageManager } from '@features/project-selection';
import { computeReact19MigrationContext } from '@features/react19-migration';
import type {
  DependencyReport,
  DeprecatedLifecycleUsage,
  DeprecatedPackage,
  Recommendation,
  RiskReport,
  ScanReport,
  ScanProjectInfo,
  ScriptReport,
  SourceAnalysisReport,
} from '../types/scanner.types';

/* -------------------------------------------------------------------------- */
/* Error type                                                                 */
/* -------------------------------------------------------------------------- */

export type ScannerServiceErrorKind =
  | 'tauri-unavailable'
  | 'invalid-path'
  | 'ipc-error';

export class ScannerServiceError extends Error {
  public readonly kind: ScannerServiceErrorKind;

  public constructor(kind: ScannerServiceErrorKind, message: string) {
    super(message);
    this.name = 'ScannerServiceError';
    this.kind = kind;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Run the deterministic Rust scanner and convert the raw payload into a
 * `ScanReport` ready for the UI.
 */
export async function runProjectScan(path: string): Promise<ScanReport> {
  if (!runtimeConfig.isTauri) {
    throw new ScannerServiceError(
      'tauri-unavailable',
      'The scanner is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: ProjectScanRaw;
  try {
    raw = await invokeCommand('project_scan', { path });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/invalid input|not accessible|not a directory/i.test(message)) {
      throw new ScannerServiceError('invalid-path', message);
    }
    throw new ScannerServiceError('ipc-error', message);
  }

  return buildScanReport(raw);
}

/**
 * Pure converter from raw Rust payload → typed `ScanReport`.
 *
 * Exported separately so unit tests can feed canned `ProjectScanRaw`
 * fixtures without touching the IPC layer.
 */
export function buildScanReport(raw: ProjectScanRaw): ScanReport {
  const parsedPackageJson = parsePackageJson(raw.packageJsonText);

  const dependencies = buildDependencyReport(raw, parsedPackageJson.value);
  const sourceAnalysis = buildSourceAnalysisReport(raw);
  const scripts = buildScriptReport(parsedPackageJson.value);

  const risks: RiskReport = buildRiskReport({
    dependencies,
    sourceAnalysis,
    scripts,
    packageJsonMissing: raw.packageJsonText === null,
    ...(parsedPackageJson.error !== undefined
      ? { packageJsonInvalidReason: parsedPackageJson.error }
      : {}),
  });

  const recommendations: readonly Recommendation[] = buildRecommendations({
    dependencies,
    sourceAnalysis,
    scripts,
    risks,
  });

  const projectInfo: ScanProjectInfo = {
    path: raw.path,
    name: parsedPackageJson.value?.name ?? raw.folderName,
    isGitRepository: raw.isGitRepository,
    ...(raw.currentBranch != null && raw.currentBranch.length > 0
      ? { currentBranch: raw.currentBranch }
      : {}),
    gitClean: raw.gitClean === null ? 'unknown' : raw.gitClean ? 'clean' : 'dirty',
    hasTypeScript:
      raw.tsconfigPresent ||
      dependencies.tooling.typescript !== undefined ||
      sourceAnalysis.tsFiles + sourceAnalysis.tsxFiles > 0,
    complexity: estimateComplexity(sourceAnalysis),
    durationMs: raw.durationMs,
  };

  // R2 step 2 — React 19 migration context + full support eligibility.
  // Pure and deterministic; uses only signals the scanner already
  // extracted (package.json text, declared versions, inferred package
  // manager from lockfiles).
  const react19 = computeReact19MigrationContext({
    packageJsonPresent: raw.packageJsonText !== null,
    packageManager: dependencies.packageManager,
    ...(dependencies.reactVersion !== undefined
      ? { reactVersion: dependencies.reactVersion }
      : {}),
    ...(dependencies.reactDomVersion !== undefined
      ? { reactDomVersion: dependencies.reactDomVersion }
      : {}),
  });

  return {
    id: makeReportId(raw),
    projectPath: raw.path,
    generatedAt: new Date().toISOString(),
    projectInfo,
    dependencies,
    sourceAnalysis,
    scripts,
    risks,
    recommendations,
    ...(react19.context !== undefined
      ? { react19MigrationContext: react19.context }
      : {}),
    react19SupportStatus: react19.status,
  };
}

/* -------------------------------------------------------------------------- */
/* package.json parsing                                                       */
/* -------------------------------------------------------------------------- */

interface ParsedPackageJson {
  readonly name?: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly scripts: Readonly<Record<string, string>>;
}

interface ParsePackageJsonResult {
  readonly value?: ParsedPackageJson;
  readonly error?: string;
}

function parsePackageJson(text: string | null): ParsePackageJsonResult {
  if (text === null) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: 'package.json does not contain a JSON object.' };
  }
  const obj = raw as Record<string, unknown>;
  return {
    value: {
      ...(typeof obj['name'] === 'string' && (obj['name'] as string).length > 0
        ? { name: (obj['name'] as string).trim() }
        : {}),
      dependencies: pickStringRecord(obj['dependencies']),
      devDependencies: pickStringRecord(obj['devDependencies']),
      peerDependencies: pickStringRecord(obj['peerDependencies']),
      optionalDependencies: pickStringRecord(obj['optionalDependencies']),
      scripts: pickStringRecord(obj['scripts']),
    },
  };
}

function pickStringRecord(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw.length > 0) {
      out[key] = raw;
    }
  }
  return out;
}

function readVersion(
  pkg: ParsedPackageJson | undefined,
  name: string,
): string | undefined {
  if (!pkg) return undefined;
  const buckets = [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ];
  for (const bucket of buckets) {
    const v = bucket[name];
    if (typeof v === 'string' && v.length > 0) {
      return v;
    }
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* DependencyReport                                                           */
/* -------------------------------------------------------------------------- */

const ROUTING_PACKAGES = ['react-router-dom', 'react-router'] as const;

function buildDependencyReport(
  raw: ProjectScanRaw,
  pkg: ParsedPackageJson | undefined,
): DependencyReport {
  const lockFiles = collectLockFiles(raw.lockFiles);
  const packageManager = inferPackageManager(raw.lockFiles);

  const reactVersion = readVersion(pkg, 'react');
  const reactDomVersion = readVersion(pkg, 'react-dom');
  const reactScriptsVersion = readVersion(pkg, 'react-scripts');
  const reactMajor = parseMajor(reactVersion);

  const nodeSassVersion = readVersion(pkg, 'node-sass');
  const sassVersion = readVersion(pkg, 'sass');

  const routing = pickRouting(pkg);

  const deprecatedPackages: DeprecatedPackage[] = [];
  if (nodeSassVersion !== undefined) {
    deprecatedPackages.push({
      name: 'node-sass',
      version: nodeSassVersion,
      reason:
        'Unmaintained since 2020 and bound to LibSass (also unmaintained). Frequent install failures on modern Node.',
      recommendedReplacement: 'sass',
    });
  }

  return {
    ...(reactVersion !== undefined ? { reactVersion } : {}),
    ...(reactDomVersion !== undefined ? { reactDomVersion } : {}),
    ...(reactScriptsVersion !== undefined ? { reactScriptsVersion } : {}),
    ...(reactMajor !== undefined ? { reactMajor } : {}),
    packageManager,
    lockFiles,
    deprecatedPackages,
    styling: {
      usesNodeSass: nodeSassVersion !== undefined,
      ...(nodeSassVersion !== undefined ? { nodeSassVersion } : {}),
      usesSass: sassVersion !== undefined,
      ...(sassVersion !== undefined ? { sassVersion } : {}),
    },
    routing,
    stateManagement: {
      ...optionalEntry('redux', readVersion(pkg, 'redux')),
      ...optionalEntry('reduxToolkit', readVersion(pkg, '@reduxjs/toolkit')),
      ...optionalEntry('mobx', readVersion(pkg, 'mobx')),
      ...optionalEntry('zustand', readVersion(pkg, 'zustand')),
    },
    testing: {
      ...optionalEntry('jest', readVersion(pkg, 'jest')),
      ...optionalEntry(
        'testingLibraryReact',
        readVersion(pkg, '@testing-library/react'),
      ),
      ...optionalEntry('cypress', readVersion(pkg, 'cypress')),
      ...optionalEntry('playwright', readVersion(pkg, '@playwright/test')),
      ...optionalEntry('vitest', readVersion(pkg, 'vitest')),
    },
    tooling: {
      ...optionalEntry('typescript', readVersion(pkg, 'typescript')),
      ...optionalEntry('eslint', readVersion(pkg, 'eslint')),
      ...optionalEntry('prettier', readVersion(pkg, 'prettier')),
    },
  };
}

function pickRouting(
  pkg: ParsedPackageJson | undefined,
): DependencyReport['routing'] {
  for (const name of ROUTING_PACKAGES) {
    const version = readVersion(pkg, name);
    if (version !== undefined) {
      return { packageName: name, version };
    }
  }
  return {};
}

function optionalEntry<K extends string, V>(
  key: K,
  value: V | undefined,
): Record<K, V> | Record<string, never> {
  return value !== undefined ? ({ [key]: value } as Record<K, V>) : {};
}

function inferPackageManager(
  lockFiles: ProjectScanRaw['lockFiles'],
): PackageManager {
  if (lockFiles.npm) return 'npm';
  if (lockFiles.yarn) return 'yarn';
  if (lockFiles.pnpm) return 'pnpm';
  if (lockFiles.bun) return 'bun';
  return 'unknown';
}

function collectLockFiles(
  lockFiles: ProjectScanRaw['lockFiles'],
): readonly string[] {
  const out: string[] = [];
  if (lockFiles.npm) out.push('package-lock.json');
  if (lockFiles.yarn) out.push('yarn.lock');
  if (lockFiles.pnpm) out.push('pnpm-lock.yaml');
  if (lockFiles.bun) out.push('bun.lockb');
  return out;
}

function parseMajor(version: string | undefined): number | undefined {
  if (version === undefined) return undefined;
  // Strip semver range characters (^, ~, >=, etc.) before extracting the
  // major. Accepts forms like "^17.0.2", ">=18.0.0 <19.0.0", "18".
  const match = version.match(/(\d+)/);
  if (!match || match[1] === undefined) return undefined;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}

/* -------------------------------------------------------------------------- */
/* SourceAnalysisReport                                                       */
/* -------------------------------------------------------------------------- */

function buildSourceAnalysisReport(raw: ProjectScanRaw): SourceAnalysisReport {
  const s = raw.source;
  const totalSource =
    s.jsFiles + s.jsxFiles + s.tsFiles + s.tsxFiles + s.styleFiles + s.jsonFiles;
  return {
    totalFilesScanned: s.totalFilesScanned,
    jsFiles: s.jsFiles,
    jsxFiles: s.jsxFiles,
    tsFiles: s.tsFiles,
    tsxFiles: s.tsxFiles,
    styleFiles: s.styleFiles,
    jsonFiles: s.jsonFiles,
    classComponentIndicators: s.classComponentIndicators,
    deprecatedLifecycleIndicators: mapLifecycle(s.deprecatedLifecycleIndicators),
    reactDomRenderUsages: s.reactDomRenderUsages,
    legacyContextIndicators: s.legacyContextIndicators,
    routerUsageIndicators: s.routerUsageIndicators,
    scannedDirectories: [...s.scannedDirectories],
    skippedDirectories: [...s.skippedDirectories],
    truncated: raw.limits.truncated,
    filesSkippedTooLarge: raw.limits.filesSkippedTooLarge,
    isEmpty: totalSource === 0,
  };
}

function mapLifecycle(
  raw: readonly ProjectScanLifecycleRaw[],
): readonly DeprecatedLifecycleUsage[] {
  return raw.map((entry) => ({
    method: entry.method,
    fileCount: entry.fileCount,
    ...(entry.exampleFile != null && entry.exampleFile.length > 0
      ? { exampleFile: entry.exampleFile }
      : {}),
  }));
}

/* -------------------------------------------------------------------------- */
/* ScriptReport                                                               */
/* -------------------------------------------------------------------------- */

function buildScriptReport(pkg: ParsedPackageJson | undefined): ScriptReport {
  const scripts = pkg?.scripts ?? {};
  return {
    hasStart: typeof scripts['start'] === 'string',
    hasDev: typeof scripts['dev'] === 'string',
    hasBuild: typeof scripts['build'] === 'string',
    hasTest: typeof scripts['test'] === 'string',
    hasLint: typeof scripts['lint'] === 'string',
    hasTypecheck:
      typeof scripts['typecheck'] === 'string' ||
      typeof scripts['type-check'] === 'string' ||
      typeof scripts['tsc'] === 'string',
    raw: scripts,
  };
}

/* -------------------------------------------------------------------------- */
/* misc                                                                       */
/* -------------------------------------------------------------------------- */

function estimateComplexity(
  source: SourceAnalysisReport,
): ScanProjectInfo['complexity'] {
  const code = source.jsFiles + source.jsxFiles + source.tsFiles + source.tsxFiles;
  if (code <= 30) return 'small';
  if (code <= 200) return 'medium';
  return 'large';
}

function makeReportId(raw: ProjectScanRaw): string {
  // Stable-ish id: project hash + start-of-scan timestamp slot. We do not
  // need cryptographic uniqueness here; the report lives in-memory only.
  const slug = raw.path.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return `scan:${slug}:${Date.now()}`;
}
