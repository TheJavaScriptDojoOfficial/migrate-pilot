/**
 * React 19 canonical issue-code registry — R2 Step 4.
 *
 * Single source of truth for product-level issue codes used by the
 * compatibility scanner, report UI, and future Planner V2 / Risk Engine R3.
 *
 * Detailed detection codes (e.g. `react-dom-render-detected`) remain on
 * {@link React19CompatibilityIssue.code}; {@link React19CanonicalIssueCode}
 * provides a stable, normalized grouping layer via optional
 * `canonicalCode` on each issue.
 */

import type {
  React19CompatibilityCategory,
  React19CompatibilityIssueCode,
  React19CompatibilitySeverity,
} from '../types/react19Compatibility.types';

/* -------------------------------------------------------------------------- */
/* Canonical codes                                                            */
/* -------------------------------------------------------------------------- */

export const REACT19_ISSUE_CODES = {
  REACT_SOURCE_MAJOR_SUPPORTED: 'react-source-major-supported',
  REACT_DOM_VERSION_MISMATCH: 'react-dom-major-mismatch',
  REACT_19_PEER_CONFLICT: 'react-19-peer-conflict',
  LEGACY_RENDER_API_USAGE: 'legacy-render-api-usage',
  FIND_DOM_NODE_USAGE: 'find-dom-node-usage',
  STRING_REFS_USAGE: 'string-refs-usage',
  LEGACY_CONTEXT_USAGE: 'legacy-context-usage',
  UNSAFE_LIFECYCLE_USAGE: 'unsafe-lifecycle-usage',
  DEFAULT_PROPS_ON_FUNCTION_COMPONENTS: 'default-props-on-function-components',
  PROPTYPES_ON_FUNCTION_COMPONENTS: 'prop-types-on-function-components',
  JSX_TRANSFORM_OUTDATED: 'jsx-transform-outdated',
  OLD_REACT_SCRIPTS_VERSION: 'old-react-scripts-version',
  OLD_ROUTER_VERSION: 'old-router-version',
  ENZYME_TESTING_SETUP: 'enzyme-testing-setup',
  NODE_SASS_USAGE: 'node-sass-usage',
  MISSING_BUILD_SCRIPT: 'missing-build-script',
  MISSING_TEST_SCRIPT: 'missing-test-script',
  DIRTY_GIT_STATE: 'dirty-git-state',
} as const;

export type React19CanonicalIssueCode =
  (typeof REACT19_ISSUE_CODES)[keyof typeof REACT19_ISSUE_CODES];

const CANONICAL_CODE_SET: ReadonlySet<string> = new Set(
  Object.values(REACT19_ISSUE_CODES),
);

