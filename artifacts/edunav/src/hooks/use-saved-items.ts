import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth.js";

export type SavedItemRow = {
  id?: number | string;
  collegeId?: number | string;
  scholarshipId?: number | string;
  scholarshipName?: string | null;
  name?: string | null;
  careerTitle?: string | null;
  title?: string | null;
  onetCode?: string | null;
  [k: string]: unknown;
};

export type SavedItemsResponse = {
  colleges?: SavedItemRow[];
  careers?: SavedItemRow[];
  scholarships?: SavedItemRow[];
};

export type SavedItemKeys = {
  collegeIds: Set<string>;
  careerTitles: Set<string>;
  careerOnetCodes: Set<string>;
  scholarshipIds: Set<string>;
  scholarshipNames: Set<string>;
};

const EMPTY_KEYS: SavedItemKeys = {
  collegeIds: new Set(),
  careerTitles: new Set(),
  careerOnetCodes: new Set(),
  scholarshipIds: new Set(),
  scholarshipNames: new Set(),
};

// Pulls the user's saved-items list (the same `/api/saved-items/:userId`
// endpoint that the detail screens' Save button already uses) so list and
// recommendation cards across the web app can show a "Saved" badge that
// stays in sync with adds/removes via the shared query cache.
export function useSavedItems(): {
  data: SavedItemsResponse | null | undefined;
  keys: SavedItemKeys;
  isEnabled: boolean;
} {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery<SavedItemsResponse | null>({
    queryKey: ["/api/saved-items", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`/api/saved-items/${encodeURIComponent(userId)}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return (await res.json()) as SavedItemsResponse;
    },
    enabled: !!userId,
  });

  const keys = useMemo<SavedItemKeys>(() => {
    if (!query.data) return EMPTY_KEYS;
    const collegeIds = new Set<string>();
    for (const row of query.data.colleges ?? []) {
      const id = row.collegeId ?? row.id;
      if (id != null) collegeIds.add(String(id));
    }
    const careerTitles = new Set<string>();
    const careerOnetCodes = new Set<string>();
    for (const row of query.data.careers ?? []) {
      const title = (
        (typeof row.careerTitle === "string" && row.careerTitle) ||
        (typeof row.title === "string" && row.title) ||
        (typeof row.name === "string" && row.name) ||
        ""
      )
        .trim()
        .toLowerCase();
      if (title) careerTitles.add(title);
      const code = typeof row.onetCode === "string" ? row.onetCode.trim() : "";
      if (code) careerOnetCodes.add(code);
    }
    const scholarshipIds = new Set<string>();
    const scholarshipNames = new Set<string>();
    for (const row of query.data.scholarships ?? []) {
      const id = row.scholarshipId ?? row.id;
      if (id != null) scholarshipIds.add(String(id));
      const rawName =
        (typeof row.scholarshipName === "string" && row.scholarshipName) ||
        (typeof row.name === "string" && row.name) ||
        "";
      // Index both the simple lowercased trim (back-compat with any caller
      // still using normalizeKey) and the stronger canonical key so the
      // badge fallback survives extra punctuation / year suffixes between
      // the saved row and the displayed pick.
      const simple = rawName.trim().toLowerCase();
      if (simple) scholarshipNames.add(simple);
      const canonical = canonicalScholarshipKey(rawName);
      if (canonical) scholarshipNames.add(canonical);
    }
    return {
      collegeIds,
      careerTitles,
      careerOnetCodes,
      scholarshipIds,
      scholarshipNames,
    };
  }, [query.data]);

  return { data: query.data, keys, isEnabled: !!userId };
}

export function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

// Shared "is this card already saved?" lookups used by every list/card
// screen so the matching logic (normalize title + onetCode, canonical
// scholarship key, stringified id) can evolve in one place without
// drifting between callers.
export function isCareerSaved(
  savedKeys: SavedItemKeys,
  career: { title?: string | null; onetCode?: string | null },
): boolean {
  const titleKey = normalizeKey(career.title);
  const codeKey = (career.onetCode ?? "").trim();
  return (
    (titleKey.length > 0 && savedKeys.careerTitles.has(titleKey)) ||
    (codeKey.length > 0 && savedKeys.careerOnetCodes.has(codeKey))
  );
}

export function isCollegeSaved(
  savedKeys: SavedItemKeys,
  college: { id?: number | string | null },
): boolean {
  if (college.id == null) return false;
  return savedKeys.collegeIds.has(String(college.id));
}

export function isScholarshipSaved(
  savedKeys: SavedItemKeys,
  scholarship: { id?: number | string | null; name?: string | null },
): boolean {
  const idKey = scholarship.id != null ? String(scholarship.id) : "";
  const nameKey = canonicalScholarshipKey(scholarship.name);
  return (
    (idKey.length > 0 && savedKeys.scholarshipIds.has(idKey)) ||
    (nameKey.length > 0 && savedKeys.scholarshipNames.has(nameKey))
  );
}

// Canonical scholarship-name key used for fuzzy "Saved" badge matching when
// a list page only knows the scholarship by name (no stable id). Strips
// all punctuation and any year / year-range tokens (e.g. "2024",
// "2024-2025", "2024-25") so cosmetic differences like "Federal Pell Grant
// 2024" vs "Federal Pell Grant" still match the same saved row.
export function canonicalScholarshipKey(
  value: string | null | undefined,
): string {
  let s = (value ?? "").toLowerCase();
  s = s.replace(/\b(19|20)\d{2}\s*[-–—\/]\s*(?:(19|20)?\d{2})\b/g, " ");
  s = s.replace(/\b(19|20)\d{2}\b/g, " ");
  s = s.replace(/[^a-z0-9]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}
