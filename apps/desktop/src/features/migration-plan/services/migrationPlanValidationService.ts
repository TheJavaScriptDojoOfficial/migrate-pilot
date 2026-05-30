/**
 * Migration plan validation service.
 *
 * Pure, deterministic mapping from a project's available scripts +
 * package manager to a list of validation commands. Used by the plan
 * generator to attach realistic `validationCommands` to each step.
 *
 * Why a dedicated module?
 *   - Keeps the planner free from package-manager string concatenation.
 *   - Centralises the script names we accept (`typecheck` vs `type-check`).
 *   - One place to extend when the orchestrator learns to invoke validation.
 *
 * No process is spawned here — Milestone 4 is planning only. The commands
 * are *suggestions* surfaced to the user, not actual executions.
 */
import type { PackageManager } from '@features/project-selection';
import type { ScriptReport } from '@features/scanner';

/** Logical script types we know how to map to package-manager commands. */
export type ValidationCommandKind =
  | 'build'
  | 'test'
  | 'lint'
  | 'typecheck'
  | 'start'
  | 'dev';

export interface ValidationCommandPlan {
  readonly kind: ValidationCommandKind;
  readonly command: string;
  /** The script name actually present in package.json that drives the command. */
  readonly scriptName: string;
  /** True when this script can be used as a regression gate per step. */
  readonly isPrimary: boolean;
}

/**
 * Resolve the concrete shell command for a logical validation kind, given
 * the project's package manager and the script names it exposes.
 *
 * Returns `undefined` when the corresponding script is not declared — we
 * never invent commands the project does not own.
 */
export function resolveValidationCommand(
  kind: ValidationCommandKind,
  packageManager: PackageManager,
  scripts: ScriptReport,
): ValidationCommandPlan | undefined {
  const scriptName = findScriptName(kind, scripts);
  if (scriptName === undefined) return undefined;

  return {
    kind,
    scriptName,
    command: formatRun(packageManager, scriptName),
    isPrimary: PRIMARY_KINDS.has(kind),
  };
}

/**
 * Build the full set of validation commands derived from the project's
 * scripts. Ordering is stable: build first, then typecheck, lint, test —
 * matching the validation cadence described in the constitution
 * (build > static checks > tests).
 */
export function resolveAllValidationCommands(
  packageManager: PackageManager,
  scripts: ScriptReport,
): readonly ValidationCommandPlan[] {
  const out: ValidationCommandPlan[] = [];
  for (const kind of VALIDATION_ORDER) {
    const cmd = resolveValidationCommand(kind, packageManager, scripts);
    if (cmd !== undefined) out.push(cmd);
  }
  return out;
}

/**
 * Convenience helper used heavily by the plan generator: returns only the
 * raw command strings, filtered to the kinds the caller wants.
 */
export function pickValidationCommands(
  packageManager: PackageManager,
  scripts: ScriptReport,
  kinds: readonly ValidationCommandKind[],
): readonly string[] {
  const out: string[] = [];
  for (const kind of kinds) {
    const cmd = resolveValidationCommand(kind, packageManager, scripts);
    if (cmd !== undefined) out.push(cmd.command);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

const VALIDATION_ORDER: readonly ValidationCommandKind[] = [
  'build',
  'typecheck',
  'lint',
  'test',
];

const PRIMARY_KINDS: ReadonlySet<ValidationCommandKind> = new Set([
  'build',
  'typecheck',
  'lint',
  'test',
]);

function findScriptName(
  kind: ValidationCommandKind,
  scripts: ScriptReport,
): string | undefined {
  switch (kind) {
    case 'build':
      return scripts.hasBuild ? 'build' : undefined;
    case 'test':
      return scripts.hasTest ? 'test' : undefined;
    case 'lint':
      return scripts.hasLint ? 'lint' : undefined;
    case 'start':
      return scripts.hasStart ? 'start' : undefined;
    case 'dev':
      return scripts.hasDev ? 'dev' : undefined;
    case 'typecheck':
      // Accept all common spellings the scanner recognises.
      if (typeof scripts.raw['typecheck'] === 'string') return 'typecheck';
      if (typeof scripts.raw['type-check'] === 'string') return 'type-check';
      if (typeof scripts.raw['tsc'] === 'string') return 'tsc';
      return undefined;
  }
}

/**
 * Build the package-manager-specific incantation for `npm run <script>`.
 * `npm test` is a historical alias kept for parity with the rest of the
 * ecosystem; for any other script we always use the explicit `run` form
 * so the output is predictable.
 */
function formatRun(packageManager: PackageManager, scriptName: string): string {
  const pm = packageManager === 'unknown' ? 'npm' : packageManager;
  if (pm === 'npm') {
    if (scriptName === 'test') return 'npm test';
    return `npm run ${scriptName}`;
  }
  if (pm === 'yarn') {
    if (scriptName === 'test') return 'yarn test';
    return `yarn ${scriptName}`;
  }
  if (pm === 'pnpm') {
    if (scriptName === 'test') return 'pnpm test';
    return `pnpm run ${scriptName}`;
  }
  // bun
  if (scriptName === 'test') return 'bun test';
  return `bun run ${scriptName}`;
}
