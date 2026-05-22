import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { SavedBadge } from "@/components/SavedBadge";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useRefreshSet } from "@/hooks/useAutoRefreshOnFocus";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatValue, isScholarshipOpen } from "@/lib/utils";
import { SYSTEM_FONT } from "@/lib/typography";

type Scholarship = {
  id: number;
  name: string;
  provider?: string | null;
  type?: string | null;
  amount?: number | null;
  awardMin?: number | null;
  awardMax?: number | null;
  deadline?: string | null;
  deadlineAt?: string | null;
  description?: string | null;
  state?: string | null;
  renewable?: boolean | null;
  website?: string | null;
  url?: string | null;
};

type SortKey = "default" | "amount" | "deadline";

// Canonical key for matching scholarship names that vary by punctuation
// or year suffix (e.g. "Foo Scholarship" vs "Foo Scholarship 2024-2025").
// Mirrors `canonicalScholarshipKey` on web (use-saved-items.ts).
function canonicalScholarshipKey(value: string | null | undefined): string {
  let s = (value ?? "").toLowerCase();
  s = s.replace(/\b(19|20)\d{2}\s*[-–—\/]\s*(?:(19|20)?\d{2})\b/g, " ");
  s = s.replace(/\b(19|20)\d{2}\b/g, " ");
  s = s.replace(/[^a-z0-9]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

// Shape returned by /api/profile/scholarship-recommendations — we only need
// the name (to key by) and the precomputed match reasons.
type ScholarshipRecsResponse = {
  recommendations?: Array<{
    scholarship?: { name?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

// /api/saved-items shape (subset). Only the scholarships list is used to
// drive the "Saved" badge on each list card.
type SavedScholarshipRow = {
  scholarshipId?: number | string | null;
  id?: number | string | null;
  scholarshipName?: string | null;
  name?: string | null;
};
type SavedItemsResponse = {
  scholarships?: SavedScholarshipRow[];
};

// Mirrors the home screen helper: trim, dedupe blanks, and cap to a couple
// short pills so cards stay scannable.
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

const TYPE_FILTERS = [
  "all",
  "need-based",
  "merit-based",
  "service-based",
  "athletic",
] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  "need-based": "Need-based",
  "merit-based": "Merit",
  "service-based": "Service",
  athletic: "Athletic",
};

function formatAmount(item: Scholarship): string | null {
  const lo = item.awardMin ?? null;
  const hi = item.awardMax ?? null;
  if (lo && hi && lo !== hi) {
    return `$${lo.toLocaleString()} – $${hi.toLocaleString()}`;
  }
  const a = item.amount ?? hi ?? lo;
  if (typeof a === "number" && Number.isFinite(a) && a > 0) {
    return `$${a.toLocaleString()}`;
  }
  return null;
}

function deadlineDate(item: Scholarship): Date | null {
  const raw = item.deadlineAt ?? item.deadline ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDeadline(item: Scholarship): string | null {
  const raw = item.deadlineAt ?? item.deadline ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return typeof raw === "string" ? raw : null;
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function deadlineUrgency(item: Scholarship): "expired" | "urgent" | "soon" | "ok" | null {
  const d = deadlineDate(item);
  if (!d) return null;
  const days = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= 14) return "urgent";
  if (days <= 45) return "soon";
  return "ok";
}

export default function ScholarshipsTab() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [matchedOnly, setMatchedOnly] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<
    Scholarship[]
  >({
    queryKey: ["/api/scholarships"],
    queryFn: async () => {
      const res = await apiRequest<unknown>("GET", "/api/scholarships");
      if (Array.isArray(res)) return res as Scholarship[];
      if (res && typeof res === "object") {
        const obj = res as Record<string, unknown>;
        if (Array.isArray(obj.scholarships)) return obj.scholarships as Scholarship[];
        if (Array.isArray(obj.results)) return obj.results as Scholarship[];
      }
      return [];
    },
  });

  // Pull the personalized match reasons from the smart matcher so we can show
  // the same compact "why this matches you" chips that appear on the home
  // screen. Allowed to fail quietly (e.g. signed-out users) — the list still
  // works, just without per-card chips.
  const recsQ = useQuery<ScholarshipRecsResponse | null>({
    queryKey: ["/api/profile/scholarship-recommendations"],
    queryFn: async () =>
      apiGet<ScholarshipRecsResponse | null>(
        "/api/profile/scholarship-recommendations",
        { allowUnauthorized: true },
      ),
  });

  // Build a lookup from scholarship name → top reasons. The recommendations
  // endpoint doesn't echo a DB id (it serves both DB rows and curated picks),
  // so we key on a normalized name and accept the rare cross-match risk.
  const reasonsByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of recsQ.data?.recommendations ?? []) {
      const name = entry.scholarship?.name?.trim().toLowerCase();
      if (!name) continue;
      const reasons = pickMatchReasons(entry.matchReasons);
      if (reasons.length > 0) map.set(name, reasons);
    }
    return map;
  }, [recsQ.data]);

  // Pull the saved-items list so each scholarship card can show a "Saved"
  // badge when the row is already in the user's plan. Mirrors the same
  // query used by the detail screen so the badge stays in sync after any
  // add/remove (cache invalidation already happens there).
  const savedItemsQ = useQuery<SavedItemsResponse | null>({
    queryKey: ["/api/saved-items", user?.id],
    queryFn: async () =>
      user?.id
        ? apiGet<SavedItemsResponse | null>(
            `/api/saved-items/${encodeURIComponent(user.id)}`,
            { allowUnauthorized: true },
          )
        : null,
    enabled: !!user?.id,
  });

  // Saved scholarship lookup keys: id (preferred — stable PK) plus name
  // (fallback for curated/hardcoded picks the matcher emits without an id).
  const savedScholarshipKeys = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const row of savedItemsQ.data?.scholarships ?? []) {
      const id = row.scholarshipId ?? row.id;
      if (id != null) ids.add(String(id));
      // Index both the simple lowercase name (matches existing call sites)
      // and the canonical key (so cosmetic differences like year suffixes
      // still flag the row as saved on this list page).
      const raw = (row.scholarshipName ?? row.name ?? "").trim();
      const simple = raw.toLowerCase();
      if (simple) names.add(simple);
      const canonical = canonicalScholarshipKey(raw);
      if (canonical) names.add(canonical);
    }
    return { ids, names };
  }, [savedItemsQ.data]);

  // Whether the user has any personalized scholarship matches at all. The
  // "Matched to me" toggle only makes sense when there's at least one match
  // to filter down to (signed-out users typically have none).
  const hasMatches = reasonsByName.size > 0;

  // If the user enabled the "Matched to me" filter and then matches go away
  // (e.g. signing out), turn it back off so the list isn't stuck empty.
  useEffect(() => {
    if (matchedOnly && !hasMatches) setMatchedOnly(false);
  }, [matchedOnly, hasMatches]);

  // Refetch everything that drives the visible list: the scholarships list,
  // the personalized scholarship recs (drives match-reason chips and the
  // "Matched to me" toggle), and the saved-items lookup (drives the Saved
  // badge).
  const refetchAll = useCallback(async () => {
    await Promise.all([refetch(), recsQ.refetch(), savedItemsQ.refetch()]);
  }, [refetch, recsQ, savedItemsQ]);

  // Silently re-pull when the tab regains focus or the app comes back from
  // background, so saves/unsaves and profile edits made on the web show up
  // without requiring a manual pull. The helper also owns the manual
  // pull-to-refresh handler — it stamps the dedupe window after the refetch
  // resolves so a focus/app-active event right after a pull can't trigger
  // an extra silent refetch within the threshold.
  const { refresh: onManualRefresh } = useRefreshSet(refetchAll);

  const filtered = useMemo(() => {
    const list = (data ?? []).filter(
      (s) => s && s.id != null && s.name && isScholarshipOpen(s),
    );
    const q = search.trim().toLowerCase();

    let result = list.filter((s) => {
      if (matchedOnly && hasMatches) {
        const key = s.name?.trim().toLowerCase() ?? "";
        if (!reasonsByName.has(key)) return false;
      }
      if (typeFilter !== "all") {
        if (!s.type || !s.type.toLowerCase().includes(typeFilter)) return false;
      }
      if (q) {
        const hay = `${s.name ?? ""} ${s.provider ?? ""} ${s.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortKey === "amount") {
      result = [...result].sort((a, b) => {
        const av = a.awardMax ?? a.amount ?? a.awardMin ?? 0;
        const bv = b.awardMax ?? b.amount ?? b.awardMin ?? 0;
        return (bv ?? 0) - (av ?? 0);
      });
    } else if (sortKey === "deadline") {
      result = [...result].sort((a, b) => {
        const ad = deadlineDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
        const bd = deadlineDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });
    }
    return result;
  }, [data, search, typeFilter, sortKey, matchedOnly, hasMatches, reasonsByName]);

  const totalCount = data?.length ?? 0;
  const visibleCount = filtered.length;
  const filtersActive = Boolean(search) || typeFilter !== "all" || matchedOnly;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <ScreenHeader
        title="Scholarships"
        subtitle="Funding matched to your goals"
      />

      <View style={styles.controls}>
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, provider, keyword"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.searchInput,
              { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "400" },
            ]}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}
        >
          {hasMatches ? (
            <Pressable
              onPress={() => setMatchedOnly((v) => !v)}
              style={({ pressed }) => [
                styles.filterChip,
                styles.matchedChip,
                {
                  backgroundColor: matchedOnly ? colors.primary : colors.muted,
                  borderColor: matchedOnly ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: matchedOnly }}
              accessibilityLabel="Filter to scholarships matched to me"
            >
              <Feather
                name="star"
                size={12}
                color={matchedOnly ? "#FFFFFF" : colors.primary}
              />
              <Text
                style={{
                  color: matchedOnly ? "#FFFFFF" : colors.foreground,
                  fontFamily: SYSTEM_FONT,
                  fontWeight: matchedOnly ? "600" : "500",
                  fontSize: 13,
                }}
              >
                Matched to me
              </Text>
            </Pressable>
          ) : null}
          {(TYPE_FILTERS as readonly TypeFilter[]).map((item) => {
            const active = typeFilter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setTypeFilter(item)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? "#FFFFFF" : colors.foreground,
                    fontFamily: SYSTEM_FONT, fontWeight: active ? "600" : "500",
                    fontSize: 13,
                  }}
                >
                  {TYPE_LABELS[item]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sortRow}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: SYSTEM_FONT, fontWeight: "500",
              fontSize: 12,
            }}
          >
            {isLoading
              ? "Loading…"
              : `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()} scholarships`}
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["default", "amount", "deadline"] as SortKey[]).map((k) => {
              const active = sortKey === k;
              const label =
                k === "default" ? "Best" : k === "amount" ? "$" : "Deadline";
              return (
                <Pressable
                  key={k}
                  onPress={() => setSortKey(k)}
                  style={({ pressed }) => [
                    styles.sortChip,
                    {
                      backgroundColor: active ? colors.primary : "transparent",
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? "#FFFFFF" : colors.mutedForeground,
                      fontFamily: SYSTEM_FONT, fontWeight: "600",
                      fontSize: 11,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState
            icon="alert-circle"
            title="Couldn't load scholarships"
            message="Pull to refresh and try again."
          />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon="search"
            title={filtersActive ? "No matches" : "No scholarships yet"}
            message={
              filtersActive
                ? "Try clearing filters or a different search."
                : "New opportunities will appear here."
            }
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshing={isRefetching}
          onRefresh={() => void onManualRefresh()}
          renderItem={({ item }) => {
            const nameKey = item.name?.trim().toLowerCase() ?? "";
            // Use the canonical key for the saved lookup so year/punctuation
            // variants between the curated list and the saved row still
            // flag the card as saved. `reasonsByName` keeps the simple
            // lowercase key it was built with elsewhere.
            const savedNameKey = canonicalScholarshipKey(item.name);
            const isSaved =
              savedScholarshipKeys.ids.has(String(item.id)) ||
              (savedNameKey.length > 0 &&
                savedScholarshipKeys.names.has(savedNameKey));
            return (
              <ScholarshipCard
                item={item}
                matchReasons={reasonsByName.get(nameKey) ?? null}
                isSaved={isSaved}
                onPress={() =>
                  router.push({
                    pathname: "/scholarship/[id]",
                    params: { id: String(item.id) },
                  })
                }
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ScholarshipCard({
  item,
  matchReasons,
  isSaved,
  onPress,
}: {
  item: Scholarship;
  matchReasons: string[] | null;
  isSaved: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const amt = formatAmount(item);
  const dl = formatDeadline(item);
  const urgency = deadlineUrgency(item);

  const urgencyColor =
    urgency === "expired"
      ? "#9CA3AF"
      : urgency === "urgent"
      ? "#F43F5E"
      : urgency === "soon"
      ? "#F59E0B"
      : "#10B981";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: colors.radius + 6,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
        },
        pressed ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null,
      ]}
    >
      <View style={styles.cardBody}>
        <View style={styles.amountRow}>
          <View
            style={[
              styles.amountIconWrap,
              { backgroundColor: colors.accent },
            ]}
          >
            <Feather name="award" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.amountLabel,
                { color: colors.mutedForeground },
              ]}
            >
              Award
            </Text>
            <Text
              style={[styles.amountText, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {amt ?? "Variable"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {item.renewable ? (
              <View
                style={[
                  styles.renewable,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather name="refresh-cw" size={10} color={colors.primary} />
                <Text style={[styles.renewableText, { color: colors.primary }]}>
                  Renewable
                </Text>
              </View>
            ) : null}
            {isSaved ? <SavedBadge /> : null}
          </View>
        </View>

        <Text
          style={{
            color: colors.foreground,
            fontFamily: SYSTEM_FONT,
            fontWeight: "700",
            fontSize: 15,
            lineHeight: 20,
            marginTop: 12,
          }}
          numberOfLines={2}
        >
          {formatValue(item.name, { fallback: "Scholarship" })}
        </Text>

        <MatchReasonChips reasons={matchReasons} />

        {item.provider != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Feather name="briefcase" size={11} color={colors.mutedForeground} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: SYSTEM_FONT, fontWeight: "500",
                fontSize: 12,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {formatValue(item.provider, { fallback: "" })}
            </Text>
          </View>
        ) : null}

        {item.description != null ? (
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: SYSTEM_FONT, fontWeight: "400",
              fontSize: 12,
              lineHeight: 17,
              marginTop: 8,
            }}
            numberOfLines={2}
          >
            {formatValue(item.description, { fallback: "" })}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {dl ? (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: urgencyColor + "1A", borderColor: urgencyColor + "55" },
              ]}
            >
              <Feather name="calendar" size={10} color={urgencyColor} />
              <Text
                style={{
                  color: urgencyColor,
                  fontFamily: SYSTEM_FONT, fontWeight: "600",
                  fontSize: 11,
                }}
              >
                {urgency === "expired" ? "Closed" : dl}
              </Text>
            </View>
          ) : null}
          {item.type ? (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Feather name="tag" size={10} color={colors.mutedForeground} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "500",
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                {item.type}
              </Text>
            </View>
          ) : null}
          {item.state ? (
            <View
              style={[
                styles.metaPill,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Feather name="map-pin" size={10} color={colors.mutedForeground} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: SYSTEM_FONT, fontWeight: "500",
                  fontSize: 11,
                }}
              >
                {item.state}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  controls: { paddingTop: 4 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  matchedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 4 },
  card: { overflow: "hidden" },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  amountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  amountLabel: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "500",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  amountText: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "700",
    fontSize: 18,
    marginTop: 2,
  },
  renewable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  renewableText: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    fontSize: 10,
  },
  cardBody: {
    padding: 14,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
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
