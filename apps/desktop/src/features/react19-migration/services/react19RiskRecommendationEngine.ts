import type { ScanReport } from '@features/scanner';

import {
  REACT19_ISSUE_CODE_METADATA,
  REACT19_ISSUE_CODES,
  getReact19IssueDisplayLabel,
} from '../constants/react19IssueCodes';
import {
  REACT19_EXECUTION_CAPABILITY_DISPLAY_NAMES,
  REACT19_MIGRATION_PHASES_ORDERED,
  REACT19_PHASE_DISPLAY_NAMES,
  REACT19_RISK_RULES,
  getReact19DefaultExecutionCapabilityForCategory,
  getReact19DefaultValidationForCategory,
  getReact19FallbackPhaseForCategory,
  mapReact19SeverityToRiskLevel,
} from '../constants/react19RiskRules';
import type { React19CompatibilityIssue } from '../types/react19Compatibility.types';
import type {
  React19ExecutionCapability,
  React19MigrationPhase,
  React19RiskEngineResult,
  React19RiskEngineSummary,
  React19RiskRecommendation,
  React19RiskRecommendationsByPhase,
  React19ValidationRequirement,
} from '../types/react19RiskRecommendation.types';

export function buildReact19RiskEngine(scanReport: ScanReport): React19RiskEngineResult {
  const issues = scanReport.react19CompatibilityReport?.issues ?? [];
  const issueItems = issues.map((issue, index) =>
    mapReact19IssueToRiskRecommendation(issue, scanReport, index),
  );
  const bridgeItems = buildReactBridgeRecommendations(scanReport);
  const validationCapabilityItems = buildValidationCapabilityRecommendations(scanReport);

  const items = sortRiskRecommendations(
    attachRelatedIssueCodes([...issueItems, ...bridgeItems, ...validationCapabilityItems]),
  );

  return {
    items,
    byPhase: groupReact19RiskRecommendationsByPhase(items),
    summary: summarizeReact19RiskRecommendations(items),
  };
}

export function mapReact19IssueToRiskRecommendation(
  issue: React19CompatibilityIssue,
  _scanReport: ScanReport,
  index = 0,
): React19RiskRecommendation {
  const canonicalTemplate =
    issue.canonicalCode !== undefined ? REACT19_RISK_RULES[issue.canonicalCode] : undefined;
  const codeTemplate = REACT19_RISK_RULES[issue.code];
  const template = codeTemplate ?? canonicalTemplate;
  const metadata =
    issue.canonicalCode !== undefined
      ? REACT19_ISSUE_CODE_METADATA[issue.canonicalCode]
      : undefined;

  const phase = template?.phase ?? getReact19FallbackPhaseForCategory(issue.category);
  const riskLevel = template?.riskLevel ?? mapReact19SeverityToRiskLevel(issue.severity);
  const executionCapability =
    template?.executionCapability ??
    getReact19DefaultExecutionCapabilityForCategory(issue.category);

  const defaultValidation = getReact19DefaultValidationForCategory(issue.category);
  const validation = mergeValidationRequirements(defaultValidation, template?.validation);

  const title = metadata?.label ?? getReact19IssueDisplayLabel(issue);
  const explanation = metadata?.description ?? issue.message;
  const recommendation =
    template?.recommendation ??
    metadata?.defaultRecommendation ??
    issue.recommendation;

  const idSuffix = issue.packageName ?? issue.count?.toString() ?? `${index}`;

  return {
    id: `risk:${issue.code}:${idSuffix}`,
    sourceIssueCode: issue.code,
    ...(issue.canonicalCode !== undefined ? { canonicalCode: issue.canonicalCode } : {}),
    title,
    explanation,
    recommendation,
    phase,
    riskLevel,
    executionCapability,
    validation,
    ...(template?.blocksPlanGeneration !== undefined
      ? { blocksPlanGeneration: template.blocksPlanGeneration }
      : {}),
    ...(template?.blocksUpgrade !== undefined
      ? { blocksUpgrade: template.blocksUpgrade }
      : issue.severity === 'blocker' || issue.severity === 'high'
        ? { blocksUpgrade: true }
        : {}),
  };
}

