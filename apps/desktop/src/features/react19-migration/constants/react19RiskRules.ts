import type {
  React19CompatibilityCategory,
  React19CompatibilitySeverity,
} from '../types/react19Compatibility.types';
import type {
  React19ExecutionCapability,
  React19MigrationPhase,
  React19MigrationRiskLevel,
  React19ValidationRequirement,
} from '../types/react19RiskRecommendation.types';

export interface React19RiskRuleTemplate {
  readonly phase: React19MigrationPhase;
  readonly riskLevel?: React19MigrationRiskLevel;
  readonly recommendation?: string;
  readonly executionCapability?: React19ExecutionCapability;
  readonly validation?: React19ValidationRequirement;
  readonly blocksPlanGeneration?: boolean;
  readonly blocksUpgrade?: boolean;
}

export const REACT19_MIGRATION_PHASES_ORDERED: readonly React19MigrationPhase[] = [
  'preflight',
  'tooling',
  'react-bridge',
  'api-compatibility',
  'dependency-modernization',
  'typescript-readiness',
  'routing-readiness',
  'testing-readiness',
  'validation-readiness',
];

export const REACT19_PHASE_DISPLAY_NAMES: Readonly<
  Record<React19MigrationPhase, string>
> = {
  preflight: 'Preflight',
  tooling: 'Tooling',
  'react-bridge': 'React 18 bridge',
  'api-compatibility': 'API compatibility',
  'dependency-modernization': 'Dependency modernization',
  'typescript-readiness': 'TypeScript readiness',
  'routing-readiness': 'Routing readiness',
  'testing-readiness': 'Testing readiness',
  'validation-readiness': 'Validation readiness',
};

export const REACT19_EXECUTION_CAPABILITY_DISPLAY_NAMES: Readonly<
  Record<React19ExecutionCapability, string>
> = {
  scriptable: 'Scriptable',
  codemod: 'Codemod',
  'ai-assisted': 'AI-assisted',
  manual: 'Manual',
  'validation-only': 'Validation only',
};

