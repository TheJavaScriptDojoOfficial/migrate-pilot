/**
 * Public barrel for the diff-review feature.
 *
 * External code should depend on the screen component, the store hook
 * (for reading the diff review session or status), and the types — never
 * on the service or component internals.
 */
export { DiffReviewScreen } from './DiffReviewScreen';
export {
  useDiffReviewStore,
  selectDiffReviewError,
  selectDiffReviewExecutionRunId,
  selectDiffReviewPending,
  selectDiffReviewSession,
  selectDiffReviewStatus,
  selectSelectedDiffFile,
} from './hooks/useDiffReview';
export {
  DiffReviewServiceError,
  approveDiffReview,
  loadDiffReview,
  parseDiffFile,
  parseDiffReviewDecision,
  parseDiffReviewSession,
  rejectDiffReview,
} from './services/diffReviewService';
export {
  classifyDiffLine,
  formatReviewTimestamp,
  FILE_STATUS_ICON,
  FILE_STATUS_LABEL,
  FILE_STATUS_TONE,
  REVIEW_STATUS_KIND,
  REVIEW_STATUS_LABEL,
} from './services/diffReviewPresentationService';
export type { DiffLineKind } from './services/diffReviewPresentationService';
export type {
  DiffCommandLog,
  DiffFile,
  DiffFileStatus,
  DiffReviewDecision,
  DiffReviewDecisionType,
  DiffReviewError,
  DiffReviewSession,
  DiffReviewState,
  DiffReviewStatus,
} from './types/diffReview.types';
