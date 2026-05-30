/**
 * Scanner recommendation service.
 *
 * Pure mapping from `RiskReport` + parsed dependency / source information
 * to a list of {@link Recommendation}s. Distinct from the risk service:
 *
 *   - The risk service answers "what is wrong?" (issues + score).
 *   - This service answers "what should the user do next?" (actions).
 *
 * Both are deterministic. AI-generated planning happens in a later
 * milestone and consumes these recommendations as compact context.
 */

import type {
  DependencyReport,
  Recommendation,
  RiskReport,
  ScanIssueCode,
  ScriptReport,
  SourceAnalysisReport,
} from '../types/scanner.types';

export interface RecommendationInputs {
  readonly dependencies: DependencyReport;
  readonly sourceAnalysis: SourceAnalysisReport;
  readonly scripts: ScriptReport;
  readonly risks: RiskReport;
}

export function buildRecommendations(
  inputs: RecommendationInputs,
): readonly Recommendation[] {
  const recs: Recommendation[] = [];
  const codes = collectIssueCodes(inputs.risks);

  // High-priority foundational steps come first; the planner will preserve
  // order when generating the migration plan in Milestone 4.

  if (codes.has('NODE_SASS_DEPRECATED')) {
    recs.push({
      id: 'replace-node-sass',
      title: 'Replace node-sass with sass',
      detail:
        'Plan a separate migration step to swap node-sass for sass (Dart Sass). Update package.json, remove node-sass, install sass, and validate the build output. Style behaviour should remain unchanged.',
      priority: 'high',
      relatedCodes: ['NODE_SASS_DEPRECATED'],
    });
  }

  if (codes.has('DEPRECATED_LIFECYCLES_PRESENT')) {
    recs.push({
      id: 'fix-deprecated-lifecycles',
      title: 'Replace deprecated React lifecycle methods',
      detail:
        'componentWillMount / componentWillReceiveProps / componentWillUpdate (and their UNSAFE_ aliases) cause warnings on React 17 and break concurrent rendering on React 18. Migrate to componentDidMount + getDerivedStateFromProps or to function components with hooks before upgrading React.',
      priority: 'high',
      relatedCodes: ['DEPRECATED_LIFECYCLES_PRESENT'],
    });
  }

  if (codes.has('REACT_DOM_RENDER_USAGE')) {
    recs.push({
      id: 'migrate-to-createroot',
      title: 'Migrate from ReactDOM.render to createRoot',
      detail:
        'React 18 deprecates ReactDOM.render. Replace it with createRoot from react-dom/client and validate that hydration and concurrent features still behave correctly.',
      priority: 'medium',
      relatedCodes: ['REACT_DOM_RENDER_USAGE'],
    });
  }

  if (codes.has('OUTDATED_REACT_VERSION')) {
    const version = inputs.dependencies.reactVersion ?? 'older';
    recs.push({
      id: 'upgrade-react-major',
      title: `Plan a React ${inputs.dependencies.reactMajor ?? ''} → 18 upgrade`,
      detail: `The project targets React ${version}. Upgrade once the foundation is stable: deprecated lifecycles fixed, ReactDOM.render migrated, and the existing build still passes.`,
      priority: 'medium',
      relatedCodes: ['OUTDATED_REACT_VERSION'],
    });
  }

  if (codes.has('NO_TYPESCRIPT')) {
    recs.push({
      id: 'introduce-typescript',
      title: 'Introduce TypeScript',
      detail:
        'Add tsconfig.json and the @types/* dependencies. Convert utilities first, then shared components, then pages. The migration plan will sequence the conversion in small reviewable steps.',
      priority: 'medium',
      relatedCodes: ['NO_TYPESCRIPT'],
    });
  }

  if (codes.has('CLASS_COMPONENTS_PRESENT')) {
    recs.push({
      id: 'modernize-class-components',
      title: 'Convert class components to function components',
      detail:
        'Class components are still supported but lock the project out of newer React patterns. Plan small per-component conversions during the modernization step.',
      priority: 'medium',
      relatedCodes: ['CLASS_COMPONENTS_PRESENT'],
    });
  }

  if (codes.has('LEGACY_CONTEXT_API')) {
    recs.push({
      id: 'modernize-context-api',
      title: 'Migrate to the modern Context API',
      detail:
        'Replace contextTypes / getChildContext / childContextTypes with React.createContext. This unblocks lifecycle and state management modernization.',
      priority: 'medium',
      relatedCodes: ['LEGACY_CONTEXT_API'],
    });
  }

  if (codes.has('MULTIPLE_LOCK_FILES')) {
    recs.push({
      id: 'pick-single-lockfile',
      title: 'Settle on a single package manager',
      detail: `Found multiple lockfiles (${inputs.dependencies.lockFiles.join(', ')}). Pick one and remove the others; the migration workspace will use the same package manager.`,
      priority: 'high',
      relatedCodes: ['MULTIPLE_LOCK_FILES'],
    });
  } else if (codes.has('MISSING_LOCK_FILE')) {
    recs.push({
      id: 'generate-lockfile',
      title: 'Generate a lockfile for reproducible installs',
      detail:
        'Run your package manager install once to produce a lockfile (npm install / yarn / pnpm install / bun install). This is required for safe migration installs later.',
      priority: 'high',
      relatedCodes: ['MISSING_LOCK_FILE'],
    });
  }

  if (codes.has('MISSING_BUILD_SCRIPT')) {
    recs.push({
      id: 'add-build-script',
      title: 'Add a build script to package.json',
      detail:
        'Migrate Pilot validates each migration step against the project build. Add a `build` script (e.g. `react-scripts build`, `vite build`) before starting execution.',
      priority: 'high',
      relatedCodes: ['MISSING_BUILD_SCRIPT'],
    });
  }

  if (codes.has('MISSING_LINT_SCRIPT')) {
    recs.push({
      id: 'add-lint-script',
      title: 'Add a lint script',
      detail:
        'A lint script gives Migrate Pilot a fast static-validation gate between migration steps. Add `eslint .` or your existing equivalent to package.json scripts.',
      priority: 'low',
      relatedCodes: ['MISSING_LINT_SCRIPT'],
    });
  }

  if (codes.has('MISSING_TEST_SCRIPT')) {
    recs.push({
      id: 'add-test-script',
      title: 'Add a test script',
      detail:
        'Without tests, regression validation is limited to build + type-check. Adding a basic test script unlocks deeper validation.',
      priority: 'low',
      relatedCodes: ['MISSING_TEST_SCRIPT'],
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'looks-ready',
      title: 'No critical recommendations from the scanner',
      detail:
        'The deterministic scan did not surface any modernization-blocking risks. The migration plan will still review the project before execution.',
      priority: 'low',
    });
  }

  return recs;
}

function collectIssueCodes(risks: RiskReport): Set<ScanIssueCode> {
  const set = new Set<ScanIssueCode>();
  for (const issue of risks.blockers) set.add(issue.code);
  for (const issue of risks.warnings) set.add(issue.code);
  for (const issue of risks.infos) set.add(issue.code);
  return set;
}
