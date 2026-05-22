// Shared "rebuild a saved row for Undo" helper.
//
// Used by every Undo flow in the project so the recreate POST shape can't
// silently drift between surfaces:
//   - Web detail-page Save button   (artifacts/edunav/src/components/saved-plan-button.tsx)
//   - Web My Plan list              (artifacts/edunav/src/pages/saved.tsx)
//   - Mobile detail screens         (artifacts/edunav-mobile/app/{college,career,scholarship}/[id].tsx)
//   - Mobile My Plan list           (artifacts/edunav-mobile/app/saved.tsx)
//
// The helper is intentionally framework-free (no React, no UI deps) so it
// can be consumed by both the Vite web app and the Expo mobile app from a
// single source of truth.

export type SavedKind = "college" | "career" | "scholarship";

export type CollegePriority = "high" | "medium" | "low";
export type ScholarshipStatus =
  | "interested"
  | "applied"
  | "awarded"
  | "rejected";

export function isCollegePriority(v: unknown): v is CollegePriority {
  return v === "high" || v === "medium" || v === "low";
}

export function isScholarshipStatus(v: unknown): v is ScholarshipStatus {
  return (
    v === "interested" ||
    v === "applied" ||
    v === "awarded" ||
    v === "rejected"
  );
}

// Loose shape that covers both the rich SavedRow returned by /api/saved-items
// (used by the My Plan lists) and the partially-typed row a detail-page
// Save button captures from its own saved-items query.
export type SavedRowLike = {
  id?: number | string;
  collegeId?: number | string;
  scholarshipId?: number | string;
  careerTitle?: string | null;
  notes?: string | null;
  priority?: string | null;
  applicationStatus?: string | null;
  deadline?: string | null;
  scholarshipName?: string | null;
  matchScore?: number | null;
  skillsGap?: unknown;
  [k: string]: unknown;
};

// Per-kind fallbacks the caller can pass in from its own props/context
// when the captured row is missing a field. The My Plan lists usually
// don't need these because the row already has everything.
export type RecreateFallbacks = {
  collegeId?: number | string | null;
  scholarshipId?: number | string | null;
  scholarshipName?: string | null;
  scholarshipDeadline?: string | null;
  careerTitle?: string | null;
};

function trimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

// Build the POST body that re-creates a removed saved-college /
// saved-career / saved-scholarship row exactly as the server stored it,
// so the Undo action on the remove toast restores the same notes,
// priority, status, deadline, and snapshot name in a single tap.
//
// Returns null when essential fields (FK id or career title) are
// missing — callers should suppress the Undo affordance in that case.
export function buildSavedRowRecreatePayload(
  kind: SavedKind,
  row: SavedRowLike,
  userId: string,
  fallbacks?: RecreateFallbacks,
): Record<string, unknown> | null {
  const notes = typeof row.notes === "string" ? row.notes : null;

  if (kind === "college") {
    const rawId = row.collegeId ?? row.id ?? fallbacks?.collegeId;
    const collegeId = Number(rawId);
    if (!Number.isFinite(collegeId) || collegeId <= 0) return null;
    const priority = isCollegePriority(row.priority) ? row.priority : null;
    return {
      userId,
      collegeId,
      notes,
      ...(priority ? { priority } : {}),
    };
  }

  if (kind === "scholarship") {
    const rawId = row.scholarshipId ?? row.id ?? fallbacks?.scholarshipId;
    const scholarshipId = Number(rawId);
    if (!Number.isFinite(scholarshipId) || scholarshipId <= 0) return null;
    const status = isScholarshipStatus(row.applicationStatus)
      ? row.applicationStatus
      : null;
    const deadline =
      trimmedString(row.deadline) ?? fallbacks?.scholarshipDeadline ?? null;
    // Carry the captured display name back through undo so the re-saved
    // row keeps the snapshot used by the badge fallback on list pages.
    const scholarshipName =
      trimmedString(row.scholarshipName) ??
      trimmedString(fallbacks?.scholarshipName) ??
      null;
    return {
      userId,
      scholarshipId,
      deadline,
      notes,
      ...(status ? { applicationStatus: status } : {}),
      ...(scholarshipName ? { scholarshipName } : {}),
    };
  }

  const careerTitle =
    trimmedString(row.careerTitle) ?? trimmedString(fallbacks?.careerTitle);
  if (!careerTitle) return null;
  const matchScore = typeof row.matchScore === "number" ? row.matchScore : 0;
  const skillsGap = Array.isArray(row.skillsGap) ? row.skillsGap : [];
  return {
    userId,
    careerTitle,
    matchScore,
    skillsGap,
    notes,
  };
}