export function groupReact19RiskRecommendationsByPhase(
  items: readonly React19RiskRecommendation[],
): React19RiskRecommendationsByPhase {
  const grouped: Record<React19MigrationPhase, React19RiskRecommendation[]> = {
    preflight: [],
    tooling: [],
    'react-bridge': [],
    'api-compatibility': [],
    'dependency-modernization': [],
    'typescript-readiness': [],
    'routing-readiness': [],
    'testing-readiness': [],
    'validation-readiness': [],
  };

  for (const item of items) {
    grouped[item.phase].push(item);
  }

  return grouped;
}

export function summarizeReact19RiskRecommendations(
  items: readonly React19RiskRecommendation[],
): React19RiskEngineSummary {
  let blockers = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let info = 0;

  let manual = 0;
  let aiAssisted = 0;
  let codemod = 0;
  let scriptable = 0;
  let validationOnly = 0;

  for (const item of items) {
    switch (item.riskLevel) {
      case 'blocker':
        blockers += 1;
        break;
      case 'high':
        high += 1;
        break;
      case 'medium':
        medium += 1;
        break;
      case 'low':
        low += 1;
        break;
      case 'info':
        info += 1;
        break;
    }

    switch (item.executionCapability) {
      case 'manual':
        manual += 1;
        break;
      case 'ai-assisted':
        aiAssisted += 1;
        break;
      case 'codemod':
        codemod += 1;
        break;
      case 'scriptable':
        scriptable += 1;
        break;
      case 'validation-only':
        validationOnly += 1;
        break;
    }
  }

  return {
    total: items.length,
    blockers,
    high,
    medium,
    low,
    info,
    manual,
    aiAssisted,
    codemod,
    scriptable,
    validationOnly,
  };
}

export function getReact19PhaseDisplayName(phase: React19MigrationPhase): string {
  return REACT19_PHASE_DISPLAY_NAMES[phase];
}

export function getReact19ExecutionCapabilityDisplayName(
  capability: React19ExecutionCapability,
): string {
  return REACT19_EXECUTION_CAPABILITY_DISPLAY_NAMES[capability];
}

function buildReactBridgeRecommendations(scanReport: ScanReport): React19RiskRecommendation[] {
  const sourceMajor =
    scanReport.react19MigrationContext?.sourceReactMajor ??
    scanReport.react19SupportStatus?.sourceReactMajor ??
    scanReport.dependencies.reactMajor;

  if (sourceMajor === 16 || sourceMajor === 17) {
    return [
      {
        id: `risk:react-bridge:react-${sourceMajor}`,
        sourceIssueCode: REACT19_ISSUE_CODES.REACT_SOURCE_MAJOR_SUPPORTED,
        canonicalCode: REACT19_ISSUE_CODES.REACT_SOURCE_MAJOR_SUPPORTED,
        title: 'React 18 bridge required before React 19',
        explanation: `React ${sourceMajor} projects should first migrate to React 18 root APIs and compatibility expectations before taking the React 19 upgrade.`,
        recommendation:
          'Introduce a React 18 bridge phase first, then continue to React 19 upgrade and compatibility hardening.',
        phase: 'react-bridge',
        riskLevel: 'high',
        executionCapability: 'ai-assisted',
        validation: {
          requiresInstall: true,
          requiresLint: true,
          requiresTypecheck: true,
          requiresTests: true,
          requiresBuild: true,
        },
        blocksUpgrade: true,
      },
    ];
  }

  if (sourceMajor === 18) {
    return [
      {
        id: 'risk:react-bridge:react-18-skip',
        sourceIssueCode: REACT19_ISSUE_CODES.REACT_SOURCE_MAJOR_SUPPORTED,
        canonicalCode: REACT19_ISSUE_CODES.REACT_SOURCE_MAJOR_SUPPORTED,
        title: 'React 18 bridge can be skipped',
        explanation:
          'This project already runs React 18, so a dedicated bridge phase is not required.',
        recommendation:
          'Proceed directly with API compatibility checks and dependency modernization for React 19.',
        phase: 'react-bridge',
        riskLevel: 'info',
        executionCapability: 'validation-only',
        validation: {
          requiresLint: true,
          requiresTypecheck: true,
          requiresTests: true,
          requiresBuild: true,
        },
      },
    ];
  }

  return [];
}

