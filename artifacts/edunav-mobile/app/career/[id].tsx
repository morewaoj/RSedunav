import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  EditModal,
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
import { SYSTEM_FONT } from "@/lib/typography";
import { confirmRemoveFromPlan } from "@/lib/utils";

type SavedCareerRow = {
  id?: number | string;
  careerTitle?: string | null;
  title?: string | null;
  name?: string | null;
  notes?: string | null;
  [k: string]: unknown;
};

type SavedItemsForCareerNote = {
  careers?: SavedCareerRow[];
};

// Subset of /api/profile/career-recommendations response — we need each
// entry's title (case-insensitive) and onetCode so we can find this career,
// plus the per-entry matchReasons so the detail screen can show the same
// "why this matched" chips the Careers tab list cards already render.
type CareerRecsResponse = {
  careers?: Array<{
    career?: { title?: string | null; onetCode?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

// Mirrors the helper used on the list cards: trim, drop blanks, cap to a
// couple of short pills so the detail header stays scannable.
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

type CareerMatch = {
  career: {
    title: string;
    description?: string | null;
    requiredSkills?: string[] | null;
    averageSalary?: number | null;
    growthOutlook?: string | null;
    workEnvironment?: string | null;
    educationRequirements?: string | null;
    industryInsights?: string[] | null;
    topKConfidence?: number | null;
    onetCode?: string | null;
    industries?: string[] | null;
  };
  marketData?: {
    demandLevel?: string;
    remoteFriendly?: boolean;
    jobAvailability?: number;
  } | null;
  matchDetails?: {
    matchReasons?: string[] | null;
    skillsMatch?: string[] | null;
    missingSkills?: string[] | null;
    standOutTips?: string[] | null;
  } | null;
};

type CareerDetail = {
  id?: string | number;
  title: string;
  description?: string | null;
  averageSalary?: number | null;
  growthOutlook?: string | null;
  outlook?: string | null;
  growth?: string | null;
  skills?: string[] | null;
  requiredSkills?: string[] | null;
  education?: string | null;
  educationRequirements?: string | null;
  industries?: string[] | null;
  responsibilities?: string[] | null;
  workEnvironment?: string | null;
  // Carried through so the match-reason chip lookup can match on the
  // fetched career's onetCode in addition to the inline-passed payload's
  // — important when the user deep-links to a career screen without route
  // params (e.g. from a saved-careers row).
  onetCode?: string | null;
};

function decodeMatch(data?: string | string[]): CareerMatch | null {
  if (!data) return null;
  const raw = Array.isArray(data) ? data[0] : data;
  // Expo Router already URL-decodes route params once. Only JSON.parse here —
  // a second decodeURIComponent throws "URI malformed" when the payload
  // contains literal % characters (e.g. salary "100%"), which produced the
  // "Career not found" bug for recommended career cards.
  try {
    return JSON.parse(raw) as CareerMatch;
  } catch {
    try {
      // Defensive fallback for any legacy double-encoded data still in the
      // navigation stack (won't run for fresh navigations).
      return JSON.parse(decodeURIComponent(raw)) as CareerMatch;
    } catch {
      return null;
    }
  }
}

export default function CareerDetailScreen() {
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const colors = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();

  const passed = useMemo(() => decodeMatch(data), [data]);

  // The route param `id` may be either a numeric career-paths PK (deep link)
  // or a careerTitle string (saved careers store only the title). Try the
  // numeric endpoint first, then fall back to the title search endpoint.
  const fallbackQ = useQuery<CareerDetail | null>({
    queryKey: ["/api/career-paths/lookup", id],
    queryFn: async () => {
      const idStr = String(id ?? "").trim();
      if (!idStr) return null;
      const numeric = /^\d+$/.test(idStr);
      if (numeric) {
        try {
          const direct = await apiRequest<CareerDetail>(
            "GET",
            `/api/career-paths/${encodeURIComponent(idStr)}`,
          );
          if (direct?.title) return direct;
        } catch {
          // fall through to title search
        }
      }
      try {
        const matches = await apiGet<CareerDetail[] | null>(
          `/api/career-paths/search/${encodeURIComponent(idStr)}`,
          { allowUnauthorized: true },
        );
        if (Array.isArray(matches) && matches.length > 0) {
          const lower = idStr.toLowerCase();
          const exact = matches.find(
            (m) => (m?.title ?? "").toLowerCase() === lower,
          );
          return exact ?? matches[0] ?? null;
        }
      } catch {
        // ignore
      }
      return null;
    },
    enabled: !!id && !passed,
  });

  // Prefer freshly-fetched API data over the route-passed payload once the
  // detail query has resolved (e.g. after a pull-to-refresh). The passed
  // payload is only used as the initial render source so navigating in from
  // a recommendation card stays instant.
  const career: CareerDetail | null = fallbackQ.data
    ? fallbackQ.data
    : passed
    ? {
        id,
        title: passed.career.title,
        description: passed.career.description,
        averageSalary: passed.career.averageSalary,
        growthOutlook: passed.career.growthOutlook,
        skills: passed.career.requiredSkills,
        education: passed.career.educationRequirements,
        industries: passed.career.industries,
        workEnvironment: passed.career.workEnvironment,
        onetCode: passed.career.onetCode,
      }
    : null;

  const market = passed?.marketData ?? null;
  const matchDetails = passed?.matchDetails ?? null;

  // Pull the user's personalized career matches so we can show the same
  // "why this matched" chips the Careers tab list cards already render.
  // Allowed to fail quietly (signed-out users get null) — when there's no
  // match we just hide the chip row.
  const careerRecsQ = useQuery<CareerRecsResponse | null>({
    queryKey: ["/api/profile/career-recommendations"],
    queryFn: async () =>
      apiGet<CareerRecsResponse | null>(
        "/api/profile/career-recommendations",
        { allowUnauthorized: true },
      ),
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Always refetch the detail query — even when we initially rendered
      // from the passed payload — so pull-to-refresh actually re-pulls the
      // catalog record. TanStack Query's refetch() runs regardless of the
      // query's `enabled` flag.
      await Promise.all([
        fallbackQ.refetch(),
        careerRecsQ.refetch(),
        qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fallbackQ, careerRecsQ, qc, user?.id]);

  const savedItemsQ = useQuery<SavedItemsForCareerNote | null>({
    queryKey: ["/api/saved-items", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return await apiGet<SavedItemsForCareerNote | null>(
        `/api/saved-items/${encodeURIComponent(user.id)}`,
        { allowUnauthorized: true },
      );
    },
    enabled: !!user?.id,
  });

  // The current detail screen route param `id` for careers is the title
  // string (saved careers store only `careerTitle`, no PK), so match the
  // saved row by title instead of by id.
  const savedCareerRow = useMemo<SavedCareerRow | null>(() => {
    const title = career?.title;
    if (!title || !Array.isArray(savedItemsQ.data?.careers)) return null;
    const target = title.trim().toLowerCase();
    if (!target) return null;
    return (
      savedItemsQ.data!.careers!.find((row) => {
        const candidate =
          (typeof row.careerTitle === "string" && row.careerTitle) ||
          (typeof row.title === "string" && row.title) ||
          (typeof row.name === "string" && row.name) ||
          "";
        return candidate.trim().toLowerCase() === target;
      }) ?? null
    );
  }, [career?.title, savedItemsQ.data]);

  const savedNote = normalizeNotes(savedCareerRow?.notes);

  // Find this career in the recommendations payload and pull its
  // matchReasons. Match by onetCode when available, otherwise fall back to
  // a normalized title comparison — same dual-key approach the web
  // career-detail page and the Careers tab list cards use, so the surfaces
  // stay in sync.
  const matchReasons = useMemo<string[]>(() => {
    if (!career) return [];
    const targetTitle = career.title?.trim().toLowerCase() ?? "";
    // Prefer the fetched career's onetCode (works on deep links without
    // route params), but fall back to the inline-passed payload's so the
    // first instant render — before the detail query resolves — still
    // matches when the user tapped through from a recommendation card.
    const targetCode =
      (career.onetCode ?? passed?.career.onetCode ?? "").trim();
    for (const entry of careerRecsQ.data?.careers ?? []) {
      const entryTitle = entry.career?.title?.trim().toLowerCase() ?? "";
      const entryCode = entry.career?.onetCode?.trim() ?? "";
      const titleMatches = !!targetTitle && !!entryTitle && entryTitle === targetTitle;
      const codeMatches = !!targetCode && !!entryCode && entryCode === targetCode;
      if (titleMatches || codeMatches) {
        return pickMatchReasons(entry.matchReasons);
      }
    }
    return [];
  }, [careerRecsQ.data, career, passed?.career.onetCode]);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // Mirrors saved.tsx: after a successful edit OR remove we surface a 5s
  // undo snackbar. For edits the undo re-PATCHes the row; for removes it
  // re-POSTs the saved-careers row using the captured payload so the user
  // gets back the same notes/match metadata they had before tapping Remove.
  type PendingUndo =
    | {
        kind: "edit";
        key: number;
        label: string;
        rowId: number;
        previous: { notes: string | null };
      }
    | {
        kind: "remove";
        key: number;
        label: string;
        // Null when the captured saved-row was missing the career title
        // needed to rebuild it. The DELETE still goes through; the
        // snackbar just omits the Undo affordance — same behavior as
        // the web My Plan toast.
        payload: Record<string, unknown> | null;
      };
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);

  const updateNoteM = useMutation({
    mutationFn: async (target: EditTarget) => {
      if (target.kind !== "career") return;
      const notesValue = normalizeNotes(target.notes);
      await apiRequest("PATCH", `/api/saved-careers/${target.rowId}`, {
        notes: notesValue,
      });
    },
    onSuccess: (_data, target) => {
      setEditTarget(null);
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      if (target.kind !== "career") return;
      // Suppress the snackbar when nothing actually changed (matches the
      // My Plan behavior). Compare normalized notes so trim/whitespace
      // differences don't trigger a spurious undo prompt.
      const newNotes = normalizeNotes(target.notes);
      if (newNotes === target.originalNotes) return;
      setPendingUndo({
        kind: "edit",
        key: Date.now(),
        label: target.label,
        rowId: target.rowId,
        previous: { notes: target.originalNotes },
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
        // Re-create the saved-careers row using the payload we captured
        // just before the DELETE so the user gets the same notes/match
        // metadata back in one tap. Caller must ensure undo is not
        // invoked when payload is null (Snackbar already hides the
        // action button in that case).
        if (!undo.payload) return;
        await apiRequest("POST", "/api/saved-careers", undo.payload);
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

  const openNoteEditor = () => {
    const rawId = savedCareerRow?.id;
    const rowId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(rowId)) return;
    const rawNotes = savedCareerRow?.notes;
    setEditTarget({
      kind: "career",
      rowId,
      label: career?.title ?? "Career",
      notes: typeof rawNotes === "string" ? rawNotes : "",
      originalNotes: normalizeNotes(rawNotes),
    });
  };

  // Reflect the saved state on screen load so the Save button doesn't
  // confusingly invite the user to re-save an item that's already in their
  // plan. `saveM.isSuccess` (computed below) also keeps the button in the
  // saved state immediately after a tap, before the saved-items query has
  // refetched.
  const alreadyInPlan = !!savedCareerRow;

  // Removes the saved-careers row directly from the detail screen so a user
  // viewing a career they already saved doesn't have to back out to the
  // Saved tab to take it off their plan. Mirrors the DELETE the saved.tsx
  // list view uses (`/api/saved-careers/:id`).
  const removeM = useMutation({
    mutationFn: async (vars: {
      label: string;
      recreatePayload: Record<string, unknown> | null;
    }) => {
      const rawId = savedCareerRow?.id;
      const rowId = typeof rawId === "number" ? rawId : Number(rawId);
      if (!Number.isFinite(rowId)) {
        throw new Error("This item can't be removed right now.");
      }
      await apiRequest("DELETE", `/api/saved-careers/${rowId}`);
      return vars;
    },
    onSuccess: (_data, variables) => {
      // Refetch saved-items so `alreadyInPlan` flips to false and the
      // Save button reappears in place of the Remove button.
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      // Mirrors the My Plan list: a 5s undo snackbar so an accidental
      // Remove tap can be reversed without re-saving from scratch.
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
    const rawId = savedCareerRow?.id;
    const rowId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(rowId)) return;
    if (!user?.id) return;
    const label = career?.title ?? "this career";
    // Capture the saved-careers shape now so the undo snackbar can
    // re-POST the same row (notes + match metadata included) if the user
    // taps Undo within ~5s. Shared with the web Save button, the web
    // My Plan list, and the mobile My Plan list via @workspace/saved-recreate
    // so all four surfaces stay in lock-step. Older saved-rows may have
    // the title under `title`/`name` instead of `careerTitle`, and the
    // route may be opened on a brand-new career not yet saved, so derive
    // a best-effort fallback title to hand to the helper.
    const row = savedCareerRow;
    const fallbackTitle =
      (typeof row?.title === "string" && row.title.trim()) ||
      (typeof row?.name === "string" && row.name.trim()) ||
      career?.title ||
      null;
    // The DELETE proceeds even when the helper can't rebuild the row
    // (e.g. legacy saved-row missing the career title); Undo is just
    // suppressed in the snackbar, mirroring the web My Plan toast.
    const recreatePayload = buildSavedRowRecreatePayload(
      "career",
      row ?? {},
      user.id,
      { careerTitle: fallbackTitle },
    );
    confirmRemoveFromPlan(label, !!savedNote, () =>
      removeM.mutate({ label, recreatePayload }),
    );
  };

  const saveM = useMutation({
    mutationFn: async () => {
      if (!career || !user?.id) {
        throw new Error("You need to be signed in to save items.");
      }
      const conf = passed?.career.topKConfidence ?? null;
      return await apiRequest<{ duplicate?: boolean }>("POST", "/api/saved-careers", {
        userId: user.id,
        careerTitle: career.title,
        onetCode: passed?.career.onetCode ?? null,
        // matchScore is still persisted internally for ranking — we just
        // never display it as a percentage in the UI.
        matchScore: typeof conf === "number" ? Math.round(conf) : 0,
        education: career.education ?? null,
        growth: career.growthOutlook ?? null,
        matchReasons: passed?.matchDetails?.matchReasons ?? null,
        skillsGap: passed?.matchDetails?.missingSkills ?? null,
        standOutTips: passed?.matchDetails?.standOutTips ?? null,
      });
    },
    onSuccess: (result) => {
      if (result?.duplicate) {
        Alert.alert("Already in your plan", "This career is already saved.");
      } else {
        Alert.alert("Saved", "Added to your plan.");
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

  if (!passed && fallbackQ.isLoading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScreenHeader title="Career" showBack />
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (!career) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScreenHeader title="Career" showBack />
        <View style={[styles.center, { flex: 1, padding: 20 }]}>
          <EmptyState
            icon="alert-circle"
            title="Career not found"
            message="This career may no longer be available. Try going back and choosing another."
          />
        </View>
      </SafeAreaView>
    );
  }

  const salary =
    typeof career.averageSalary === "number" && career.averageSalary > 0
      ? `$${career.averageSalary.toLocaleString()}`
      : null;
  const outlook = career.growthOutlook || career.outlook || career.growth || null;
  const skills = career.skills ?? career.requiredSkills ?? [];
  const education = career.education || career.educationRequirements || null;
  const industries = career.industries ?? [];
  const responsibilities = career.responsibilities ?? [];

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenHeader title="Career" showBack />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
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
      <View>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT, fontWeight: "700",
            fontSize: 26,
            letterSpacing: -0.4,
          }}
        >
          {career.title}
        </Text>
        {career.description ? (
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: SYSTEM_FONT, fontWeight: "400",
              fontSize: 14,
              lineHeight: 21,
              marginTop: 8,
            }}
          >
            {career.description}
          </Text>
        ) : null}
        <MatchReasonChips reasons={matchReasons} />
      </View>

      {(salary || outlook || market?.demandLevel) ? (
        <View style={styles.statRow}>
          {salary ? (
            <Stat icon="dollar-sign" label="Median wage" value={salary} />
          ) : null}
          {outlook ? <Stat icon="trending-up" label="Outlook" value={outlook} /> : null}
          {market?.demandLevel ? (
            <Stat icon="activity" label="Demand" value={market.demandLevel} />
          ) : null}
        </View>
      ) : null}

      <PrimaryButton
        label={alreadyInPlan || saveM.isSuccess ? "Saved to your plan" : "Save to my plan"}
        onPress={() => saveM.mutate()}
        loading={saveM.isPending}
        disabled={alreadyInPlan || saveM.isSuccess}
      />

      {alreadyInPlan ? (
        <SavedNoteCard
          note={savedNote}
          onEdit={openNoteEditor}
          disabled={updateNoteM.isPending}
        />
      ) : null}

      {alreadyInPlan ? (
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
      ) : null}

      {skills.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Key skills
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {skills.map((s) => (
              <View
                key={s}
                style={{
                  backgroundColor: colors.accent,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: SYSTEM_FONT, fontWeight: "500",
                    fontSize: 12,
                  }}
                >
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {matchDetails?.matchReasons?.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Why this is a fit
          </Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            {matchDetails.matchReasons.map((r, i) => (
              <Bullet key={i} text={r} colors={colors} />
            ))}
          </View>
        </Card>
      ) : null}

      {matchDetails?.missingSkills?.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Skills to grow
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: SYSTEM_FONT, fontWeight: "400",
              fontSize: 13,
              marginTop: 4,
              marginBottom: 8,
              lineHeight: 19,
            }}
          >
            Building these will strengthen your match.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {matchDetails.missingSkills.map((s) => (
              <View
                key={s}
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: SYSTEM_FONT, fontWeight: "500",
                    fontSize: 12,
                  }}
                >
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {education ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Education
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: SYSTEM_FONT, fontWeight: "400",
              fontSize: 14,
              lineHeight: 21,
              marginTop: 6,
            }}
          >
            {education}
          </Text>
        </Card>
      ) : null}

      {industries.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Industries
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {industries.map((s) => (
              <View
                key={s}
                style={{
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: "500",
                    fontSize: 12,
                  }}
                >
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {responsibilities.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Responsibilities
          </Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            {responsibilities.map((r, i) => (
              <Bullet key={i} text={r} colors={colors} />
            ))}
          </View>
        </Card>
      ) : null}

      {matchDetails?.standOutTips?.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            How to stand out
          </Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            {matchDetails.standOutTips.map((r, i) => (
              <Bullet key={i} text={r} colors={colors} />
            ))}
          </View>
        </Card>
      ) : null}
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
          // always have a payload-equivalent (previous notes).
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

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Feather name={icon} size={16} color={colors.primary} />
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: SYSTEM_FONT, fontWeight: "500",
          fontSize: 11,
          marginTop: 6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "700",
          fontSize: 14,
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Bullet({
  text,
  colors,
}: {
  text: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.primary,
          marginTop: 7,
        }}
      />
      <Text
        style={{
          flex: 1,
          color: colors.foreground,
          fontFamily: SYSTEM_FONT, fontWeight: "400",
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// Same compact pill row used on the Careers tab list cards (see
// `(tabs)/careers.tsx#MatchReasonChips`) so the detail screen header feels
// consistent with the list. Renders nothing when there are no reasons.
function MatchReasonChips({ reasons }: { reasons: string[] | null | undefined }) {
  const colors = useColors();
  if (!reasons || reasons.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {reasons.map((reason, idx) => (
        <View
          key={`${idx}-${reason}`}
          style={[
            styles.reasonChip,
            { backgroundColor: colors.accent, borderColor: colors.border },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.reasonChipText, { color: colors.primary }]}
          >
            {reason}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, padding: 12, borderWidth: 1 },
  sectionTitle: {
    fontFamily: SYSTEM_FONT, fontWeight: "700",
    fontSize: 15,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  reasonChip: {
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reasonChipText: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
});