export function isReact19CanonicalIssueCode(
  value: string,
): value is React19CanonicalIssueCode {
  return CANONICAL_CODE_SET.has(value);
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export type React19IssueCodeMetadata = {
  readonly canonicalCode: React19CanonicalIssueCode;
  readonly label: string;
  readonly category: React19CompatibilityCategory;
  readonly defaultSeverity: React19CompatibilitySeverity;
  readonly description: string;
  readonly defaultRecommendation: string;
};

export const REACT19_ISSUE_CODE_METADATA: Readonly<
  Record<React19CanonicalIssueCode, React19IssueCodeMetadata>
> = {
  [REACT19_ISSUE_CODES.REACT_SOURCE_MAJOR_SUPPORTED]: {
    canonicalCode: REACT19_ISSUE_CODES.REACT_SOURCE_MAJOR_SUPPORTED,
    label: 'React source major supported',
    category: 'react-version',
    defaultSeverity: 'info',
    description:
      'The project declares React 16, 17, or 18 — a supported source major for Migrate Pilot V1.',
    defaultRecommendation:
      'Proceed with the React 19 migration plan when other blockers are resolved.',
  },
  [REACT19_ISSUE_CODES.REACT_DOM_VERSION_MISMATCH]: {
    canonicalCode: REACT19_ISSUE_CODES.REACT_DOM_VERSION_MISMATCH,
    label: 'React DOM version mismatch',
    category: 'react-dom-version',
    defaultSeverity: 'blocker',
    description:
      'The declared `react` and `react-dom` majors do not match. Both packages must share a major before migrating.',
    defaultRecommendation:
      'Align `react-dom` to the same major as `react`, reinstall dependencies, and re-run the scan.',
  },
  [REACT19_ISSUE_CODES.REACT_19_PEER_CONFLICT]: {
    canonicalCode: REACT19_ISSUE_CODES.REACT_19_PEER_CONFLICT,
    label: 'React 19 peer dependency conflict',
    category: 'peer-dependencies',
    defaultSeverity: 'medium',
    description:
      'One or more dependencies appear pinned to an older React major or may not declare React 19 peer support.',
    defaultRecommendation:
      'Review each flagged package for a React 19–compatible release or replacement before upgrading.',
  },
  [REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE]: {
    canonicalCode: REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE,
    label: 'Legacy render API usage',
    category: 'deprecated-react-api',
    defaultSeverity: 'high',
    description:
      'Legacy ReactDOM render/hydrate/unmount APIs were detected. React 19 requires `createRoot` / `hydrateRoot`.',
    defaultRecommendation:
      'Replace legacy render APIs with `createRoot` or `hydrateRoot` during the React 18 bridge phase.',
  },
  [REACT19_ISSUE_CODES.FIND_DOM_NODE_USAGE]: {
    canonicalCode: REACT19_ISSUE_CODES.FIND_DOM_NODE_USAGE,
    label: 'findDOMNode usage',
    category: 'component-patterns',
    defaultSeverity: 'high',
    description:
      '`findDOMNode` is removed in React 19. Refs must replace direct DOM lookups.',
    defaultRecommendation:
      'Replace `findDOMNode` with `createRef` / `useRef` before upgrading to React 19.',
  },
  [REACT19_ISSUE_CODES.STRING_REFS_USAGE]: {
    canonicalCode: REACT19_ISSUE_CODES.STRING_REFS_USAGE,
    label: 'String refs usage',
    category: 'component-patterns',
    defaultSeverity: 'high',
    description:
      'String refs (`ref="name"`) are removed in React 19. Callback refs or `useRef` are required.',
    defaultRecommendation:
      'Replace string refs with callback refs or `useRef` before upgrading.',
  },
  [REACT19_ISSUE_CODES.LEGACY_CONTEXT_USAGE]: {
    canonicalCode: REACT19_ISSUE_CODES.LEGACY_CONTEXT_USAGE,
    label: 'Legacy context usage',
    category: 'component-patterns',
    defaultSeverity: 'medium',
    description:
      'Legacy context API patterns (`childContextTypes`, `contextTypes`, `getChildContext`) were detected.',
    defaultRecommendation:
      'Migrate to `React.createContext` during the api-compatibility phase.',
  },
  [REACT19_ISSUE_CODES.UNSAFE_LIFECYCLE_USAGE]: {
    canonicalCode: REACT19_ISSUE_CODES.UNSAFE_LIFECYCLE_USAGE,
    label: 'Unsafe lifecycle usage',
    category: 'deprecated-lifecycle',
    defaultSeverity: 'high',
    description:
      'Deprecated lifecycle methods (`componentWill*`, `UNSAFE_*`) were detected and may break under concurrent rendering.',
    defaultRecommendation:
      'Migrate to `componentDidMount`, `getDerivedStateFromProps`, or function components with hooks.',
  },
  [REACT19_ISSUE_CODES.DEFAULT_PROPS_ON_FUNCTION_COMPONENTS]: {
    canonicalCode: REACT19_ISSUE_CODES.DEFAULT_PROPS_ON_FUNCTION_COMPONENTS,
    label: 'Default props on function components',
    category: 'deprecated-react-api',
    defaultSeverity: 'medium',
    description:
      '`.defaultProps` assignments on function components were detected and may need review for React 19 compatibility.',
    defaultRecommendation:
      'Prefer ES default parameters or destructuring defaults instead of `.defaultProps` on function components.',
  },
  [REACT19_ISSUE_CODES.PROPTYPES_ON_FUNCTION_COMPONENTS]: {
    canonicalCode: REACT19_ISSUE_CODES.PROPTYPES_ON_FUNCTION_COMPONENTS,
    label: 'PropTypes on function components',
    category: 'deprecated-react-api',
    defaultSeverity: 'medium',
    description:
      'PropTypes usage was detected and may need review for React 19 compatibility on function components.',
    defaultRecommendation:
      'Migrate to TypeScript types or a runtime validation library compatible with React 19.',
  },
  [REACT19_ISSUE_CODES.JSX_TRANSFORM_OUTDATED]: {
    canonicalCode: REACT19_ISSUE_CODES.JSX_TRANSFORM_OUTDATED,
    label: 'Outdated JSX transform',
    category: 'jsx-transform',
    defaultSeverity: 'medium',
    description:
      'The JSX transform appears classic or could not be confirmed. React 17+ recommends the automatic transform.',
    defaultRecommendation:
      'Switch to the automatic JSX transform (`"jsx": "react-jsx"` or Babel `runtime: "automatic"`).',
  },
  [REACT19_ISSUE_CODES.OLD_REACT_SCRIPTS_VERSION]: {
    canonicalCode: REACT19_ISSUE_CODES.OLD_REACT_SCRIPTS_VERSION,
    label: 'Old react-scripts version',
    category: 'build-tool',
    defaultSeverity: 'high',
    description:
      'A very old `react-scripts` major was detected. Modern React builds require a newer toolchain.',
    defaultRecommendation:
      'Upgrade `react-scripts` to a modern major or migrate to Vite before adopting React 19.',
  },
  [REACT19_ISSUE_CODES.OLD_ROUTER_VERSION]: {
    canonicalCode: REACT19_ISSUE_CODES.OLD_ROUTER_VERSION,
    label: 'Old router version',
    category: 'routing',
    defaultSeverity: 'medium',
    description:
      'An older `react-router` major was detected that may lack modern data-router APIs.',
    defaultRecommendation:
      'Plan a router upgrade (at minimum v5/v6) before or after the React 19 upgrade.',
  },
  [REACT19_ISSUE_CODES.ENZYME_TESTING_SETUP]: {
    canonicalCode: REACT19_ISSUE_CODES.ENZYME_TESTING_SETUP,
    label: 'Enzyme testing setup',
    category: 'testing',
    defaultSeverity: 'high',
    description:
      'Enzyme has no officially supported React 18 / 19 adapter and is incompatible with concurrent rendering.',
    defaultRecommendation:
      'Migrate tests to `@testing-library/react` before upgrading React.',
  },
  [REACT19_ISSUE_CODES.NODE_SASS_USAGE]: {
    canonicalCode: REACT19_ISSUE_CODES.NODE_SASS_USAGE,
    label: 'node-sass usage',
    category: 'sass-scss',
    defaultSeverity: 'medium',
    description:
      '`node-sass` is unmaintained and frequently fails on modern Node versions.',
    defaultRecommendation: 'Replace `node-sass` with `sass` (Dart Sass).',
  },
  [REACT19_ISSUE_CODES.MISSING_BUILD_SCRIPT]: {
    canonicalCode: REACT19_ISSUE_CODES.MISSING_BUILD_SCRIPT,
    label: 'Missing build script',
    category: 'validation',
    defaultSeverity: 'high',
    description:
      'No `build` script is declared. The migration runner relies on it as a validation gate.',
    defaultRecommendation: 'Add a `build` script to package.json before running migrations.',
  },
  [REACT19_ISSUE_CODES.MISSING_TEST_SCRIPT]: {
    canonicalCode: REACT19_ISSUE_CODES.MISSING_TEST_SCRIPT,
    label: 'Missing test script',
    category: 'validation',
    defaultSeverity: 'medium',
    description:
      'No `test` script is declared, limiting regression validation between migration steps.',
    defaultRecommendation: 'Add a `test` script (Jest, Vitest, etc.) to harden each migration step.',
  },
  [REACT19_ISSUE_CODES.DIRTY_GIT_STATE]: {
    canonicalCode: REACT19_ISSUE_CODES.DIRTY_GIT_STATE,
    label: 'Dirty Git state',
    category: 'package-manager',
    defaultSeverity: 'high',
    description:
      'The Git working tree has uncommitted changes. Migration workspaces work best from a clean baseline.',
    defaultRecommendation:
      'Commit, stash, or discard existing changes before creating a migration workspace.',
  },
};

/* -------------------------------------------------------------------------- */
/* Detailed → canonical mapping                                               */
/* -------------------------------------------------------------------------- */

/**
 * Maps detailed scanner issue codes to their product-level canonical code.
 * Codes omitted here either have no canonical mapping or use the canonical
 * string directly as {@link React19CompatibilityIssueCode}.
 */
export const REACT19_DETAILED_TO_CANONICAL: Readonly<
  Partial<Record<React19CompatibilityIssueCode, React19CanonicalIssueCode>>
> = {
  'react-dom-major-mismatch': REACT19_ISSUE_CODES.REACT_DOM_VERSION_MISMATCH,
  'react-dom-render-detected': REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE,
  'react-dom-hydrate-detected': REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE,
  'unmount-component-at-node-detected': REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE,
  'unstable-render-subtree-detected': REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE,
  'create-factory-detected': REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE,
  'find-dom-node-detected': REACT19_ISSUE_CODES.FIND_DOM_NODE_USAGE,
  'string-refs-detected': REACT19_ISSUE_CODES.STRING_REFS_USAGE,
  'legacy-context-detected': REACT19_ISSUE_CODES.LEGACY_CONTEXT_USAGE,
  'deprecated-lifecycle-detected': REACT19_ISSUE_CODES.UNSAFE_LIFECYCLE_USAGE,
  'jsx-transform-classic': REACT19_ISSUE_CODES.JSX_TRANSFORM_OUTDATED,
  'jsx-transform-config-not-detected': REACT19_ISSUE_CODES.JSX_TRANSFORM_OUTDATED,
  'build-tool-react-scripts-very-old': REACT19_ISSUE_CODES.OLD_REACT_SCRIPTS_VERSION,
  'router-version-old': REACT19_ISSUE_CODES.OLD_ROUTER_VERSION,
  'router-version-very-old': REACT19_ISSUE_CODES.OLD_ROUTER_VERSION,
  'enzyme-detected': REACT19_ISSUE_CODES.ENZYME_TESTING_SETUP,
  'node-sass-detected': REACT19_ISSUE_CODES.NODE_SASS_USAGE,
  'peer-dependency-risk-detected': REACT19_ISSUE_CODES.REACT_19_PEER_CONFLICT,
  'missing-build-script': REACT19_ISSUE_CODES.MISSING_BUILD_SCRIPT,
  'missing-test-script': REACT19_ISSUE_CODES.MISSING_TEST_SCRIPT,
  'default-props-on-function-components':
    REACT19_ISSUE_CODES.DEFAULT_PROPS_ON_FUNCTION_COMPONENTS,
  'prop-types-on-function-components':
    REACT19_ISSUE_CODES.PROPTYPES_ON_FUNCTION_COMPONENTS,
  'dirty-git-state': REACT19_ISSUE_CODES.DIRTY_GIT_STATE,
};

/**
 * Resolve the canonical code for a detailed compatibility issue code.
 */
export function resolveReact19CanonicalIssueCode(
  code: React19CompatibilityIssueCode,
): React19CanonicalIssueCode | undefined {
  const mapped = REACT19_DETAILED_TO_CANONICAL[code];
  if (mapped !== undefined) return mapped;
  if (isReact19CanonicalIssueCode(code)) return code;
  return undefined;
}

/**
 * User-facing label for an issue — prefers the canonical metadata label
 * when a canonical code is present.
 */
export function getReact19IssueDisplayLabel(issue: {
  readonly title: string;
  readonly code: React19CompatibilityIssueCode;
  readonly canonicalCode?: React19CanonicalIssueCode;
}): string {
  if (issue.canonicalCode !== undefined) {
    const meta = REACT19_ISSUE_CODE_METADATA[issue.canonicalCode];
    if (meta !== undefined) return meta.label;
  }
  return issue.title;
}
