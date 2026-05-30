import type { React19CanonicalIssueCode } from '../constants/react19IssueCodes';

export type React19MigrationPhase =
  | 'preflight'
  | 'tooling'
  | 'react-bridge'
  | 'api-compatibility'
  | 'dependency-modernization'
  | 'typescript-readiness'
  | 'routing-readiness'
  | 'testing-readiness'
  | 'validation-readiness';

export type React19MigrationRiskLevel =
  | 'blocker'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

export type React19ExecutionCapability =
  | 'scriptable'
  | 'codemod'
  | 'ai-assisted'
  | 'manual'
  | 'validation-only';

export interface React19ValidationRequirement {
  readonly requiresInstall?: boolean;
  readonly requiresLint?: boolean;
  readonly requiresTypecheck?: boolean;
  readonly requiresTests?: boolean;
  readonly requiresBuild?: boolean;
  readonly requiresManualVerification?: boolean;
  readonly suggestedCommands?: readonly string[];
}

export interface React19RiskRecommendation {
  readonly id: string;
  readonly sourceIssueCode: string;
  readonly canonicalCode?: React19CanonicalIssueCode;
  readonly title: string;
  readonly explanation: string;
  readonly recommendation: string;
  readonly phase: React19MigrationPhase;
  readonly riskLevel: React19MigrationRiskLevel;
  readonly executionCapability: React19ExecutionCapability;
  readonly validation: React19ValidationRequirement;
  readonly blocksPlanGeneration?: boolean;
  readonly blocksUpgrade?: boolean;
  readonly relatedIssueCodes?: readonly string[];
}

export interface React19RiskEngineSummary {
  readonly total: number;
  readonly blockers: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly info: number;
  readonly manual: number;
  readonly aiAssisted: number;
  readonly codemod: number;
  readonly scriptable: number;
  readonly validationOnly: number;
}

export type React19RiskRecommendationsByPhase = Readonly<
  Record<React19MigrationPhase, readonly React19RiskRecommendation[]>
>;

export interface React19RiskEngineResult {
  readonly items: readonly React19RiskRecommendation[];
  readonly byPhase: React19RiskRecommendationsByPhase;
  readonly summary: React19RiskEngineSummary;
}
