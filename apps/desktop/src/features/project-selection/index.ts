/**
 * Public barrel for the project-selection feature.
 *
 * External code should only depend on the screen component and the store
 * (for reading the selected project elsewhere). Services and components
 * stay encapsulated; reach for them only from inside this folder.
 */
export { ProjectSelectionScreen } from './ProjectSelectionScreen';
export { useProjectSelectionStore } from './hooks/useProjectSelection';
export type {
  PackageManager,
  ProjectMetadata,
  ProjectMetadataScripts,
  ProjectSelectionState,
  ProjectValidationIssue,
  ProjectValidationIssueCode,
  ProjectValidationIssueType,
  ProjectValidationStatus,
} from './types/projectSelection.types';
