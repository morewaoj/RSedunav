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

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SavedBadge } from "@/components/SavedBadge";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useRefreshSet } from "@/hooks/useAutoRefreshOnFocus";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SYSTEM_FONT } from "@/lib/typography";

type College = {
  id: string | number;
  name: string;
  city?: string | null;
  state?: string | null;
  type?: string | null;
  studentSize?: number | null;
  tuitionInState?: number | null;
  tuitionOutState?: number | null;
  tuitionOutOfState?: number | null;
};

// Shape returned by /api/profile/college-recommendations — we only need the
// id (to key by) so we can hide everything else when the user toggles on the
// "Matched to me" filter chip. Matches the saved tab's CollegeRecsResponse.
type CollegeRecsResponse = {
  colleges?: Array<{
    college?: { id?: number | string | null } | null;
  }>;
};

// /api/saved-items shape (subset). Only the colleges list is used here, and
// only the id fields needed to mark a row as already saved.
type SavedCollegeRow = {
  collegeId?: number | string | null;
  id?: number | string | null;
};
type SavedItemsResponse = {
  colleges?: SavedCollegeRow[];
};

function useDebounced<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function CollegesTab() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [matchedOnly, setMatchedOnly] = useState(false);
  const debounced = useDebounced(query.trim(), 400);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<
    College[]
  >({
    queryKey: ["/api/colleges/search", debounced],
    queryFn: async () => {
      const q = debounced || "university";
      const res = await apiRequest<unknown>(
        "GET",
        `/api/colleges/search?q=${encodeURIComponent(q)}&limit=40`,
      );
      if (Array.isArray(res)) return res as College[];
      if (res && typeof res === "object") {
        const obj = res as Record<string, unknown>;
        // Backend returns { data, pageInfo } from /api/colleges/search
        if (Array.isArray(obj.data)) return obj.data as College[];
        if (Array.isArray(obj.colleges)) return obj.colleges as College[];
        if (Array.isArray(obj.results)) return obj.results as College[];
      }
      return [];
    },
  });

  // Pull the user's personalized college matches so we can offer the same
  // "Matched to me" toggle the Scholarships tab has. Allowed to fail quietly
  // (e.g. signed-out users) — the list still works, just without the chip.
  const recsQ = useQuery<CollegeRecsResponse | null>({
    queryKey: ["/api/profile/college-recommendations"],
    queryFn: async () =>
      apiGet<CollegeRecsResponse | null>(
        "/api/profile/college-recommendations",
        { allowUnauthorized: true },
      ),
  });

  // Build a Set of recommended college ids. Ids may arrive as numbers from
  // the live backend or strings from demo data, so we normalize to strings
  // for stable lookups.
  const recommendedIds = useMemo(() => {
    const set = new Set<string>();
    for (const entry of recsQ.data?.colleges ?? []) {
      const id = entry.college?.id;
      if (id == null) continue;
      set.add(String(id));
    }
    return set;
  }, [recsQ.data]);

  // Pull the saved-items list so each search-result card can show a "Saved"
  // badge when the college is already in the user's plan. Mirrors the same
  // query used by the detail screen (cache invalidation already happens
  // there) so the badge stays in sync after any add/remove.
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

  // Saved-college ids stringified for stable lookups regardless of whether
  // the saved row stores the id as `collegeId` (preferred) or `id`.
  const savedCollegeIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of savedItemsQ.data?.colleges ?? []) {
      const id = row.collegeId ?? row.id;
      if (id != null) set.add(String(id));
    }
    return set;
  }, [savedItemsQ.data]);

  // Whether the user has any personalized college matches at all. The chip
  // only makes sense when there's at least one match to filter down to
  // (signed-out users typically have none).
  const hasMatches = recommendedIds.size > 0;

  // If the user enabled the "Matched to me" filter and then matches go away
  // (e.g. signing out), turn it back off so the list isn't stuck empty.
  useEffect(() => {
    if (matchedOnly && !hasMatches) setMatchedOnly(false);
  }, [matchedOnly, hasMatches]);

  // Refetch everything that drives the visible list: the search results,
  // the personalized college recs (drives the "Matched to me" chip), and
  // the saved-items lookup (drives the Saved badge).
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
    const list = data ?? [];
    if (!matchedOnly || !hasMatches) return list;
    return list.filter((c) => recommendedIds.has(String(c.id)));
  }, [data, matchedOnly, hasMatches, recommendedIds]);

  const totalCount = data?.length ?? 0;
  const visibleCount = filtered.length;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <ScreenHeader
        title="Colleges"
        subtitle="Search 32,000+ U.S. institutions"
      />

      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: colors.muted,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, city, or major"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.searchInput,
              { color: colors.foreground, fontFamily: SYSTEM_FONT, fontWeight: "400" },
            ]}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      </View>

      {hasMatches ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 4 }}
        >
          <Pressable
            onPress={() => setMatchedOnly((v) => !v)}
            style={({ pressed }) => [
              styles.matchedChip,
              {
                backgroundColor: matchedOnly ? colors.primary : colors.muted,
                borderColor: matchedOnly ? colors.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: matchedOnly }}
            accessibilityLabel="Filter to colleges matched to me"
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
        </ScrollView>
      ) : null}

      <View style={styles.countRow}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: SYSTEM_FONT,
            fontWeight: "500",
            fontSize: 12,
          }}
        >
          {isLoading
            ? "Loading…"
            : `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()} colleges`}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <EmptyState
            icon="alert-circle"
            title="Couldn't load colleges"
            message="Pull to refresh and try again."
          />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon="book-open"
            title={matchedOnly ? "No matched colleges here" : "No colleges match"}
            message={
              matchedOnly
                ? "Try a different search or turn off the matched filter."
                : "Try a different search term."
            }
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshing={isRefetching}
          onRefresh={() => void onManualRefresh()}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSaved = savedCollegeIds.has(String(item.id));
            return (
            <Card
              onPress={() =>
                router.push({
                  pathname: "/college/[id]",
                  params: { id: String(item.id) },
                })
              }
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: colors.accent },
                  ]}
                >
                  <Feather
                    name="book-open"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors.foreground,
                      fontFamily: SYSTEM_FONT, fontWeight: "600",
                      fontSize: 15,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: SYSTEM_FONT, fontWeight: "400",
                      fontSize: 13,
                      marginTop: 3,
                    }}
                  >
                    {[item.city, item.state].filter(Boolean).join(", ") ||
                      "United States"}
                  </Text>
                  <View style={styles.metaRow}>
                    {item.type ? (
                      <Pill icon="tag" text={item.type} />
                    ) : null}
                    {item.studentSize ? (
                      <Pill
                        icon="users"
                        text={`${item.studentSize.toLocaleString()} students`}
                      />
                    ) : null}
                    {isSaved ? <SavedBadge /> : null}
                  </View>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={colors.mutedForeground}
                />
              </View>
            </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Pill({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  text: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      <Feather name={icon} size={11} color={colors.mutedForeground} />
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: SYSTEM_FONT, fontWeight: "500",
          fontSize: 11,
        }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  matchedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
});