function buildValidationCapabilityRecommendations(
  scanReport: ScanReport,
): React19RiskRecommendation[] {
  const scripts = scanReport.scripts.raw;
  const available = scanReport.react19CompatibilityReport?.signals.availableValidationCommands ?? [];
  const commands = available.length > 0 ? available : Object.keys(scripts);
  const runPrefix =
    scanReport.dependencies.packageManager === 'unknown'
      ? 'npm run'
      : `${scanReport.dependencies.packageManager} run`;

  const deduped = Array.from(new Set(commands));
  const out: React19RiskRecommendation[] = [];

  for (const command of deduped) {
    if (!isValidationScriptName(command)) continue;
    out.push({
      id: `risk:validation-command:${command}`,
      sourceIssueCode: `validation-command-available:${command}`,
      title: `${command} validation command available`,
      explanation: `The project exposes a \`${command}\` script that can be used as a migration validation gate.`,
      recommendation: `Run \`${runPrefix} ${command}\` after relevant migration changes.`,
      phase: 'validation-readiness',
      riskLevel: 'info',
      executionCapability: 'validation-only',
      validation: validationRequirementForValidationCommand(command, `${runPrefix} ${command}`),
    });
  }

  return out;
}

function validationRequirementForValidationCommand(
  scriptName: string,
  command: string,
): React19ValidationRequirement {
  const shared = { suggestedCommands: [command] } as const;
  switch (scriptName) {
    case 'build':
      return { ...shared, requiresBuild: true };
    case 'test':
      return { ...shared, requiresTests: true };
    case 'lint':
      return { ...shared, requiresLint: true };
    case 'typecheck':
    case 'type-check':
    case 'tsc':
      return { ...shared, requiresTypecheck: true };
    default:
      return shared;
  }
}

function mergeValidationRequirements(
  base: React19ValidationRequirement,
  override: React19ValidationRequirement | undefined,
): React19ValidationRequirement {
  if (override === undefined) return base;
  const combinedCommands = [
    ...(base.suggestedCommands ?? []),
    ...(override.suggestedCommands ?? []),
  ];
  return {
    ...base,
    ...override,
    ...(combinedCommands.length > 0
      ? { suggestedCommands: Array.from(new Set(combinedCommands)) }
      : {}),
  };
}

function sortRiskRecommendations(
  items: readonly React19RiskRecommendation[],
): readonly React19RiskRecommendation[] {
  const phaseRank = REACT19_MIGRATION_PHASES_ORDERED.reduce<
    Record<React19MigrationPhase, number>
  >(
    (acc, phase, index) => {
      acc[phase] = index;
      return acc;
    },
    {
      preflight: 0,
      tooling: 0,
      'react-bridge': 0,
      'api-compatibility': 0,
      'dependency-modernization': 0,
      'typescript-readiness': 0,
      'routing-readiness': 0,
      'testing-readiness': 0,
      'validation-readiness': 0,
    },
  );
  const riskRank = {
    blocker: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  } as const;

  return [...items].sort((a, b) => {
    const byPhase = phaseRank[a.phase] - phaseRank[b.phase];
    if (byPhase !== 0) return byPhase;
    const byRisk = riskRank[b.riskLevel] - riskRank[a.riskLevel];
    if (byRisk !== 0) return byRisk;
    return a.title.localeCompare(b.title);
  });
}

function attachRelatedIssueCodes(
  items: readonly React19RiskRecommendation[],
): React19RiskRecommendation[] {
  const byCanonical = new Map<string, string[]>();
  for (const item of items) {
    const key = item.canonicalCode ?? item.sourceIssueCode;
    const list = byCanonical.get(key) ?? [];
    list.push(item.sourceIssueCode);
    byCanonical.set(key, list);
  }

  return items.map((item) => {
    const key = item.canonicalCode ?? item.sourceIssueCode;
    const related = byCanonical.get(key) ?? [];
    const deduped = Array.from(new Set(related)).filter((code) => code !== item.sourceIssueCode);
    if (deduped.length === 0) return item;
    return {
      ...item,
      relatedIssueCodes: deduped,
    };
  });
}

function isValidationScriptName(name: string): boolean {
  return (
    name === 'build' ||
    name === 'test' ||
    name === 'lint' ||
    name === 'typecheck' ||
    name === 'type-check' ||
    name === 'tsc'
  );
}