export const REACT19_RISK_RULES: Readonly<Record<string, React19RiskRuleTemplate>> = {
  // Preflight
  'dirty-git-state': {
    phase: 'preflight',
    riskLevel: 'high',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true },
    blocksPlanGeneration: false,
    blocksUpgrade: true,
  },
  'package-manager-not-detected': {
    phase: 'preflight',
    riskLevel: 'blocker',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresManualVerification: true },
    blocksPlanGeneration: true,
    blocksUpgrade: true,
  },
  'no-lockfile-found': {
    phase: 'preflight',
    riskLevel: 'high',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true },
    blocksUpgrade: true,
  },
  'multiple-lockfiles-found': {
    phase: 'preflight',
    riskLevel: 'medium',
    executionCapability: 'manual',
    validation: { requiresInstall: true, requiresManualVerification: true },
  },
  'package-manager-lockfile-mismatch': {
    phase: 'preflight',
    riskLevel: 'low',
    executionCapability: 'manual',
    validation: { requiresInstall: true, requiresManualVerification: true },
  },

  // Tooling
  'build-tool-react-scripts-very-old': {
    phase: 'tooling',
    riskLevel: 'high',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresBuild: true, requiresTests: true },
  },
  'build-tool-webpack-major-too-old': {
    phase: 'tooling',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: { requiresInstall: true, requiresBuild: true, requiresTests: true },
  },
  'build-tool-not-detected': {
    phase: 'tooling',
    riskLevel: 'medium',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true, requiresBuild: true },
  },
  'build-tool-missing-build-script': {
    phase: 'validation-readiness',
    riskLevel: 'high',
    executionCapability: 'manual',
    validation: { requiresBuild: true, requiresManualVerification: true },
  },
  'jsx-transform-classic': {
    phase: 'tooling',
    riskLevel: 'medium',
    executionCapability: 'scriptable',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresBuild: true,
      requiresTests: true,
    },
  },
  'jsx-transform-config-not-detected': {
    phase: 'tooling',
    riskLevel: 'low',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true, requiresBuild: true },
  },

  // Bridge and React version
  'react-not-detected': {
    phase: 'preflight',
    riskLevel: 'blocker',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true },
    blocksPlanGeneration: true,
    blocksUpgrade: true,
  },
  'react-version-unparseable': {
    phase: 'preflight',
    riskLevel: 'blocker',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true },
    blocksPlanGeneration: true,
    blocksUpgrade: true,
  },
  'react-major-below-supported': {
    phase: 'react-bridge',
    riskLevel: 'blocker',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true },
    blocksPlanGeneration: true,
    blocksUpgrade: true,
  },
  'react-major-above-target': {
    phase: 'preflight',
    riskLevel: 'blocker',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true },
    blocksPlanGeneration: true,
    blocksUpgrade: true,
  },
  'react-major-already-target': {
    phase: 'react-bridge',
    riskLevel: 'info',
    executionCapability: 'validation-only',
    validation: { requiresBuild: true, requiresTests: true },
  },

  // Dependency modernization
  'react-dom-not-detected': {
    phase: 'dependency-modernization',
    riskLevel: 'blocker',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresBuild: true, requiresTests: true },
    blocksPlanGeneration: true,
    blocksUpgrade: true,
  },
  'react-dom-version-unparseable': {
    phase: 'dependency-modernization',
    riskLevel: 'blocker',
    executionCapability: 'manual',
    validation: { requiresInstall: true, requiresBuild: true },
    blocksPlanGeneration: true,
    blocksUpgrade: true,
  },
  'react-dom-major-mismatch': {
    phase: 'dependency-modernization',
    riskLevel: 'high',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresBuild: true, requiresTests: true },
    blocksUpgrade: true,
  },
  'peer-dependency-risk-detected': {
    phase: 'dependency-modernization',
    riskLevel: 'high',
    executionCapability: 'manual',
    validation: { requiresInstall: true, requiresBuild: true, requiresTests: true },
  },
  'deprecated-dependency-detected': {
    phase: 'dependency-modernization',
    riskLevel: 'medium',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresBuild: true },
  },
  'node-sass-detected': {
    phase: 'dependency-modernization',
    riskLevel: 'high',
    executionCapability: 'scriptable',
    validation: {
      requiresInstall: true,
      requiresBuild: true,
      suggestedCommands: ['npm run build', 'npm run test'],
    },
  },
  'sass-files-without-compiler': {
    phase: 'dependency-modernization',
    riskLevel: 'high',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresBuild: true },
  },
  'sass-loader-very-old': {
    phase: 'dependency-modernization',
    riskLevel: 'medium',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresBuild: true },
  },

  // API compatibility
  'react-dom-render-detected': {
    phase: 'api-compatibility',
    riskLevel: 'high',
    executionCapability: 'codemod',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
    blocksUpgrade: true,
  },
  'react-dom-hydrate-detected': {
    phase: 'api-compatibility',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
    blocksUpgrade: true,
  },
  'unmount-component-at-node-detected': {
    phase: 'api-compatibility',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
    blocksUpgrade: true,
  },
  'unstable-render-subtree-detected': {
    phase: 'api-compatibility',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
    blocksUpgrade: true,
  },
  'create-factory-detected': {
    phase: 'api-compatibility',
    riskLevel: 'medium',
    executionCapability: 'codemod',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
  },
  'find-dom-node-detected': {
    phase: 'api-compatibility',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
    blocksUpgrade: true,
  },
  'string-refs-detected': {
    phase: 'api-compatibility',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
    blocksUpgrade: true,
  },
  'legacy-context-detected': {
    phase: 'api-compatibility',
    riskLevel: 'medium',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
  },
  'deprecated-lifecycle-detected': {
    phase: 'api-compatibility',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
    blocksUpgrade: true,
  },
  'default-props-on-function-components': {
    phase: 'api-compatibility',
    riskLevel: 'medium',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
  },
  'prop-types-on-function-components': {
    phase: 'api-compatibility',
    riskLevel: 'medium',
    executionCapability: 'ai-assisted',
    validation: {
      requiresLint: true,
      requiresTypecheck: true,
      requiresTests: true,
      requiresBuild: true,
    },
  },
  'class-components-present': {
    phase: 'api-compatibility',
    riskLevel: 'low',
    executionCapability: 'manual',
    validation: {
      requiresTests: true,
      requiresBuild: true,
    },
  },

  // Readiness tracks
  'typescript-not-configured': {
    phase: 'typescript-readiness',
    riskLevel: 'medium',
    executionCapability: 'manual',
    validation: { requiresTypecheck: true, requiresManualVerification: true },
  },
  'typescript-dependency-missing-but-files-present': {
    phase: 'typescript-readiness',
    riskLevel: 'medium',
    executionCapability: 'scriptable',
    validation: { requiresInstall: true, requiresTypecheck: true, requiresBuild: true },
  },
  'project-mostly-javascript': {
    phase: 'typescript-readiness',
    riskLevel: 'info',
    executionCapability: 'validation-only',
    validation: { requiresBuild: true },
  },
  'router-version-very-old': {
    phase: 'routing-readiness',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: { requiresInstall: true, requiresTests: true, requiresBuild: true },
  },
  'router-version-old': {
    phase: 'routing-readiness',
    riskLevel: 'medium',
    executionCapability: 'ai-assisted',
    validation: { requiresInstall: true, requiresTests: true, requiresBuild: true },
  },
  'router-version-unknown': {
    phase: 'routing-readiness',
    riskLevel: 'low',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true, requiresBuild: true },
  },
  'enzyme-detected': {
    phase: 'testing-readiness',
    riskLevel: 'high',
    executionCapability: 'ai-assisted',
    validation: { requiresTests: true, requiresBuild: true },
    blocksUpgrade: true,
  },
  'no-modern-testing-library': {
    phase: 'testing-readiness',
    riskLevel: 'low',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true },
  },
  'react-test-renderer-detected': {
    phase: 'testing-readiness',
    riskLevel: 'low',
    executionCapability: 'ai-assisted',
    validation: { requiresTests: true, requiresBuild: true },
  },

  // Validation readiness
  'missing-build-script': {
    phase: 'validation-readiness',
    riskLevel: 'high',
    executionCapability: 'manual',
    validation: { requiresBuild: true, requiresManualVerification: true },
  },
  'missing-test-script': {
    phase: 'testing-readiness',
    riskLevel: 'medium',
    executionCapability: 'manual',
    validation: { requiresManualVerification: true, requiresBuild: true },
  },
  'missing-lint-script': {
    phase: 'validation-readiness',
    riskLevel: 'medium',
    executionCapability: 'manual',
    validation: { requiresLint: true, requiresManualVerification: true },
  },
  'missing-typecheck-script': {
    phase: 'validation-readiness',
    riskLevel: 'medium',
    executionCapability: 'manual',
    validation: { requiresTypecheck: true, requiresManualVerification: true },
  },
};

