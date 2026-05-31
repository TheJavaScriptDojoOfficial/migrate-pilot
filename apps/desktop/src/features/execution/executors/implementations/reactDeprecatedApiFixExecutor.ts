/**
 * Executor Registry V2 — `react-deprecated-api-fix` deterministic
 * executor (Phase R6 Step 3.4).
 *
 * Centralises the targeted compatibility fixes for deprecated React
 * APIs flagged by the scanner. The initial version classifies each
 * supported issue code as either:
 *
 *   - `available`     The transformation is deterministic and the V2
 *                     framework will rewrite it once the AST runner
 *                     ships. (Tracked separately as
 *                     `future-support` until then so the UI is
 *                     honest about runtime state.)
 *   - `manual-only`   The transformation has too much project-shape
 *                     ambiguity to be safe deterministically (e.g.
 *                     replacing legacy `contextTypes` with the
 *                     modern Context API requires shape decisions
 *                     only the human author can make).
 *
 * Selection metadata
 * ------------------
 *   - `supportedPhases: ['api-compatibility']` — every fix lives in
 *     the canonical API compatibility phase.
 *   - `supportedTracks: []` — eligible on every React 19 track.
 *   - `supportedIssueCodes` — exactly the canonical codes called out
 *     by R6 Step 3 § 3.4.
 *
 * Run behaviour
 * -------------
 * - Reads `context.issueCodes` to pick the right per-code branch.
 *   The executor only acts on intersection between
 *   {@link SUPPORTED_ISSUE_CODES} and the step's `issueCodes` so a
 *   misrouted step still produces an honest "nothing to do" report.
 * - For codes mapped to a manual fix, logs the guidance verbatim and
 *   returns a `completed` no-op run.
 * - For codes pending the AST runner, logs the planned transform and
 *   returns a `completed` no-op run noting the gate.
 */
import {
  REACT19_ISSUE_CODES,
  type ReactMigrationPhase,
} from '@features/react19-migration';
import type { ExecutorAvailability } from '@features/migration-plan';

import type { ExecutionLogEntry } from '../../types/execution.types';
import type {
  ExecutionResult,
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
} from '../executor.types';
import {
  buildCompletedRun,
  buildFailedRunFromError,
  buildLog,
} from './executorResultBuilder';

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const REACT_DEPRECATED_API_FIX_EXECUTOR_KEY = 'react-deprecated-api-fix';

const SUPPORTED_PHASES: readonly ReactMigrationPhase[] = ['api-compatibility'];

/**
 * Canonical issue codes this executor opts into. Mirrors the list in
 * the Phase R6 Step 3 § 3.4 spec exactly so a missed entry in the
 * planner surfaces as `future-support` rather than silently routing
 * elsewhere.
 */
const SUPPORTED_ISSUE_CODES: readonly string[] = [
  REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE,
  REACT19_ISSUE_CODES.FIND_DOM_NODE_USAGE,
  REACT19_ISSUE_CODES.STRING_REFS_USAGE,
  REACT19_ISSUE_CODES.LEGACY_CONTEXT_USAGE,
  REACT19_ISSUE_CODES.UNSAFE_LIFECYCLE_USAGE,
  REACT19_ISSUE_CODES.DEFAULT_PROPS_ON_FUNCTION_COMPONENTS,
  REACT19_ISSUE_CODES.PROPTYPES_ON_FUNCTION_COMPONENTS,
];

/* -------------------------------------------------------------------------- */
/* Per-issue plan                                                             */
/* -------------------------------------------------------------------------- */

type FixSupport = 'deterministic-pending-ast-runner' | 'manual-only';

interface IssueFixPlan {
  readonly support: FixSupport;
  readonly summary: string;
  readonly detail: string;
}

