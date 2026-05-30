/**
 * Public barrel for the scanner feature.
 *
 * External code should depend on the screen component, the store hook
 * (for reading the scan report or status), and the types — never on the
 * service or component internals.
 */
export { ScannerScreen } from './ScannerScreen';
export {
  useProjectScannerStore,
  selectScanError,
  selectScanIsReadyForPlan,
  selectScanReport,
  selectScanStatus,
} from './hooks/useProjectScanner';
export {
  ScanDependencyCard,
} from './components/ScanDependencyCard';
export { ScanReact19ContextCard } from './components/ScanReact19ContextCard';
export { ScanReact19CompatibilityCard } from './components/ScanReact19CompatibilityCard';
export { ScanRecommendations } from './components/ScanRecommendations';
export { ScanRiskCard } from './components/ScanRiskCard';
export { ScanSourceAnalysisCard } from './components/ScanSourceAnalysisCard';
export { ScanSummaryCard } from './components/ScanSummaryCard';
export { ScanActionBar } from './components/ScanActionBar';
export type {
  DependencyReport,
  DeprecatedLifecycleUsage,
  DeprecatedPackage,
  Recommendation,
  RiskReport,
  ScanError,
  ScanIssue,
  ScanIssueCode,
  ScanIssueSeverity,
  ScanProjectInfo,
  ScanReport,
  ScanRiskLevel,
  ScanStatus,
  ScannerState,
  ScriptReport,
  SourceAnalysisReport,
} from './types/scanner.types';