export function mapReact19SeverityToRiskLevel(
  severity: React19CompatibilitySeverity,
): React19MigrationRiskLevel {
  return severity;
}

export function getReact19FallbackPhaseForCategory(
  category: React19CompatibilityCategory,
): React19MigrationPhase {
  switch (category) {
    case 'react-version':
    case 'react-dom-version':
    case 'package-manager':
      return 'preflight';
    case 'build-tool':
    case 'jsx-transform':
      return 'tooling';
    case 'deprecated-react-api':
    case 'deprecated-lifecycle':
    case 'component-patterns':
      return 'api-compatibility';
    case 'dependencies':
    case 'peer-dependencies':
    case 'sass-scss':
      return 'dependency-modernization';
    case 'typescript-readiness':
      return 'typescript-readiness';
    case 'routing':
      return 'routing-readiness';
    case 'testing':
      return 'testing-readiness';
    case 'validation':
      return 'validation-readiness';
  }
}

export function getReact19DefaultExecutionCapabilityForCategory(
  category: React19CompatibilityCategory,
): React19ExecutionCapability {
  switch (category) {
    case 'react-version':
    case 'react-dom-version':
    case 'dependencies':
    case 'sass-scss':
      return 'scriptable';
    case 'build-tool':
    case 'deprecated-react-api':
    case 'deprecated-lifecycle':
    case 'component-patterns':
    case 'routing':
    case 'testing':
      return 'ai-assisted';
    case 'peer-dependencies':
    case 'package-manager':
    case 'typescript-readiness':
      return 'manual';
    case 'jsx-transform':
      return 'scriptable';
    case 'validation':
      return 'manual';
  }
}

export function getReact19DefaultValidationForCategory(
  category: React19CompatibilityCategory,
): React19ValidationRequirement {
  switch (category) {
    case 'react-version':
    case 'package-manager':
      return { requiresManualVerification: true };
    case 'react-dom-version':
    case 'dependencies':
    case 'peer-dependencies':
    case 'sass-scss':
      return { requiresInstall: true, requiresBuild: true, requiresTests: true };
    case 'build-tool':
      return { requiresInstall: true, requiresBuild: true, requiresTests: true };
    case 'jsx-transform':
      return {
        requiresLint: true,
        requiresTypecheck: true,
        requiresBuild: true,
      };
    case 'deprecated-react-api':
    case 'deprecated-lifecycle':
    case 'component-patterns':
      return {
        requiresLint: true,
        requiresTypecheck: true,
        requiresTests: true,
        requiresBuild: true,
      };
    case 'typescript-readiness':
      return { requiresTypecheck: true, requiresBuild: true };
    case 'routing':
      return { requiresInstall: true, requiresTests: true, requiresBuild: true };
    case 'testing':
      return { requiresTests: true, requiresBuild: true };
    case 'validation':
      return { requiresManualVerification: true };
  }
}
