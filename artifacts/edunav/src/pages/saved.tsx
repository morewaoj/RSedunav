import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Bookmark,
  Briefcase,
  GraduationCap,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth.js";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { pickMatchReasons } from "@/components/match-reason-chips";
import { buildSavedRowRecreatePayload } from "@/lib/saved-recreate";
import {
  SavedItemEditDialog,
  type CollegePriority,
  type ScholarshipStatus,
  type SavedKind,
  isCollegePriority,
  isScholarshipStatus,
  priorityLabel,
  statusLabel,
} from "@/components/saved-note-section";

type SavedCollegeRow = {
  id?: number | string;
  collegeId?: number | string;
  notes?: string | null;
  priority?: string | null;
};

type SavedCareerRow = {
  id?: number | string;
  careerTitle?: string | null;
  notes?: string | null;
  // Carried through so the Undo action can re-POST the row exactly as the
  // server originally stored it (matchScore / skillsGap are required by
  // the saved-career insert schema).
  matchScore?: number | null;
  skillsGap?: unknown;
};

type SavedScholarshipRow = {
  id?: number | string;
  scholarshipId?: number | string;
  notes?: string | null;
  applicationStatus?: string | null;
  // Carried through so Undo can restore the row's deadline and the
  // snapshot display name used by list-page Saved badges.
  deadline?: string | null;
  scholarshipName?: string | null;
  // True for legacy saved rows whose `scholarshipId` no longer resolves to
  // a row in the canonical `scholarships` table AND that don't carry a
  // snapshot name. Surfaced by the API so the UI can show a clear
  // "no longer available" placeholder and let the user clean it up.
  scholarshipMissing?: boolean;
};

type SavedItemsResponse = {
  colleges?: SavedCollegeRow[];
  careers?: SavedCareerRow[];
  scholarships?: SavedScholarshipRow[];
};

type CollegeDetail = { id?: number | string; name?: string };
type ScholarshipDetail = { id?: number | string; name?: string; title?: string };

