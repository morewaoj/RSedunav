import { Feather } from "@expo/vector-icons";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import {
  EditModal,
  isCollegePriority,
  isScholarshipStatus,
  normalizeNotes,
  priorityLabel,
  statusLabel,
  type CollegePriority,
  type EditTarget,
  type ScholarshipStatus,
} from "@/components/SavedItemEditModal";
import { buildSavedRowRecreatePayload } from "@workspace/saved-recreate";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { Snackbar } from "@/components/Snackbar";
import { useRefreshSet } from "@/hooks/useAutoRefreshOnFocus";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SYSTEM_FONT } from "@/lib/typography";
import { isScholarshipOpen } from "@/lib/utils";

type SavedKind = "colleges" | "careers" | "scholarships";

function confirmRemove(label: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    const ok = typeof window !== "undefined"
      ? window.confirm(`Remove "${label}" from your plan?`)
      : true;
    if (ok) onConfirm();
    return;
  }
  Alert.alert("Remove from plan", `Remove "${label}" from your plan?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: onConfirm },
  ]);
}

type SavedCollegeRow = {
  id?: number | string;
  collegeId?: number | string;
  name?: string;
  notes?: string | null;
  priority?: string | null;
  [k: string]: unknown;
};

type SavedCareerRow = {
  id?: number | string;
  careerTitle?: string;
  title?: string;
  name?: string;
  matchScore?: number | null;
  [k: string]: unknown;
};

type SavedScholarshipRow = {
  id?: number | string;
  scholarshipId?: number | string;
  name?: string;
  title?: string;
  // Snapshot of the canonical name at save time. Used as a fallback when
  // /api/scholarships/:id can't be loaded (curated picks, recommendations).
  scholarshipName?: string | null;
  applicationStatus?: string | null;
  notes?: string | null;
  deadline?: string | null;
  // True when the API determined the saved row's canonical scholarship
  // is missing from the `scholarships` table AND no snapshot name exists,
  // so the row needs a clear "no longer available" placeholder.
  scholarshipMissing?: boolean;
  [k: string]: unknown;
};

type SavedItems = {
  colleges?: SavedCollegeRow[];
  careers?: SavedCareerRow[];
  scholarships?: SavedScholarshipRow[];
};

type CollegeDetail = {
  id?: number | string;
  name?: string;
};

type ScholarshipDetail = {
  id?: number | string;
  name?: string;
  title?: string;
  provider?: string | null;
  deadline?: string | null;
  deadlineAt?: string | null;
  isActive?: boolean | null;
};

// Mirrors the shape used on the Scholarships tab and home screen so we can
// reuse the precomputed "why this matches you" reasons here too.
type ScholarshipRecsResponse = {
  recommendations?: Array<{
    scholarship?: { name?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

// Same payload shape the home screen consumes from
// /api/profile/career-recommendations. Reasons may arrive as an array OR as a
// "; "-separated string under matchReason — handle both.
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

// Personalized college reasons come from /api/profile/college-recommendations,
// which mirrors the careers/scholarships rec feeds: each entry pairs a
// college with the reasons it matches the signed-in user. We pass the
// caller's saved college ids via ?ids= so every saved row gets scored.
type CollegeRecsResponse = {
  colleges?: Array<{
    college?: { id?: number | string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

// Numeric rank for the user-assigned saved-college priority. Lower wins,
// so high-priority schools land first; rows without a priority are returned
// as `undefined` from the rank fn so they sink to the bottom in stable
// original save order (matching the helper's tiebreak rule). Mirrors the
// web My Plan page's PRIORITY_RANK so both surfaces stay in lock-step.
const PRIORITY_RANK: Record<CollegePriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function pickMatchReasons(
  reasons: string[] | null | undefined,
  max = 2,
): string[] {
  if (!Array.isArray(reasons)) return [];
  const cleaned = reasons
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter((r) => r.length > 0);
  return cleaned.slice(0, max);
}

// Mirrors the home-screen helper: accepts either a clean string[] or a
// pre-joined string (the saved career analysis stores reasons as a single
// "; "-separated value), normalizes, and caps to a few short pills.
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

function pickDisplayTitle(...candidates: Array<unknown>): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return "Unknown Item";
}

function asId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length > 0 ? s : null;
}

type PendingUndo =
  | {
      kind: "remove";
      key: number;
      label: string;
      savedKind: SavedKind;
      // Null when the captured saved-row was missing data needed to
      // rebuild it (e.g. legacy partial row). The DELETE still goes
      // through; the snackbar just omits the Undo affordance — same
      // behavior as the web My Plan toast.
      payload: Record<string, unknown> | null;
    }
  | {
      kind: "edit-college";
      key: number;
      label: string;
      rowId: number;
      previous: { notes: string | null; priority: CollegePriority | null };
    }
  | {
      kind: "edit-scholarship";
      key: number;
      label: string;
      rowId: number;
      previous: {
        notes: string | null;
        applicationStatus: ScholarshipStatus | null;
      };
    }
  | {
      kind: "edit-career";
      key: number;
      label: string;
      rowId: number;
      previous: { notes: string | null };
    };

export default function SavedScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } =
    useQuery<SavedItems | null>({
      queryKey: ["/api/saved-items", user?.id],
      queryFn: async () => {
        if (!user?.id) return null;
        return await apiGet<SavedItems | null>(
          `/api/saved-items/${encodeURIComponent(user.id)}`,
          { allowUnauthorized: true },
        );
      },
      enabled: !!user?.id,
    });

  // Pull the personalized scholarship reasons so saved scholarships keep the
  // same "why this matches you" chips users see on the home screen and the
  // Scholarships tab. Allowed to fail quietly — saved items still render.
  const recsQ = useQuery<ScholarshipRecsResponse | null>({
    queryKey: ["/api/profile/scholarship-recommendations"],
    queryFn: async () =>
      apiGet<ScholarshipRecsResponse | null>(
        "/api/profile/scholarship-recommendations",
        { allowUnauthorized: true },
      ),
    enabled: !!user?.id,
  });

  // Saved careers reuse the same /api/profile/career-recommendations feed
  // the home screen renders for personalized matches, so users see the same
  // "why this matches you" chips here. Allowed to fail quietly.
  const careerRecsQ = useQuery<CareerRecsResponse | null>({
    queryKey: ["/api/profile/career-recommendations"],
    queryFn: async () =>
      apiGet<CareerRecsResponse | null>(
        "/api/profile/career-recommendations",
        { allowUnauthorized: true },
      ),
    enabled: !!user?.id,
  });

  // Saved colleges reuse the same recommendations feed pattern as careers
  // and scholarships, but keyed by collegeId. We narrow scoring to the
  // user's saved ids via ?ids= so every saved row gets a chance at chips.
  // Allowed to fail quietly — saved cards still render without chips.
  const savedCollegeIds = React.useMemo(() => {
    const ids = (data?.colleges ?? [])
      .map((c) => c.collegeId ?? c.id)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }, [data?.colleges]);
  const collegeRecsQ = useQuery<CollegeRecsResponse | null>({
    queryKey: ["/api/profile/college-recommendations", savedCollegeIds],
    queryFn: async () => {
      const path =
        savedCollegeIds.length > 0
          ? `/api/profile/college-recommendations?ids=${savedCollegeIds.join(",")}`
          : "/api/profile/college-recommendations";
      return apiGet<CollegeRecsResponse | null>(path, {
        allowUnauthorized: true,
      });
    },
    enabled: !!user?.id,
  });

  // Silently refetch the saved list (and the recs feeds that drive its
  // chips/ranking) when the screen regains focus or the app returns from
  // background, so saves/unsaves made on the web show up without a manual
  // pull-to-refresh. The helper also owns the manual pull-to-refresh
  // handler — it stamps the dedupe window after the refetch resolves so a
  // focus/app-active event right after a pull can't trigger an extra
  // silent refetch within the threshold.
  const refetchAllRaw = useCallback(
    () =>
      Promise.all([
        refetch(),
        user?.id ? recsQ.refetch() : Promise.resolve(),
        user?.id ? careerRecsQ.refetch() : Promise.resolve(),
        user?.id ? collegeRecsQ.refetch() : Promise.resolve(),
      ]),
    [refetch, recsQ, careerRecsQ, collegeRecsQ, user?.id],
  );

  const { refresh: onManualRefresh } = useRefreshSet(refetchAllRaw);

  // Recs aren't keyed by DB id (the endpoint mixes DB rows with curated
  // picks), so we look up by normalized name — same approach as the
  // Scholarships tab.
  const reasonsByName = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of recsQ.data?.recommendations ?? []) {
      const name = entry.scholarship?.name?.trim().toLowerCase();
      if (!name) continue;
      const reasons = pickMatchReasons(entry.matchReasons);
      if (reasons.length > 0) map.set(name, reasons);
    }
    return map;
  }, [recsQ.data]);

  // Recommendations come back already sorted by best score, so the index in
  // the recs array IS the match rank (0 = strongest match). We only count a
  // scholarship as ranked when it also has at least one reason chip — that
  // way "ranked at the top" always lines up with a visible "why this
  // matches you" explanation, and rows without reasons fall to the bottom
  // in stable save order per the task spec.
  const rankByName = React.useMemo(() => {
    const map = new Map<string, number>();
    const recs = recsQ.data?.recommendations ?? [];
    recs.forEach((entry, idx) => {
      const name = entry.scholarship?.name?.trim().toLowerCase();
      if (!name || map.has(name)) return;
      if (!reasonsByName.has(name)) return;
      map.set(name, idx);
    });
    return map;
  }, [recsQ.data, reasonsByName]);

  // Saved careers are keyed by careerTitle (no DB id) so we look up by
  // normalized title — same approach as the home screen. Reasons come from
  // either entry.matchReasons (array), entry.reason, career.matchReasons
  // (array), or career.matchReason ("; "-joined string).
  const careerReasonsByTitle = React.useMemo(() => {
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

  // Server-computed reasons keyed by collegeId. The endpoint already caps
  // at 2 reasons per entry; we just normalize and skip blanks here.
  const collegeReasonsById = React.useMemo(() => {
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

  // Same shape as rankByName but keyed by normalized career title. Saved
  // careers don't carry a stable id, so title matches the recs feed the
  // same way the chips do.
  const careerRankByTitle = React.useMemo(() => {
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

  const removeM = useMutation({
    mutationFn: async ({
      kind,
      id,
    }: {
      kind: SavedKind;
      id: number | string;
      label: string;
      recreatePayload: Record<string, unknown> | null;
    }) => {
      if (!user?.id) throw new Error("Not signed in");
      const numericId = typeof id === "number" ? id : Number(id);
      if (!Number.isFinite(numericId)) throw new Error("Invalid item id");
      // Auth is enforced server-side from the session cookie — no userId in
      // the URL on purpose so callers can't act on other users' rows.
      await apiRequest("DELETE", `/api/saved-${kind}/${numericId}`);
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      // Offer a short-lived undo so an accidental confirm doesn't permanently
      // wipe the row. The recreatePayload was captured at remove time so the
      // re-POST restores the same notes/priority/status the user had.
      setPendingUndo({
        kind: "remove",
        key: Date.now(),
        savedKind: variables.kind,
        label: variables.label,
        payload: variables.recreatePayload,
      });
    },
    onError: (e) => {
      Alert.alert(
        "Couldn't remove item",
        e instanceof Error ? e.message : "Please try again.",
      );
    },
  });

  const undoM = useMutation({
    mutationFn: async (undo: PendingUndo) => {
      if (undo.kind === "remove") {
        // Caller must ensure undo is not invoked when payload is null
        // (Snackbar already hides the action button in that case).
        if (!undo.payload) return;
        await apiRequest("POST", `/api/saved-${undo.savedKind}`, undo.payload);
      } else if (undo.kind === "edit-college") {
        await apiRequest("PATCH", `/api/saved-colleges/${undo.rowId}`, {
          notes: undo.previous.notes,
          priority: undo.previous.priority,
        });
      } else if (undo.kind === "edit-scholarship") {
        await apiRequest("PATCH", `/api/saved-scholarships/${undo.rowId}`, {
          notes: undo.previous.notes,
          applicationStatus: undo.previous.applicationStatus,
        });
      } else {
        await apiRequest("PATCH", `/api/saved-careers/${undo.rowId}`, {
          notes: undo.previous.notes,
        });
      }
    },
    onSuccess: () => {
      setPendingUndo(null);
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
    },
    onError: (e) => {
      setPendingUndo(null);
      Alert.alert(
        "Couldn't undo",
        e instanceof Error ? e.message : "Please try again.",
      );
    },
  });

  const updateM = useMutation({
    mutationFn: async (target: EditTarget) => {
      if (!user?.id) throw new Error("Not signed in");
      const notesValue = normalizeNotes(target.notes);
      if (target.kind === "college") {
        await apiRequest("PATCH", `/api/saved-colleges/${target.rowId}`, {
          notes: notesValue,
          priority: target.priority,
        });
      } else if (target.kind === "scholarship") {
        await apiRequest("PATCH", `/api/saved-scholarships/${target.rowId}`, {
          notes: notesValue,
          applicationStatus: target.status,
        });
      } else {
        await apiRequest("PATCH", `/api/saved-careers/${target.rowId}`, {
          notes: notesValue,
        });
      }
    },
    onSuccess: (_data, target) => {
      setEditTarget(null);
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      // Reuse the same undo snackbar pattern as removals so an accidental
      // overwrite of priority/status/notes can be reversed within ~5s.
      const newNotes = normalizeNotes(target.notes);
      if (target.kind === "college") {
        const changed =
          newNotes !== target.originalNotes ||
          target.priority !== target.originalPriority;
        if (changed) {
          setPendingUndo({
            kind: "edit-college",
            key: Date.now(),
            label: target.label,
            rowId: target.rowId,
            previous: {
              notes: target.originalNotes,
              priority: target.originalPriority,
            },
          });
        }
      } else if (target.kind === "scholarship") {
        const changed =
          newNotes !== target.originalNotes ||
          target.status !== target.originalStatus;
        if (changed) {
          setPendingUndo({
            kind: "edit-scholarship",
            key: Date.now(),
            label: target.label,
            rowId: target.rowId,
            previous: {
              notes: target.originalNotes,
              applicationStatus: target.originalStatus,
            },
          });
        }
      } else {
        const changed = newNotes !== target.originalNotes;
        if (changed) {
          setPendingUndo({
            kind: "edit-career",
            key: Date.now(),
            label: target.label,
            rowId: target.rowId,
            previous: { notes: target.originalNotes },
          });
        }
      }
    },
    onError: (e) => {
      Alert.alert(
        "Couldn't save changes",
        e instanceof Error ? e.message : "Please try again.",
      );
    },
  });

  const handleRemove = (
    kind: SavedKind,
    id: number | string | undefined,
    label: string,
    recreatePayload: Record<string, unknown> | null,
  ) => {
    if (id === undefined || id === null) return;
    if (!user?.id) return;
    // Allow the DELETE to proceed even if the recreate helper returned
    // null. The snackbar just suppresses the Undo button in that case,
    // matching the web My Plan toast behavior.
    confirmRemove(label, () =>
      removeM.mutate({ kind, id, label, recreatePayload }),
    );
  };

  // Swipe-to-remove skips the modal confirm because the 5-second undo
  // snackbar already covers accidental deletes. The trash button keeps
  // the explicit confirm for users who don't (or can't) swipe.
  const handleSwipeRemove = (
    kind: SavedKind,
    id: number | string | undefined,
    label: string,
    recreatePayload: Record<string, unknown> | null,
  ) => {
    if (id === undefined || id === null) return;
    if (!user?.id) return;
    // Allow the DELETE even when recreate payload is unavailable; Undo
    // is just suppressed in the snackbar to match web parity.
    removeM.mutate({ kind, id, label, recreatePayload });
  };

  // Per-kind wrappers around the shared @workspace/saved-recreate helper.
  // The shared helper builds the recreate POST body for every Undo flow
  // in the project (web Save button, web My Plan list, mobile detail
  // screens, mobile My Plan list) so the four surfaces can't drift.
  // Saved careers may carry the title under `title`/`name` instead of
  // `careerTitle` on legacy rows, so we hand the helper a fallback.
  const buildCareerPayload = (
    row: SavedCareerRow,
  ): Record<string, unknown> | null => {
    if (!user?.id) return null;
    const fallbackTitle =
      (typeof row.title === "string" && row.title.trim()) ||
      (typeof row.name === "string" && row.name.trim()) ||
      null;
    return buildSavedRowRecreatePayload("career", row, user.id, {
      careerTitle: fallbackTitle,
    });
  };

  const buildCollegePayload = (
    row: SavedCollegeRow,
  ): Record<string, unknown> | null => {
    if (!user?.id) return null;
    return buildSavedRowRecreatePayload("college", row, user.id);
  };

  const buildScholarshipPayload = (
    row: SavedScholarshipRow,
  ): Record<string, unknown> | null => {
    if (!user?.id) return null;
    return buildSavedRowRecreatePayload("scholarship", row, user.id);
  };

  const openCareerEditor = (row: SavedCareerRow, label: string) => {
    const rowId = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(rowId)) return;
    const rawNotes = (row as Record<string, unknown>).notes;
    const notes = typeof rawNotes === "string" ? rawNotes : "";
    setEditTarget({
      kind: "career",
      rowId,
      label,
      notes,
      originalNotes: normalizeNotes(rawNotes),
    });
  };

  const openCollegeEditor = (row: SavedCollegeRow, label: string) => {
    const rowId = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(rowId)) return;
    const originalNotes = normalizeNotes(row.notes);
    const originalPriority = isCollegePriority(row.priority) ? row.priority : null;
    setEditTarget({
      kind: "college",
      rowId,
      label,
      notes: typeof row.notes === "string" ? row.notes : "",
      priority: originalPriority ?? "medium",
      originalNotes,
      originalPriority,
    });
  };

  const openScholarshipEditor = (row: SavedScholarshipRow, label: string) => {
    const rowId = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(rowId)) return;
    const originalNotes = normalizeNotes(row.notes);
    const originalStatus = isScholarshipStatus(row.applicationStatus)
      ? row.applicationStatus
      : null;
    setEditTarget({
      kind: "scholarship",
      rowId,
      label,
      notes: typeof row.notes === "string" ? row.notes : "",
      status: originalStatus ?? "interested",
      originalNotes,
      originalStatus,
    });
  };

  // Defensive client-side dedup (the backend already prevents new duplicates,
  // but legacy rows from before that fix may still exist in storage).
  const dedupBy = <T,>(rows: T[], keyOf: (r: T) => string | null): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const r of rows) {
      const k = keyOf(r);
      if (!k) {
        out.push(r);
        continue;
      }
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  };

  const careerRows = dedupBy(data?.careers ?? [], (r) => {
    const t = r.careerTitle ?? r.title ?? r.name;
    return typeof t === "string" && t.trim() ? t.trim().toLowerCase() : null;
  });
  const collegeRows = dedupBy(data?.colleges ?? [], (r) => {
    const id = r.collegeId ?? r.id;
    return id !== undefined && id !== null ? String(id) : null;
  });
  const scholarshipRows = dedupBy(data?.scholarships ?? [], (r) => {
    const id = r.scholarshipId ?? r.id;
    return id !== undefined && id !== null ? String(id) : null;
  });

  const collegeIds = collegeRows
    .map((r) => asId(r.collegeId ?? r.id))
    .filter((v): v is string => v !== null);
  const scholarshipIds = scholarshipRows
    .map((r) => asId(r.scholarshipId ?? r.id))
    .filter((v): v is string => v !== null);

  const collegeDetailQs = useQueries({
    queries: collegeIds.map((id) => ({
      queryKey: ["/api/colleges", id],
      queryFn: async () =>
        apiGet<CollegeDetail | null>(`/api/colleges/${encodeURIComponent(id)}`, {
          allowUnauthorized: true,
        }),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const scholarshipDetailQs = useQueries({
    queries: scholarshipIds.map((id) => ({
      queryKey: ["/api/scholarships", id],
      queryFn: async () =>
        apiGet<ScholarshipDetail | null>(
          `/api/scholarships/${encodeURIComponent(id)}`,
          { allowUnauthorized: true },
        ),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const collegeNameById = new Map<string, string>();
  collegeIds.forEach((id, i) => {
    const d = collegeDetailQs[i]?.data;
    if (d?.name) collegeNameById.set(id, d.name);
  });

  const scholarshipDetailById = new Map<string, ScholarshipDetail>();
  scholarshipIds.forEach((id, i) => {
    const d = scholarshipDetailQs[i]?.data;
    if (d) scholarshipDetailById.set(id, d);
  });

  const careersBase = careerRows.map((c) => {
    const name = pickDisplayTitle(c.careerTitle, c.title, c.name);
    // Saved careers store only `careerTitle` (no career-paths PK), so we use
    // the title itself as the route id and the detail screen falls back to
    // `/api/career-paths/search/:title` when the param isn't numeric.
    const routeId = pickDisplayTitle(
      c.careerTitle,
      c.title,
      c.name,
    );
    return {
      row: c,
      id: routeId !== "Unknown Item" ? routeId : null,
      name,
    };
  });

  const collegesBase = collegeRows.map((c) => {
    const id = asId(c.collegeId ?? c.id);
    return {
      row: c,
      id,
      name: pickDisplayTitle(
        id ? collegeNameById.get(id) : undefined,
        c.name,
        (c as Record<string, unknown>).school_name,
      ),
    };
  });

  const scholarshipsBase = scholarshipRows
    .map((s) => {
      const id = asId(s.scholarshipId ?? s.id);
      const detail = id ? scholarshipDetailById.get(id) : undefined;
      // Treat the saved row as orphaned when the API flagged it AND the
      // best-effort detail fetch also didn't recover a name client-side.
      // Snapshot names already win in pickDisplayTitle below, so a row
      // with a snapshot is never marked missing — only legacy rows whose
      // canonical scholarship has been deleted with no snapshot to fall
      // back on. Keeps the placeholder behavior aligned with the
      // server-side LEFT JOIN truth.
      const snapshot =
        typeof s.scholarshipName === "string" && s.scholarshipName.trim()
          ? s.scholarshipName.trim()
          : "";
      const detailName =
        (typeof detail?.name === "string" && detail.name.trim()) ||
        (typeof detail?.title === "string" && detail.title.trim()) ||
        "";
      const isMissing =
        s.scholarshipMissing === true && !snapshot && !detailName;
      return {
        row: s,
        detail,
        id,
        isMissing,
        name: isMissing
          ? "Scholarship no longer available"
          : pickDisplayTitle(
              detail?.name,
              detail?.title,
              s.scholarshipName,
              s.name,
              s.title,
              (s as Record<string, unknown>).scholarship_name,
            ),
      };
    })
    .filter((entry) => {
      // Orphans don't have a canonical detail row, so the deadline filter
      // can't apply — surface them so the user can clean them up. For
      // resolvable saved scholarships, keep the existing "open scholarships
      // only" behavior driven by detail.deadlineAt / isActive.
      if (entry.isMissing) return true;
      if (!entry.detail) return true;
      return isScholarshipOpen({
        deadlineAt: entry.detail.deadlineAt ?? null,
        deadline: entry.detail.deadline ?? entry.row.deadline ?? null,
        isActive: entry.detail.isActive ?? null,
      });
    });

  // Shared rank-sort helper so all three Saved sections stay in lock-step.
  // Returns the re-ranked list AND whether any row actually changed
  // position, which we use to decide if the "Best match first" subtitle is
  // worth showing (the spec wants it only when at least one row was
  // re-ranked, not just when the recs feed happens to know about an item
  // that's already in save order).
  function sortByRank<T>(
    base: T[],
    enabled: boolean,
    rankOf: (entry: T) => number | undefined,
  ): { items: T[]; reordered: boolean } {
    if (!enabled) return { items: base, reordered: false };
    const sorted = base
      .map((entry, originalIndex) => ({
        entry,
        originalIndex,
        rank: rankOf(entry),
      }))
      .sort((a, b) => {
        const aHas = a.rank !== undefined;
        const bHas = b.rank !== undefined;
        if (aHas && bHas) return (a.rank as number) - (b.rank as number);
        if (aHas) return -1;
        if (bHas) return 1;
        return a.originalIndex - b.originalIndex;
      });
    const reordered = sorted.some((s, i) => s.originalIndex !== i);
    return { items: sorted.map((s) => s.entry), reordered };
  }

  // Sort saved scholarships by best match first, using the rank from the
  // recommendations feed. Items with no rank (e.g. saved before profile was
  // filled in, or the recs feed didn't surface them) drop to the bottom in
  // their original save order. If the recs request failed entirely, we keep
  // the original order so the list still renders cleanly.
  const sortByMatch = !recsQ.isError && rankByName.size > 0;
  const { items: scholarships, reordered: scholarshipsReordered } = sortByRank(
    scholarshipsBase,
    sortByMatch,
    (entry) => rankByName.get(entry.name.trim().toLowerCase()),
  );
  // Only advertise the "Best match first" affordance when at least one row
  // actually moved — otherwise the label is misleading.
  const sortedByMatchVisible = scholarshipsReordered;

  // Sort saved colleges by the user-assigned priority (High → Medium → Low
  // → unset) so the schools the user cares most about surface first. Mirrors
  // the web My Plan page so both surfaces stay in lock-step. Priority lives
  // on the saved row itself (no server call needed), so this always runs;
  // rows without a priority fall to the bottom in stable original save
  // order via sortByRank's undefined-rank tiebreak rule.
  const { items: colleges, reordered: collegesReordered } = sortByRank(
    collegesBase,
    true,
    (entry) =>
      isCollegePriority(entry.row.priority)
        ? PRIORITY_RANK[entry.row.priority]
        : undefined,
  );
  // Per spec: only show the "By priority" subtitle when at least one row
  // actually moved — otherwise the label would be misleading.
  const collegesSortedByPriorityVisible = collegesReordered;

  // Same sort pattern, keyed by normalized career title (no DB id on saved
  // careers). Mirrors the way the chips above are looked up.
  const sortCareersByMatch =
    !careerRecsQ.isError && careerRankByTitle.size > 0;
  const { items: careers, reordered: careersReordered } = sortByRank(
    careersBase,
    sortCareersByMatch,
    (entry) => careerRankByTitle.get(entry.name.trim().toLowerCase()),
  );
  const careersSortedByMatchVisible = careersReordered;

  const detailLoading =
    collegeDetailQs.some((q) => q.isLoading) ||
    scholarshipDetailQs.some((q) => q.isLoading);

  const totalCount = careers.length + colleges.length + scholarships.length;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenHeader title="My Plan" showBack />
      <ScrollView
        style={{ backgroundColor: colors.background, flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void onManualRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError ? (
          <EmptyState
            icon="alert-circle"
            title="Couldn't load your plan"
            message="Please try again in a moment."
          />
        ) : totalCount === 0 && !detailLoading ? (
          <View style={{ paddingTop: 32 }}>
            <EmptyState
              icon="bookmark"
              title="Nothing saved yet"
              message="Tap 'Save to my plan' on a career, college, or scholarship to start building your plan."
            />
          </View>
        ) : (
          <>
            <SectionHeader
              title="Saved careers"
              subtitle={
                careersSortedByMatchVisible
                  ? `${careers.length} item${careers.length === 1 ? "" : "s"} • Best match first`
                  : `${careers.length} item${careers.length === 1 ? "" : "s"}`
              }
            />
            {careers.length === 0 ? (
              <Text style={styles.empty(colors.mutedForeground)}>
                No careers saved yet.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {careers.map((c, i) => {
                  const rowId = c.row.id;
                  const isRemoving =
                    removeM.isPending &&
                    removeM.variables?.kind === "careers" &&
                    String(removeM.variables?.id) === String(rowId);
                  const note =
                    typeof (c.row as Record<string, unknown>).notes === "string"
                      ? ((c.row as Record<string, unknown>).notes as string).trim()
                      : "";
                  const badges: BadgeSpec[] = [];
                  if (note.length > 0) badges.push({ icon: "edit-3", text: "Note" });
                  const canRemove = rowId !== undefined && rowId !== null;
                  return (
                    <SwipeableRow
                      key={`car-${i}`}
                      label={c.name}
                      enabled={canRemove && !isRemoving}
                      onSwipeRemove={
                        canRemove
                          ? () =>
                              handleSwipeRemove(
                                "careers",
                                rowId,
                                c.name,
                                buildCareerPayload(c.row),
                              )
                          : undefined
                      }
                    >
                      <Card
                        onPress={() => {
                          if (c.id) router.push({ pathname: "/career/[id]", params: { id: c.id } });
                        }}
                      >
                        <Row
                          icon="briefcase"
                          label={c.name}
                          badges={badges}
                          matchReasons={careerReasonsByTitle.get(
                            c.name.trim().toLowerCase(),
                          )}
                          onEdit={
                            canRemove
                              ? () => openCareerEditor(c.row, c.name)
                              : undefined
                          }
                          onRemove={
                            canRemove
                              ? () =>
                                  handleRemove(
                                    "careers",
                                    rowId,
                                    c.name,
                                    buildCareerPayload(c.row),
                                  )
                              : undefined
                          }
                          isRemoving={isRemoving}
                        />
                      </Card>
                    </SwipeableRow>
                  );
                })}
              </View>
            )}

            <SectionHeader
              title="Saved colleges"
              subtitle={
                collegesSortedByPriorityVisible
                  ? `${colleges.length} item${colleges.length === 1 ? "" : "s"} • By priority`
                  : `${colleges.length} item${colleges.length === 1 ? "" : "s"}`
              }
            />
            {colleges.length === 0 ? (
              <Text style={styles.empty(colors.mutedForeground)}>
                No colleges saved yet.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {colleges.map((c, i) => {
                  const rowId = c.row.id;
                  const isRemoving =
                    removeM.isPending &&
                    removeM.variables?.kind === "colleges" &&
                    String(removeM.variables?.id) === String(rowId);
                  const priority = priorityLabel(c.row.priority);
                  const note = typeof c.row.notes === "string" ? c.row.notes.trim() : "";
                  const badges: BadgeSpec[] = [];
                  if (priority) badges.push({ icon: "flag", text: priority });
                  if (note.length > 0) badges.push({ icon: "edit-3", text: "Note" });
                  const canRemove = rowId !== undefined && rowId !== null;
                  return (
                    <SwipeableRow
                      key={`col-${i}`}
                      label={c.name}
                      enabled={canRemove && !isRemoving}
                      onSwipeRemove={
                        canRemove
                          ? () =>
                              handleSwipeRemove(
                                "colleges",
                                rowId,
                                c.name,
                                buildCollegePayload(c.row),
                              )
                          : undefined
                      }
                    >
                      <Card
                        onPress={() => {
                          if (c.id) router.push({ pathname: "/college/[id]", params: { id: c.id } });
                        }}
                      >
                        <Row
                          icon="book-open"
                          label={c.name}
                          badges={badges}
                          matchReasons={
                            c.id ? collegeReasonsById.get(c.id) : undefined
                          }
                          onEdit={
                            canRemove
                              ? () => openCollegeEditor(c.row, c.name)
                              : undefined
                          }
                          onRemove={
                            canRemove
                              ? () =>
                                  handleRemove(
                                    "colleges",
                                    rowId,
                                    c.name,
                                    buildCollegePayload(c.row),
                                  )
                              : undefined
                          }
                          isRemoving={isRemoving}
                        />
                      </Card>
                    </SwipeableRow>
                  );
                })}
              </View>
            )}

            <SectionHeader
              title="Saved scholarships"
              subtitle={
                sortedByMatchVisible
                  ? `${scholarships.length} item${scholarships.length === 1 ? "" : "s"} • Best match first`
                  : `${scholarships.length} item${scholarships.length === 1 ? "" : "s"}`
              }
            />
            {scholarships.length === 0 ? (
              <Text style={styles.empty(colors.mutedForeground)}>
                No scholarships saved yet.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {scholarships.map((s, i) => {
                  const rowId = s.row.id;
                  const isRemoving =
                    removeM.isPending &&
                    removeM.variables?.kind === "scholarships" &&
                    String(removeM.variables?.id) === String(rowId);
                  const status = statusLabel(s.row.applicationStatus);
                  const note = typeof s.row.notes === "string" ? s.row.notes.trim() : "";
                  const badges: BadgeSpec[] = [];
                  if (s.isMissing) {
                    // Subtle leading badge so the placeholder row reads as
                    // a cleanup item, not as a normal saved scholarship.
                    badges.push({ icon: "alert-circle", text: "Removed by source" });
                  }
                  if (status) badges.push({ icon: "check-circle", text: status });
                  if (note.length > 0) badges.push({ icon: "edit-3", text: "Note" });
                  // If this saved scholarship is no longer in the recs feed
                  // (e.g. profile changed) or it's an orphan placeholder,
                  // we just omit chips — the rest of the card still
                  // renders cleanly.
                  const matchReasons = s.isMissing
                    ? null
                    : reasonsByName.get(s.name.trim().toLowerCase()) ?? null;
                  const canRemove = rowId !== undefined && rowId !== null;
                  return (
                    <SwipeableRow
                      key={`sch-${i}`}
                      label={s.name}
                      enabled={canRemove && !isRemoving}
                      onSwipeRemove={
                        canRemove
                          ? () =>
                              handleSwipeRemove(
                                "scholarships",
                                rowId,
                                s.name,
                                buildScholarshipPayload(s.row),
                              )
                          : undefined
                      }
                    >
                      <Card
                        onPress={() => {
                          // Don't navigate to /scholarship/:id for orphan
                          // placeholders — the canonical row is gone, so
                          // the detail screen would 404.
                          if (s.isMissing) return;
                          if (s.id)
                            router.push({
                              pathname: "/scholarship/[id]",
                              params: { id: s.id },
                            });
                        }}
                      >
                        <Row
                          icon={s.isMissing ? "alert-triangle" : "award"}
                          label={s.name}
                          badges={badges}
                          matchReasons={matchReasons}
                          // Hide Edit on orphan rows: editing notes/status
                          // for a scholarship that no longer exists won't
                          // surface anywhere useful.
                          onEdit={
                            canRemove && !s.isMissing
                              ? () => openScholarshipEditor(s.row, s.name)
                              : undefined
                          }
                          onRemove={
                            canRemove
                              ? () =>
                                  handleRemove(
                                    "scholarships",
                                    rowId,
                                    s.name,
                                    buildScholarshipPayload(s.row),
                                  )
                              : undefined
                          }
                          isRemoving={isRemoving}
                          mutedLabel={s.isMissing}
                        />
                      </Card>
                    </SwipeableRow>
                  );
                })}
              </View>
            )}

          </>
        )}
      </ScrollView>

      <EditModal
        target={editTarget}
        onCancel={() => {
          if (!updateM.isPending) setEditTarget(null);
        }}
        onChange={setEditTarget}
        onSave={() => {
          if (editTarget) updateM.mutate(editTarget);
        }}
        isSaving={updateM.isPending}
      />

      <Snackbar
        key={pendingUndo?.key ?? "snackbar-empty"}
        visible={!!pendingUndo}
        message={
          pendingUndo
            ? pendingUndo.kind === "remove"
              ? `Removed "${pendingUndo.label}" from your plan`
              : `Saved changes to "${pendingUndo.label}"`
            : ""
        }
        actionLabel={
          // Hide the Undo affordance when the helper couldn't capture
          // a recreate payload (legacy/partial saved-row). Edit undos
          // always have a payload-equivalent (previous notes/priority/
          // status), so they keep the button.
          pendingUndo?.kind === "remove" && !pendingUndo.payload
            ? undefined
            : undoM.isPending
              ? "Undoing…"
              : "Undo"
        }
        onAction={
          pendingUndo?.kind === "remove" && !pendingUndo.payload
            ? undefined
            : () => {
                if (!pendingUndo || undoM.isPending) return;
                undoM.mutate(pendingUndo);
              }
        }
        onDismiss={() => setPendingUndo(null)}
      />
    </SafeAreaView>
  );
}

type BadgeSpec = {
  icon: React.ComponentProps<typeof Feather>["name"];
  text: string;
};

function SwipeableRow({
  label,
  enabled,
  onSwipeRemove,
  children,
}: {
  label: string;
  enabled: boolean;
  onSwipeRemove?: () => void;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const ref = useRef<SwipeableMethods>(null);

  if (!enabled || !onSwipeRemove) {
    return <>{children}</>;
  }

  // Tapping the revealed action also triggers the same delete + undo
  // flow, in case the swipe doesn't pass the auto-open threshold.
  const triggerDelete = () => {
    ref.current?.close();
    onSwipeRemove();
  };

  const renderRightActions = () => (
    <View style={{ width: 96, paddingLeft: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} from your plan`}
        onPress={triggerDelete}
        style={{
          flex: 1,
          backgroundColor: colors.destructive,
          borderRadius: colors.radius + 4,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <Feather
          name="trash-2"
          size={20}
          color={colors.destructiveForeground}
        />
        <Text
          style={{
            color: colors.destructiveForeground,
            fontFamily: SYSTEM_FONT,
            fontWeight: "600",
            fontSize: 12,
          }}
        >
          Delete
        </Text>
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        // Releasing past the open threshold completes the delete
        // immediately — the undo snackbar replaces the modal confirm.
        if (direction === SwipeDirection.RIGHT) {
          triggerDelete();
        }
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function Row({
  icon,
  label,
  badges,
  matchReasons,
  onEdit,
  onRemove,
  isRemoving,
  mutedLabel,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  badges?: BadgeSpec[];
  matchReasons?: string[] | null;
  onEdit?: () => void;
  onRemove?: () => void;
  isRemoving?: boolean;
  // Render the title in muted/italic style — used for placeholder rows
  // (e.g. saved scholarships whose canonical row has been deleted) so the
  // user can immediately tell the entry isn't a normal saved item.
  mutedLabel?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            color: mutedLabel ? colors.mutedForeground : colors.foreground,
            fontFamily: SYSTEM_FONT,
            fontWeight: "600",
            fontSize: 15,
            fontStyle: mutedLabel ? "italic" : "normal",
          }}
          numberOfLines={2}
        >
          {label}
        </Text>
        {matchReasons && matchReasons.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {matchReasons.map((reason, i) => (
              <View
                key={`reason-${i}-${reason}`}
                style={{
                  maxWidth: "100%",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  borderWidth: StyleSheet.hairlineWidth,
                  backgroundColor: colors.accent,
                  borderColor: colors.border,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "600",
                    fontSize: 10.5,
                    letterSpacing: 0.1,
                  }}
                >
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {badges && badges.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {badges.map((b, i) => (
              <View
                key={`${b.text}-${i}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: colors.muted,
                }}
              >
                <Feather name={b.icon} size={11} color={colors.mutedForeground} />
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "500",
                    fontSize: 11,
                  }}
                >
                  {b.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {onEdit ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            if (!isRemoving) onEdit();
          }}
          disabled={isRemoving}
          hitSlop={10}
          accessibilityLabel={`Edit details for ${label}`}
          accessibilityRole="button"
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.muted : "transparent",
          })}
        >
          <Feather name="edit-2" size={17} color={colors.primary} />
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            if (!isRemoving) onRemove();
          }}
          disabled={isRemoving}
          hitSlop={10}
          accessibilityLabel={`Remove ${label} from your plan`}
          accessibilityRole="button"
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.muted : "transparent",
            opacity: isRemoving ? 0.5 : 1,
          })}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Feather name="trash-2" size={18} color={colors.destructive} />
          )}
        </Pressable>
      ) : (
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      )}
    </View>
  );
}

const styles = {
  center: {
    paddingVertical: 64,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  empty: (color: string) => ({
    color,
    fontFamily: SYSTEM_FONT,
    fontWeight: "400" as const,
    fontSize: 13,
    marginTop: -6,
  }),
};
