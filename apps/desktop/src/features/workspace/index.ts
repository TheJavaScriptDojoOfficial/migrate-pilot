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
  selectWorkspaceError,
  selectWorkspacePreflight,
  selectWorkspaceResult,
  selectWorkspaceStatus,
} from './hooks/useWorkspaceSetup';
export {
  isValidBranchName,
  sanitiseForBranch,
} from './services/workspacePathService';
export type {
  GitCleanliness,
  WorkspaceCommandLog,
  WorkspaceCreationResult,
  WorkspaceError,
  WorkspaceErrorKind,
  WorkspaceIssue,
  WorkspaceIssueCode,
  WorkspaceIssueSeverity,
  WorkspacePreflight,
  WorkspaceSetupState,
  WorkspaceStatus,
  WorkspaceStrategy,
} from './types/workspace.types';