// Mirrors the recs payload shape used on mobile's saved screen and the web
// Scholarships page: entries pair a scholarship with the personalized
// reasons it matches the signed-in user. We look rows up by normalized
// name both for ranking and for the "why this matches you" chips.
type ScholarshipRecsResponse = {
  recommendations?: Array<{
    scholarship?: { name?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

// /api/profile/career-recommendations payload — reasons may arrive as an
// array OR as a "; "-separated string under matchReason, so we accept both
// (same shape mobile's saved screen normalizes).
type CareerRecsResponse = {
  careers?: Array<{
    career?: {
      title?: string | null;
      matchReason?: string | null;
      matchReasons?: string[] | null;
    } | null;
    reason?: string | null;
    matchReasons?: string[] | null;
  }>;
};

// /api/profile/college-recommendations?ids=… payload — we narrow scoring
// to the user's saved ids so every saved row has a chance at chips.
type CollegeRecsResponse = {
  colleges?: Array<{
    college?: { id?: number | string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

type EditTarget = {
  kind: SavedKind;
  rowId: number;
  label: string;
  initialNotes: string | null;
  initialPriority: CollegePriority | null;
  initialStatus: ScholarshipStatus | null;
};

// Numeric rank for the user-assigned saved-college priority. Lower wins,
// so high-priority schools land first; rows without a priority are
// returned as `undefined` from the rank fn so they sink to the bottom in
// stable original save order (matching the helper's tiebreak rule).
const PRIORITY_RANK: Record<CollegePriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Shared rank-sort helper that mirrors the one on mobile's Saved screen.
// Returns the re-ranked list AND whether any row actually changed position,
// so callers can decide whether the "Best match first" affordance is worth
// showing (per spec: only when at least one row was re-ranked).
function sortByRank<T>(
  base: T[],
  enabled: boolean,
  rankOf: (entry: T) => number | undefined,
): { items: T[]; reordered: boolean } {
  if (!enabled) return { items: base, reordered: false };
  const decorated = base.map((entry, originalIndex) => ({
    entry,
    originalIndex,
    rank: rankOf(entry),
  }));
  decorated.sort((a, b) => {
    const aHas = a.rank !== undefined;
    const bHas = b.rank !== undefined;
    if (aHas && bHas) return (a.rank as number) - (b.rank as number);
    if (aHas) return -1;
    if (bHas) return 1;
    return a.originalIndex - b.originalIndex;
  });
  const reordered = decorated.some((s, i) => s.originalIndex !== i);
  return { items: decorated.map((s) => s.entry), reordered };
}


// Career reasons may arrive as a clean string[] or as a single
// "; "-separated string. Try each candidate in order and return the first
// one that yields at least one cleaned pill (mirrors mobile saved screen).
function pickReasonsFromMixed(
  candidates: Array<string[] | string | null | undefined>,
  max = 2,
): string[] {
  for (const candidate of candidates) {
    let parts: string[] = [];
    if (Array.isArray(candidate)) {
      parts = candidate.filter((r): r is string => typeof r === "string");
    } else if (typeof candidate === "string") {
      parts = candidate.split(/;|\u2022|\|/);
    }
    const cleaned = parts
      .map((r) => r.replace(/\s+/g, " ").trim())
      .filter((r) => r.length > 0);
    if (cleaned.length > 0) return cleaned.slice(0, max);
  }
  return [];
}

function normalizeNote(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function rowIdNumber(rowId: unknown): number | null {
  const n = typeof rowId === "number" ? rowId : Number(rowId);
  return Number.isFinite(n) ? n : null;
}

function deleteEndpoint(kind: SavedKind, rowId: number): string {
  if (kind === "college") return `/api/saved-colleges/${rowId}`;
  if (kind === "scholarship") return `/api/saved-scholarships/${rowId}`;
  return `/api/saved-careers/${rowId}`;
}

function postEndpoint(kind: SavedKind): string {
  if (kind === "college") return "/api/saved-colleges";
  if (kind === "scholarship") return "/api/saved-scholarships";
  return "/api/saved-careers";
}

function detailHref(kind: SavedKind, id: number | string | null): string | null {
  if (id === null || id === undefined || String(id).length === 0) return null;
  if (kind === "college") return `/college/${id}`;
  if (kind === "scholarship") return `/scholarship/${id}`;
  return null;
}

export default function SavedPage() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const savedItemsQ = useQuery<SavedItemsResponse | null>({
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

  const colleges = savedItemsQ.data?.colleges ?? [];
  const careers = savedItemsQ.data?.careers ?? [];
  const scholarships = savedItemsQ.data?.scholarships ?? [];

  // The saved_colleges / saved_scholarships rows only persist the foreign id,
  // not the display name. Fetch each title in parallel so rows show a useful
  // label. Allowed to fail quietly — the row falls back to "College #id".
  const collegeDetailQs = useQueries({
    queries: colleges.map((row) => {
      const rawId = row.collegeId ?? row.id;
      const idNum = Number(rawId);
      const enabled = Number.isFinite(idNum) && idNum > 0;
      return {
        queryKey: ["/api/colleges", idNum],
        queryFn: async () => {
          const res = await fetch(`/api/colleges/${idNum}`, {
            credentials: "include",
          });
          if (!res.ok) return null;
          return (await res.json()) as CollegeDetail;
        },
        enabled,
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  // Pull the personalized scholarship recommendations so we can mirror the
  // mobile Saved screen and order saved scholarships by best match. The
  // endpoint is auth-gated; if it 401s or otherwise fails, we fall back to
  // the original save order — saved rows still render cleanly.
  const scholarshipRecsQ = useQuery<ScholarshipRecsResponse | null>({
    // Key by userId so an account switch within the same SPA session
    // doesn't briefly serve the previous user's ranking from cache.
    queryKey: ["/api/profile/scholarship-recommendations", userId],
    queryFn: async () => {
      const res = await fetch("/api/profile/scholarship-recommendations", {
        credentials: "include",
      });
      if (!res.ok) return null;
      return (await res.json()) as ScholarshipRecsResponse;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Saved careers reuse the same /api/profile/career-recommendations feed
  // the Careers tab and home screen render — so users see the same "why
  // this matches you" chips here too. Allowed to fail quietly.
  const careerRecsQ = useQuery<CareerRecsResponse | null>({
    queryKey: ["/api/profile/career-recommendations", userId],
    queryFn: async () => {
      const res = await fetch("/api/profile/career-recommendations", {
        credentials: "include",
      });
      if (!res.ok) return null;
      return (await res.json()) as CareerRecsResponse;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Saved colleges use a server-scored recs feed keyed by collegeId. We
  // narrow scoring to just the user's saved ids via ?ids= so every saved
  // row gets a chance at chips even if it isn't in the user's top picks.
  const savedCollegeIds = useMemo(() => {
    const ids = colleges
      .map((c) => c.collegeId ?? c.id)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }, [colleges]);
  const collegeRecsQ = useQuery<CollegeRecsResponse | null>({
    queryKey: [
      "/api/profile/college-recommendations",
      userId,
      savedCollegeIds,
    ],
    queryFn: async () => {
      const path =
        savedCollegeIds.length > 0
          ? `/api/profile/college-recommendations?ids=${savedCollegeIds.join(",")}`
          : "/api/profile/college-recommendations";
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as CollegeRecsResponse;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const scholarshipDetailQs = useQueries({
    queries: scholarships.map((row) => {
      const rawId = row.scholarshipId ?? row.id;
      const idNum = Number(rawId);
      const enabled = Number.isFinite(idNum) && idNum > 0;
      return {
        queryKey: ["/api/scholarships", idNum],
        queryFn: async () => {
          const res = await fetch(`/api/scholarships/${idNum}`, {
            credentials: "include",
          });
          if (!res.ok) return null;
          return (await res.json()) as ScholarshipDetail;
        },
        enabled,
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  // Re-POST the saved-* row using the payload captured just before the
  // DELETE so the user gets the same notes / priority / status back in one
  // tap. Powers the Undo action on the remove toast — mirrors the detail
  // page button (saved-plan-button.tsx) and the mobile My Plan undo.
  const undoM = useMutation({
    mutationFn: async ({
      kind,
      payload,
    }: {
      kind: SavedKind;
      payload: Record<string, unknown>;
    }) => {
      await apiRequest("POST", postEndpoint(kind), payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", userId] });
    },
    onError: (e) => {
      toast({
        title: "Couldn't undo",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeM = useMutation({
    mutationFn: async ({
      kind,
      rowId,
    }: {
      kind: SavedKind;
      rowId: number;
      label: string;
      recreatePayload: Record<string, unknown> | null;
    }) => {
      await apiRequest("DELETE", deleteEndpoint(kind, rowId));
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", userId] });
      toast({
        title: `Removed "${vars.label}" from your plan`,
        // Match the detail-page button and the mobile snackbar window.
        // Radix toast defaults to ~5s already, but pin it so the three
        // surfaces stay in sync if the global default ever changes.
        duration: 5000,
        action: vars.recreatePayload ? (
          <ToastAction
            altText="Undo remove"
            onClick={() =>
              undoM.mutate({ kind: vars.kind, payload: vars.recreatePayload! })
            }
          >
            Undo
          </ToastAction>
        ) : undefined,
      });
    },
    onError: (e) => {
      toast({
        title: "Couldn't remove",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRemove = (
    kind: SavedKind,
    rowId: number,
    label: string,
    recreatePayload: Record<string, unknown> | null,
  ) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(`Remove "${label}" from your plan?`);
      if (!ok) return;
    }
    removeM.mutate({ kind, rowId, label, recreatePayload });
  };

  const isLoading = authLoading || (!!userId && savedItemsQ.isLoading);

  const totalSaved = colleges.length + careers.length + scholarships.length;

  // Server-computed college reasons keyed by collegeId. The endpoint
  // already caps reasons; we just normalize and skip blanks.
  const collegeReasonsById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of collegeRecsQ.data?.colleges ?? []) {
      const id = entry.college?.id;
      if (id === null || id === undefined) continue;
      const key = String(id);
      const reasons = pickMatchReasons(entry.matchReasons);
      if (reasons.length > 0) map.set(key, reasons);
    }
    return map;
  }, [collegeRecsQ.data]);

  // Saved careers don't carry a stable id, so we look up by normalized
  // title — same as the mobile saved screen.
  const careerReasonsByTitle = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of careerRecsQ.data?.careers ?? []) {
      const title = entry.career?.title?.trim().toLowerCase();
      if (!title) continue;
      const reasons = pickReasonsFromMixed([
        entry.matchReasons,
        entry.career?.matchReasons,
        entry.reason,
        entry.career?.matchReason,
      ]);
      if (reasons.length > 0) map.set(title, reasons);
    }
    return map;
  }, [careerRecsQ.data]);

  // Scholarship reasons by normalized name — recs feed mixes DB rows with
  // curated picks, so name is the only stable join key (mirrors mobile).
  const scholarshipReasonsByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of scholarshipRecsQ.data?.recommendations ?? []) {
      const name = entry.scholarship?.name?.trim().toLowerCase();
      if (!name) continue;
      const reasons = pickMatchReasons(entry.matchReasons);
      if (reasons.length > 0) map.set(name, reasons);
    }
    return map;
  }, [scholarshipRecsQ.data]);

  const collegeRowsBase = useMemo(
    () =>
      colleges.map((row, idx) => {
        const rowId = rowIdNumber(row.id);
        const detail = collegeDetailQs[idx]?.data ?? null;
        const fallbackId = row.collegeId ?? row.id;
        const label =
          (typeof detail?.name === "string" && detail.name.trim()) ||
          (fallbackId != null ? `College #${fallbackId}` : "Saved college");
        const href = detailHref("college", row.collegeId ?? row.id ?? null);
        const lookupId = row.collegeId ?? row.id;
        const lookupKey =
          lookupId !== undefined && lookupId !== null ? String(lookupId) : null;
        const reasons =
          lookupKey !== null ? collegeReasonsById.get(lookupKey) ?? [] : [];
        const priority = isCollegePriority(row.priority) ? row.priority : null;
        const recreatePayload = userId
          ? buildSavedRowRecreatePayload("college", row, userId)
          : null;
        return {
          rowId,
          label,
          href,
          note: normalizeNote(row.notes),
          reasons,
          priority,
          status: null as ScholarshipStatus | null,
          recreatePayload,
        };
      }),
    [colleges, collegeDetailQs, collegeReasonsById, userId],
  );

  const careerRowsBase = useMemo(
    () =>
      careers.map((row) => {
        const rowId = rowIdNumber(row.id);
        const label =
          (typeof row.careerTitle === "string" && row.careerTitle.trim()) ||
          "Saved career";
        const reasons =
          careerReasonsByTitle.get(label.trim().toLowerCase()) ?? [];
        const recreatePayload = userId
          ? buildSavedRowRecreatePayload("career", row, userId)
          : null;
        return {
          rowId,
          label,
          href: null as string | null,
          note: normalizeNote(row.notes),
          reasons,
          priority: null as CollegePriority | null,
          status: null as ScholarshipStatus | null,
          recreatePayload,
        };
      }),
    [careers, careerReasonsByTitle, userId],
  );

  // Recommendations come back already sorted by best score, so the index in
  // the recs array IS the match rank (0 = strongest match). We only count a
  // scholarship as ranked when it also has at least one reason — same rule
  // as mobile, so "ranked at the top" lines up with a real explanation and
  // rows without reasons fall to the bottom in stable original save order.
  const scholarshipRankByName = useMemo(() => {
    const map = new Map<string, number>();
    const recs = scholarshipRecsQ.data?.recommendations ?? [];
    recs.forEach((entry, idx) => {
      const name =
        typeof entry.scholarship?.name === "string"
          ? entry.scholarship.name.trim().toLowerCase()
          : "";
      if (!name || map.has(name)) return;
      // Pair the rank with a real explanation: if the entry didn't yield
      // any chip-worthy reasons, don't rank it either.
      if (!scholarshipReasonsByName.has(name)) return;
      map.set(name, idx);
    });
    return map;
  }, [scholarshipRecsQ.data, scholarshipReasonsByName]);

  const scholarshipRowsBase = useMemo(
    () =>
      scholarships.map((row, idx) => {
        const rowId = rowIdNumber(row.id);
        const detail = scholarshipDetailQs[idx]?.data ?? null;
        const fallbackId = row.scholarshipId ?? row.id;
        const detailName =
          (typeof detail?.name === "string" && detail.name.trim()) ||
          (typeof detail?.title === "string" && detail.title.trim()) ||
          "";
        const snapshotName =
          typeof row.scholarshipName === "string" && row.scholarshipName.trim()
            ? row.scholarshipName.trim()
            : "";
        // Treat the row as orphaned when the API flagged it AND we also
        // couldn't recover a name client-side (the detail fetch is best
        // effort and may briefly populate while the page loads). This
        // keeps the placeholder behavior aligned with the server-side
        // truth from the LEFT JOIN against `scholarships`.
        const isOrphan =
          row.scholarshipMissing === true && !detailName && !snapshotName;
        const label = isOrphan
          ? "Scholarship no longer available"
          : detailName ||
            snapshotName ||
            (fallbackId != null ? `Scholarship #${fallbackId}` : "Saved scholarship");
        // Don't link orphans to a detail page that will 404 — there's
        // nothing to show. Remove is still available so the user can
        // clean the row up.
        const href = isOrphan
          ? null
          : detailHref("scholarship", row.scholarshipId ?? row.id ?? null);
        const reasons = isOrphan
          ? []
          : scholarshipReasonsByName.get(label.trim().toLowerCase()) ?? [];
        const status = isScholarshipStatus(row.applicationStatus)
          ? row.applicationStatus
          : null;
        // Prefer the row's persisted snapshot name; fall back to the
        // resolved detail label so an undo restores the same display name
        // list-page Saved badges fall back to.
        const recreateRow: SavedScholarshipRow = {
          ...row,
          scholarshipName: snapshotName || detailName || null,
        };
        const recreatePayload = userId
          ? buildSavedRowRecreatePayload("scholarship", recreateRow, userId)
          : null;
        return {
          rowId,
          label,
          href,
          note: normalizeNote(row.notes),
          reasons,
          priority: null as CollegePriority | null,
          status,
          recreatePayload,
          isMissing: isOrphan,
        };
      }),
    [scholarships, scholarshipDetailQs, scholarshipReasonsByName, userId],
  );

  // Sort saved scholarships by best match using the rank from the recs feed.
  // Falls back to the original save order if the recs request errored or
  // didn't surface any rankable rows.
  const sortScholarshipsByMatch =
    !scholarshipRecsQ.isError && scholarshipRankByName.size > 0;
  const { items: scholarshipRows, reordered: scholarshipsReordered } = useMemo(
    () =>
      sortByRank(
        scholarshipRowsBase,
        sortScholarshipsByMatch,
        (row) => scholarshipRankByName.get(row.label.trim().toLowerCase()),
      ),
    [scholarshipRowsBase, sortScholarshipsByMatch, scholarshipRankByName],
  );
  // Only show the "Best match first" affordance when at least one row
  // actually moved — otherwise the label would be misleading.
  const scholarshipsSortedByMatchVisible = scholarshipsReordered;

  // Sort saved colleges by the user-assigned priority (High → Medium → Low
  // → unset) so the schools they care most about surface first. Priority
  // lives on the saved row itself (no server call needed), so this always
  // runs; rows without a priority fall to the bottom in stable original
  // save order via sortByRank's undefined-rank tiebreak rule.
  const { items: collegeRows, reordered: collegesReordered } = useMemo(
    () =>
      sortByRank(
        collegeRowsBase,
        true,
        (row) => (row.priority ? PRIORITY_RANK[row.priority] : undefined),
      ),
    [collegeRowsBase],
  );
  // Per spec: only show the "By priority" subtitle when at least one row
  // actually moved — otherwise the label would be misleading.
  const collegesSortedByPriorityVisible = collegesReordered;

  // Same pattern as colleges, keyed by normalized career title since saved
  // careers don't carry a stable id (mirrors mobile's careerRankByTitle).
  const careerRankByTitle = useMemo(() => {
    const map = new Map<string, number>();
    const recs = careerRecsQ.data?.careers ?? [];
    recs.forEach((entry, idx) => {
      const title = entry.career?.title?.trim().toLowerCase();
      if (!title || map.has(title)) return;
      if (!careerReasonsByTitle.has(title)) return;
      map.set(title, idx);
    });
    return map;
  }, [careerRecsQ.data, careerReasonsByTitle]);

  const sortCareersByMatch =
    !careerRecsQ.isError && careerRankByTitle.size > 0;
  const { items: careerRows, reordered: careersReordered } = useMemo(
    () =>
      sortByRank(
        careerRowsBase,
        sortCareersByMatch,
        (row) => careerRankByTitle.get(row.label.trim().toLowerCase()),
      ),
    [careerRowsBase, sortCareersByMatch, careerRankByTitle],
  );
  const careersSortedByMatchVisible = careersReordered;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Bookmark className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="heading-my-plan">
              My Plan
            </h1>
            <p className="text-sm text-muted-foreground">
              Everything you've saved across colleges, careers, and scholarships.
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20" data-testid="state-loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !userId ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Sign in to see everything you've saved to your plan.
            </p>
            <Link href="/auth">
              <Button data-testid="link-sign-in">Sign in</Button>
            </Link>
          </CardContent>
        </Card>
      ) : totalSaved === 0 ? (
        <Card>
          <CardContent className="p-8 text-center" data-testid="state-empty">
            <Bookmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">Nothing saved yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tap "Save to my plan" on any college, career, or scholarship and it will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <SavedSection
            title="Colleges"
            icon={<GraduationCap className="h-5 w-5 text-primary" />}
            kind="college"
            rows={collegeRows}
            subtitle={collegesSortedByPriorityVisible ? "By priority" : null}
            emptyText="No colleges saved yet."
            onEdit={(row) =>
              setEditTarget({
                kind: "college",
                rowId: row.rowId!,
                label: row.label,
                initialNotes: row.note,
                initialPriority: row.priority,
                initialStatus: null,
              })
            }
            onRemove={(row) =>
              handleRemove("college", row.rowId!, row.label, row.recreatePayload)
            }
            removingRowId={
              removeM.isPending && removeM.variables?.kind === "college"
                ? removeM.variables.rowId
                : null
            }
          />

          <SavedSection
            title="Careers"
            icon={<Briefcase className="h-5 w-5 text-primary" />}
            kind="career"
            rows={careerRows}
            subtitle={careersSortedByMatchVisible ? "Best match first" : null}
            emptyText="No careers saved yet."
            onEdit={(row) =>
              setEditTarget({
                kind: "career",
                rowId: row.rowId!,
                label: row.label,
                initialNotes: row.note,
                initialPriority: null,
                initialStatus: null,
              })
            }
            onRemove={(row) =>
              handleRemove("career", row.rowId!, row.label, row.recreatePayload)
            }
            removingRowId={
              removeM.isPending && removeM.variables?.kind === "career"
                ? removeM.variables.rowId
                : null
            }
          />

          <SavedSection
            title="Scholarships"
            icon={<Bookmark className="h-5 w-5 text-primary" />}
            kind="scholarship"
            rows={scholarshipRows}
            subtitle={
              scholarshipsSortedByMatchVisible ? "Best match first" : null
            }
            emptyText="No scholarships saved yet."
            onEdit={(row) =>
              setEditTarget({
                kind: "scholarship",
                rowId: row.rowId!,
                label: row.label,
                initialNotes: row.note,
                initialPriority: null,
                initialStatus: row.status,
              })
            }
            onRemove={(row) =>
              handleRemove(
                "scholarship",
                row.rowId!,
                row.label,
                row.recreatePayload,
              )
            }
            removingRowId={
              removeM.isPending && removeM.variables?.kind === "scholarship"
                ? removeM.variables.rowId
                : null
            }
          />
        </div>
      )}

      {editTarget && (
        <SavedItemEditDialog
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          kind={editTarget.kind}
          rowId={editTarget.rowId}
          initialNotes={editTarget.initialNotes}
          initialPriority={editTarget.initialPriority}
          initialStatus={editTarget.initialStatus}
          label={editTarget.label}
        />
      )}
    </div>
  );
}

type RowVM = {
  rowId: number | null;
  label: string;
  href: string | null;
  note: string | null;
  // Up to 2 short "why this matches you" pills for the row. Empty when the
  // recs feed didn't return reasons for this item (or hasn't loaded yet).
  reasons: string[];
  // Saved-college rows carry a high/medium/low priority; null on careers
  // and scholarships, or when the user hasn't picked one yet.
  priority: CollegePriority | null;
  // Saved-scholarship rows carry an application status; null on careers
  // and colleges, or when not yet set.
  status: ScholarshipStatus | null;
  // Pre-built body for re-POSTing the row if the user taps Undo on the
  // remove toast. Captured at render time so the snackbar restores the
  // row's notes / priority / status / etc. exactly. Null when we can't
  // build a payload (missing user, missing FK).
  recreatePayload: Record<string, unknown> | null;
  // True for saved scholarships whose canonical row has been deleted from
  // the `scholarships` table (no snapshot name either). The Scholarships
  // section renders these with a clear placeholder and skips chips/edit so
  // the only meaningful action is Remove.
  isMissing?: boolean;
};

function SavedSection({
  title,
  icon,
  kind,
  rows,
  subtitle,
  emptyText,
  onEdit,
  onRemove,
  removingRowId,
}: {
  title: string;
  icon: React.ReactNode;
  kind: SavedKind;
  rows: RowVM[];
  subtitle?: string | null;
  emptyText: string;
  onEdit: (row: RowVM) => void;
  onRemove: (row: RowVM) => void;
  removingRowId: number | null;
}) {
  return (
    <Card data-testid={`section-saved-${kind}s`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          <span>{title}</span>
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({rows.length})
          </span>
          {subtitle ? (
            <span
              className="ml-auto text-xs font-normal text-muted-foreground"
              data-testid={`text-saved-${kind}s-subtitle`}
            >
              {subtitle}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row, i) => {
              const canAct = row.rowId !== null;
              const isRemoving = canAct && removingRowId === row.rowId;
              const isMissing = row.isMissing === true;
              return (
                <li
                  key={row.rowId ?? `${kind}-${i}`}
                  className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                  data-testid={`row-saved-${kind}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.href ? (
                        <Link href={row.href}>
                          <span
                            className="font-medium text-foreground hover:text-primary hover:underline cursor-pointer"
                            data-testid={`link-saved-${kind}-title`}
                          >
                            {row.label}
                          </span>
                        </Link>
                      ) : (
                        <span
                          className={
                            isMissing
                              ? "font-medium italic text-muted-foreground"
                              : "font-medium text-foreground"
                          }
                          data-testid={`text-saved-${kind}-title`}
                        >
                          {row.label}
                        </span>
                      )}
                      {isMissing && (
                        // Small, neutral "Removed" badge so the placeholder
                        // row is unambiguous: the original scholarship is
                        // gone, the only useful action is to clean it up.
                        <Badge
                          variant="outline"
                          className="text-xs font-medium text-muted-foreground"
                          data-testid={`badge-saved-${kind}-missing`}
                        >
                          Removed by source
                        </Badge>
                      )}
                      {kind === "college" && row.priority && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium"
                          data-testid={`badge-saved-${kind}-priority`}
                        >
                          {priorityLabel(row.priority)} priority
                        </Badge>
                      )}
                      {kind === "scholarship" && row.status && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium"
                          data-testid={`badge-saved-${kind}-status`}
                        >
                          {statusLabel(row.status)}
                        </Badge>
                      )}
                    </div>
                    {row.reasons.length > 0 && (
                      <div
                        className="mt-1.5 flex flex-wrap gap-1"
                        data-testid={`group-saved-${kind}-reasons`}
                      >
                        {row.reasons.map((reason, idx) => (
                          <Badge
                            key={`${row.rowId ?? i}-reason-${idx}`}
                            variant="outline"
                            className="text-xs font-medium"
                            data-testid={`badge-saved-${kind}-reason`}
                          >
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {row.note && (
                      <p
                        className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap"
                        data-testid={`text-saved-${kind}-note`}
                      >
                        {row.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Editing notes/status on an orphaned saved scholarship
                        wouldn't surface anywhere useful (the canonical row
                        is gone), so hide Edit and leave Remove as the only
                        action on the placeholder row. */}
                    {!isMissing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(row)}
                        disabled={!canAct || isRemoving}
                        data-testid={`button-edit-saved-${kind}`}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(row)}
                      disabled={!canAct || isRemoving}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-remove-saved-${kind}`}
                    >
                      {isRemoving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