const ISSUE_FIX_PLANS: Readonly<Record<string, IssueFixPlan>> = {
  [REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE]: {
    support: 'deterministic-pending-ast-runner',
    summary: 'Replace legacy ReactDOM render / hydrate / unmount APIs with the React 18 root API.',
    detail:
      'Will rewrite ReactDOM.render → createRoot().render, ReactDOM.hydrate → hydrateRoot, and ReactDOM.unmountComponentAtNode → root.unmount once the AST runner is wired.',
  },
  [REACT19_ISSUE_CODES.FIND_DOM_NODE_USAGE]: {
    support: 'manual-only',
    summary: 'findDOMNode usage requires manual review.',
    detail:
      'Replace findDOMNode(this) with a forwarded ref (React.forwardRef + useRef / createRef). The deterministic codemod cannot infer which child element should hold the ref, so this fix is intentionally manual.',
  },
  [REACT19_ISSUE_CODES.STRING_REFS_USAGE]: {
    support: 'deterministic-pending-ast-runner',
    summary: 'Rewrite string refs (ref="name") to callback refs.',
    detail:
      'Will replace ref="name" with ref={(el) => { this.name = el; }} once the AST runner is wired. Component class fields will be initialised conservatively.',
  },
  [REACT19_ISSUE_CODES.LEGACY_CONTEXT_USAGE]: {
    support: 'manual-only',
    summary: 'Legacy context API requires manual migration to React.createContext.',
    detail:
      'childContextTypes/contextTypes/getChildContext only have safe modernisations when the developer decides the new Context shape and provider boundary. Migrate Pilot will not attempt a deterministic transform.',
  },
  [REACT19_ISSUE_CODES.UNSAFE_LIFECYCLE_USAGE]: {
    support: 'manual-only',
    summary: 'Unsafe lifecycle methods require manual rewrites.',
    detail:
      'componentWillMount / componentWillReceiveProps / componentWillUpdate (and their UNSAFE_* aliases) need behaviour-preserving replacements with componentDidMount, getDerivedStateFromProps, or hooks — too project-specific to be safe deterministically.',
  },
  [REACT19_ISSUE_CODES.DEFAULT_PROPS_ON_FUNCTION_COMPONENTS]: {
    support: 'deterministic-pending-ast-runner',
    summary: 'Move .defaultProps on function components to default parameters.',
    detail:
      'Will move Component.defaultProps assignments into destructuring defaults at the parameter list once the AST runner is wired.',
  },
  [REACT19_ISSUE_CODES.PROPTYPES_ON_FUNCTION_COMPONENTS]: {
    support: 'manual-only',
    summary: 'PropTypes on function components require a project-level decision.',
    detail:
      'Choose between (a) keeping prop-types as a runtime check, (b) migrating to TypeScript types, or (c) switching to a runtime validator like Zod. Migrate Pilot leaves this to the author.',
  },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function relevantIssueCodes(context: ExecutorContext): readonly string[] {
  return context.issueCodes.filter((code) => SUPPORTED_ISSUE_CODES.includes(code));
}

/* -------------------------------------------------------------------------- */
/* canRun                                                                     */
/* -------------------------------------------------------------------------- */

function canRun(context: ExecutorContext): ExecutorAvailability {
  const codes = relevantIssueCodes(context);
  if (codes.length === 0) {
    return {
      status: 'future-support',
      reason:
        'No deprecated-React-API issue codes were attached to this step. The executor only acts on the canonical issue codes listed in the React 19 readiness report.',
    };
  }

  const allManual = codes.every(
    (code) => ISSUE_FIX_PLANS[code]?.support === 'manual-only',
  );
  if (allManual) {
    return {
      status: 'manual-only',
      reason:
        'Every issue code attached to this step requires manual judgement. Migrate Pilot surfaces guidance but does not modify the source files.',
    };
  }

  const allDeterministic = codes.every(
    (code) => ISSUE_FIX_PLANS[code]?.support === 'deterministic-pending-ast-runner',
  );
  return {
    status: 'future-support',
    reason: allDeterministic
      ? 'A deterministic transform exists for every flagged code, but the AST runner is not implemented in this build yet.'
      : 'A mix of deterministic and manual fixes was detected. Some codes will be transformed automatically once the AST runner ships; others require manual review.',
  };
}

/* -------------------------------------------------------------------------- */
/* run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: ExecutorRunInput): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];
  try {
    const codes = relevantIssueCodes(input);
    if (codes.length === 0) {
      logs.push(
        buildLog(
          'warning',
          'No supported deprecated-API issue codes were attached to this step. Nothing to do.',
        ),
      );
      return buildCompletedRun({ input, logs });
    }

    logs.push(
      buildLog(
        'info',
        `Deprecated API fix plan resolved for ${codes.length} issue code${
          codes.length === 1 ? '' : 's'
        }.`,
      ),
    );

    for (const code of codes) {
      const plan = ISSUE_FIX_PLANS[code];
      if (plan === undefined) continue;
      const level: ExecutionLogEntry['level'] =
        plan.support === 'manual-only' ? 'warning' : 'info';
      logs.push(buildLog(level, `${code}: ${plan.summary}`, plan.detail));
    }

    logs.push(
      buildLog(
        'warning',
        'No source files were modified in this run.',
        'Deterministic transforms run automatically once the V2 AST runner ships; manual-only items remain the author\u2019s call.',
      ),
    );

    return buildCompletedRun({ input, logs });
  } catch (err) {
    return buildFailedRunFromError(
      input,
      logs,
      err,
      REACT_DEPRECATED_API_FIX_EXECUTOR_KEY,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Definition                                                                 */
/* -------------------------------------------------------------------------- */

export const reactDeprecatedApiFixExecutor: ExecutorDefinition = {
  key: REACT_DEPRECATED_API_FIX_EXECUTOR_KEY,
  label: 'React deprecated API fix',
  supportedPhases: SUPPORTED_PHASES,
  supportedTracks: [],
  supportedIssueCodes: SUPPORTED_ISSUE_CODES,
  executionType: 'codemod',
  canRun,
  run,
};
