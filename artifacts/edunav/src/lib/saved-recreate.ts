// Thin re-export of the workspace-level shared helper so existing
// `@/lib/saved-recreate` imports inside the web app keep resolving.
//
// The real implementation lives at `lib/saved-recreate/src/index.ts`
// (`@workspace/saved-recreate`) so the web detail-page Save button, the
// web My Plan list, the mobile detail screens, and the mobile My Plan
// list all build the recreate POST body from a single source of truth.
export {
  buildSavedRowRecreatePayload,
  isCollegePriority,
  isScholarshipStatus,
} from "@workspace/saved-recreate";
export type {
  CollegePriority,
  RecreateFallbacks,
  SavedKind,
  SavedRowLike,
  ScholarshipStatus,
} from "@workspace/saved-recreate";
