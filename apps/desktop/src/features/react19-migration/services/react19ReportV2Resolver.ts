/**
 * React 19 Report V2 resolver / hydrator (R5 Step 11).
 *
 * Planner V2 is contractually allowed to read plan-shaping data **only**
 * from the React 19 Report V2 surface on the scan report — namely:
 *
 *   - `scanReport.react19MigrationContext`
 *   - `scanReport.react19SupportStatus`
 *   - `scanReport.react19CompatibilityReport`
 *   - `scanReport.react19RiskEngine`
 *   - `scanReport.react19ReadinessReport`
 *
 * Older persisted scan reports (pre-R3 / pre-R2 step 5) may be missing
 * the derived pieces (`react19RiskEngine`, `react19ReadinessReport`).
 * Those derivations are deterministic and can be rebuilt on demand from
 * the migration context + compatibility report. This module centralizes
 * that hydration so the planner store and the planner service share one
 * single answer to "is this scan report ready for Plan V2 generation?".
 *
 * Why a dedicated resolver instead of inlining the logic?
 *   - The planner stays free of scanner-shape archaeology.
 *   - The store can fail fast with an explicit, user-facing reason
 *     before invoking the generator, instead of producing an empty plan
 *     and surfacing it as a confusing "no steps" outcome.
 *   - Future surfaces (e.g. CLI, headless test harness) can reuse the
 *     same gate without duplicating the rebuild logic.
 */

import type { ScanReport } from '@features/scanner';

import { buildReact19RiskEngine } from './react19RiskRecommendationEngine';
import { buildReact19ReadinessReportViewModel } from './react19ReadinessReportViewModel';

/** Whether the resolver had to rebuild a Report V2 field on the fly. */
export interface React19ReportV2RebuildFlags {
  readonly riskEngine: boolean;
  readonly readinessReport: boolean;
}

export interface React19ReportV2HydrationSuccess {
  readonly ok: true;
  /**
   * A {@link ScanReport} with every Report V2 field populated. The
   * planner is expected to consume this hydrated report directly — it
   * MUST NOT fall back to scanner-only shape lookups.
   */
  readonly scanReport: ScanReport;
  /** Records which Report V2 fields were missing from the input. */
  readonly rebuilt: React19ReportV2RebuildFlags;
}

export interface React19ReportV2HydrationFailure {
  readonly ok: false;
  /** Stable identifier the UI / store can branch on. */
  readonly code:
    | 'migration-context-missing'
    | 'compatibility-report-missing'
    | 'unsupported-source-major';
  /** Fully-formed, user-facing reason the planner UI can surface. */
  readonly reason: string;
}

export type React19ReportV2HydrationResult =
  | React19ReportV2HydrationSuccess
  | React19ReportV2HydrationFailure;

const SUPPORTED_SOURCE_MAJORS = new Set<number>([16, 17, 18]);

/**
 * Ensure the given {@link ScanReport} carries a complete React 19
 * Report V2 surface that Planner V2 can consume.
 *
 * Behaviour:
 *   - Fails fast (no rebuild) when the migration context is missing or
 *     the source React major is outside the supported 16/17/18 range —
 *     these are scanner-owned facts the planner cannot synthesize.
 *   - Fails when `react19RiskEngine` is missing AND
 *     `react19CompatibilityReport` is also missing — the risk engine
 *     derives from compatibility issues, so without either input we
 *     cannot rebuild safely.
 *   - Otherwise rebuilds whichever derived fields are missing via the
 *     canonical builder functions and returns the hydrated report.
 *
 * The returned report is a shallow copy of the input — callers can
 * safely pass it on to the planner without mutating the scanner store.
 */
export function hydrateReact19ScanReportV2(
  scanReport: ScanReport,
): React19ReportV2HydrationResult {
  const context = scanReport.react19MigrationContext;
  if (context === undefined) {
    return {
      ok: false,
      code: 'migration-context-missing',
      reason:
        'React 19 migration context is missing from the scan report. Re-run the React 19 compatibility scan to regenerate it.',
    };
  }
  if (!SUPPORTED_SOURCE_MAJORS.has(context.sourceReactMajor)) {
    return {
      ok: false,
      code: 'unsupported-source-major',
      reason: `Source React major ${context.sourceReactMajor} is outside the supported React 16/17/18 range. React 19 Plan V2 cannot be generated.`,
    };
  }

  let hydrated: ScanReport = scanReport;
  let riskEngineRebuilt = false;
  let readinessReportRebuilt = false;

  if (hydrated.react19RiskEngine === undefined) {
    if (hydrated.react19CompatibilityReport === undefined) {
      return {
        ok: false,
        code: 'compatibility-report-missing',
        reason:
          'React 19 compatibility report is missing from the scan report and the risk engine cannot be rebuilt without it. Re-run the React 19 compatibility scan.',
      };
    }
    hydrated = {
      ...hydrated,
      react19RiskEngine: buildReact19RiskEngine(hydrated),
    };
    riskEngineRebuilt = true;
  }

  if (hydrated.react19ReadinessReport === undefined) {
    hydrated = {
      ...hydrated,
      react19ReadinessReport: buildReact19ReadinessReportViewModel({
        scanReport: hydrated,
      }),
    };
    readinessReportRebuilt = true;
  }

  return {
    ok: true,
    scanReport: hydrated,
    rebuilt: {
      riskEngine: riskEngineRebuilt,
      readinessReport: readinessReportRebuilt,
    },
  };
}

export function isReact19ReportV2HydrationFailure(
  result: React19ReportV2HydrationResult,
): result is React19ReportV2HydrationFailure {
  return result.ok === false;
}
