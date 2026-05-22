import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  isCollegePriority,
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
import { confirmRemoveFromPlan, safeOpenUrl } from "@/lib/utils";
import { SYSTEM_FONT } from "@/lib/typography";

type SavedCollegeRow = {
  id?: number | string;
  collegeId?: number | string;
  notes?: string | null;
  priority?: string | null;
  [k: string]: unknown;
};

type SavedItemsForCollegeNote = {
  colleges?: SavedCollegeRow[];
};

// Subset of /api/profile/college-recommendations response — we only need each
// entry's college id (to find this college) and its matchReasons so the
// detail screen can show the same "why this matched" chips the list cards on
// the Colleges tab already render.
type CollegeRecsResponse = {
  colleges?: Array<{
    college?: { id?: number | string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

// Mirrors the helper used on the list cards (see `(tabs)/index.tsx` and
// `(tabs)/careers.tsx`): trim, drop blanks, cap to a couple of short pills
// so the detail header stays scannable.
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

type CollegeDetail = {
  id: string | number;
  name: string;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  type?: string | null;
  website?: string | null;
  school_url?: string | null;
  studentSize?: number | null;
  tuition?: number | null;
  tuitionInState?: number | null;
  tuitionOutState?: number | null;
  tuitionOutOfState?: number | null;
  admissionRate?: number | null;
  acceptanceRate?: number | null;
  graduationRate?: number | null;
  rating?: number | null;
  satAvg?: number | null;
  satLow?: number | null;
  satHigh?: number | null;
  imageUrl?: string | null;
  sportsPrograms?: string[] | null;
  scholarships?: string[] | null;
  walkOnAvailable?: boolean | null;
  academicLevel?: string | null;
  coachName?: string | null;
  coachEmail?: string | null;
  coachPhone?: string | null;
  programs?: string[] | null;
  popularPrograms?: string[] | null;
  description?: string | null;
};

function normalizeUrl(u?: string | null): string | null {
  if (!u || typeof u !== "string") return null;
  const trimmed = u.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function fmtMoney(v?: number | null) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return `$${v.toLocaleString()}`;
}

function fmtPct(v?: number | null) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  const pct = v <= 1 ? v * 100 : v;
  return `${pct.toFixed(0)}%`;
}

export default function CollegeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<CollegeDetail | null>({
    queryKey: ["/api/colleges", id],
    queryFn: async () => {
      try {
        return await apiRequest<CollegeDetail>(
          "GET",
          `/api/colleges/${encodeURIComponent(String(id))}`,
        );
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  // Pull the user's personalized college matches so we can show the same
  // "why this matched" chips the Colleges tab list cards already render.
  // Allowed to fail quietly (signed-out users get null) — when there's no
  // match we just hide the chip row.
  const recsQ = useQuery<CollegeRecsResponse | null>({
    queryKey: ["/api/profile/college-recommendations"],
    queryFn: async () =>
      apiGet<CollegeRecsResponse | null>(
        "/api/profile/college-recommendations",
        { allowUnauthorized: true },
      ),
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        recsQ.refetch(),
        qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, recsQ, qc, user?.id]);

  const savedItemsQ = useQuery<SavedItemsForCollegeNote | null>({
    queryKey: ["/api/saved-items", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return await apiGet<SavedItemsForCollegeNote | null>(
        `/api/saved-items/${encodeURIComponent(user.id)}`,
        { allowUnauthorized: true },
      );
    },
    enabled: !!user?.id,
  });

  // Find this college in the recommendations payload (ids may arrive as
  // numbers from live responses or strings from cached ones, so normalize)
  // and pull its matchReasons to drive the chips. Mirrors the same dual-key
  // approach the web college-detail page uses so the two surfaces stay
  // consistent.
  const matchReasons = useMemo<string[]>(() => {
    if (id == null) return [];
    const target = String(id);
    for (const entry of recsQ.data?.colleges ?? []) {
      const entryId = entry.college?.id;
      if (entryId == null) continue;
      if (String(entryId) === target) {
        return pickMatchReasons(entry.matchReasons);
      }
    }
    return [];
  }, [recsQ.data, id]);

  const collegeIdStr = String(id ?? "").trim();
  const savedCollegeRow: SavedCollegeRow | null = React.useMemo(() => {
    if (!collegeIdStr || !Array.isArray(savedItemsQ.data?.colleges)) return null;
    return (
      savedItemsQ.data!.colleges!.find((row) => {
        const candidate = row.collegeId ?? row.id;
        return candidate !== undefined && String(candidate) === collegeIdStr;
      }) ?? null
    );
  }, [collegeIdStr, savedItemsQ.data]);

  const savedNote = normalizeNotes(savedCollegeRow?.notes);
  // Reflect the saved state on screen load so the Save button doesn't
  // confusingly invite the user to re-save an item that's already in their
  // plan. `saveM.isSuccess` (used at the JSX call site) also keeps the
  // button in the saved state immediately after a tap, before the
  // saved-items query has refetched.
  const alreadyInPlan = !!savedCollegeRow;
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // Mirrors saved.tsx: a 5s undo snackbar after a successful edit OR
  // remove. Edits re-PATCH the row to its previous notes/priority; removes
  // re-POST a saved-colleges row using the captured payload so the user
  // gets the same priority/notes back in one tap.
  type PendingUndo =
    | {
        kind: "edit";
        key: number;
        label: string;
        rowId: number;
        previous: {
          notes: string | null;
          priority: "high" | "medium" | "low" | null;
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
      if (target.kind !== "college") return;
      const notesValue = normalizeNotes(target.notes);
      await apiRequest("PATCH", `/api/saved-colleges/${target.rowId}`, {
        notes: notesValue,
        priority: target.priority,
      });
    },
    onSuccess: (_data, target) => {
      setEditTarget(null);
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      if (target.kind !== "college") return;
      // Suppress the snackbar when nothing actually changed (matches the
      // My Plan behavior).
      const newNotes = normalizeNotes(target.notes);
      const changed =
        newNotes !== target.originalNotes ||
        target.priority !== target.originalPriority;
      if (!changed) return;
      setPendingUndo({
        kind: "edit",
        key: Date.now(),
        label: target.label,
        rowId: target.rowId,
        previous: {
          notes: target.originalNotes,
          priority: target.originalPriority,
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
        // Re-create the saved-colleges row using the payload captured at
        // remove time so notes/priority stay intact on undo. Caller must
        // ensure undo is not invoked when payload is null (Snackbar
        // already hides the action button in that case).
        if (!undo.payload) return;
        await apiRequest("POST", "/api/saved-colleges", undo.payload);
      } else {
        await apiRequest("PATCH", `/api/saved-colleges/${undo.rowId}`, {
          notes: undo.previous.notes,
          priority: undo.previous.priority,
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
    if (!savedCollegeRow) return;
    const rawId = savedCollegeRow.id;
    const rowId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(rowId)) return;
    const originalNotes = normalizeNotes(savedCollegeRow.notes);
    const originalPriority = isCollegePriority(savedCollegeRow.priority)
      ? savedCollegeRow.priority
      : null;
    setEditTarget({
      kind: "college",
      rowId,
      label: data?.name ?? "College",
      notes: typeof savedCollegeRow.notes === "string" ? savedCollegeRow.notes : "",
      priority: originalPriority ?? "medium",
      originalNotes,
      originalPriority,
    });
  };

  // Removes the saved-colleges row directly from the detail screen so a
  // user viewing a college they already saved doesn't have to back out to
  // the Saved tab to take it off their plan. Mirrors the DELETE the
  // saved.tsx list view uses (`/api/saved-colleges/:id`).
  const removeM = useMutation({
    mutationFn: async (vars: {
      label: string;
      recreatePayload: Record<string, unknown> | null;
    }) => {
      const rawId = savedCollegeRow?.id;
      const rowId = typeof rawId === "number" ? rawId : Number(rawId);
      if (!Number.isFinite(rowId)) {
        throw new Error("This item can't be removed right now.");
      }
      await apiRequest("DELETE", `/api/saved-colleges/${rowId}`);
      return vars;
    },
    onSuccess: (_data, variables) => {
      // Refetch saved-items so `alreadyInPlan` flips to false and the
      // Save button reappears in place of the Remove button.
      void qc.invalidateQueries({ queryKey: ["/api/saved-items", user?.id] });
      // Mirrors the My Plan list: a 5s undo snackbar so an accidental
      // Remove tap can be reversed without losing the saved priority/notes.
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
    const rawId = savedCollegeRow?.id;
    const rowId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(rowId)) return;
    if (!user?.id) return;
    const label = data?.name ?? "this college";
    // Capture the saved-colleges shape at remove time so the undo
    // snackbar can re-POST the same row with its previous priority/notes.
    // Shared with the web Save button, the web My Plan list, and the
    // mobile My Plan list via @workspace/saved-recreate so all four
    // surfaces stay in lock-step.
    // The DELETE proceeds even when the helper can't rebuild the row
    // (e.g. legacy saved-row missing collegeId); Undo is just suppressed
    // in the snackbar, mirroring the web My Plan toast.
    const recreatePayload = buildSavedRowRecreatePayload(
      "college",
      savedCollegeRow ?? {},
      user.id,
      { collegeId: Number(id) },
    );
    confirmRemoveFromPlan(label, !!savedNote, () =>
      removeM.mutate({ label, recreatePayload }),
    );
  };

  const saveM = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You need to be signed in to save items.");
      const collegeId = Number(id);
      if (!Number.isFinite(collegeId)) {
        throw new Error("This college can't be saved (invalid id).");
      }
      return await apiRequest<{ duplicate?: boolean }>("POST", "/api/saved-colleges", {
        userId: user.id,
        collegeId,
      });
    },
    onSuccess: (result) => {
      if (result?.duplicate) {
        Alert.alert("Already in your plan", "This college is already saved.");
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

  if (isLoading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScreenHeader title="College" showBack />
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
        <ScreenHeader title="College" showBack />
        <View style={[styles.center, { flex: 1, padding: 20 }]}>
          <EmptyState
            icon="alert-circle"
            title="College not found"
            message="This college may no longer be in our index."
          />
        </View>
      </SafeAreaView>
    );
  }

  const stats: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; value: string }[] = [];
  const tuition = fmtMoney(data.tuition);
  const inState = fmtMoney(data.tuitionInState);
  const outState = fmtMoney(data.tuitionOutState ?? data.tuitionOutOfState);
  const admit = fmtPct(data.admissionRate ?? data.acceptanceRate);
  const grad = fmtPct(data.graduationRate);
  const website = normalizeUrl(data.website ?? data.school_url);
  const programs = data.programs ?? data.popularPrograms ?? [];
  const sports = data.sportsPrograms ?? [];
  const schols = data.scholarships ?? [];
  const locationLine =
    data.location ||
    [data.city, data.state].filter(Boolean).join(", ") ||
    data.country ||
    "United States";
  const ratingNum =
    typeof data.rating === "number" && Number.isFinite(data.rating)
      ? Math.max(0, Math.min(5, data.rating))
      : null;
  const satRange =
    data.satLow && data.satHigh
      ? `${data.satLow}–${data.satHigh}`
      : data.satAvg
      ? `${data.satAvg} avg`
      : null;
  if (tuition) stats.push({ icon: "dollar-sign", label: "Annual tuition", value: tuition });
  if (inState) stats.push({ icon: "dollar-sign", label: "In-state tuition", value: inState });
  if (outState) stats.push({ icon: "dollar-sign", label: "Out-of-state", value: outState });
  if (admit) stats.push({ icon: "percent", label: "Acceptance rate", value: admit });
  if (grad) stats.push({ icon: "award", label: "Graduation rate", value: grad });
  if (satRange) stats.push({ icon: "edit-3", label: "SAT score", value: satRange });
  if (data.studentSize) {
    stats.push({
      icon: "users",
      label: "Students",
      value: data.studentSize.toLocaleString(),
    });
  }
  if (data.academicLevel) {
    const lvl = data.academicLevel;
    stats.push({
      icon: "book-open",
      label: "Academics",
      value: lvl.charAt(0).toUpperCase() + lvl.slice(1),
    });
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScreenHeader title="College" showBack />
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
      {data.imageUrl ? (
        <Image
          source={{ uri: data.imageUrl }}
          style={{
            width: "100%",
            height: 180,
            borderRadius: colors.radius,
            backgroundColor: colors.muted,
          }}
          resizeMode="cover"
        />
      ) : null}

      <View>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT, fontWeight: "700",
            fontSize: 26,
            letterSpacing: -0.4,
          }}
        >
          {data.name}
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: SYSTEM_FONT, fontWeight: "400",
            fontSize: 14,
            marginTop: 6,
          }}
        >
          {locationLine}
          {data.type
            ? `  ·  ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}`
            : ""}
        </Text>
        {ratingNum !== null ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Feather
                key={i}
                name="star"
                size={14}
                color={i < Math.round(ratingNum) ? "#F59E0B" : colors.border}
              />
            ))}
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "500",
                fontSize: 12,
                marginLeft: 4,
              }}
            >
              {ratingNum.toFixed(1)} rating
            </Text>
          </View>
        ) : null}
        <MatchReasonChips reasons={matchReasons} />
      </View>

      {stats.length > 0 ? (
        <View style={styles.grid}>
          {stats.map((s) => (
            <View
              key={s.label}
              style={[
                styles.stat,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name={s.icon} size={16} color={colors.primary} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "500",
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                {s.label}
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: SYSTEM_FONT, fontWeight: "700",
                  fontSize: 15,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Card>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT, fontWeight: "600",
            fontSize: 15,
            marginBottom: 6,
          }}
        >
          About
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: SYSTEM_FONT, fontWeight: "400",
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          {data.description ||
            "Data sourced from the U.S. Department of Education's College Scorecard. Save this college to your plan to compare programs, scholarships, and fit at a glance."}
        </Text>
      </Card>

      {programs.length > 0 ? (
        <Card>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: SYSTEM_FONT, fontWeight: "600",
              fontSize: 15,
              marginBottom: 8,
            }}
          >
            Popular programs
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {programs.slice(0, 12).map((p) => (
              <View
                key={p}
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
                  {p}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {sports.length > 0 ? (
        <Card>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: SYSTEM_FONT, fontWeight: "600",
              fontSize: 15,
              marginBottom: 8,
            }}
          >
            Athletics
            {data.walkOnAvailable ? "  ·  Walk-on opportunities" : ""}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {sports.slice(0, 12).map((s) => (
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

      {schols.length > 0 ? (
        <Card>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: SYSTEM_FONT, fontWeight: "600",
              fontSize: 15,
              marginBottom: 8,
            }}
          >
            Available scholarships
          </Text>
          {schols.slice(0, 8).map((s) => (
            <View
              key={s}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                paddingVertical: 4,
              }}
            >
              <Feather
                name="award"
                size={14}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: SYSTEM_FONT, fontWeight: "400",
                  fontSize: 13,
                  flex: 1,
                }}
              >
                {s}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {data.coachName || data.coachEmail || data.coachPhone ? (
        <Card>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: SYSTEM_FONT, fontWeight: "600",
              fontSize: 15,
              marginBottom: 6,
            }}
          >
            Recruiting contact
          </Text>
          {data.coachName ? (
            <Text
              style={{
                color: colors.foreground,
                fontFamily: SYSTEM_FONT, fontWeight: "500",
                fontSize: 13,
              }}
            >
              {data.coachName}
            </Text>
          ) : null}
          {data.coachEmail ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {data.coachEmail}
            </Text>
          ) : null}
          {data.coachPhone ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "400",
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {data.coachPhone}
            </Text>
          ) : null}
        </Card>
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

      {website ? (
        <PrimaryButton
          label="Visit school website"
          variant="secondary"
          onPress={() => void safeOpenUrl(website)}
        />
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
          // always have a payload-equivalent (previous notes/priority).
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

// Same compact pill row used on the Colleges tab list cards (see
// `(tabs)/index.tsx#MatchReasonChips`) so the detail screen header feels
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stat: {
    width: "47%",
    flexGrow: 1,
    minWidth: 140,
    padding: 12,
    borderWidth: 1,
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
