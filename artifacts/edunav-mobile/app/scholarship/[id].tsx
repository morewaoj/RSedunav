import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  EditModal,
  isScholarshipStatus,
  normalizeNotes,
  type EditTarget,
} from "@/components/SavedItemEditModal";
import { buildSavedRowRecreatePayload } from "@workspace/saved-recreate";
import { SavedNoteCard } from "@/components/SavedNoteCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Snackbar } from "@/components/Snackbar";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  confirmRemoveFromPlan,
  fitLabel,
  formatStringList,
  formatValue,
  safeOpenUrl,
} from "@/lib/utils";
import { SYSTEM_FONT } from "@/lib/typography";

type SavedScholarshipRow = {
  id?: number | string;
  scholarshipId?: number | string;
  notes?: string | null;
  applicationStatus?: string | null;
  [k: string]: unknown;
};

type SavedItemsForScholarshipNote = {
  scholarships?: SavedScholarshipRow[];
};

// Subset of /api/profile/scholarship-recommendations — the recs endpoint
// doesn't echo a stable id (it serves both DB rows and curated picks), so
// we key by normalized name (mirrors the Scholarships tab list cards and
// the web detail page).
type ScholarshipRecsResponse = {
  recommendations?: Array<{
    scholarship?: { name?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

// Mirrors the helper used on the Scholarships tab list cards: trim, drop
// blanks, and cap to a couple short pills so the detail header stays
// scannable.
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

type ScholarshipDetail = {
  id: number;
  name: string;
  provider?: string | null;
  type?: string | null;
  state?: string | null;
  amount?: number | null;
  awardMin?: number | null;
  awardMax?: number | null;
  currency?: string | null;
  deadline?: string | null;
  deadlineAt?: string | null;
  url?: string | null;
  website?: string | null;
  eligibility?: string | null;
  eligibilityRequirements?: string[] | null;
  targetDemographics?: string[] | null;
  applicationRequirements?: string[] | null;
  description?: string | null;
  renewable?: boolean | null;
  industryTags?: string[] | null;
  // Smart-matcher reasons forwarded from the For You recommendation payload.
  // Only present when the user navigated in from a recommendation card.
  matchReasons?: string[] | null;
  // Numeric matcher score (0-100) forwarded from the recommendation payload.
  // Used INTERNALLY only to derive a soft fit-label pill — never displayed
  // as a raw number or percentage.
  matchScore?: number | null;
};

function normalizeFreeform(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const arr = formatStringList(value);
    return arr.length > 0 ? arr.map((s) => `• ${s}`).join("\n") : null;
  }
  const formatted = formatValue(value, { fallback: "" });
  return formatted.length > 0 ? formatted : null;
}

function formatAmount(s: ScholarshipDetail): string | null {
  const lo = s.awardMin ?? null;
  const hi = s.awardMax ?? null;
  if (lo && hi && lo !== hi) {
    return `$${lo.toLocaleString()} – $${hi.toLocaleString()}`;
  }
  const a = s.amount ?? hi ?? lo;
  if (typeof a === "number" && Number.isFinite(a) && a > 0) {
    return `$${a.toLocaleString()}`;
  }
  return null;
}

function formatDeadline(s: ScholarshipDetail): string | null {
  const raw = s.deadlineAt ?? s.deadline ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return typeof raw === "string" ? raw : null;
  }
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function deadlineUrgency(
  s: ScholarshipDetail,
): { color: string; label: string } | null {
  const raw = s.deadlineAt ?? s.deadline ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { color: "#9CA3AF", label: "Closed" };
  if (days <= 7) return { color: "#F43F5E", label: `${days} day${days === 1 ? "" : "s"} left` };
  if (days <= 30) return { color: "#F59E0B", label: `${days} days left` };
  return { color: "#10B981", label: `${days} days left` };
}

export default function ScholarshipDetailScreen() {
  const { id, data: passedRaw } = useLocalSearchParams<{
    id: string;
    data?: string;
  }>();
  const colors = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Optional payload passed from Profile / Home For You cards. The matcher
  // exposes hardcoded scholarships (e.g. "UNCF General Scholarship") that
  // don't exist in the DB at all — so a name-search would return [] and the
  // detail screen would be stuck on "Scholarship not found". When the
  // recommendation payload is passed in, we render it directly so a
  // recommended scholarship NEVER falls through to "not found". Expo Router
  // URL-encodes route params automatically — JSON.parse it directly.
  const passedDetail: ScholarshipDetail | null = React.useMemo(() => {
    const raw = typeof passedRaw === "string" ? passedRaw : null;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.name) return null;
      return parsed as ScholarshipDetail;
    } catch {
      // Defensive: try a single decode in case some legacy caller
      // double-encoded the payload.
      try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (!parsed || typeof parsed !== "object" || !parsed.name) return null;
        return parsed as ScholarshipDetail;
      } catch {
        return null;
      }
    }
  }, [passedRaw]);

  // Soft fit-label derived from the recommendation's numeric matchScore.
  // We deliberately never surface the raw number/percentage — only the
  // bucketed label ("Top match" / "Strong fit" / "Good fit" / "Worth
  // exploring"). Hidden entirely when no score is present (e.g. a deep-link
  // to the screen that didn't come from a recommendation card).
  const fitLabelText: string | null = React.useMemo(() => {
    const score = passedDetail?.matchScore;
    if (typeof score !== "number" || !Number.isFinite(score)) return null;
    return fitLabel(score);
  }, [passedDetail]);

  // The route param `id` may be either a numeric scholarship PK (deep link
  // from the Scholarships list) OR a scholarship name (deep link from the
  // For You / Profile section, where the matcher's hardcoded results don't
  // expose a DB id). Mirror career/[id].tsx: try the numeric endpoint first,
  // then fall back to /api/scholarships/search/:query.
  const idStr = String(id ?? "");
  const isNumeric = /^\d+$/.test(idStr);

  const numericQ = useQuery<ScholarshipDetail | null>({
    queryKey: ["/api/scholarships", idStr, "by-id"],
    queryFn: async () => {
      if (!idStr || !isNumeric) return null;
      try {
        return await apiRequest<ScholarshipDetail>(
          "GET",
          `/api/scholarships/${encodeURIComponent(idStr)}`,
        );
      } catch {
        return null;
      }
    },
    enabled: !!idStr && isNumeric,
    retry: 1,
  });

  const fallbackQ = useQuery<ScholarshipDetail | null>({
    queryKey: ["/api/scholarships", idStr, "by-name"],
    queryFn: async () => {
      if (!idStr) return null;
      // Skip name search if we already have a numeric hit
      if (isNumeric && numericQ.data) return null;
      const results = await apiRequest<ScholarshipDetail[]>(
        "GET",
        `/api/scholarships/search/${encodeURIComponent(idStr)}`,
      );
      if (!Array.isArray(results) || results.length === 0) return null;
      const target = idStr.toLowerCase().trim();
      const exact = results.find(
        (s) => (s?.name ?? "").toLowerCase().trim() === target,
      );
      return exact ?? results[0] ?? null;
    },
    enabled: !!idStr && (!isNumeric || (isNumeric && numericQ.isError)),
    retry: 1,
  });

  // Render-source precedence: prefer the rich DB record (numeric, then
  // name-search), but ALWAYS fall back to the recommendation payload so a
  // For You scholarship never shows "not found".
  const data: ScholarshipDetail | null =
    numericQ.data ?? fallbackQ.data ?? passedDetail ?? null;
  // Only show the spinner when we have nothing to render yet (no passed
  // payload AND DB queries are still in flight).
  const isLoading =
    !passedDetail &&
    ((isNumeric && numericQ.isLoading) ||
      (!isNumeric && fallbackQ.isLoading) ||
      (isNumeric && numericQ.isError && fallbackQ.isLoading));
  // Only show "not found" when EVERYTHING failed AND there's no passed
  // payload to fall back to.
  const isError = !isLoading && !data;

  // Pull the user's personalized scholarship matches so the detail screen
  // can show the same "why this matched" chips the Scholarships tab list
  // cards already render. Without this, only deep-links coming in from
  // recommendation cards (which forward `passedDetail.matchReasons`) get
  // chips — taps from the list and direct deep-links would silently drop
  // them. Allowed to fail quietly: signed-out users get null and we just
  // hide the section.
  const recsQ = useQuery<ScholarshipRecsResponse | null>({
    queryKey: ["/api/profile/scholarship-recommendations"],
    queryFn: async () =>
      apiGet<ScholarshipRecsResponse | null>(
        "/api/profile/scholarship-recommendations",
        { allowUnauthorized: true },
      ),
  });

  // Build a normalized name → reasons lookup from the recs payload. The
  // recs endpoint doesn't echo a stable id, so we key by name (mirrors the
  // Scholarships tab list cards and the web detail page).
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

  // Smart-matcher reasons displayed in the "Why this matches you" section.
  // Precedence:
  //   1) `passedDetail.matchReasons` — forwarded inline from a recommendation
  //      card. Wins so the chips are right on first paint, before any extra
  //      query resolves.
  //   2) `reasonsByName` — the personalized recs payload, keyed by the
  //      resolved scholarship's normalized name. Covers detail screens
  //      reached without an inline payload (Scholarships tab tap, deep
  //      links, etc.).
  // Trim whitespace, drop blanks, and de-dupe so chips stay readable.
  const matchReasons: string[] = React.useMemo(() => {
    const direct = passedDetail?.matchReasons;
    if (Array.isArray(direct)) {
      // Dedupe by normalized form, then cap via the shared helper so the
      // direct (inline) path matches the recs-lookup path: same cleaning
      // and the same 1–2 short chip cap. Without the cap, an upstream
      // payload with 3+ reasons would silently render more chips than
      // every other surface.
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const r of direct) {
        if (typeof r !== "string") continue;
        const cleaned = r.replace(/\s+/g, " ").trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(cleaned);
      }
      const capped = pickMatchReasons(deduped);
      if (capped.length > 0) return capped;
    }
    const candidates = [
      numericQ.data?.name,
      fallbackQ.data?.name,
      passedDetail?.name,
    ];
    for (const raw of candidates) {
      const key = raw?.trim().toLowerCase();
      if (!key) continue;
      const found = reasonsByName.get(key);
      if (found && found.length > 0) return found;
    }
    return [];
  }, [
    passedDetail,
    numericQ.data?.name,
    fallbackQ.data?.name,
    reasonsByName,
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        isNumeric ? numericQ.refetch() : Promise.resolve(),
        !isNumeric || numericQ.isError ? fallbackQ.refetch() : Promise.resolve(),
        recsQ.refetch(),
        qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isNumeric, numericQ, fallbackQ, recsQ, qc, user?.id]);

  const savedItemsQ = useQuery<SavedItemsForScholarshipNote | null>({
    queryKey: ["/api/saved-items", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return await apiGet<SavedItemsForScholarshipNote | null>(
        `/api/saved-items/${encodeURIComponent(user.id)}`,
        { allowUnauthorized: true },
      );
    },
    enabled: !!user?.id,
  });

  // Match the saved row by the resolved scholarship's DB id (numeric or
  // name-search results both expose `id`). Fall back to the route param
  // when it's already numeric so deep-links still find their saved row
  // before the detail query resolves.
  const resolvedScholarshipId = React.useMemo(() => {
    const fromData = numericQ.data?.id ?? fallbackQ.data?.id;
    if (typeof fromData === "number" && Number.isFinite(fromData)) {
      return String(fromData);
    }
    if (isNumeric) return idStr;
    return null;
  }, [numericQ.data, fallbackQ.data, isNumeric, idStr]);

  const savedScholarshipRow: SavedScholarshipRow | null = React.useMemo(() => {
    if (!resolvedScholarshipId || !Array.isArray(savedItemsQ.data?.scholarships)) {
      return null;
    }
    return (
      savedItemsQ.data!.scholarships!.find((row) => {
        const candidate = row.scholarshipId ?? row.id;
        return candidate !== undefined && String(candidate) === resolvedScholarshipId;
      }) ?? null
    );
  }, [resolvedScholarshipId, savedItemsQ.data]);

  const savedNote = normalizeNotes(savedScholarshipRow?.notes);
  // Reflect the saved state on screen load so the Save button doesn't
  // confusingly invite the user to re-save an item that's already in their
  // plan. `saveM.isSuccess` (used at the JSX call site below) also keeps
  // the button in the saved state immediately after a tap, before the
  // saved-items query has refetched.
  const alreadyInPlan = !!savedScholarshipRow;
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // Mirrors saved.tsx: a 5s undo snackbar after a successful edit OR
  // remove. Edits re-PATCH back to the previous status/notes; removes
  // re-POST a saved-scholarships row using the captured payload so the
  // user gets the same status/notes/deadline back in one tap.
  type PendingUndo =
    | {
        kind: "edit";
        key: number;
        label: string;
        rowId: number;
        previous: {
          notes: string | null;
          applicationStatus:
            | "interested"
            | "applied"
            | "awarded"
            | "rejected"
            | null;
        };
      }
    | {
        kind: "remove";
        key: number;
        label: string;
        // Null when the captured saved-row was missing the FK id needed
        // to rebuild it (e.g. legacy partial row). The DELETE still goes
        // through; the snackbar just omits the Undo affordance — same
        // behavior as the web My Plan toast.
        payload: Record<string, unknown> | null;
      };
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);

  const updateNoteM = useMutation({
    mutationFn: async (target: EditTarget) => {
      if (target.kind !== "scholarship") return;
      const notesValue = normalizeNotes(target.notes);
      await apiRequest("PATCH", `/api/saved-scholarships/${target.rowId}`, {
        notes: notesValue,
        applicationStatus: target.status,
      });
    },
    onSuccess: (_data, target) => {
      setEditTarget(null);
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      if (target.kind !== "scholarship") return;
      // Suppress the snackbar when nothing actually changed (matches the
      // My Plan behavior).
      const newNotes = normalizeNotes(target.notes);
      const changed =
        newNotes !== target.originalNotes ||
        target.status !== target.originalStatus;
      if (!changed) return;
      setPendingUndo({
        kind: "edit",
        key: Date.now(),
        label: target.label,
        rowId: target.rowId,
        previous: {
          notes: target.originalNotes,
          applicationStatus: target.originalStatus,
        },
      });
    },
    onError: (e) => {
      Alert.alert(
        "Couldn't save changes",
        e instanceof Error ? e.message : "Please try again.",
      );
    },
  });

  const undoM = useMutation({
    mutationFn: async (undo: NonNullable<typeof pendingUndo>) => {
      if (undo.kind === "remove") {
        // Re-create the saved-scholarships row using the payload captured
        // at remove time so notes/status/deadline stay intact on undo.
        // Caller must ensure undo is not invoked when payload is null
        // (Snackbar already hides the action button in that case).
        if (!undo.payload) return;
        await apiRequest("POST", "/api/saved-scholarships", undo.payload);
      } else {
        await apiRequest("PATCH", `/api/saved-scholarships/${undo.rowId}`, {
          notes: undo.previous.notes,
          applicationStatus: undo.previous.applicationStatus,
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

  const openNoteEditor = () => {
    if (!savedScholarshipRow) return;
    const rawId = savedScholarshipRow.id;
    const rowId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(rowId)) return;
    const originalNotes = normalizeNotes(savedScholarshipRow.notes);
    const originalStatus = isScholarshipStatus(savedScholarshipRow.applicationStatus)
      ? savedScholarshipRow.applicationStatus
      : null;
    setEditTarget({
      kind: "scholarship",
      rowId,
      label: data?.name ?? "Scholarship",
      notes: typeof savedScholarshipRow.notes === "string"
        ? savedScholarshipRow.notes
        : "",
      status: originalStatus ?? "interested",
      originalNotes,
      originalStatus,
    });
  };

  // Removes the saved-scholarships row directly from the detail screen so a
  // user viewing a scholarship they already saved doesn't have to back out
  // to the Saved tab to take it off their plan. Mirrors the DELETE the
  // saved.tsx list view uses (`/api/saved-scholarships/:id`).
  const removeM = useMutation({
    mutationFn: async (vars: {
      label: string;
      recreatePayload: Record<string, unknown> | null;
    }) => {
      const rawId = savedScholarshipRow?.id;
      const rowId = typeof rawId === "number" ? rawId : Number(rawId);
      if (!Number.isFinite(rowId)) {
        throw new Error("This item can't be removed right now.");
      }
      await apiRequest("DELETE", `/api/saved-scholarships/${rowId}`);
      return vars;
    },
    onSuccess: (_data, variables) => {
      // Refetch saved-items so `alreadyInPlan` flips to false and the
      // Save button reappears in place of the Remove button.
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      // Mirrors the My Plan list: a 5s undo snackbar so an accidental
      // Remove tap can be reversed with the same status/notes/deadline.
      setPendingUndo({
        kind: "remove",
        key: Date.now(),
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

  const onRemove = () => {
    const rawId = savedScholarshipRow?.id;
    const rowId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(rowId)) return;
    if (!user?.id) return;
    const label = data?.name ?? "this scholarship";
    // Capture the saved-scholarships shape at remove time so the undo
    // snackbar can re-POST the row with previous status/notes/deadline.
    // Shared with the web Save button, the web My Plan list, and the
    // mobile My Plan list via @workspace/saved-recreate so all four
    // surfaces stay in lock-step. Pass the resolved scholarship id +
    // detail name + deadline as fallbacks so undo still re-creates the
    // row even if the captured saved-row is missing those fields.
    // The DELETE proceeds even when the helper can't rebuild the row
    // (e.g. legacy saved-row missing scholarshipId); Undo is just
    // suppressed in the snackbar, mirroring the web My Plan toast.
    const recreatePayload = buildSavedRowRecreatePayload(
      "scholarship",
      savedScholarshipRow ?? {},
      user.id,
      {
        scholarshipId: resolvedScholarshipId
          ? Number(resolvedScholarshipId)
          : undefined,
        scholarshipName: typeof data?.name === "string" ? data.name : null,
        scholarshipDeadline: data?.deadline ?? data?.deadlineAt ?? null,
      },
    );
    confirmRemoveFromPlan(label, !!savedNote, () =>
      removeM.mutate({ label, recreatePayload }),
    );
  };

  const saveM = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in to save scholarships to your plan.");
      // Prefer the resolved scholarship's real DB id; fall back to the route
      // param if it's already numeric. If neither is available (matcher-only
      // scholarship like "UNCF General Scholarship"), surface a friendly
      // message instead of crashing or saving a bad row.
      const numericFromData = Number(numericQ.data?.id ?? fallbackQ.data?.id);
      const scholarshipId = Number.isFinite(numericFromData)
        ? numericFromData
        : isNumeric
          ? Number(idStr)
          : NaN;
      if (!Number.isFinite(scholarshipId)) {
        throw new Error(
          "This scholarship can't be saved to your plan yet. Tap \"Apply on website\" to apply directly.",
        );
      }
      return await apiRequest<{ duplicate?: boolean }>("POST", "/api/saved-scholarships", {
        userId: user.id,
        scholarshipId,
        // Snapshot the display name so list pages can match the "Saved"
        // badge by name even when curated/recommendation picks lack a
        // stable id matching this row.
        scholarshipName: data?.name ?? null,
        deadline: data?.deadline ?? data?.deadlineAt ?? null,
      });
    },
    onSuccess: (result) => {
      if (result?.duplicate) {
        Alert.alert("Already in your plan", "This scholarship is already saved.");
      } else {
        Alert.alert("Saved to your plan", "Find it under Saved.");
      }
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
    },
    onError: (e) => {
      Alert.alert(
        "Couldn't save",
        e instanceof Error ? e.message : "Please try again.",
      );
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScreenHeader title="Scholarship" showBack />
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScreenHeader title="Scholarship" showBack />
        <View style={[styles.center, { flex: 1, padding: 20 }]}>
          <EmptyState
            icon="alert-circle"
            title="Scholarship not found"
            message="This scholarship may no longer be available. Try going back and choosing another."
          />
        </View>
      </SafeAreaView>
    );
  }

  const amt = formatAmount(data);
  const dl = formatDeadline(data);
  const urgency = deadlineUrgency(data);
  const applyUrl = data.website ?? data.url ?? null;

  const eligibilityList: string[] = formatStringList(data.eligibilityRequirements);
  const appReqs: string[] = formatStringList(data.applicationRequirements);
  const demos: string[] = formatStringList(data.targetDemographics);
  const eligibilityText = normalizeFreeform(data.eligibility);
  const safeDescription = normalizeFreeform(data.description);
  const safeName = formatValue(data.name, { fallback: "Scholarship" });
  const safeProvider = data.provider == null ? null : formatValue(data.provider, { fallback: "" }) || null;
  const safeType = data.type == null ? null : formatValue(data.type, { fallback: "" }) || null;
  const safeState = data.state == null ? null : formatValue(data.state, { fallback: "" }) || null;
  const safeCurrency = data.currency == null ? null : formatValue(data.currency, { fallback: "" }) || null;

  const onApply = () => {
    if (!applyUrl) {
      Alert.alert(
        "No application link",
        "This scholarship doesn't have a direct application link. Search for it on the provider's website.",
      );
      return;
    }
    void safeOpenUrl(applyUrl, {
      failureTitle: "Couldn't open link",
      failureMessage: "Could not open this link. Please try again later.",
    });
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenHeader title="Scholarship" showBack />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        <LinearGradient
          colors={["#6C2BD9", "#A855F7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {safeType ? (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{safeType.toUpperCase()}</Text>
            </View>
          ) : null}
          <Text style={styles.heroTitle}>{safeName}</Text>
          {safeProvider ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Feather name="briefcase" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroProvider} numberOfLines={2}>
                {safeProvider}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatTile
            label="Award"
            value={amt ?? "Variable"}
            icon="dollar-sign"
            accent="#6C2BD9"
          />
          <StatTile
            label="Deadline"
            value={dl ?? "Rolling"}
            icon="calendar"
            accent={urgency?.color ?? "#A855F7"}
            sub={urgency?.label}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={applyUrl ? "Apply on website" : "No application link"}
                onPress={onApply}
                disabled={!applyUrl}
              />
            </View>
            <Pressable
              onPress={() => saveM.mutate()}
              disabled={saveM.isPending || alreadyInPlan || saveM.isSuccess}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  borderColor: colors.primary,
                  backgroundColor:
                    alreadyInPlan || saveM.isSuccess
                      ? colors.accent
                      : pressed
                        ? colors.muted
                        : "transparent",
                  opacity:
                    saveM.isPending
                      ? 0.6
                      : alreadyInPlan || saveM.isSuccess
                        ? 0.85
                        : 1,
                },
              ]}
            >
              <Feather
                name={alreadyInPlan || saveM.isSuccess ? "check" : "bookmark"}
                size={16}
                color={colors.primary}
              />
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: SYSTEM_FONT, fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {saveM.isPending
                  ? "Saving…"
                  : alreadyInPlan || saveM.isSuccess
                    ? "Saved to plan"
                    : "Save to plan"}
              </Text>
            </Pressable>
          </View>
        </View>

        {alreadyInPlan ? (
          <View style={styles.section}>
            <SavedNoteCard
              note={savedNote}
              onEdit={openNoteEditor}
              disabled={updateNoteM.isPending}
            />
          </View>
        ) : null}

        {alreadyInPlan ? (
          <View style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove from plan"
              onPress={onRemove}
              disabled={removeM.isPending}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                minHeight: 48,
                paddingHorizontal: 20,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.destructive,
                backgroundColor: pressed ? colors.muted : "transparent",
                opacity: removeM.isPending ? 0.6 : 1,
              })}
            >
              {removeM.isPending ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Feather name="trash-2" size={16} color={colors.destructive} />
              )}
              <Text
                style={{
                  color: colors.destructive,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {removeM.isPending ? "Removing…" : "Remove from plan"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {matchReasons.length > 0 ? (
          <Section title="Why this matches you">
            {fitLabelText ? (
              <View
                accessibilityRole="text"
                accessibilityLabel={`Match strength: ${fitLabelText}`}
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: colors.accent,
                  borderColor: colors.primary,
                  marginBottom: 10,
                }}
              >
                <Feather name="star" size={11} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT,
                    fontWeight: "700",
                    fontSize: 11,
                  }}
                >
                  {fitLabelText}
                </Text>
              </View>
            ) : null}
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 13,
                lineHeight: 19,
                marginBottom: 10,
              }}
            >
              We scored this against your profile and found{" "}
              {matchReasons.length === 1
                ? "1 reason"
                : `${matchReasons.length} reasons`}{" "}
              it could be a fit:
            </Text>
            <View style={styles.tagRow}>
              {matchReasons.map((reason, i) => (
                <View
                  key={`reason-${i}`}
                  style={[
                    styles.reasonChip,
                    {
                      backgroundColor: colors.accent,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Feather name="check" size={12} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: SYSTEM_FONT, fontWeight: "600",
                      fontSize: 12,
                    }}
                  >
                    {reason}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {safeDescription ? (
          <Section title="About this scholarship">
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              {safeDescription}
            </Text>
          </Section>
        ) : null}

        {eligibilityList.length > 0 || eligibilityText ? (
          <Section title="Eligibility">
            {eligibilityText ? (
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                  fontSize: 13,
                  lineHeight: 20,
                  marginBottom: eligibilityList.length > 0 ? 10 : 0,
                }}
              >
                {eligibilityText}
              </Text>
            ) : null}
            {eligibilityList.map((req, i) => (
              <BulletItem key={`elig-${i}`} text={req} icon="check-circle" />
            ))}
          </Section>
        ) : null}

        {appReqs.length > 0 ? (
          <Section title="What you'll need">
            {appReqs.map((req, i) => (
              <BulletItem key={`app-${i}`} text={req} icon="file-text" />
            ))}
          </Section>
        ) : null}

        {demos.length > 0 ? (
          <Section title="Best for">
            <View style={styles.tagRow}>
              {demos.map((d, i) => (
                <View
                  key={`demo-${i}`}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT, fontWeight: "500",
                      fontSize: 12,
                    }}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Quick facts">
          <FactRow label="Provider" value={safeProvider} />
          <FactRow label="Type" value={safeType} />
          <FactRow label="State" value={safeState} />
          <FactRow
            label="Renewable"
            value={
              data.renewable === true
                ? "Yes — can renew yearly"
                : data.renewable === false
                ? "No — one-time award"
                : null
            }
          />
          <FactRow label="Currency" value={safeCurrency} />
        </Section>
      </ScrollView>
      <EditModal
        target={editTarget}
        onCancel={() => {
          if (!updateNoteM.isPending) setEditTarget(null);
        }}
        onChange={setEditTarget}
        onSave={() => {
          if (editTarget) updateNoteM.mutate(editTarget);
        }}
        isSaving={updateNoteM.isPending}
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
          // always have a payload-equivalent (previous notes/status).
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.section,
        styles.sectionCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 4,
        },
      ]}
    >
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "700",
          fontSize: 15,
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function StatTile({
  label,
  value,
  icon,
  accent,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  accent: string;
  sub?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius + 4,
        },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: accent + "1A" }]}>
        <Feather name={icon} size={16} color={accent} />
      </View>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: SYSTEM_FONT, fontWeight: "500",
          fontSize: 11,
          marginTop: 8,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "700",
          fontSize: 15,
          marginTop: 2,
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
      {sub ? (
        <Text
          style={{
            color: accent,
            fontFamily: SYSTEM_FONT, fontWeight: "600",
            fontSize: 11,
            marginTop: 4,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function BulletItem({
  text,
  icon,
}: {
  text: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}) {
  const colors = useColors();
  return (
    <View style={styles.bullet}>
      <Feather name={icon} size={14} color={colors.primary} style={{ marginTop: 2 }} />
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "400",
          fontSize: 13,
          lineHeight: 19,
          flex: 1,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function FactRow({ label, value }: { label: string; value?: string | null }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={[styles.factRow, { borderBottomColor: colors.border }]}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: SYSTEM_FONT, fontWeight: "500",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "600",
          fontSize: 13,
          flexShrink: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 18,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: "#FFFFFF",
    fontFamily: SYSTEM_FONT, fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontFamily: SYSTEM_FONT, fontWeight: "700",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  heroProvider: {
    color: "rgba(255,255,255,0.95)",
    fontFamily: SYSTEM_FONT, fontWeight: "500",
    fontSize: 13,
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  statTile: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  sectionCard: {
    padding: 16,
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  bullet: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 12,
  },
});
