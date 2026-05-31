/**
 * Public barrel for the workspace feature.
 *
 * External code should depend on the screen component, the store hook
 * (for reading the workspace result or status), and the types — never on
 * the service or component internals.
 */
export { WorkspaceScreen } from './WorkspaceScreen';
export {
  useWorkspaceSetupStore,
  selectHasWorkspace,
  selectHasValidWorkspace,
  selectWorkspaceError,
  selectWorkspacePath,
  selectWorkspacePlanSnapshot,
  selectWorkspacePreflight,
  selectWorkspaceResult,
  selectWorkspaceState,
  selectWorkspaceStatus,
} from './hooks/useWorkspaceSetup';
export {
  isValidBranchName,
  sanitiseForBranch,
} from './services/workspacePathService';
export {
  isValidWorkspaceState,
  validateWorkspaceState,
} from './services/workspaceValidationService';
export type {
  CreateWorkspaceRequest,
  CreateWorkspaceResult,
  GitCleanliness,
  WorkspaceCommandLog,
  WorkspaceCreationResult,
  WorkspaceError,
  WorkspaceErrorKind,
  WorkspaceGitStatus,
  WorkspaceIssue,
  WorkspaceIssueCode,
  WorkspaceIssueSeverity,
  WorkspacePackageManager,
  WorkspacePlanSnapshot,
  WorkspacePreflight,
  WorkspaceSetupState,
  WorkspaceState,
  WorkspaceStateValidation,
  WorkspaceStatus,
  WorkspaceStrategy,
} from './types/workspace.types';
